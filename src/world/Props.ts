import * as THREE from 'three';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight } from './Terrain';
import type { Physics } from '../physics/Physics';
import type { AssetManager } from '../core/AssetManager';

/** Shared context handed to world builders. */
export interface WorldCtx {
  group: THREE.Group;
  physics: Physics;
  blockers: THREE.Object3D[];
  nightGlow: THREE.MeshToonMaterial[];
  lampLights: THREE.PointLight[];
  animated: Array<(dt: number, t: number) => void>;
  assets: AssetManager;
}

/* ------------------------------- Trees ------------------------------- */

export function makeTree(
  ctx: WorldCtx,
  x: number,
  z: number,
  variant: 'round' | 'tall' | 'amber' = 'round',
  scale = 1
): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const trunkMat = createToonMaterial('#8a6243');
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.2, 7), trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  g.add(trunk);

  const foliageColor = variant === 'amber' ? '#f0784a' : variant === 'tall' ? '#4fb264' : '#5fca6e';
  const folMat = createToonMaterial(foliageColor, { rimStrength: 0.22 });
  const blobs =
    variant === 'tall'
      ? [
          { r: 1.5, y: 2.7 },
          { r: 1.2, y: 3.8 },
          { r: 0.85, y: 4.7 },
        ]
      : [
          { r: 1.9, y: 3.0 },
          { r: 1.3, y: 3.9, dx: 0.9 },
          { r: 1.2, y: 3.8, dx: -0.85, dz: 0.4 },
        ];
  for (const b of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), folMat);
    m.position.set(b.dx ?? 0, b.y, b.dz ?? 0);
    m.scale.y = 0.85;
    m.castShadow = true;
    g.add(m);
  }
  ctx.group.add(g);
  ctx.physics.addCylinder(x, y + 1.1, z, 1.1, 0.45 * scale);
  ctx.blockers.push(trunk);
  return g;
}

export function makeRock(ctx: WorldCtx, x: number, z: number, scale = 1): THREE.Mesh {
  const y = terrainHeight(x, z);
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7 * scale, 0),
    createToonMaterial('#9aa4ae', { shadowLevel: 0.55 })
  );
  rock.position.set(x, y + 0.32 * scale, z);
  rock.scale.y = 0.72;
  rock.rotation.y = x * 1.7 + z;
  rock.castShadow = true;
  ctx.group.add(rock);
  if (scale > 0.8) {
    ctx.physics.addCylinder(x, y + 0.4, z, 0.4, 0.6 * scale);
    ctx.blockers.push(rock);
  }
  return rock;
}

/* --------------------------- Small furniture -------------------------- */

export function makeBench(ctx: WorldCtx, x: number, z: number, rotY = 0): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const wood = createToonMaterial('#a97e52');
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.5), wood);
  seat.position.y = 0.45;
  seat.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.1), wood);
  back.position.set(0, 0.8, -0.22);
  for (const sx of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.4), wood);
    leg.position.set(sx, 0.22, 0);
    g.add(leg);
  }
  g.add(seat, back);
  ctx.group.add(g);
  ctx.physics.addBox(x, y + 0.4, z, 0.85, 0.4, 0.3, rotY);
  return g;
}

/** Wooden street post with a hanging paper lantern. */
export function makeLampPost(ctx: WorldCtx, x: number, z: number): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const wood = createToonMaterial('#4a3b2e');
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 0.14), wood);
  post.position.y = 1.4;
  post.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), wood);
  arm.position.set(0.26, 2.72, 0);
  const lanternMat = createToonMaterial('#ffe9b0', { emissive: '#ffca6b', emissiveIntensity: 0.3 });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 8), lanternMat);
  lantern.position.set(0.5, 2.4, 0);
  for (const cy of [2.62, 2.18]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 8), wood);
    cap.position.set(0.5, cy, 0);
    g.add(cap);
  }
  const light = new THREE.PointLight('#ffc873', 0, 11, 1.8);
  light.position.set(0.5, 2.4, 0);
  g.add(post, arm, lantern, light);
  ctx.group.add(g);
  ctx.nightGlow.push(lanternMat);
  ctx.lampLights.push(light);
  ctx.physics.addCylinder(x, y + 1.4, z, 1.4, 0.14);
  return g;
}

/** Telegraph pole; returns the wire attachment point in world space. */
export function makePowerPole(ctx: WorldCtx, x: number, z: number): THREE.Vector3 {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mat = createToonMaterial('#4d4438');
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 7), mat);
  pole.position.y = 2.7;
  pole.castShadow = true;
  g.add(pole);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), mat);
  cross.position.y = 4.9;
  g.add(cross);
  const insulatorMat = createToonMaterial('#e8e4d8');
  for (const ix of [-0.6, 0, 0.6]) {
    const ins = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), insulatorMat);
    ins.position.set(ix, 5.0, 0);
    g.add(ins);
  }
  ctx.group.add(g);
  ctx.physics.addCylinder(x, y + 2.7, z, 2.7, 0.16);
  return new THREE.Vector3(x, y + 4.95, z);
}

