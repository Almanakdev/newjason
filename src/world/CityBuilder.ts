import * as THREE from 'three';
import {
  makeBuilding,
  makeLampPost,
  makePowerPole,
  makeWire,
  type WorldCtx,
} from './Props';
import {
  makeTower,
  makeNeonSign,
  makeKonbini,
  makeCrossing,
  makeSakura,
  makePaifang,
  makePagoda,
  makeLanternString,
  makeFoodStall,
} from './CityProps';
import { CITY, terrainHeight } from './Terrain';

/**
 * Chinatown (码城唐人街) — the city district reworked around a paifang gate,
 * lantern-strung main street, green-tiled shophouses and a pagoda landmark.
 * Backdrop towers keep the big-city skyline behind the old quarter, per the
 * "neon alley in a modern city" reference. Same flat plateau + physics as
 * before; only the dressing changed.
 */
export function buildCity(ctx: WorldCtx): THREE.Group {
  const city = new THREE.Group();
  city.name = 'region-city';
  const prevGroup = ctx.group;
  ctx.group = city;

  const C = CITY; // { x:-100, z:10 }
  /** Rotation so a building's front (+z) faces the crossing centre. */
  const faceCentre = (tx: number, tz: number) => Math.atan2(C.x - tx, C.z - tz);

  // --- the crossing stays as the market square at the heart of the quarter ---
  makeCrossing(ctx, C.x, C.z, 11);

  // --- paifang gate on the south approach (the player walks in through it) ---
  makePaifang(ctx, C.x, C.z - 16, 0, 13);

  // --- pagoda landmark on the north-east corner ---
  makePagoda(ctx, C.x + 19, C.z + 21, 5);

  // --- green-tiled shophouses lining both avenues (Chinese old-street look) ---
  const shophouses: [number, number, string, string][] = [
    // [x, z, wall, roof]
    [C.x - 17, C.z + 19, '#f4ecd9', '#2e6e4e'],
    [C.x - 29, C.z + 4, '#efe3cd', '#7a1f18'],
    [C.x - 29, C.z + 15, '#f4ecd9', '#2e6e4e'],
    [C.x + 29, C.z + 4, '#eee6d2', '#2e6e4e'],
    [C.x + 29, C.z + 16, '#f4ecd9', '#7a1f18'],
    [C.x - 6, C.z + 30, '#efe3cd', '#2e6e4e'],
    [C.x + 6, C.z + 30, '#f4ecd9', '#7a1f18'],
    [C.x - 17, C.z - 10, '#eee6d2', '#7a1f18'],
    [C.x + 17, C.z - 10, '#f4ecd9', '#2e6e4e'],
  ];
  for (const [sx, sz, wall, roof] of shophouses) {
    makeBuilding(ctx, {
      x: sx,
      z: sz,
      rotY: faceCentre(sx, sz),
      w: 8,
      d: 6,
      stories: 2,
      wall,
      roof,
      awning: '#b8271f',
      roofRise: 0.9,
      wideWindows: true,
    });
  }

  // --- 24H corner store, now signed 便利店 ---
  makeKonbini(ctx, C.x + 15, C.z - 2, faceCentre(C.x + 15, C.z - 2));

  // --- street food stalls along the sidewalks, fronts toward the road ---
  const stalls: [number, number, number, 'noodle' | 'bao' | 'skewer' | 'tea'][] = [
    // west sidewalk, facing east (+x): rotY -PI/2 turns the +z front toward the road
    [C.x - 8, C.z - 1, -Math.PI / 2, 'noodle'],
    [C.x - 8, C.z + 17, -Math.PI / 2, 'skewer'],
    // east sidewalk, facing west
    [C.x + 8, C.z + 13, Math.PI / 2, 'bao'],
    [C.x + 8, C.z - 9, Math.PI / 2, 'tea'],
    // along the east-west avenue, facing the road
    [C.x - 15, C.z + 7, Math.PI, 'bao'],
    [C.x + 21, C.z + 7, Math.PI, 'skewer'],
  ];
  for (const [sx, sz, rot, variant] of stalls) makeFoodStall(ctx, sx, sz, rot, variant);

  // --- red lantern strings across the main street ---
  for (const z of [C.z - 10, C.z - 3, C.z + 6, C.z + 14, C.z + 22]) {
    const yL = terrainHeight(C.x - 9, z) + 4.4;
    const yR = terrainHeight(C.x + 9, z) + 4.4;
    makeLanternString(
      ctx,
      new THREE.Vector3(C.x - 9, yL, z),
      new THREE.Vector3(C.x + 9, yR, z),
      6
    );
  }
  // A couple more along the east-west avenue.
  for (const x of [C.x - 20, C.x + 22]) {
    const yA = terrainHeight(x, C.z + 2) + 4.2;
    const yB = terrainHeight(x, C.z + 16) + 4.2;
    makeLanternString(ctx, new THREE.Vector3(x, yA, C.z + 2), new THREE.Vector3(x, yB, C.z + 16), 5);
  }

  // --- neon hanzi signs clustered near the square (red/gold palette) ---
  const signs: [number, number, string][] = [
    [C.x - 9, C.z + 10, '#e03b30'],
    [C.x + 9, C.z + 9, '#f5a623'],
    [C.x - 8, C.z - 8, '#ff6a4d'],
    [C.x + 10, C.z - 7, '#e03b30'],
    [C.x - 24, C.z + 9, '#f5a623'],
  ];
  for (const [nx, nz, hue] of signs) makeNeonSign(ctx, nx, nz, hue, 4 + Math.random() * 2);

  // --- sakura still lines the sidewalks (reference 2) ---
  for (const z of [C.z - 8, C.z + 2, C.z + 18, C.z + 28]) {
    makeSakura(ctx, C.x - 11, z, 0.95 + Math.random() * 0.2);
    makeSakura(ctx, C.x + 11, z, 0.95 + Math.random() * 0.2);
  }

  // --- street lamps down the avenues ---
  for (const z of [C.z - 12, C.z + 4, C.z + 22]) {
    makeLampPost(ctx, C.x - 6, z);
    makeLampPost(ctx, C.x + 6, z);
  }

  // --- modern skyline behind the old quarter (reference 1's backdrop) ---
  const towers: { x: number; z: number; h: number; screen?: boolean; hue?: string; label?: string; wall?: string }[] = [
    { x: C.x - 34, z: C.z + 34, h: 40, screen: true, hue: '#e03b30', label: '码', wall: '#6f7a8e' },
    { x: C.x + 32, z: C.z + 36, h: 36, screen: true, hue: '#f5a623', label: '未来', wall: '#74809a' },
    { x: C.x - 36, z: C.z - 30, h: 44, wall: '#69748a' },
    { x: C.x + 36, z: C.z - 28, h: 34, wall: '#7a8598' },
  ];
  for (const t of towers) {
    makeTower(ctx, {
      x: t.x,
      z: t.z,
      rotY: faceCentre(t.x, t.z),
      w: 11,
      d: 11,
      h: t.h,
      wall: t.wall,
      screen: t.screen,
      screenHue: t.hue,
      label: t.label,
    });
  }

  // --- overhead power lines along the eastern approach (alley clutter) ---
  const poleXs = [C.x + 24, C.x + 34, C.x + 44, C.x + 54];
  let prevTop: THREE.Vector3 | null = null;
  for (const px of poleXs) {
    const top = makePowerPole(ctx, px, C.z - 6);
    if (prevTop) makeWire(ctx, prevTop, top, 0.7);
    prevTop = top;
  }

  ctx.group = prevGroup;
  ctx.group.add(city);
  return city;
}
