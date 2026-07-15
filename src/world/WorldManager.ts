import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { SceneManager } from '../core/SceneManager';
import type { AssetManager } from '../core/AssetManager';
import type { Physics } from '../physics/Physics';
import { buildTerrain, terrainHeight, isOpenMeadow, POND, RIVER_POINTS } from './Terrain';
import { buildVillage } from './VillageBuilder';
import { buildValley } from './ValleyBuilder';
import { makeKarstPeak } from './Props';
import { SkyDome } from '../shaders/sky';
import { WaterSurface } from '../shaders/water';
import { GrassField, FlowerField, PollenParticles } from '../shaders/grass';
import type { WorldCtx } from './Props';
import { POI } from '../utils/constants';

/**
 * Builds and updates the streamed world. Regions are grouped so distant ones
 * can be culled cheaply; the terrain itself is a single seamless mesh so
 * there are never visible seams between regions.
 */
export class WorldManager {
  readonly ctx: WorldCtx;
  readonly sky: SkyDome;
  private waters: WaterSurface[] = [];
  private grassFields: GrassField[] = [];
  private flowerFields: FlowerField[] = [];
  private pollen: PollenParticles[] = [];
  private regions: { group: THREE.Group; center: THREE.Vector2; radius: number }[] = [];

  constructor(
    private sceneMgr: SceneManager,
    physics: Physics,
    assets: AssetManager,
    private bus: EventBus
  ) {
    this.ctx = {
      group: sceneMgr.worldGroup,
      physics,
      blockers: sceneMgr.cameraBlockers,
      nightGlow: [],
      lampLights: [],
      animated: [],
      assets,
    };
    this.sky = new SkyDome();
    sceneMgr.scene.add(this.sky.mesh);
  }

  build(): void {
    // Terrain (visual + physics share vertices).
    const terrain = buildTerrain();
    this.sceneMgr.worldGroup.add(terrain.mesh);
    this.sceneMgr.addCameraBlocker(terrain.mesh);
    this.ctx.physics.addTrimesh(terrain.vertices, terrain.indices);

    // Water: village pond.
    const pond = new WaterSurface(new THREE.CircleGeometry(POND.radius + 1.2, 24));
    pond.mesh.position.set(POND.x, POND.waterY, POND.z);
    this.sceneMgr.worldGroup.add(pond.mesh);
    this.waters.push(pond);

    // Water: valley river segments.
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
      const [ax, az] = RIVER_POINTS[i];
      const [bx, bz] = RIVER_POINTS[i + 1];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const len = Math.hypot(bx - ax, bz - az) + 6;
      const seg = new WaterSurface(new THREE.PlaneGeometry(len, 9, 8, 2));
      seg.mesh.position.set(mx, terrainHeight(mx, mz) + 0.55, mz);
      seg.mesh.rotation.z = -Math.atan2(bz - az, bx - ax);
      seg.setColors('#4a8fb5', '#8fd0dd');
      this.sceneMgr.worldGroup.add(seg.mesh);
      this.waters.push(seg);
    }

    // Regions.
    const village = buildVillage(this.ctx);
    this.regions.push({ group: village, center: new THREE.Vector2(0, 0), radius: 320 });
    const valley = buildValley(this.ctx);
    this.regions.push({ group: valley, center: new THREE.Vector2(POI.valleyMeadow.x, POI.valleyMeadow.z), radius: 300 });

    // Karst spires ring the sanctuary — the "world between skies" horizon.
    const peaks: [number, number, number, number][] = [
      [-35, -185, 85, 16], [40, -198, 115, 20], [110, -168, 70, 14], [-125, -155, 95, 18],
      [-190, -52, 82, 15], [-172, 52, 108, 19], [-85, 182, 75, 14], [28, 200, 95, 17],
      [195, -40, 90, 16], [205, 58, 74, 13],
    ];
    for (const [px, pz, ph, pr] of peaks) makeKarstPeak(this.ctx, px, pz, ph, pr);

    // Vegetation fields (instanced, one draw call each).
    const place = (x: number, z: number): number | null => {
      if (!isOpenMeadow(x, z)) return null;
      const y = terrainHeight(x, z);
      if (y > 12) return null; // no grass on alpine rock
      return y;
    };
    const valleyGrass = new GrassField(POI.valleyMeadow.x, POI.valleyMeadow.z, 62, 2600, place, 7);
    const villageGrass = new GrassField(0, 0, 52, 900, place, 13);
    this.grassFields.push(valleyGrass, villageGrass);
    this.sceneMgr.worldGroup.add(valleyGrass.mesh, villageGrass.mesh);

    const valleyFlowers = new FlowerField(POI.valleyMeadow.x, POI.valleyMeadow.z, 48, 260, place, 21);
    const villageFlowers = new FlowerField(0, 0, 44, 90, place, 34);
    this.flowerFields.push(valleyFlowers, villageFlowers);
    this.sceneMgr.worldGroup.add(valleyFlowers.mesh, villageFlowers.mesh);

    // Floating pollen motes give the air a magical thickness.
    const villagePollen = new PollenParticles(new THREE.Vector3(0, 2, 0), 30);
    const valleyPollen = new PollenParticles(
      new THREE.Vector3(POI.valleyMeadow.x, terrainHeight(POI.valleyMeadow.x, POI.valleyMeadow.z), POI.valleyMeadow.z),
      40,
      160,
      '#e8ffd9'
    );
    this.pollen.push(villagePollen, valleyPollen);
    this.sceneMgr.effectsGroup.add(villagePollen.points, valleyPollen.points);
  }

  setGrassDensity(fraction: number): void {
    for (const g of this.grassFields) g.setDensity(fraction);
  }

  update(dt: number, t: number, playerPos: THREE.Vector3): void {
    this.sky.mesh.position.copy(playerPos);
    this.sky.update(t);
    for (const w of this.waters) w.update(t);
    for (const g of this.grassFields) g.update(t);
    for (const f of this.flowerFields) f.update(t);
    for (const p of this.pollen) p.update(dt, t);
    for (const fn of this.ctx.animated) fn(dt, t);

    // Cheap region streaming: hide far regions entirely.
    for (const r of this.regions) {
      const d = Math.hypot(playerPos.x - r.center.x, playerPos.z - r.center.y);
      r.group.visible = d < r.radius;
    }
  }
}
