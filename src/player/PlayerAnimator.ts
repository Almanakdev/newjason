import { damp, lerp } from '../utils/math';
import type { CharacterRig } from './CharacterFactory';

export type LocomotionState = 'idle' | 'walk' | 'jog' | 'jump' | 'fall' | 'land';
export type ActionName =
  | 'gather'
  | 'craft'
  | 'fish'
  | 'sit'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'laugh'
  | 'heart'
  | 'carry'
  | 'hug';

interface Pose {
  armLX: number; armLZ: number;
  armRX: number; armRZ: number;
  legLX: number; legRX: number;
  torsoX: number; torsoY: number;
  headX: number; headY: number;
  hipsY: number;
}

const REST: Pose = {
  armLX: 0, armLZ: -0.12,
  armRX: 0, armRZ: 0.12,
  legLX: 0, legRX: 0,
  torsoX: 0, torsoY: 0,
  headX: 0, headY: 0,
  hipsY: 0,
};

/**
 * Procedural full-body animation with smooth blending. Locomotion drives the
 * legs; actions/emotes override the upper body (and sometimes everything).
 * Swappable later for THREE.AnimationMixer clips from GLB files — the
 * controller only talks to this class's small API.
 */
export class CharacterAnimator {
  private loco: LocomotionState = 'idle';
  private action: { name: ActionName; elapsed: number; duration: number } | null = null;
  private walkPhase = 0;
  private speedFactor = 0;
  private applied: Pose = { ...REST };
  private landTimer = 0;
  /** Fired each time a foot plants while walking (for footstep audio). */
  onStep: (() => void) | null = null;

  constructor(private rig: CharacterRig) {}

  setLocomotion(state: LocomotionState): void {
    if (state === 'land' && this.loco !== 'land') this.landTimer = 0.18;
    this.loco = state;
  }

  get locomotion(): LocomotionState {
    return this.loco;
  }

  setSpeedFactor(f: number): void {
    this.speedFactor = f;
  }

  playAction(name: ActionName, duration = this.defaultDuration(name)): void {
    this.action = { name, elapsed: 0, duration };
  }

  stopAction(): void {
    this.action = null;
  }

  get currentAction(): ActionName | null {
    return this.action?.name ?? null;
  }

  private defaultDuration(name: ActionName): number {
    switch (name) {
      case 'gather': return 1.1;
      case 'craft': return 1.8;
      case 'wave': return 1.8;
      case 'cheer': return 1.5;
      case 'laugh': return 1.6;
      case 'heart': return 1.8;
      case 'hug': return 1.6;
      case 'dance': return 5;
      default: return Infinity; // fish, sit, carry hold until stopped
    }
  }

  update(dt: number, t: number): void {
    const target: Pose = { ...REST };

    /* ---- locomotion layer ---- */
    switch (this.loco) {
      case 'idle':
        target.torsoX = Math.sin(t * 1.6) * 0.02;
        target.armLX = Math.sin(t * 1.4) * 0.03;
        target.armRX = Math.sin(t * 1.4 + 1) * 0.03;
        target.headY = Math.sin(t * 0.6) * 0.07;
        break;
      case 'walk':
      case 'jog': {
        const jog = this.loco === 'jog';
        const freq = jog ? 10.5 : 7.0;
        const prevPhase = this.walkPhase;
        this.walkPhase += dt * freq * Math.max(0.4, this.speedFactor);
        if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) {
          this.onStep?.();
        }
        const legAmp = jog ? 0.85 : 0.5;
        const armAmp = jog ? 0.65 : 0.35;
        const s = Math.sin(this.walkPhase);
        target.legLX = s * legAmp;
        target.legRX = -s * legAmp;
        target.armLX = -s * armAmp;
        target.armRX = s * armAmp;
        target.torsoX = jog ? 0.17 : 0.06;
        target.hipsY = -Math.abs(Math.cos(this.walkPhase)) * (jog ? 0.055 : 0.035);
        break;
      }
      case 'jump':
        target.legLX = -0.5;
        target.legRX = -0.25;
        target.armLZ = -0.9;
        target.armRZ = 0.9;
        target.torsoX = -0.06;
        break;
      case 'fall':
        target.armLZ = -1.7;
        target.armRZ = 1.7;
        target.legLX = 0.3;
        target.legRX = -0.2;
        break;
      case 'land':
        target.hipsY = -0.16;
        target.torsoX = 0.3;
        target.armLX = -0.4;
        target.armRX = -0.4;
        break;
    }
    if (this.landTimer > 0) this.landTimer -= dt;

