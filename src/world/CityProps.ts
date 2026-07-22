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

/** Sign glyph pool — hanzi for the Chinatown district. */
const KANA = ['码', '餐', '茶', '酒', '面', '福', '书', '灯', '未来', '文房四宝'];

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

/* ------------------------------- Paifang ------------------------------ */

/** Chinatown gate: red pillars, gold sign board, green tiled roof. */
export function makePaifang(ctx: WorldCtx, x: number, z: number, rotY = 0, span = 12): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const red = createToonMaterial('#b8271f');
  const gold = createToonMaterial('#f5a623', { emissive: '#f5a623', emissiveIntensity: 0.12 });
  const tile = createToonMaterial('#2e6e4e');

  // Pillars.
  for (const side of [-1, 1] as const) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 5.6, 10), red);
    pillar.position.set((side * span) / 2, 2.8, 0);
    pillar.castShadow = true;
    g.add(pillar);
    ctx.blockers.push(pillar);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), createToonMaterial('#8d8d8d'));
    base.position.set((side * span) / 2, 0.25, 0);
    g.add(base);
  }

  // Lintels.
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(span + 1.6, 0.55, 0.7), red);
  lintel.position.y = 5.3;
  g.add(lintel);
  const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(span - 1.2, 0.4, 0.6), red);
  lintel2.position.y = 4.3;
  g.add(lintel2);

  // Sign board between the lintels — gold, always readable.
  const signTex = ctx.assets.makeCanvasTexture(256, 64, (c) => {
    c.fillStyle = '#8d1a13';
    c.fillRect(0, 0, 256, 64);
    c.strokeStyle = '#f5a623';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 56);
    c.fillStyle = '#f5c96b';
    c.font = 'bold 40px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('码 城 唐 人 街', 128, 34);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
  for (const side of [1, -1] as const) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.0), signMat);
    sign.position.set(0, 4.8, side * 0.38);
    if (side === -1) sign.rotation.y = Math.PI;
    g.add(sign);
  }

  // Green tiled roof with a slight rise, plus gold ridge caps.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(span + 3, 0.28, 2.1), tile);
  roof.position.y = 5.85;
  roof.castShadow = true;
  g.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(span + 3.4, 0.18, 0.5), gold);
  ridge.position.y = 6.06;
  g.add(ridge);
  for (const side of [-1, 1] as const) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.8), gold);
    tip.position.set((side * (span + 3)) / 2, 6.1, 0);
    tip.rotation.z = side * 0.35;
    g.add(tip);
  }

  ctx.group.add(g);
  ctx.physics.addCylinder(x - (span / 2) * Math.cos(rotY), y + 2.8, z + (span / 2) * Math.sin(rotY), 2.8, 0.5);
  ctx.physics.addCylinder(x + (span / 2) * Math.cos(rotY), y + 2.8, z - (span / 2) * Math.sin(rotY), 2.8, 0.5);
  return g;
}

/* -------------------------------- Pagoda ------------------------------- */

/** Tiered pagoda landmark with glowing paper windows and green tile eaves. */
export function makePagoda(ctx: WorldCtx, x: number, z: number, tiers = 5): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const red = createToonMaterial('#a8231c');
  const tile = createToonMaterial('#2e6e4e');
  const paper = createToonMaterial('#ffe9c0', { emissive: '#ffc96b', emissiveIntensity: 0.26 });
  ctx.nightGlow.push(paper);

  const baseW = 9;
  const tierH = 3.2;
  let cy = 0;
  for (let t = 0; t < tiers; t++) {
    const w = baseW * (1 - t * 0.14);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, w), red);
    body.position.y = cy + tierH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    if (t === 0) ctx.blockers.push(body);

    // Glowing window band on each face.
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, tierH * 0.34, w + 0.08), paper);
    band.position.y = cy + tierH / 2;
    g.add(band);
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, tierH * 0.34, w * 0.72), paper);
    band2.position.y = cy + tierH / 2;
    g.add(band2);

    // Eave slab, wider than the tier, with upturned gold corner tips.
    const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 0.24, w + 2.2), tile);
    eave.position.y = cy + tierH + 0.12;
    eave.castShadow = true;
    g.add(eave);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.6), createToonMaterial('#f5a623'));
      tip.position.set((ex * (w + 2.2)) / 2, cy + tierH + 0.3, (ez * (w + 2.2)) / 2);
      tip.rotation.z = ex * 0.3;
      tip.rotation.x = -ez * 0.3;
      g.add(tip);
    }
    cy += tierH + 0.24;
  }

  // Gold finial.
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 1.6, 8), createToonMaterial('#f5a623', { emissive: '#f5a623', emissiveIntensity: 0.18 }));
  finial.position.y = cy + 0.8;
  g.add(finial);

  ctx.group.add(g);
  ctx.physics.addBox(x, y + cy / 2, z, baseW / 2, cy / 2, baseW / 2);
  return g;
}

