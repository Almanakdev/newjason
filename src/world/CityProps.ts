import * as THREE from 'three';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight } from './Terrain';
import type { WorldCtx } from './Props';

/**
 * Urban prop factories for the Shibuya-style district. Same contract as
 * Props.ts: each self-grounds via terrainHeight, adds a physics collider,
 * pushes solid meshes to ctx.blockers (camera collision) and pushes any
 * night-lit material to ctx.nightGlow so the day/night cycle blooms it.
 *
 * Neon convention:
 *  - Signs/window strips are pushed to nightGlow → dim by day, bright at night.
 *  - Big video screens use MeshBasicMaterial (unlit) → always lit, day or night,
 *    the way a real Shibuya display reads.
 */

const KANA = ['コード', 'ミライ', 'ネオ', 'シティ', 'ジェイソン', 'ショー', 'カフェ', 'ラーメン', '未来', '電気'];

function screenTexture(ctx: WorldCtx, w: number, h: number, hue: string, label: string): THREE.CanvasTexture {
  return ctx.assets.makeCanvasTexture(w, h, (c) => {
    c.fillStyle = '#0a1030';
    c.fillRect(0, 0, w, h);
    // scanline glow bands
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hue);
    grad.addColorStop(1, '#0a1030');
    c.fillStyle = grad;
    c.globalAlpha = 0.55;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.font = `bold ${Math.floor(h * 0.42)}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, w / 2, h / 2);
  });
}

/* -------------------------------- Tower ------------------------------- */

export interface TowerOpts {
  x: number;
  z: number;
  rotY?: number;
  w?: number;
  d?: number;
  h?: number;
  wall?: string;
  /** Attach a big video billboard to the front face. */
  screen?: boolean;
  screenHue?: string;
  label?: string;
}

/** A tall commercial tower: glass-grey slab, glowing window strips, optional screen. */
export function makeTower(ctx: WorldCtx, opts: TowerOpts): THREE.Group {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const w = opts.w ?? 10;
  const d = opts.d ?? 10;
  const h = opts.h ?? 26;
  const y = terrainHeight(x, z);

  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const wallMat = createToonMaterial(opts.wall ?? '#8b95a6', { shadowLevel: 0.6 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);
  ctx.blockers.push(walls);

  // Ground-floor frontage reads brighter (shops at street level).
  const baseMat = createToonMaterial('#3a4152');
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 3, d + 0.2), baseMat);
  base.position.y = 1.5;
  g.add(base);

  // Vertical window strips on all four faces — bloom at night.
  const winMat = createToonMaterial('#cfe6ff', { emissive: '#7fb2ff', emissiveIntensity: 0.24 });
  ctx.nightGlow.push(winMat);
  const strips = Math.max(2, Math.floor(w / 2.4));
  for (const face of [0, 1, 2, 3]) {
    const along = face % 2 === 0 ? w : d;
    const depth = face % 2 === 0 ? d : w;
    for (let s = 0; s < strips; s++) {
      const t = (s + 0.5) / strips - 0.5;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.7, h - 4, 0.1), winMat);
      const off = t * (along - 1.4);
      if (face === 0) strip.position.set(off, h / 2 + 1.4, depth / 2 + 0.06);
      else if (face === 1) {
        strip.position.set(along / 2 + 0.06, h / 2 + 1.4, off);
        strip.rotation.y = Math.PI / 2;
      } else if (face === 2) strip.position.set(off, h / 2 + 1.4, -depth / 2 - 0.06);
      else {
        strip.position.set(-along / 2 - 0.06, h / 2 + 1.4, off);
        strip.rotation.y = Math.PI / 2;
      }
      g.add(strip);
    }
  }

  // Rooftop parapet + housing.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.6, d * 0.5), createToonMaterial('#4a5162'));
  cap.position.y = h + 0.8;
  g.add(cap);

  // Optional big video screen on the front face.
  if (opts.screen) {
    const sw = w * 0.82;
    const sh = h * 0.34;
    const tex = screenTexture(ctx, 256, 128, opts.screenHue ?? '#ec4380', opts.label ?? KANA[Math.floor(Math.random() * KANA.length)]);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    screen.position.set(0, h * 0.62, d / 2 + 0.12);
    g.add(screen);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.5, sh + 0.5, 0.2), createToonMaterial('#15151d'));
    bezel.position.set(0, h * 0.62, d / 2 + 0.02);
    g.add(bezel);
  }

  ctx.group.add(g);
  ctx.physics.addBox(x, y + h / 2, z, w / 2, h / 2, d / 2, rotY);
  return g;
}

/* ------------------------------ Neon sign ----------------------------- */

/** A vertical lit sign board on a short mast — pure set dressing, no collider. */
export function makeNeonSign(ctx: WorldCtx, x: number, z: number, hue = '#ec4380', height = 4): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, height, 6), createToonMaterial('#2a2a30'));
  mast.position.y = height / 2;
  g.add(mast);

  const boardMat = createToonMaterial(hue, { emissive: hue, emissiveIntensity: 0.3 });
  ctx.nightGlow.push(boardMat);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, height * 0.7, 0.12), boardMat);
  board.position.set(0.5, height * 0.62, 0);
  g.add(board);

  // A single lit kana so it reads as signage, always visible.
  const tex = screenTexture(ctx, 64, 128, hue, KANA[Math.floor(Math.random() * KANA.length)][0]);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, height * 0.62),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  face.position.set(0.57, height * 0.62, 0);
  g.add(face);

  ctx.group.add(g);
  return g;
}

/* --------------------------- Scramble crossing ------------------------ */

/** Painted zebra crossings around an intersection centre. Ground decal, no collider. */
export function makeCrossing(ctx: WorldCtx, cx: number, cz: number, reach = 11): THREE.Group {
  const y = terrainHeight(cx, cz) + 0.03;
  const g = new THREE.Group();
  g.position.set(cx, y, cz);

  const paint = new THREE.MeshBasicMaterial({ color: '#eef1f5', toneMapped: false });
  const barGeo = new THREE.BoxGeometry(0.55, 0.02, 3.4);

  const lay = (dirX: number, dirZ: number) => {
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(barGeo, paint);
      // offset perpendicular to travel direction
      bar.position.set(dirX * (reach * 0.55) + -dirZ * i * 0.9, 0, dirZ * (reach * 0.55) + dirX * i * 0.9);
      bar.rotation.y = Math.atan2(dirZ, dirX);
      g.add(bar);
    }
  };
  lay(1, 0);
  lay(-1, 0);
  lay(0, 1);
  lay(0, -1);

  ctx.group.add(g);
  return g;
}

/* ------------------------------- Konbini ------------------------------ */

/** A bright convenience-store frontage: lit sign band + glowing window wall. */
export function makeKonbini(ctx: WorldCtx, x: number, z: number, rotY = 0): THREE.Group {
  const y = terrainHeight(x, z);
  const w = 8;
  const d = 6;
  const h = 3.6;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), createToonMaterial('#eef1f4'));
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);
  ctx.blockers.push(walls);

  // Bright glass frontage that glows warm at night.
  const glassMat = createToonMaterial('#fff6d8', { emissive: '#ffd97a', emissiveIntensity: 0.3 });
  ctx.nightGlow.push(glassMat);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 2, 0.1), glassMat);
  glass.position.set(0, 1.2, d / 2 + 0.06);
  g.add(glass);

  // Sign band across the top — striped konbini look, always lit.
  const signTex = ctx.assets.makeCanvasTexture(256, 48, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 256, 48);
    c.fillStyle = '#e24b4a';
    c.fillRect(0, 0, 256, 12);
    c.fillStyle = '#3b8f52';
    c.fillRect(0, 36, 256, 12);
    c.fillStyle = '#1d5aa0';
    c.font = 'bold 26px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('コンビニ  24H', 128, 24);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 0.9),
    new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })
  );
  sign.position.set(0, h - 0.2, d / 2 + 0.12);
  g.add(sign);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 1.1), createToonMaterial('#d6dade'));
  awning.position.set(0, h - 0.7, d / 2 + 0.55);
  g.add(awning);

  ctx.group.add(g);
  ctx.physics.addBox(x, y + h / 2, z, w / 2, h / 2, d / 2, rotY);
  return g;
}

/* ------------------------------- Sakura ------------------------------- */

/** Cherry tree in bloom — soft pink canopy lining the sidewalks. */
export function makeSakura(ctx: WorldCtx, x: number, z: number, scale = 1): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7), createToonMaterial('#6d5142'));
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);
  ctx.blockers.push(trunk);

  const blossomMats = ['#ffc7dd', '#ffb3d0', '#ffd9e6'].map((c) =>
    createToonMaterial(c, { rimStrength: 0.24 })
  );
  const blobs: [number, number, number, number][] = [
    [0, 3.0, 0, 1.5],
    [1.0, 2.7, 0.4, 1.0],
    [-0.9, 2.7, -0.3, 1.0],
    [0.2, 2.6, -1.0, 0.9],
    [-0.3, 3.3, 0.7, 0.9],
  ];
  blobs.forEach(([bx, by, bz, r], i) => {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), blossomMats[i % blossomMats.length]);
    blob.position.set(bx, by, bz);
    blob.castShadow = true;
    g.add(blob);
  });

  ctx.group.add(g);
  ctx.physics.addCylinder(x, y + 1.2, z, 1.2, 0.3);
  return g;
}