/** Sagging wire between two points (telegraph lines, laundry lines). */
export function makeWire(ctx: WorldCtx, from: THREE.Vector3, to: THREE.Vector3, sag = 0.55): void {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    points.push(p);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#2e2a33' }));
  ctx.group.add(line);
}

/** Vermilion gate marking the village threshold. */
export function makeTorii(ctx: WorldCtx, x: number, z: number, rotY = 0): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const red = createToonMaterial('#c94b3d');
  const dark = createToonMaterial('#3a3038');
  for (const side of [-1.4, 1.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 3.0, 8), red);
    pillar.position.set(side, 1.5, 0);
    pillar.castShadow = true;
    g.add(pillar);
    ctx.physics.addCylinder(
      x + Math.cos(rotY) * side,
      y + 1.5,
      z - Math.sin(rotY) * side,
      1.5,
      0.24
    );
  }
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.26, 0.34), red);
  topBeam.position.y = 3.1;
  topBeam.castShadow = true;
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.12, 0.42), dark);
  topCap.position.y = 3.28;
  const midBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.24), red);
  midBeam.position.y = 2.55;
  g.add(topBeam, topCap, midBeam);
  ctx.group.add(g);
  return g;
}

/** Distant karst spire — the steep green-capped peaks ringing the sanctuary. */
export function makeKarstPeak(ctx: WorldCtx, x: number, z: number, height: number, radius: number): void {
  const y = terrainHeight(x, z);
  const rockMat = createToonMaterial('#7fa08e', { shadowLevel: 0.62, rimStrength: 0.12 });
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.45, radius, height, 9),
    rockMat
  );
  spire.position.set(x, y + height / 2, z);
  ctx.group.add(spire);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.5, 9, 7), rockMat);
  crown.position.set(x, y + height, z);
  ctx.group.add(crown);
  // Green cap of clinging vegetation.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.42, 8, 6), createToonMaterial('#6fae7a'));
  cap.scale.y = 0.55;
  cap.position.set(x, y + height + radius * 0.28, z);
  ctx.group.add(cap);
}

/** Lush shrub clump — the wild green that hugs walls and street edges. */
export function makeShrub(ctx: WorldCtx, x: number, z: number, scale = 1): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const greens = ['#3f8f4a', '#5fae5a', '#2f7a44'];
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32 * scale, 1),
      createToonMaterial(greens[i % greens.length], { rimStrength: 0.3 })
    );
    blob.position.set(Math.cos(i * 2.2) * 0.28 * scale, 0.24 * scale + i * 0.07, Math.sin(i * 2.2) * 0.24 * scale);
    blob.scale.y = 0.8;
    blob.castShadow = true;
    g.add(blob);
  }
  ctx.group.add(g);
  return g;
}

export function makePlanter(ctx: WorldCtx, x: number, z: number): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.45, 8), createToonMaterial('#c96b52'));
  pot.position.y = 0.22;
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), createToonMaterial('#77c46f'));
  bush.position.y = 0.68;
  bush.scale.y = 0.8;
  const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), createToonMaterial('#f2a1b8'));
  bloom.position.set(0.15, 0.9, 0.1);
  g.add(pot, bush, bloom);
  pot.castShadow = true;
  ctx.group.add(g);
  return g;
}

/* ------------------------------ Buildings ----------------------------- */

export interface BuildingOpts {
  x: number;
  z: number;
  rotY?: number;
  w?: number;
  d?: number;
  h?: number;
  stories?: 1 | 2;
  wall?: string;
  roof?: string;
  awning?: string;
  name?: string;
  icon?: string;
  chimney?: boolean;
  /** Override roof rise (lower = the long low homes of the residential lane). */
  roofRise?: number;
  /** Wide multi-pane window bands instead of square windows. */
  wideWindows?: boolean;
}

/**
 * Mountain-town house in a Japanese-village style: plaster walls with dark
 * wood trim, a gabled tile roof with deep eaves, framed shoji-glow windows
 * and an awning over the entrance.
 */
