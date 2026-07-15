import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { angleDamp, damp } from '../utils/math';
import { terrainHeight, terrainSurface } from '../world/Terrain';
import { createCharacter, makeNameTag, type CharacterRig } from './CharacterFactory';
import { CharacterAnimator, type ActionName } from './PlayerAnimator';
import type { Physics, CharacterHandle } from '../physics/Physics';
import type { InputManager } from '../core/InputManager';
import type { AudioManager } from '../core/AudioManager';
import type { Appearance } from '../types';

const CAPSULE_HALF = 0.82; // capsule halfHeight + radius (matches Physics.createCharacter)

/**
 * Kinematic third-person character controller: smooth accel/decel,
 * camera-relative movement, jumping, slope + step handling via Rapier's
 * character controller, land recovery and footstep audio.
 */
export class PlayerController {
  rig: CharacterRig;
  animator: CharacterAnimator;
  private handle: CharacterHandle;
  private velocity = new THREE.Vector3();
  private vy = 0;
  private grounded = true;
  private wasAirborne = false;
  private landHold = 0;
  private visualYaw: number;
  /** Founder nameplate above the head. Survives appearance rebuilds. */
  private nameTag: THREE.Sprite | null = null;
  private nameTagText = '';
  /** Gameplay systems (dialogue, fishing, build mode) can freeze input. */
  inputEnabled = true;

  constructor(
    private physics: Physics,
    parent: THREE.Group,
    private audio: AudioManager,
    appearance: Appearance,
    spawn: { x: number; y: number; z: number },
    yaw: number
  ) {
    this.rig = createCharacter(appearance, { outline: true });
    this.animator = new CharacterAnimator(this.rig);
    this.visualYaw = yaw;
    this.rig.root.rotation.y = yaw;
    parent.add(this.rig.root);

    const groundY = terrainHeight(spawn.x, spawn.z);
    const startY = Math.max(spawn.y, groundY + 0.2) + CAPSULE_HALF;
    this.handle = physics.createCharacter(spawn.x, startY, spawn.z);
    this.rig.root.position.set(spawn.x, startY - CAPSULE_HALF, spawn.z);

    this.bindFootsteps();
  }

  private bindFootsteps(): void {
    this.animator.onStep = () => {
      const p = this.position;
      this.audio.playSfx(terrainSurface(p.x, p.z) === 'stone' ? 'footstep_stone' : 'footstep_grass');
    };
  }

  /**
   * Founder nameplate above the character. Pink so the player reads as
   * distinct from NPCs (ink) and other players (green).
   */
  setName(name: string): void {
    this.nameTagText = name;
    this.disposeNameTag();
    if (!name) return;
    this.nameTag = makeNameTag(name, '#ec4380');
    this.rig.root.add(this.nameTag);
  }

  private disposeNameTag(): void {
    if (!this.nameTag) return;
    this.nameTag.removeFromParent();
    this.nameTag.material.map?.dispose();
    this.nameTag.material.dispose();
    this.nameTag = null;
  }

  /** Swap the character's look (used by the tailor's re-customization). */
  rebuildAppearance(appearance: Appearance): void {
    const parent = this.rig.root.parent;
    const pos = this.rig.root.position.clone();
    parent?.remove(this.rig.root);
    // The tag is parented to the old rig root, so it dies with it — rebuild it
    // against the new rig below rather than letting it silently disappear.
    this.disposeNameTag();
    this.rig = createCharacter(appearance, { outline: true });
    this.rig.root.position.copy(pos);
    this.rig.root.rotation.y = this.visualYaw;
    parent?.add(this.rig.root);
    this.animator = new CharacterAnimator(this.rig);
    this.bindFootsteps();
    if (this.nameTagText) this.setName(this.nameTagText);
  }

  /** Feet position in world space. */
  get position(): THREE.Vector3 {
    const t = this.handle.body.translation();
    return new THREE.Vector3(t.x, t.y - CAPSULE_HALF, t.z);
  }

  get headPosition(): THREE.Vector3 {
    return this.position.add(new THREE.Vector3(0, 1.4, 0));
  }

