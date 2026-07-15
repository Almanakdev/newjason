import * as THREE from 'three';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight } from './Terrain';
import { POI } from '../utils/constants';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { WorldCtx } from './Props';

interface Waylight {
  id: string;
  group: THREE.Group;
  crystal: THREE.Mesh;
  crystalMat: THREE.MeshToonMaterial;
  rings: THREE.Mesh[];
  beam: THREE.Mesh;
  light: THREE.PointLight;
  restored: boolean;
  restoreAnim: number; // 0..1 during the restoration sequence
}

/**
 * Waylights — the ancient beacons that reconnect Aeralume. The village tower
 * is the chapter-one restoration target.
 */
export class WaylightSystem {
  private waylights = new Map<string, Waylight>();

  constructor(
    private bus: EventBus,
    private audio: AudioManager
  ) {}

  buildVillageTower(ctx: WorldCtx): void {
    const { x, z } = POI.waylightTower;
    const y = terrainHeight(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = 'waylight-village';

    const stone = createToonMaterial('#b9c2cc');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 1.1, 10), stone);
    base.position.y = 0.55;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 4.6, 9), createToonMaterial('#cdd5de'));
    column.position.y = 3.3;
    column.castShadow = true;
    g.add(column);

    // Carved swirls hinted with a darker band.
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 8, 18), createToonMaterial('#8fa0b5'));
    band.rotation.x = Math.PI / 2;
    band.position.y = 2.4;
    g.add(band);

    const crystalMat = createToonMaterial('#7fd8d0', {
      emissive: '#1f6a66',
      emissiveIntensity: 0.25,
      rimStrength: 0.5,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), crystalMat);
    crystal.position.y = 6.6;
    g.add(crystal);

    const ringMat = createToonMaterial('#d9e6f2', { emissive: '#7fd8d0', emissiveIntensity: 0.15 });
    const rings: THREE.Mesh[] = [];
    for (const [r, ry] of [[1.25, 6.0], [0.95, 7.3]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 24), ringMat);
      ring.position.y = ry;
      ring.rotation.x = Math.PI / 2.4;
      rings.push(ring);
      g.add(ring);
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.7, 44, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#9ff0e8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 26;
    g.add(beam);

    const light = new THREE.PointLight('#7fd8d0', 0, 26, 1.4);
    light.position.y = 6.6;
    g.add(light);

    ctx.group.add(g);
    ctx.physics.addCylinder(x, y + 0.8, z, 0.8, 2.0);
    ctx.blockers.push(base);

    this.waylights.set('village_waylight', {
      id: 'village_waylight',
      group: g,
      crystal,
      crystalMat,
      rings,
      beam,
      light,
      restored: false,
      restoreAnim: 0,
    });
  }

  isRestored(id: string): boolean {
    return this.waylights.get(id)?.restored ?? false;
  }

  get restoredIds(): string[] {
    return Array.from(this.waylights.values())
      .filter((w) => w.restored)
      .map((w) => w.id);
  }

  applySave(restored: string[]): void {
    for (const id of restored) {
      const w = this.waylights.get(id);
      if (w) {
        w.restored = true;
        w.restoreAnim = 1;
      }
    }
  }

  restore(id: string): void {
    const w = this.waylights.get(id);
    if (!w || w.restored) return;
    w.restored = true;
    this.audio.playSfx('chime');
    this.bus.emit('waylight:restored', { id });
    this.bus.emit('notify', { text: 'The Signal Tower hums back to life!', icon: '✨' });
  }

  update(dt: number, t: number): void {
    for (const w of this.waylights.values()) {
      if (w.restored && w.restoreAnim < 1) {
        w.restoreAnim = Math.min(1, w.restoreAnim + dt * 0.5);
      }
      const a = w.restoreAnim;
      w.crystal.rotation.y = t * (0.3 + a * 1.2);
      w.crystal.position.y = 6.6 + Math.sin(t * 1.3) * (0.08 + a * 0.18);
      w.crystalMat.emissiveIntensity = 0.25 + a * (1.1 + Math.sin(t * 2.2) * 0.25);
      w.rings.forEach((ring, i) => {
        ring.rotation.z = t * (0.4 + i * 0.3) * (0.3 + a);
        ring.position.y = (i === 0 ? 6.0 : 7.3) + Math.sin(t * 1.1 + i * 2) * 0.12 * (0.5 + a);
      });
      const beamMat = w.beam.material as THREE.MeshBasicMaterial;
      beamMat.opacity = a * (0.22 + Math.sin(t * 1.8) * 0.06);
      w.light.intensity = a * (2.2 + Math.sin(t * 2.5) * 0.5);
    }
  }
}
