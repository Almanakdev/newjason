import * as THREE from 'three';
import { createCharacter, makeNameTag, type CharacterRig } from '../player/CharacterFactory';
import { CharacterAnimator, type ActionName } from '../player/PlayerAnimator';
import { SnapshotBuffer, type PlayerSnapshot } from './StateInterpolation';
import type { Appearance } from '../types';

/** Visual proxy for a remote player, driven by interpolated snapshots. */
export class NetworkPlayer {
  readonly rig: CharacterRig;
  readonly animator: CharacterAnimator;
  readonly buffer = new SnapshotBuffer();
  private lastPos = new THREE.Vector3();

  constructor(
    readonly id: string,
    readonly name: string,
    appearance: Appearance,
    parent: THREE.Group
  ) {
    this.rig = createCharacter(appearance);
    this.animator = new CharacterAnimator(this.rig);
    this.rig.root.add(makeNameTag(name, '#4f7d62'));
    parent.add(this.rig.root);
  }

  pushSnapshot(snap: PlayerSnapshot): void {
    this.buffer.push(snap);
  }

  playEmote(action: ActionName): void {
    this.animator.playAction(action);
  }

  update(dt: number, t: number, renderTime: number): void {
    const s = this.buffer.sample(renderTime);
    if (s) {
      const speed = this.lastPos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) / Math.max(dt, 0.001);
      this.rig.root.position.set(s.x, s.y, s.z);
      this.rig.root.rotation.y = s.yaw;
      this.lastPos.set(s.x, s.y, s.z);
      if (!this.animator.currentAction) {
        this.animator.setLocomotion(speed > 4 ? 'jog' : speed > 0.3 ? 'walk' : 'idle');
        this.animator.setSpeedFactor(Math.min(1, speed / 5));
      }
    }
    this.animator.update(dt, t);
  }

  dispose(parent: THREE.Group): void {
    parent.remove(this.rig.root);
  }
}
