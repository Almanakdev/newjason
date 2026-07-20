import * as THREE from 'three';
import {
  makeBuilding,
  makeLampPost,
  makePowerPole,
  makeWire,
  type WorldCtx,
} from './Props';
import { makeTower, makeNeonSign, makeKonbini, makeCrossing, makeSakura } from './CityProps';
import { CITY } from './Terrain';

/**
 * The Neon Ward — a Shibuya-style city district: a scramble crossing ringed
 * by screen-clad towers, a convenience store, mid-rise shopfronts, sakura-lined
 * sidewalks and overhead power lines. Built beside the village on the same flat
 * plateau so you can walk between them.
 */
export function buildCity(ctx: WorldCtx): THREE.Group {
  const city = new THREE.Group();
  city.name = 'region-city';
  const prevGroup = ctx.group;
  ctx.group = city;

  const C = CITY; // { x:-100, z:10 }
  /** Rotation so a building's front (+z) faces the crossing centre. */
  const faceCentre = (tx: number, tz: number) => Math.atan2(C.x - tx, C.z - tz);

  // --- the scramble crossing at the heart of the ward ---
  makeCrossing(ctx, C.x, C.z, 11);

  // --- four corner towers, screens angled at the crossing ---
  const towers: { x: number; z: number; h: number; screen?: boolean; hue?: string; label?: string; wall?: string }[] = [
    { x: C.x - 18, z: C.z + 20, h: 30, screen: true, hue: '#ec4380', label: 'コード', wall: '#8b95a6' },
    { x: C.x + 18, z: C.z + 20, h: 24, screen: true, hue: '#37b6d8', label: 'ミライ', wall: '#7f8aa0' },
    { x: C.x - 18, z: C.z - 16, h: 26, screen: true, hue: '#ffd166', label: 'ジェイソン', wall: '#909aa8' },
    { x: C.x + 18, z: C.z - 16, h: 34, screen: false, wall: '#7a8598' },
    // taller backdrop slabs behind the front row
    { x: C.x - 34, z: C.z + 34, h: 40, wall: '#6f7a8e' },
    { x: C.x + 32, z: C.z + 36, h: 36, wall: '#74809a' },
    { x: C.x - 36, z: C.z - 30, h: 44, wall: '#69748a' },
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

  // --- convenience store on the near corner ---
  makeKonbini(ctx, C.x + 15, C.z - 2, faceCentre(C.x + 15, C.z - 2));

  // --- mid-rise shopfronts lining the two avenues ---
  const shops: [number, number, string][] = [
    [C.x - 30, C.z + 3, '#f2ded0'],
    [C.x - 30, C.z + 15, '#e7e0ef'],
    [C.x + 30, C.z + 4, '#f0ead8'],
    [C.x + 30, C.z + 16, '#dfeae0'],
    [C.x - 6, C.z + 30, '#efe2d4'],
    [C.x + 6, C.z + 30, '#e3e7f0'],
  ];
  for (const [sx, sz, wall] of shops) {
    makeBuilding(ctx, {
      x: sx,
      z: sz,
      rotY: faceCentre(sx, sz),
      w: 8,
      d: 6,
      stories: 2,
      wall,
      roof: '#3a4152',
      roofRise: 0.5,
      wideWindows: true,
    });
  }

  // --- neon signs clustered at the crossing corners ---
  const signs: [number, number, string][] = [
    [C.x - 9, C.z + 10, '#ec4380'],
    [C.x + 9, C.z + 9, '#37b6d8'],
    [C.x - 8, C.z - 8, '#ffd166'],
    [C.x + 10, C.z - 7, '#8b5cf6'],
  ];
  for (const [nx, nz, hue] of signs) makeNeonSign(ctx, nx, nz, hue, 4 + Math.random() * 2);

  // --- sakura lining the sidewalks along both avenues ---
  for (const z of [C.z - 8, C.z + 2, C.z + 18, C.z + 28]) {
    makeSakura(ctx, C.x - 9, z, 0.95 + Math.random() * 0.2);
    makeSakura(ctx, C.x + 9, z, 0.95 + Math.random() * 0.2);
  }
  for (const x of [C.x - 26, C.x - 14, C.x + 14, C.x + 26]) {
    makeSakura(ctx, x, C.z + 9, 0.95 + Math.random() * 0.2);
  }

  // --- street lamps down the avenues ---
  for (const z of [C.z - 12, C.z + 4, C.z + 22]) {
    makeLampPost(ctx, C.x - 6, z);
    makeLampPost(ctx, C.x + 6, z);
  }

  // --- overhead power lines along the eastern approach (konbini-street look) ---
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
