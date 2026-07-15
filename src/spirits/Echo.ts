import * as THREE from 'three';
import { FSM } from '../utils/fsm';
import { angleDamp, dist2D, seededRandom } from '../utils/math';
import { terrainHeight } from '../world/Terrain';
import { createToonMaterial } from '../shaders/toon';
import type { SpiritDef } from '../types';

/**
 * Echoes — original spirit creatures of Aeralume. Small, rounded, glowing.
 * Players never capture them: they soothe, befriend and guide them.
 */
export class Echo {
  readonly group: THREE.Group;
  private body: THREE.Mesh;
  private bodyMat: THREE.MeshToonMaterial;
  private glowLight: THREE.PointLight;
  private fsm: FSM<Echo>;
  private rng: () => number;
  private homeX: number;
  private homeZ: number;
  private target = { x: 0, z: 0 };
  private yaw = 0;
  private baseColor: THREE.Color;
  private distressColor = new THREE.Color('#8a8f9e');
  calmed = false;
  distressed = false;
  private celebrateTimer = 0;

  constructor(
    readonly def: SpiritDef,
    parent: THREE.Group
  ) {
    this.rng = seededRandom(def.id.length * 131 + 17);
    this.homeX = def.spawn.x;
    this.homeZ = def.spawn.z;
    this.target = { x: this.homeX, z: this.homeZ };
    this.baseColor = new THREE.Color(def.palette.body);

    this.group = new THREE.Group();
    this.group.name = `echo-${def.id}`;

    // Body: soft rounded blob, squashed for friendliness.
    this.bodyMat = createToonMaterial(def.palette.body, {
      emissive: def.palette.glow,
      emissiveIntensity: 0.3,
      rimStrength: 0.45,
      rimColor: def.palette.glow,
    });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), this.bodyMat);
    this.body.scale.set(1, 0.85, 1);
    this.body.castShadow = true;
    this.group.add(this.body);

    // Belly patch.
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      createToonMaterial(def.palette.accent)
    );
    belly.scale.set(1, 0.8, 0.5);
    belly.position.set(0, -0.05, 0.16);
    this.body.add(belly);

    // Big glossy eyes.
    const eyeMat = createToonMaterial('#2b2233', { emissive: '#ffffff', emissiveIntensity: 0.06 });
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
      eye.position.set(0.11 * side, 0.08, 0.26);
      this.body.add(eye);
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 4),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      shine.position.set(0.1 * side + 0.02, 0.1, 0.3);
      this.body.add(shine);
    }

    // Variant features — original silhouettes per family.
    const accentMat = createToonMaterial(def.palette.accent, {
      emissive: def.palette.glow,
      emissiveIntensity: 0.25,
    });
    if (def.variant === 'meadow') {
      // Leaf-shaped ears + sprout on top.
      for (const side of [-1, 1] as const) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 5), accentMat);
        ear.position.set(0.18 * side, 0.28, 0);
        ear.rotation.z = side * -0.6;
        this.body.add(ear);
      }
      const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), accentMat);
      sprout.position.set(0, 0.34, 0);
      this.body.add(sprout);
    } else if (def.variant === 'river') {
      // Fin crest + wavy tail.
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), accentMat);
      crest.rotation.x = -0.4;
      crest.position.set(0, 0.3, -0.05);
      this.body.add(crest);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), accentMat);
      tail.rotation.x = Math.PI * 0.6;
      tail.position.set(0, 0, -0.34);
      this.body.add(tail);
    } else if (def.variant === 'hearth') {
      // Little ember wisp above the head.
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), accentMat);
      wisp.position.set(0, 0.4, 0);
      this.body.add(wisp);
    }

    // Seed markings that glow.
    const markMat = new THREE.MeshBasicMaterial({ color: def.palette.glow });
    for (let i = 0; i < 4; i++) {
      const mark = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), markMat);
      const a = (i / 4) * Math.PI * 2 + 0.5;
      mark.position.set(Math.cos(a) * 0.26, -0.08 + Math.sin(i * 2.1) * 0.08, Math.sin(a) * 0.26);
      this.body.add(mark);
    }

    this.glowLight = new THREE.PointLight(def.palette.glow, 0.7, 4, 2);
    this.glowLight.position.y = 0.3;
    this.group.add(this.glowLight);

    const y = terrainHeight(this.homeX, this.homeZ);
    this.group.position.set(this.homeX, y + 0.45, this.homeZ);
    parent.add(this.group);

    this.fsm = new FSM<Echo>(this)
      .add('idle', {
        update: (e) => {
          if (e.fsm.timeInState > 3 + e.rng() * 5) e.fsm.set('wander');
        },
      })
      .add('wander', {
        enter: (e) => {
          e.target = {
            x: e.homeX + (e.rng() - 0.5) * 10,
            z: e.homeZ + (e.rng() - 0.5) * 10,
          };
        },
        update: (e) => {
          if (e.arrived()) e.fsm.set('idle');
        },
      })
      .add('observe', {})
      .add('approach', {})
      .add('distressed', {})
      .add('celebrate', {
        enter: (e) => (e.celebrateTimer = 3),
      })
      .add('follow', {})
      .add('sleep', {});
    this.fsm.set('idle');
  }

  get state(): string {
    return this.fsm.state;
  }

  get position(): THREE.Vector3 {
    return this.group.position.clone();
  }

  setDistressed(value: boolean): void {
    this.distressed = value;
    if (value) this.fsm.set('distressed');
    else if (this.fsm.state === 'distressed') this.fsm.set('idle');
  }

  calm(): void {
    this.calmed = true;
    this.distressed = false;
    this.fsm.set('celebrate');
  }

  private arrived(): boolean {
    return dist2D(this.group.position.x, this.group.position.z, this.target.x, this.target.z) < 0.3;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, isNight: boolean): void {
    // Night-only spirits fade out during the day.
    if (this.def.nightOnly) {
      this.group.visible = isNight;
      if (!isNight) return;
    }

    const p = this.group.position;
    const pd = dist2D(p.x, p.z, playerPos.x, playerPos.z);

    // Social state transitions.
    if (!this.distressed && this.fsm.state !== 'celebrate') {
      if (this.calmed && pd < 6 && pd > 1.6) this.fsm.set('follow');
      else if (this.calmed && this.fsm.state === 'follow' && pd <= 1.6) this.fsm.set('observe');
      else if (!this.calmed && pd < 5) this.fsm.set('observe');
      else if (this.fsm.state === 'observe' && pd >= 6) this.fsm.set('idle');
    }

    // Movement.
    if (this.fsm.state === 'wander') {
      const dx = this.target.x - p.x;
      const dz = this.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const step = Math.min(dist, 1.1 * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
      }
    } else if (this.fsm.state === 'follow' && pd > 1.6) {
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(dist - 1.4, 2.2 * dt);
      if (step > 0) {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
      }
      this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
    } else if (this.fsm.state === 'observe') {
      this.yaw = angleDamp(this.yaw, Math.atan2(playerPos.x - p.x, playerPos.z - p.z), 6, dt);
    }
    this.group.rotation.y = this.yaw;

    // Float above the ground with a gentle bob (shiver when distressed).
    const groundY = terrainHeight(p.x, p.z);
    const bob = this.distressed
      ? Math.sin(t * 22) * 0.02 + 0.35
      : 0.45 + Math.sin(t * 2 + this.homeX) * 0.08;
    p.y = groundY + bob;

    // Visual state: distressed Echoes desaturate; calm ones glow warmly.
    const targetColor = this.distressed ? this.distressColor : this.baseColor;
    this.bodyMat.color.lerp(targetColor, Math.min(1, dt * 3));
    const pulse = this.fsm.state === 'celebrate' ? 1.4 : this.calmed ? 0.7 : 0.35;
    this.bodyMat.emissiveIntensity = pulse * (0.75 + Math.sin(t * 3) * 0.25);
    this.glowLight.intensity = pulse * (0.6 + Math.sin(t * 3.3) * 0.2);

    if (this.fsm.state === 'celebrate') {
      this.group.rotation.y += dt * 6;
      this.celebrateTimer -= dt;
      if (this.celebrateTimer <= 0) this.fsm.set('idle');
    }

    this.fsm.update(dt);
  }
}
