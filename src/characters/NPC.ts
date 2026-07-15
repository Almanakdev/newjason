import * as THREE from 'three';
import { FSM } from '../utils/fsm';
import { angleDamp, dist2D, seededRandom } from '../utils/math';
import { terrainHeight } from '../world/Terrain';
import { createCharacter, makeNameTag, type CharacterRig } from '../player/CharacterFactory';
import { CharacterAnimator } from '../player/PlayerAnimator';
import type { NPCDef, NPCScheduleEntry } from '../types';

const NPC_WALK_SPEED = 1.7;

/**
 * A villager with a daily schedule, idle activities, weather/time awareness
 * and warm reactions to the player.
 */
export class NPC {
  readonly rig: CharacterRig;
  readonly animator: CharacterAnimator;
  private fsm: FSM<NPC>;
  private target = { x: 0, z: 0 };
  private wanderTimer = 0;
  private rng: () => number;
  private yaw = 0;
  private talking = false;
  private waveCooldown = 0;
  raining = false;

  constructor(
    readonly def: NPCDef,
    parent: THREE.Group
  ) {
    this.rig = createCharacter(def.appearance);
    this.animator = new CharacterAnimator(this.rig);
    this.rig.root.add(makeNameTag(def.name));
    const y = terrainHeight(def.home.x, def.home.z);
    this.rig.root.position.set(def.home.x, y, def.home.z);
    this.target = { x: def.home.x, z: def.home.z };
    parent.add(this.rig.root);
    this.rng = seededRandom(def.id.length * 7919 + def.home.x * 31);

    this.fsm = new FSM<NPC>(this)
      .add('idle', {
        update: (npc, _dt) => {
          if (npc.fsm.timeInState > 4 + npc.rng() * 6) npc.fsm.set('wander');
        },
      })
      .add('wander', {
        enter: (npc) => npc.pickWanderTarget(),
        update: (npc) => {
          if (npc.arrived()) npc.fsm.set('idle');
        },
      })
      .add('walkTo', {
        update: (npc) => {
          if (npc.arrived()) npc.fsm.set('activity');
        },
      })
      .add('activity', {
        enter: (npc) => npc.startActivityPose(),
        update: (npc) => {
          const entry = npc.activeSchedule();
          if (entry?.activity === 'work' && npc.fsm.timeInState % 4 < 0.05) {
            npc.animator.playAction('craft');
          }
        },
        exit: (npc) => npc.animator.stopAction(),
      })
      .add('talk', {
        enter: (npc) => npc.animator.stopAction(),
      });
    this.fsm.set('idle');
  }

  get position(): THREE.Vector3 {
    return this.rig.root.position.clone();
  }

  get id(): string {
    return this.def.id;
  }

  startTalking(): void {
    this.talking = true;
    this.fsm.set('talk');
  }

  stopTalking(): void {
    this.talking = false;
    this.fsm.set('idle');
  }

  /** Wave back when the player emotes nearby. */
  reactToEmote(): void {
    if (this.waveCooldown <= 0 && !this.talking) {
      this.animator.playAction('wave');
      this.waveCooldown = 10;
    }
  }

  private activeSchedule(): NPCScheduleEntry | null {
    return this.currentSchedule;
  }

  private currentSchedule: NPCScheduleEntry | null = null;

  private pickWanderTarget(): void {
    const base = this.currentSchedule ?? { x: this.def.home.x, z: this.def.home.z };
    this.target = {
      x: base.x + (this.rng() - 0.5) * 7,
      z: base.z + (this.rng() - 0.5) * 7,
    };
  }

  private arrived(): boolean {
    const p = this.rig.root.position;
    return dist2D(p.x, p.z, this.target.x, this.target.z) < 0.4;
  }

  private startActivityPose(): void {
    const entry = this.currentSchedule;
    if (!entry) return;
    if (entry.activity === 'sit') this.animator.playAction('sit', Infinity);
  }

  update(dt: number, t: number, timeOfDay: number, playerPos: THREE.Vector3): void {
    if (this.waveCooldown > 0) this.waveCooldown -= dt;

    // Resolve schedule (rain sends most villagers toward home/cover).
    let entry: NPCScheduleEntry | null = null;
    for (const s of this.def.schedule) {
      const inWindow =
        s.start <= s.end
          ? timeOfDay >= s.start && timeOfDay < s.end
          : timeOfDay >= s.start || timeOfDay < s.end;
      if (inWindow) {
        entry = s;
        break;
      }
    }
    if (this.raining && entry && entry.activity !== 'sleep') {
      entry = { ...entry, x: this.def.home.x, z: this.def.home.z, activity: 'idle' };
    }

    const changed =
      entry !== this.currentSchedule &&
      (entry?.x !== this.currentSchedule?.x ||
        entry?.z !== this.currentSchedule?.z ||
        entry?.activity !== this.currentSchedule?.activity);
    this.currentSchedule = entry;

    // Sleeping villagers are home with the lights on.
    const sleeping = entry?.activity === 'sleep';
    this.rig.root.visible = !sleeping;
    if (sleeping) return;

    if (changed && entry && !this.talking) {
      this.target = { x: entry.x, z: entry.z };
      this.fsm.set('walkTo');
    }

    // Movement toward target.
    const p = this.rig.root.position;
    const dx = this.target.x - p.x;
    const dz = this.target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const moving =
      !this.talking &&
      dist > 0.35 &&
      (this.fsm.state === 'walkTo' || this.fsm.state === 'wander');
    if (moving) {
      const step = Math.min(dist, NPC_WALK_SPEED * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 10, dt);
      this.animator.setLocomotion('walk');
      this.animator.setSpeedFactor(0.7);
    } else {
      this.animator.setLocomotion('idle');
      // Face the player when they're close (or always while talking).
      const pd = dist2D(p.x, p.z, playerPos.x, playerPos.z);
      if (this.talking || pd < 3.2) {
        this.yaw = angleDamp(this.yaw, Math.atan2(playerPos.x - p.x, playerPos.z - p.z), 6, dt);
      }
    }
    p.y = terrainHeight(p.x, p.z);
    this.rig.root.rotation.y = this.yaw;

    this.fsm.update(dt);
    this.animator.update(dt, t);
  }
}