export function makeBuilding(ctx: WorldCtx, opts: BuildingOpts): THREE.Group {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const w = opts.w ?? 6;
  const d = opts.d ?? 5;
  const stories = opts.stories ?? 1;
  const h = opts.h ?? (stories === 2 ? 5.4 : 3.4);
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const wallColor = opts.wall ?? '#f2ead8';
  const wallMat = createToonMaterial(wallColor);
  const woodMat = createToonMaterial('#5a4634');
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);

  // Stone footing.
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3), createToonMaterial('#9aa0a6'));
  skirt.position.y = 0.22;
  g.add(skirt);

  // Dark wood corner posts + story beams (timber-framed plaster look).
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), woodMat);
    post.position.set((cx * w) / 2, h / 2, (cz * d) / 2);
    g.add(post);
  }
  for (let s = 1; s <= stories; s++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), woodMat);
    beam.position.y = Math.min(h - 0.08, s * (h / stories));
    g.add(beam);
  }

  /* --- gabled tile roof: two slanted slabs, gable infills, ridge beam --- */
  const roofColor = opts.roof ?? '#3a5aa8';
  const roofMat = createToonMaterial(roofColor);
  const roofH = opts.roofRise ?? Math.max(1.1, d * 0.24);
  const dd = d / 2 + 0.65; // eave overhang front/back
  const slabW = w + 1.1; // eave overhang sides
  const slabLen = Math.hypot(roofH, dd) + 0.2;
  const angle = Math.atan2(roofH, dd);
  for (const side of [1, -1] as const) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.14, slabLen), roofMat);
    slab.position.set(0, h + roofH / 2, (side * dd) / 2);
    slab.rotation.x = side * angle;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(slabW + 0.15, 0.18, 0.32), createToonMaterial('#2c3f74'));
  ridge.position.y = h + roofH + 0.03;
  g.add(ridge);
  // Gable infill triangles at each end, wall-colored.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-d / 2, 0);
  gableShape.lineTo(d / 2, 0);
  gableShape.lineTo(0, roofH);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  for (const side of [1, -1] as const) {
    const gable = new THREE.Mesh(gableGeo, createToonMaterial(wallColor, { side: THREE.DoubleSide }));
    gable.rotation.y = (side * Math.PI) / 2;
    gable.position.set((side * w) / 2, h, 0);
    g.add(gable);
  }

  /* --- entrance: door, stone step, awning --- */
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.12), woodMat);
  door.position.set(0, 0.85, d / 2 + 0.06);
  g.add(door);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.6), createToonMaterial('#aeb4ba'));
  step.position.set(0, 0.07, d / 2 + 0.42);
  g.add(step);
  const awningMat = createToonMaterial(opts.awning ?? roofColor);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.85), awningMat);
  awning.position.set(0, 2.08, d / 2 + 0.42);
  awning.rotation.x = -0.3;
  awning.castShadow = true;
  g.add(awning);

  /* --- framed windows that glow warm (shoji feel), one row per story --- */
  const winMat = createToonMaterial('#ffedbe', { emissive: '#ffc96b', emissiveIntensity: 0.24 });
  ctx.nightGlow.push(winMat);
  const frameGeo = new THREE.BoxGeometry(0.98, 0.98, 0.08);
  const paneGeo = new THREE.BoxGeometry(0.78, 0.78, 0.1);
  for (let s = 0; s < stories; s++) {
    const wy = 1.7 + s * 2.1;
    if (opts.wideWindows) {
      // One broad multi-pane band per story, offset beside the door.
      const bandW = w * 0.52;
      const bandX = w * 0.2;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(bandW + 0.2, 1.15, 0.08), woodMat);
      frame.position.set(bandX, wy, d / 2 + 0.02);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.95, 0.1), winMat);
      pane.position.set(bandX, wy, d / 2 + 0.04);
      g.add(frame, pane);
      // Mullion grid for that many-paned look.
      for (let m = -1; m <= 1; m++) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.12), woodMat);
        mullion.position.set(bandX + (m * bandW) / 3.2, wy, d / 2 + 0.05);
        g.add(mullion);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(bandW, 0.06, 0.12), woodMat);
      rail.position.set(bandX, wy, d / 2 + 0.05);
      g.add(rail);
    } else {
      for (const sx of [-w * 0.28, w * 0.28]) {
        const frame = new THREE.Mesh(frameGeo, woodMat);
        frame.position.set(sx, wy, d / 2 + 0.02);
        const pane = new THREE.Mesh(paneGeo, winMat);
        pane.position.set(sx, wy, d / 2 + 0.04);
        g.add(frame, pane);
      }
    }
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.78), winMat);
    sideWin.position.set(w / 2 + 0.03, wy, 0);
    g.add(sideWin);
    // Second-story window box awning strip.
    if (s === 1) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.07, 0.6), awningMat);
      strip.position.set(0, wy + 0.75, d / 2 + 0.28);
      strip.rotation.x = -0.3;
      g.add(strip);
    }
  }

  if (opts.chimney) {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), createToonMaterial('#8d8478'));
    chimney.position.set(w * 0.25, h + roofH + 0.5, -d * 0.15);
    g.add(chimney);
  }

  // Hanging sign with icon + name.
  if (opts.name) {
    const tex = ctx.assets.makeCanvasTexture(256, 128, (c2d) => {
      c2d.fillStyle = '#f7efdd';
      c2d.beginPath();
      c2d.roundRect(4, 4, 248, 120, 22);
      c2d.fill();
      c2d.strokeStyle = '#8a6243';
      c2d.lineWidth = 8;
      c2d.stroke();
      c2d.fillStyle = '#33415c';
      c2d.font = '44px sans-serif';
      c2d.textAlign = 'center';
      c2d.fillText(opts.icon ?? '✶', 128, 56);
      c2d.font = 'bold 26px sans-serif';
      c2d.fillText(opts.name ?? '', 128, 100);
    });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    sign.position.set(0, 2.85, d / 2 + 0.12);
    g.add(sign);
  }

  ctx.group.add(g);
  ctx.physics.addBox(x, y + h / 2, z, w / 2, h / 2, d / 2, rotY);
  ctx.blockers.push(walls);
  return g;
}

