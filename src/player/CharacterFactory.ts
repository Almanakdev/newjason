import * as THREE from 'three';
import { createToonMaterial, addOutline } from '../shaders/toon';
import { SKIN_TONES, HAIR_COLORS, CLOTH_COLORS } from '../utils/constants';
import type { Appearance } from '../types';

/**
 * Procedural stylized character: friendly proportions, big readable hands and
 * feet, layered clothing, expressive face. Every part is driven by the
 * Appearance indices so the same factory builds players and NPCs.
 * Replaceable later by production GLB rigs via AssetManager.
 */

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  height: number;
  hipHeight: number;
}

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

export function createCharacter(appearance: Appearance, opts: { outline?: boolean } = {}): CharacterRig {
  const a = appearance;
  const widthScale = a.bodyType === 0 ? 0.9 : a.bodyType === 2 ? 1.14 : 1;
  const skin = createToonMaterial(pick(SKIN_TONES, a.skinTone));
  const hair = createToonMaterial(pick(HAIR_COLORS, a.hairColor));
  const jacket = createToonMaterial(pick(CLOTH_COLORS, a.jacket));
  const shirt = createToonMaterial(pick(CLOTH_COLORS, a.shirt));
  const pants = createToonMaterial(pick(CLOTH_COLORS, a.pants));
  const shoes = createToonMaterial(pick(CLOTH_COLORS, a.shoes));

  const sleeveless = a.sleeves === 0;
  const topMat = sleeveless ? shirt : jacket;
  const armMat = sleeveless ? skin : jacket;

  const root = new THREE.Group();
  root.name = 'character';
  // Anime-teen proportions (~6 heads tall): high hips, long slim legs,
  // narrow sloped shoulders, compact head. Total height unchanged (1.56m)
  // so the physics capsule and camera framing stay valid.
  const hipHeight = 0.88;
  const hips = new THREE.Group();
  hips.position.y = hipHeight;
  root.add(hips);

  /* --------- Legs (pivot at hip) — long and slim --------- */
  const soleMat = createToonMaterial('#f2efe6');
  const makeLeg = (side: 1 | -1): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(0.105 * widthScale * side, 0, 0);
    // Shorts cover to the knee…
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055 * widthScale, 0.24, 4, 8), pants);
    legMesh.position.y = -0.19;
    legMesh.castShadow = true;
    // …bare shin below (summer-village style, straight off the model sheet).
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.042 * widthScale, 0.34, 4, 8), skin);
    shin.position.y = -0.56;
    shin.castShadow = true;
    // Low-profile sneaker with a white sole.
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), shoes);
    foot.scale.set(1.1, 0.55, 1.7);
    foot.position.set(0, -0.775, 0.05);
    foot.castShadow = true;
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.26), soleMat);
    sole.position.set(0, -0.815, 0.055);
    g.add(legMesh, shin, foot, sole);
    return g;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  hips.add(legL, legR);

  /* --------- Torso: slim core, narrow shoulders --------- */
  const torso = new THREE.Group();
  hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * widthScale, 0.22, 4, 10), topMat);
  body.position.y = 0.17;
  body.castShadow = true;
  torso.add(body);
  if (!sleeveless) {
    // Shirt shows at the chest — layered clothing under the jacket.
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.09 * widthScale, 10, 8), shirt);
    chest.scale.set(1, 1.2, 0.5);
    chest.position.set(0, 0.2, 0.115 * widthScale + 0.02);
    torso.add(chest);
  }
  // Neck.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), skin);
  neck.position.y = 0.42;
  torso.add(neck);

  /* --------- Arms (pivot at shoulder) — thin, hands at mid-thigh --------- */
  const gloveMat = a.gloves > 0 ? createToonMaterial('#8a6243') : skin;
  const makeArm = (side: 1 | -1): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(0.19 * widthScale * side, 0.34, 0);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.36, 4, 8), armMat);
    armMesh.position.y = -0.25;
    armMesh.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), gloveMat);
    hand.position.y = -0.5;
    hand.castShadow = true;
    g.add(armMesh, hand);
    // natural resting angle — no T-pose
    g.rotation.z = side * -0.12;
    return g;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  torso.add(armL, armR);

  /* --------- Head + face (built at legacy scale, shrunk as a group) ------ */
  const head = new THREE.Group();
  head.position.y = 0.54;
  head.scale.setScalar(0.62); // compact anime head; features keep their layout
  torso.add(head);
  const headScale: [number, number, number] =
    a.faceShape === 1 ? [0.94, 1.08, 0.94] : a.faceShape === 2 ? [1.06, 0.95, 1] : [1, 1, 1];
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 14), skin);
  skull.scale.set(...headScale);
  skull.castShadow = true;
  head.add(skull);
  if (opts.outline) addOutline(skull, 0.035);

  const eyeMat = createToonMaterial('#2b2233');
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), eyeMat);
    eye.position.set(0.085 * side, 0.03, 0.2);
    if (a.eyes === 1) eye.scale.y = 0.45; // sleepy
    if (a.eyes === 2) eye.scale.setScalar(1.3); // wide
    if (a.eyes === 3) eye.scale.set(1.1, 0.8, 1); // gentle
    head.add(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), hair);
    brow.position.set(0.085 * side, 0.105, 0.205);
    if (a.brows === 1) brow.rotation.z = 0;
    if (a.brows === 2) brow.rotation.z = side * -0.35;
    if (a.brows === 0) brow.rotation.z = side * 0.15;
    head.add(brow);
  }
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI),
    createToonMaterial('#8a4a3d')
  );
  mouth.position.set(0, -0.075, 0.205);
  mouth.rotation.x = Math.PI;
  if (a.mouth === 1) mouth.scale.setScalar(0.6);
  if (a.mouth === 2) mouth.scale.set(1.35, 1.2, 1);
  head.add(mouth);

  // Blush — instant warmth.
  const blushMat = createToonMaterial('#f2a1a1', { transparent: true, opacity: 0.55 });
  for (const side of [-1, 1] as const) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), blushMat);
    blush.position.set(0.14 * side, -0.04, 0.195);
    blush.rotation.y = side * 0.5;
    head.add(blush);
  }

  /* --------- Hair --------- */
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hair
  );
  cap.position.y = 0.03;
  cap.scale.set(headScale[0] * 1.02, headScale[1], headScale[2] * 1.02);
  head.add(cap);
  switch (a.hairstyle % 6) {
    case 1: { // wind tuft
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), hair);
      tuft.position.set(0.04, 0.27, 0.03);
      tuft.rotation.z = -0.5;
      head.add(tuft);
      break;
    }
    case 2: { // long braid
      const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.4, 4, 8), hair);
      braid.position.set(0, -0.18, -0.22);
      braid.rotation.x = 0.35;
      head.add(braid);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hair);
      tip.position.set(0, -0.44, -0.31);
      head.add(tip);
      break;
    }
    case 3: { // cloud curls
      for (let i = 0; i < 4; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hair);
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        curl.position.set(Math.cos(ang) * 0.16, 0.2, Math.sin(ang) * 0.16);
        head.add(curl);
      }
      break;
    }
    case 4: { // side sweep
      const sweep = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hair);
      sweep.scale.set(1.15, 0.55, 1);
      sweep.position.set(0.09, 0.13, 0.13);
      sweep.rotation.z = -0.3;
      head.add(sweep);
      break;
    }
    case 5: { // messy spikes — anime-kid energy
      const spikeSpots: [number, number, number, number, number][] = [
        // [x, y, z, tiltZ, tiltX]
        [0, 0.26, 0.02, 0, -0.15],
        [0.11, 0.22, 0.06, -0.55, -0.2],
        [-0.11, 0.22, 0.05, 0.55, -0.2],
        [0.07, 0.22, -0.13, -0.3, 0.5],
        [-0.06, 0.23, -0.14, 0.25, 0.55],
        [0.13, 0.17, -0.05, -0.75, 0.15],
        [-0.14, 0.16, -0.04, 0.75, 0.15],
      ];
      for (const [sx, sy, sz, tz, tx] of spikeSpots) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.17, 5), hair);
        spike.position.set(sx, sy, sz);
        spike.rotation.set(tx, 0, tz);
        head.add(spike);
      }
      // Choppy fringe over the forehead.
      for (const fx of [-0.09, 0, 0.09]) {
        const fringe = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 5), hair);
        fringe.position.set(fx, 0.14, 0.18);
        fringe.rotation.x = 2.6;
        head.add(fringe);
      }
      break;
    }
  }

  /* --------- Accessories --------- */
  if (a.hat === 1) { // traveler beanie
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      createToonMaterial(pick(CLOTH_COLORS, (a.jacket + 3) % CLOTH_COLORS.length))
    );
    beanie.position.y = 0.08;
    head.add(beanie);
  } else if (a.hat === 2) { // ranger beret
    const beret = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), createToonMaterial('#7fae6b'));
    beret.scale.set(1.3, 0.4, 1.3);
    beret.position.set(0.06, 0.2, 0);
    beret.rotation.z = -0.2;
    head.add(beret);
  } else if (a.hat === 3) { // straw sunhat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.03, 14), createToonMaterial('#e5ce8f'));
    brim.position.y = 0.14;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12), createToonMaterial('#e5ce8f'));
    crown.position.y = 0.22;
    head.add(brim, crown);
  }

  if (a.scarf > 0) {
    const scarfMat = createToonMaterial(pick(CLOTH_COLORS, (a.jacket + 5) % CLOTH_COLORS.length));
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.042, 8, 14), scarfMat);
    wrap.position.y = 0.44;
    wrap.rotation.x = Math.PI / 2;
    torso.add(wrap);
    if (a.scarf === 1) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.032), scarfMat);
      tail.position.set(0.05, 0.32, 0.12);
      tail.rotation.x = 0.15;
      torso.add(tail);
    }
  }

  if (a.backpack > 0) {
    const packColor = a.backpack === 2 ? '#7fae6b' : '#e0d6c2';
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), createToonMaterial(packColor));
    pack.position.set(0, 0.18, -0.17);
    torso.add(pack);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.09, 0.13), createToonMaterial('#b9a689'));
    flap.position.set(0, 0.29, -0.17);
    torso.add(flap);
  }

  if (a.pin > 0) {
    const pinColors = ['#f5d76b', '#7fae6b', '#5f8fc9'];
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), createToonMaterial(pinColors[(a.pin - 1) % 3], { emissive: pinColors[(a.pin - 1) % 3], emissiveIntensity: 0.4 }));
    pin.position.set(-0.07, 0.28, 0.115 * widthScale + 0.03);
    torso.add(pin);
  }

  return { root, hips, torso, head, armL, armR, legL, legR, height: 1.56, hipHeight };
}

/** Floating name tag used by NPCs and remote players. */
export function makeNameTag(name: string, color = '#33415c'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const c = canvas.getContext('2d');
  if (c) {
    c.font = 'bold 34px sans-serif';
    c.textAlign = 'center';
    const w = Math.min(240, c.measureText(name).width + 36);
    c.fillStyle = 'rgba(250, 246, 236, 0.92)';
    c.beginPath();
    c.roundRect(128 - w / 2, 10, w, 52, 26);
    c.fill();
    c.fillStyle = color;
    c.fillText(name, 128, 47);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.5, 0.42, 1);
  sprite.position.y = 2.05;
  sprite.renderOrder = 5;
  return sprite;
}