  get yaw(): number {
    return this.visualYaw;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  playAction(name: ActionName, duration?: number): void {
    this.animator.playAction(name, duration);
  }

  stopAction(): void {
    this.animator.stopAction();
  }

  teleportTo(x: number, z: number): void {
    const y = terrainHeight(x, z) + 0.3 + CAPSULE_HALF;
    this.handle.body.setNextKinematicTranslation({ x, y, z });
    this.rig.root.position.set(x, y - CAPSULE_HALF, z);
  }

  update(dt: number, t: number, input: InputManager, cameraYaw: number): void {
    const cfg = GameConfig;
    let mx = 0;
    let mz = 0;
    if (this.inputEnabled) {
      const mv = input.moveVector();
      mx = mv.x;
      mz = mv.z;
    }

    // Camera-relative movement basis.
    const fwdX = -Math.sin(cameraYaw);
    const fwdZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const dirX = fwdX * -mz + rightX * mx;
    const dirZ = fwdZ * -mz + rightZ * mx;
    const mag = Math.min(1, Math.hypot(dirX, dirZ));

    const jog = input.jogHeld();
    const targetSpeed = mag * (jog ? cfg.jogSpeed : cfg.walkSpeed);
    const lambda = targetSpeed > this.horizontalSpeed ? cfg.acceleration : cfg.deceleration;
    let ndx = 0;
    let ndz = 0;
    if (mag > 0.01) {
      const invMag = 1 / Math.max(0.0001, Math.hypot(dirX, dirZ));
      ndx = dirX * invMag;
      ndz = dirZ * invMag;
    } else if (this.horizontalSpeed > 0.01) {
      ndx = this.velocity.x / this.horizontalSpeed;
      ndz = this.velocity.z / this.horizontalSpeed;
    }
    const speed = damp(this.horizontalSpeed, targetSpeed, lambda, dt);
    this.velocity.x = ndx * speed;
    this.velocity.z = ndz * speed;

    // Vertical motion.
    if (this.grounded) {
      if (this.inputEnabled && !input.uiMode && input.consumeAction('jump') && !this.animator.currentAction) {
        this.vy = cfg.jumpVelocity;
        this.grounded = false;
        this.audio.playSfx('ui');
      } else {
        this.vy = -2; // keep snapped to slopes
      }
    } else {
      this.vy += cfg.gravity * dt;
    }

    const result = this.physics.moveCharacter(
      this.handle,
      this.velocity.x * dt,
      this.vy * dt,
      this.velocity.z * dt
    );
    const nowGrounded = result.grounded;
    if (!this.grounded && nowGrounded) {
      // landing
      if (this.vy < -6) {
        this.landHold = 0.2;
        this.audio.playSfx('gather');
      }
      this.vy = -2;
    }
    this.wasAirborne = !nowGrounded;
    this.grounded = nowGrounded;
    if (this.landHold > 0) this.landHold -= dt;

    // Safety net — never fall out of the world.
    const bt = this.handle.body.translation();
    if (bt.y < -20) this.teleportTo(0, 12);

    // Sync visuals.
    const feetY = this.handle.body.translation().y - CAPSULE_HALF;
    const pos = this.handle.body.translation();
    this.rig.root.position.set(pos.x, feetY, pos.z);
    if (mag > 0.05) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.visualYaw = angleDamp(this.visualYaw, targetYaw, GameConfig.turnSpeed, dt);
    }
    this.rig.root.rotation.y = this.visualYaw;

    // Animation state.
    const hs = this.horizontalSpeed;
    if (!this.grounded) {
      this.animator.setLocomotion(this.vy > 0.5 ? 'jump' : 'fall');
    } else if (this.landHold > 0) {
      this.animator.setLocomotion('land');
    } else if (hs > cfg.walkSpeed + 0.8) {
      this.animator.setLocomotion('jog');
    } else if (hs > 0.25) {
      this.animator.setLocomotion('walk');
    } else {
      this.animator.setLocomotion('idle');
    }
    this.animator.setSpeedFactor(Math.min(1, hs / cfg.jogSpeed + 0.4));
    this.animator.update(dt, t);
  }
}