/* ---------------------------- Lantern string --------------------------- */

/** A sagging rope of red paper lanterns strung across the street. */
export function makeLanternString(ctx: WorldCtx, from: THREE.Vector3, to: THREE.Vector3, count = 6): void {
  // The rope.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * 0.7;
    pts.push(p);
  }
  const rope = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: '#5a4634' })
  );
  ctx.group.add(rope);

  // Shared lantern materials (one nightGlow entry per string, not per lantern).
  const lanternMat = createToonMaterial('#e03b30', { emissive: '#ff6a4d', emissiveIntensity: 0.3 });
  ctx.nightGlow.push(lanternMat);
  const capMat = createToonMaterial('#f5a623');

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * 0.7 + 0.42;
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lanternMat);
    lantern.scale.y = 1.18;
    lantern.position.copy(p);
    ctx.group.add(lantern);
    for (const dy of [0.33, -0.33]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8), capMat);
      cap.position.set(p.x, p.y + dy, p.z);
      ctx.group.add(cap);
    }
  }
}

/* ------------------------------ Food stalls ---------------------------- */

export type StallVariant = 'noodle' | 'bao' | 'skewer' | 'tea';

const STALL_SIGNS: Record<StallVariant, string> = {
  noodle: '面',
  bao: '包子',
  skewer: '串',
  tea: '茶',
};

/**
 * Street-food stall: wooden counter, cloth canopy, lit hanzi sign, a hanging
 * lantern, and variant dressing (steamer baskets, grill, noodle pot, teapot).
 * Bao and noodle stalls get animated steam.
 */