/* --------------------------- Festive touches -------------------------- */

export function makeStringLights(ctx: WorldCtx, from: THREE.Vector3, to: THREE.Vector3): void {
  const count = 9;
  const mat = createToonMaterial('#fff2b8', { emissive: '#ffd36b', emissiveIntensity: 0.25 });
  ctx.nightGlow.push(mat);
  const geo = new THREE.SphereGeometry(0.07, 6, 5);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * 0.6; // catenary-ish sag
    const bulb = new THREE.Mesh(geo, mat);
    bulb.position.copy(p);
    ctx.group.add(bulb);
  }
}

export function makeFlag(ctx: WorldCtx, x: number, z: number, color = '#e8a04c'): void {
  const y = terrainHeight(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), createToonMaterial('#7c6a55'));
  pole.position.set(x, y + 1.6, z);
  ctx.group.add(pole);
  const flagMat = createToonMaterial(color, { side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6, 4, 1), flagMat);
  flag.position.set(x + 0.6, y + 2.9, z);
  ctx.group.add(flag);
  const pos = flag.geometry.getAttribute('position') as THREE.BufferAttribute;
  const base = new Float32Array(pos.array as ArrayLike<number>);
  ctx.animated.push((_dt, t) => {
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      pos.setZ(i, Math.sin(t * 3 + bx * 3) * 0.12 * (bx + 0.55));
    }
    pos.needsUpdate = true;
  });
}

export function makeCampfire(ctx: WorldCtx, x: number, z: number): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stoneMat = createToonMaterial('#8d949c');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), stoneMat);
    s.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5);
    g.add(s);
  }
  const flameMat = createToonMaterial('#ffb14d', { emissive: '#ff8a3d', emissiveIntensity: 1.2 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), flameMat);
  flame.position.y = 0.35;
  g.add(flame);
  const light = new THREE.PointLight('#ff9c4d', 1.6, 9, 1.6);
  light.position.y = 0.8;
  g.add(light);
  ctx.animated.push((_dt, t) => {
    flame.scale.setScalar(0.9 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.05);
    light.intensity = 1.4 + Math.sin(t * 11) * 0.35;
  });
  ctx.group.add(g);
  return g;
}

/** Simple wooden footbridge with a walkable deck collider. */
export function makeBridge(ctx: WorldCtx, x: number, z: number, rotY: number, length = 10): THREE.Group {
  const yBank = Math.max(terrainHeight(x - Math.cos(rotY) * length * 0.6, z + Math.sin(rotY) * length * 0.6),
    terrainHeight(x + Math.cos(rotY) * length * 0.6, z - Math.sin(rotY) * length * 0.6));
  const deckY = yBank + 0.18;
  const g = new THREE.Group();
  g.position.set(x, deckY, z);
  g.rotation.y = rotY;
  const wood = createToonMaterial('#a97e52');
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 2.6), wood);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  for (const side of [-1.2, 1.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 0.1), wood);
    rail.position.set(0, 0.85, side);
    g.add(rail);
    for (let i = -1; i <= 1; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), wood);
      post.position.set(i * length * 0.4, 0.42, side);
      g.add(post);
    }
  }
  ctx.group.add(g);
  ctx.physics.addBox(x, deckY, z, length / 2, 0.12, 1.3, rotY);
  // Rail colliders keep players from strolling off the side.
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  for (const side of [-1.35, 1.35]) {
    ctx.physics.addBox(x - s * side, deckY + 0.7, z - c * side, length / 2, 0.5, 0.08, rotY);
  }
  ctx.blockers.push(deck);
  return g;
}
