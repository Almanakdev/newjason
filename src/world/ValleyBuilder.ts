import * as THREE from 'three';
import { makeBridge, makeCampfire, makeRock, makeTree, type WorldCtx } from './Props';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight } from './Terrain';
import { POI } from '../utils/constants';

/**
 * Whispergrass Valley — the first exploration region. Grass and flower
 * fields are added by WorldManager (instanced); this builder handles
 * landmarks and set dressing.
 */
export function buildValley(ctx: WorldCtx): THREE.Group {
  const valley = new THREE.Group();
  valley.name = 'region-valley';
  const prevGroup = ctx.group;
  ctx.group = valley;

  // River crossing on the main path.
  makeBridge(ctx, POI.riverBridge.x, POI.riverBridge.z, Math.PI * 0.28, 11);

  // Orin's ranger camp.
  const campY = terrainHeight(POI.orinCamp.x, POI.orinCamp.z);
  const tent = new THREE.Group();
  tent.position.set(POI.orinCamp.x, campY, POI.orinCamp.z);
  const canvasMat = createToonMaterial('#7fae6b');
  const tentBody = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.9, 5), canvasMat);
  tentBody.position.y = 0.95;
  tentBody.castShadow = true;
  tent.add(tentBody);
  const logSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 7), createToonMaterial('#8a6243'));
  logSeat.rotation.z = Math.PI / 2;
  logSeat.position.set(1.6, 0.28, 1.2);
  tent.add(logSeat);
  valley.add(tent);
  ctx.physics.addCylinder(POI.orinCamp.x, campY + 0.9, POI.orinCamp.z, 0.9, 1.5);
  makeCampfire(ctx, POI.orinCamp.x + 2.4, POI.orinCamp.z + 2.2);

  // Valley shrine (a dormant mini-waylight for the next chapter).
  const shrineY = terrainHeight(POI.valleyShrine.x, POI.valleyShrine.z);
  const shrine = new THREE.Group();
  shrine.position.set(POI.valleyShrine.x, shrineY, POI.valleyShrine.z);
  const stoneMat = createToonMaterial('#a8b2bc');
  for (const [sx, sz] of [[-1.2, 0], [1.2, 0]] as const) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), stoneMat);
    pillar.position.set(sx, 1.2, sz);
    pillar.castShadow = true;
    shrine.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.6), stoneMat);
  lintel.position.y = 2.55;
  shrine.add(lintel);
  const dormantCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.4, 0),
    createToonMaterial('#6a7a92', { emissive: '#2f4a66', emissiveIntensity: 0.25 })
  );
  dormantCrystal.position.y = 1.35;
  shrine.add(dormantCrystal);
  ctx.animated.push((_dt, t) => {
    dormantCrystal.rotation.y = t * 0.4;
    dormantCrystal.position.y = 1.35 + Math.sin(t * 1.1) * 0.08;
  });
  valley.add(shrine);
  ctx.physics.addBox(POI.valleyShrine.x - 1.2, shrineY + 1.2, POI.valleyShrine.z, 0.3, 1.2, 0.3);
  ctx.physics.addBox(POI.valleyShrine.x + 1.2, shrineY + 1.2, POI.valleyShrine.z, 0.3, 1.2, 0.3);

  // Picnic spot.
  const picY = terrainHeight(140, 72);
  const blanket = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16), createToonMaterial('#e9c8d0'));
  blanket.rotation.x = -Math.PI / 2;
  blanket.position.set(140, picY + 0.03, 72);
  valley.add(blanket);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.35, 8), createToonMaterial('#b98e60'));
  basket.position.set(140.8, picY + 0.2, 71.5);
  valley.add(basket);

  // Wind chimes hanging from a big amber tree (they sing in chapter two).
  const chimeTree = makeTree(ctx, 158, 66, 'amber', 1.7);
  const chimeMat = createToonMaterial('#d9d9e2', { emissive: '#aebfd9', emissiveIntensity: 0.2 });
  for (let i = 0; i < 3; i++) {
    const chime = new THREE.Group();
    chime.position.set(i * 0.8 - 0.8, 2.6, 1.6);
    const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), createToonMaterial('#6b5a48'));
    stringMesh.position.y = 0.35;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), chimeMat);
    chime.add(stringMesh, tube);
    chimeTree.add(chime);
    ctx.animated.push((_dt, t) => {
      chime.rotation.x = Math.sin(t * 1.4 + i * 2.1) * 0.18;
      chime.rotation.z = Math.cos(t * 1.1 + i * 1.7) * 0.18;
    });
  }

  // Scattered groves and rocks.
  const treeSpots: [number, number, 'round' | 'tall' | 'amber', number][] = [
    [120, 90, 'round', 1.3], [132, 62, 'tall', 1.2], [168, 74, 'round', 1.5],
    [176, 108, 'tall', 1.3], [146, 104, 'round', 1.1], [108, 70, 'round', 1.4],
    [92, 44, 'tall', 1.2], [70, 34, 'round', 1.3], [58, 18, 'amber', 1.2],
    [160, 92, 'round', 0.9], [138, 84, 'tall', 0.95],
  ];
  for (const [tx, tz, variant, s] of treeSpots) makeTree(ctx, tx, tz, variant, s);
  makeRock(ctx, 126, 74, 1.3);
  makeRock(ctx, 154, 58, 1);
  makeRock(ctx, 170, 86, 1.5);
  makeRock(ctx, 112, 84, 0.8);

  ctx.group = prevGroup;
  ctx.group.add(valley);
  return valley;
}