export function makeFoodStall(
  ctx: WorldCtx,
  x: number,
  z: number,
  rotY = 0,
  variant: StallVariant = 'noodle'
): THREE.Group {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const wood = createToonMaterial('#6d4b32');
  const woodDark = createToonMaterial('#4a382e');

  // Counter.
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.2), wood);
  counter.position.y = 0.5;
  counter.castShadow = true;
  counter.receiveShadow = true;
  g.add(counter);
  ctx.blockers.push(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.4), createToonMaterial('#8a6243'));
  top.position.y = 1.04;
  g.add(top);

  // Canopy on four posts — red cloth with a gold trim edge.
  for (const [px, pz] of [[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.3, 0.09), woodDark);
    post.position.set(px, 1.15, pz);
    g.add(post);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 1.9), createToonMaterial('#c22d24'));
  canopy.position.y = 2.36;
  canopy.rotation.x = -0.08;
  canopy.castShadow = true;
  g.add(canopy);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.14, 0.1, 0.16), createToonMaterial('#f5a623'));
  trim.position.set(0, 2.3, 0.95);
  g.add(trim);

  // Lit sign hanging from the canopy front.
  const signTex = ctx.assets.makeCanvasTexture(96, 96, (c) => {
    c.fillStyle = '#8d1a13';
    c.fillRect(0, 0, 96, 96);
    c.strokeStyle = '#f5c96b';
    c.lineWidth = 5;
    c.strokeRect(4, 4, 88, 88);
    c.fillStyle = '#ffe9c0';
    c.font = `bold ${STALL_SIGNS[variant].length > 1 ? 34 : 56}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(STALL_SIGNS[variant], 48, 52);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false, side: THREE.DoubleSide })
  );
  sign.position.set(1.1, 1.9, 0.97);
  g.add(sign);

  // Hanging lantern on the other corner.
  const lanternMat = createToonMaterial('#e03b30', { emissive: '#ff6a4d', emissiveIntensity: 0.3 });
  ctx.nightGlow.push(lanternMat);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lanternMat);
  lantern.scale.y = 1.2;
  lantern.position.set(-1.15, 1.95, 0.9);
  g.add(lantern);

  // Variant dressing on the counter top.
  const steamAnchors: THREE.Vector3[] = [];
  if (variant === 'bao') {
    // Stacked bamboo steamer baskets.
    const basket = createToonMaterial('#c9a86a');
    for (const [bx, count] of [[-0.7, 3], [0.1, 2]] as const) {
      for (let i = 0; i < count; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12), basket);
        b.position.set(bx, 1.16 + i * 0.15, 0);
        g.add(b);
      }
      steamAnchors.push(new THREE.Vector3(bx, 1.2 + count * 0.15 + 0.25, 0));
    }
  } else if (variant === 'noodle') {
    // Big pot + bowls.
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.34, 12), createToonMaterial('#3c4048'));
    pot.position.set(-0.7, 1.25, 0);
    g.add(pot);
    steamAnchors.push(new THREE.Vector3(-0.7, 1.65, 0));
    const bowlMat = createToonMaterial('#eef1f4');
    for (const bx of [0.2, 0.6, 1.0]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.1, 10), bowlMat);
      bowl.position.set(bx, 1.13, 0.2);
      g.add(bowl);
    }
  } else if (variant === 'skewer') {
    // Grill box with ember glow and a row of skewers.
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 0.5), createToonMaterial('#3c4048'));
    grill.position.set(-0.3, 1.2, 0);
    g.add(grill);
    const ember = createToonMaterial('#ff5a2a', { emissive: '#ff5a2a', emissiveIntensity: 0.5 });
    ctx.nightGlow.push(ember);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.38), ember);
    coals.position.set(-0.3, 1.33, 0);
    g.add(coals);
    const stick = createToonMaterial('#d9b98a');
    for (let i = 0; i < 5; i++) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.035), stick);
      sk.position.set(-0.65 + i * 0.18, 1.4, 0);
      sk.rotation.y = 0.15;
      g.add(sk);
    }
  } else {
    // Tea: pot + cups.
    const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), createToonMaterial('#7a4a3a'));
    teapot.scale.y = 0.8;
    teapot.position.set(-0.6, 1.24, 0);
    g.add(teapot);
    steamAnchors.push(new THREE.Vector3(-0.6, 1.55, 0));
    const cupMat = createToonMaterial('#eef1f4');
    for (const cx of [0.0, 0.35, 0.7]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.09, 8), cupMat);
      cup.position.set(cx, 1.12, 0.25);
      g.add(cup);
    }
  }

  // Steam puffs — bob and fade on the shared animated loop.
  if (steamAnchors.length) {
    const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
    const puffs: THREE.Mesh[] = [];
    for (const a of steamAnchors) {
      for (let i = 0; i < 2; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.04, 8, 6), steamMat.clone());
        puff.position.copy(a);
        puff.userData.base = a.clone();
        puff.userData.phase = Math.random() * Math.PI * 2;
        g.add(puff);
        puffs.push(puff);
      }
    }
    ctx.animated.push((dt, t) => {
      for (const p of puffs) {
        const cycle = (t * 0.6 + (p.userData.phase as number)) % (Math.PI * 2);
        const rise = cycle / (Math.PI * 2);
        p.position.y = (p.userData.base as THREE.Vector3).y + rise * 0.7;
        (p.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - rise);
      }
    });
  }

  ctx.group.add(g);
  ctx.physics.addBox(x, y + 0.6, z, 1.4, 0.6, 0.75, rotY);
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
    c.fillText('便利店  24H', 128, 24);
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
