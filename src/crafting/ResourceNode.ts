import * as THREE from 'three';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight } from '../world/Terrain';

export type ResourceNodeType =
  | 'fiber'
  | 'branch'
  | 'stone'
  | 'clay'
  | 'glowmoss'
  | 'shell'
  | 'moonpetal'
  | 'sparkle';

export interface ResourceNodeConfig {
  id: string;
  type: ResourceNodeType;
  item: string;
  x: number;
  z: number;
  /** One-off nodes (quest sparkles) never respawn. */
  oneOff?: boolean;
}

/** A gatherable spot in the world with a hand-built little mesh per type. */
export class ResourceNode {
  readonly group: THREE.Group;
  collected = false;
  respawnTimer = 0;

  constructor(readonly config: ResourceNodeConfig) {
    this.group = new THREE.Group();
    this.group.name = `node-${config.id}`;
    const y = terrainHeight(config.x, config.z);
    this.group.position.set(config.x, y, config.z);
    this.buildMesh(config.type);
  }

  get position(): THREE.Vector3 {
    return this.group.position.clone();
  }

  private buildMesh(type: ResourceNodeType): void {
    switch (type) {
      case 'fiber': {
        const mat = createToonMaterial('#cfe08a');
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.8, 5), mat);
          blade.position.set(Math.cos(i * 2.1) * 0.14, 0.4, Math.sin(i * 2.1) * 0.14);
          blade.rotation.z = Math.sin(i * 4) * 0.2;
          this.group.add(blade);
        }
        break;
      }
      case 'branch': {
        const mat = createToonMaterial('#8a6243');
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), mat);
        b1.rotation.z = Math.PI / 2.3;
        b1.position.y = 0.12;
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), mat);
        b2.rotation.set(0.4, 0, Math.PI / 1.7);
        b2.position.set(0.2, 0.1, 0.15);
        this.group.add(b1, b2);
        break;
      }
      case 'stone': {
        const mat = createToonMaterial('#aab4bd');
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 - i * 0.03, 0), mat);
          s.position.set(Math.cos(i * 2.4) * 0.2, 0.1, Math.sin(i * 2.4) * 0.2);
          this.group.add(s);
        }
        break;
      }
      case 'clay': {
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), createToonMaterial('#b07a5a'));
        mound.scale.y = 0.45;
        mound.position.y = 0.08;
        this.group.add(mound);
        break;
      }
      case 'glowmoss': {
        const mat = createToonMaterial('#8fe8b0', { emissive: '#4fdb8a', emissiveIntensity: 0.8 });
        for (let i = 0; i < 4; i++) {
          const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat);
          tuft.position.set(Math.cos(i * 1.7) * 0.22, 0.06, Math.sin(i * 1.7) * 0.22);
          tuft.scale.y = 0.6;
          this.group.add(tuft);
        }
        break;
      }
      case 'shell': {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI),
          createToonMaterial('#e8d8f0', { rimStrength: 0.4 })
        );
        shell.rotation.x = -Math.PI / 2.4;
        shell.position.y = 0.06;
        this.group.add(shell);
        break;
      }
      case 'moonpetal': {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), createToonMaterial('#5a7d62'));
        stem.position.y = 0.25;
        const bloom = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.14, 1),
          createToonMaterial('#cfd9ff', { emissive: '#8fa3ff', emissiveIntensity: 0.7 })
        );
        bloom.position.y = 0.55;
        this.group.add(stem, bloom);
        break;
      }
      case 'sparkle': {
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          createToonMaterial('#ffe9a8', { emissive: '#ffd76b', emissiveIntensity: 1.2 })
        );
        orb.position.y = 0.5;
        this.group.add(orb);
        break;
      }
    }
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  update(dt: number, t: number): boolean {
    // Sparkles bob and spin so they read as special pickups.
    if (this.config.type === 'sparkle' && !this.collected) {
      this.group.rotation.y = t * 2;
      this.group.children[0].position.y = 0.5 + Math.sin(t * 3) * 0.12;
    }
    if (this.collected && !this.config.oneOff) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.collected = false;
        this.group.visible = true;
        this.group.scale.setScalar(0.01);
      }
    }
    // Regrow animation.
    if (!this.collected && this.group.scale.x < 1) {
      this.group.scale.setScalar(Math.min(1, this.group.scale.x + dt * 1.5));
    }
    return this.collected;
  }
}