    /* ---- action / emote layer (upper body or full override) ---- */
    if (this.action) {
      this.action.elapsed += dt;
      const act = this.action;
      const p = Math.min(1, act.elapsed / (act.duration === Infinity ? 1 : act.duration));
      switch (act.name) {
        case 'gather':
          target.torsoX = 0.65;
          target.hipsY = -0.2;
          target.armRX = -0.6 - Math.sin(p * Math.PI) * 0.7;
          target.armLX = -0.35;
          target.headX = 0.4;
          break;
        case 'craft':
          target.torsoX = 0.28;
          target.armRX = -1.15 + Math.sin(act.elapsed * 11) * 0.45;
          target.armLX = -0.5;
          target.headX = 0.3;
          break;
        case 'fish':
          target.armRX = -1.35;
          target.armLX = -0.55;
          target.torsoX = 0.1;
          break;
        case 'sit':
          target.hipsY = -0.42;
          target.legLX = -1.5;
          target.legRX = -1.5;
          target.torsoX = 0.06;
          target.armLX = -0.35;
          target.armRX = -0.35;
          break;
        case 'wave':
          target.armRZ = 2.35;
          target.armRX = -0.2 + Math.sin(act.elapsed * 9) * 0.18;
          target.headY = 0.15;
          break;
        case 'dance':
          target.torsoY = Math.sin(act.elapsed * 4.2) * 0.45;
          target.armLX = Math.sin(act.elapsed * 4.2) * 0.9 - 0.5;
          target.armRX = -Math.sin(act.elapsed * 4.2) * 0.9 - 0.5;
          target.armLZ = -0.6;
          target.armRZ = 0.6;
          target.hipsY = -Math.abs(Math.sin(act.elapsed * 8.4)) * 0.07;
          break;
        case 'cheer':
          target.armLZ = -2.5;
          target.armRZ = 2.5;
          target.hipsY = -Math.abs(Math.sin(act.elapsed * 9)) * 0.09;
          target.headX = -0.15;
          break;
        case 'laugh':
          target.torsoX = 0.12 + Math.sin(act.elapsed * 13) * 0.05;
          target.headX = -0.18;
          target.armLX = -0.85;
          target.armRX = -0.85;
          break;
        case 'heart':
          target.armLX = -1.2;
          target.armRX = -1.2;
          target.armLZ = -0.8;
          target.armRZ = 0.8;
          target.headX = 0.1;
          break;
        case 'carry':
          target.armLX = -1.05;
          target.armRX = -1.05;
          break;
        case 'hug':
          target.armLX = -0.9;
          target.armRX = -0.9;
          target.armLZ = -0.45;
          target.armRZ = 0.45;
          break;
      }
      if (act.elapsed >= act.duration) this.action = null;
    }

    /* ---- blend applied pose toward target ---- */
    const k = 12;
    const a = this.applied;
    for (const key of Object.keys(a) as (keyof Pose)[]) {
      a[key] = damp(a[key], target[key], k, dt);
    }

    const r = this.rig;
    r.armL.rotation.set(a.armLX, 0, a.armLZ);
    r.armR.rotation.set(a.armRX, 0, a.armRZ);
    r.legL.rotation.x = a.legLX;
    r.legR.rotation.x = a.legRX;
    r.torso.rotation.set(a.torsoX, a.torsoY, 0);
    r.head.rotation.set(a.headX, a.headY, 0);
    r.hips.position.y = r.hipHeight + a.hipsY;
  }

  /** Used by NPC seating and network players to hard-set a pose factor. */
  lerpToPoseImmediate(fraction: number): void {
    const a = this.applied;
    for (const key of Object.keys(a) as (keyof Pose)[]) {
      a[key] = lerp(a[key], REST[key], fraction);
    }
  }
}
