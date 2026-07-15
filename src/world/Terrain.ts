import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { clamp, distToPolyline, lerp, smoothstep } from '../utils/math';
import { POI } from '../utils/constants';
import { createToonMaterial } from '../shaders/toon';

/**
 * Analytic terrain: one continuous height function shared by the visual mesh,
 * the Rapier trimesh collider and all placement logic — so nothing ever
 * floats or sinks.
 */

export const POND = { x: POI.pond.x, z: POI.pond.z, radius: 7, waterY: 1.35 };

export const RIVER_POINTS: [number, number][] = [
  [88, 6],
  [102, 32],
  [116, 54],
  [126, 80],
  [128, 112],
];

/** Residential lane running south from the plaza. */
export const LANE_POINTS: [number, number][] = [
  [0, -8],
  [0, -38],
];

export const PATH_POINTS: [number, number][] = [
  [0, 0],
  [8, 2],
  [46, 10],
  [78, 26],
  [104, 42],
  [118, 56],
  [134, 68],
  [150, 80],
  [168, 90],
  [176, 96],
];

const VILLAGE = { x: 0, z: 0, r: 40, blend: 26, h: 2.0 };
const VALLEY = { x: 150, z: 80, r: 58, blend: 34, h: 2.7, strength: 0.72 };

function baseHills(x: number, z: number): number {
  return (
    2.5 +
    3.0 * Math.sin(x * 0.02) * Math.cos(z * 0.023) +
    1.8 * Math.sin(x * 0.043 + 1.7) * Math.sin(z * 0.037 + 0.6) +
    0.6 * Math.sin(x * 0.11) * Math.cos(z * 0.093)
  );
}

function flattenDisc(
  h: number,
  x: number,
  z: number,
  cx: number,
  cz: number,
  rInner: number,
  blend: number,
  target: number,
  strength = 1
): number {
  const d = Math.hypot(x - cx, z - cz);
  const w = (1 - smoothstep(rInner, rInner + blend, d)) * strength;
  return lerp(h, target, w);
}

export function terrainHeight(x: number, z: number): number {
  let h = baseHills(x, z);
  // Valley meadow: soften hills into a walkable bowl.
  h = flattenDisc(h, x, z, VALLEY.x, VALLEY.z, VALLEY.r, VALLEY.blend, VALLEY.h, VALLEY.strength);
  // Village plateau (fully flat social hub).
  h = flattenDisc(h, x, z, VILLAGE.x, VILLAGE.z, VILLAGE.r, VILLAGE.blend, VILLAGE.h, 1);
  // River bed depression.
  const dRiver = distToPolyline(x, z, RIVER_POINTS);
  h -= 1.7 * (1 - smoothstep(3.2, 7, dRiver));
  // Pond depression (inside the village plateau).
  const dPond = Math.hypot(x - POND.x, z - POND.z);
  h -= 1.5 * (1 - smoothstep(4.2, POND.radius + 0.8, dPond));
  // Rim mountains keep the sanctuary enclosed.
  const dEdge = Math.hypot(x, z);
  h += smoothstep(175, 238, dEdge) * 30;
  return h;
}

/** Footstep surface under a world position. */
export function terrainSurface(x: number, z: number): 'stone' | 'grass' {
  return Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 20 ? 'stone' : 'grass';
}

/** Is this point on open ground (not water, not plaza, not path)? */
export function isOpenMeadow(x: number, z: number): boolean {
  if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 2) return false;
  if (distToPolyline(x, z, RIVER_POINTS) < 7) return false;
  if (distToPolyline(x, z, PATH_POINTS) < 3.4) return false;
  if (Math.hypot(x, z) < 30) return false; // built-up village core
  if (Math.abs(x) < 12 && z < -8 && z > -42) return false; // residential lane
  return true;
}

export interface TerrainBuildResult {
  mesh: THREE.Mesh;
  vertices: Float32Array;
  indices: Uint32Array;
}

export function buildTerrain(): TerrainBuildResult {
  const size = GameConfig.worldSize;
  const segs = GameConfig.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grassA = new THREE.Color('#6fc257');
  const grassB = new THREE.Color('#4fae59');
  const valleyGrass = new THREE.Color('#8fd96b');
  // Pale sun-bleached concrete, like a sleepy summer lane.
  const walkway = new THREE.Color('#ded8c8');
  const plaza = new THREE.Color('#d8d3c4');
  const plazaAccent = new THREE.Color('#c2604c');
  const sand = new THREE.Color('#dbc9a0');
  const rock = new THREE.Color('#95a0ab');
  const snow = new THREE.Color('#eef3f7');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    // Base grass with gentle variation.
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17) * Math.cos(x * 0.07 - z * 0.11);
    c.copy(grassA).lerp(grassB, n);
    const dValley = Math.hypot(x - VALLEY.x, z - VALLEY.z);
    c.lerp(valleyGrass, 1 - smoothstep(30, VALLEY.r + 20, dValley));

    // Village plaza: warm cream paving with a terracotta accent ring.
    const dCenter = Math.hypot(x, z);
    c.lerp(plaza, 1 - smoothstep(17, 21, dCenter));
    if (dCenter > 8 && dCenter < 11) c.lerp(plazaAccent, 0.6);

    // Concrete walkway — across the plaza, out toward the valley, and down
    // the residential lane.
    const dPath = Math.min(
      distToPolyline(x, z, PATH_POINTS),
      distToPolyline(x, z, LANE_POINTS)
    );
    c.lerp(walkway, (1 - smoothstep(2.4, 4.6, dPath)) * 0.92);

    // Shores.
    const dPond = Math.hypot(x - POND.x, z - POND.z);
    c.lerp(sand, (1 - smoothstep(POND.radius, POND.radius + 2.4, dPond)) * 0.8);
    const dRiver = distToPolyline(x, z, RIVER_POINTS);
    c.lerp(sand, (1 - smoothstep(4.5, 7.5, dRiver)) * 0.6);

    // Alpine rock and snow.
    c.lerp(rock, smoothstep(13, 20, y));
    c.lerp(snow, smoothstep(24, 30, y));

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = createToonMaterial('#ffffff', { vertexColors: true, shadowLevel: 0.62, rimStrength: 0.04 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  const vertices = new Float32Array(pos.array as ArrayLike<number>);
  const rawIndex = geo.getIndex();
  const indices = rawIndex ? new Uint32Array(rawIndex.array as ArrayLike<number>) : new Uint32Array(0);

  return { mesh, vertices, indices };
}

/** Clamp a point into the playable area (used by NPC wander + mock players). */
export function clampToWorld(x: number, z: number): { x: number; z: number } {
  const max = GameConfig.worldSize / 2 - 10;
  return { x: clamp(x, -max, max), z: clamp(z, -max, max) };
}
