import * as THREE from 'three';
import {
  makeBench,
  makeBuilding,
  makeFlag,
  makeLampPost,
  makePlanter,
  makePowerPole,
  makeRock,
  makeShrub,
  makeStringLights,
  makeTorii,
  makeTree,
  makeWire,
  type WorldCtx,
} from './Props';
import { createToonMaterial } from '../shaders/toon';
import { terrainHeight, POND } from './Terrain';
import { POI } from '../utils/constants';

/**
 * Sunrise Waystation — the central social hub. Everything is positioned via
 * the POI table so quests, NPC schedules and the map stay in sync.
 */
export function buildVillage(ctx: WorldCtx): THREE.Group {
  const village = new THREE.Group();
  village.name = 'region-village';
  const prevGroup = ctx.group;
  ctx.group = village;

  // --- Buildings ring the plaza ---
  makeBuilding(ctx, {
    x: POI.cafe.x, z: POI.cafe.z, rotY: Math.PI * 0.25,
    w: 7, d: 5.5, stories: 2, wall: '#e8a06b', roof: '#c94b3d', awning: '#a83a2e',
    name: 'Ember Kettle Café', icon: '🫖', chimney: true,
  });
  makeBuilding(ctx, {
    x: POI.generalStore.x, z: POI.generalStore.z, rotY: -Math.PI * 0.22,
    w: 6.5, d: 5, stories: 2, wall: '#f2ead8', roof: '#3a5aa8', awning: '#4f8f8a',
    name: 'Drift & Sundry', icon: '🧺',
  });
  makeBuilding(ctx, {
    x: POI.tailor.x, z: POI.tailor.z, rotY: -Math.PI * 0.5,
    w: 5.5, d: 4.5, wall: '#e6ecf2', roof: '#c94b3d', awning: '#7e6bb5',
    name: 'Thread & Cloud', icon: '🧵',
  });
  makeBuilding(ctx, {
    x: POI.spiritClinic.x, z: POI.spiritClinic.z, rotY: Math.PI * 0.5,
    w: 6, d: 5, wall: '#eaf0e4', roof: '#2f4a86', awning: '#4f9e8f',
    name: 'Echo Haven', icon: '🌿',
  });
  // --- Residential lane: low wooden homes facing a concrete street ---
  // (long low silhouettes, warm timber walls, wide multi-pane windows)
  const laneHomes: { x: number; z: number; wall: string; roof: string; chimney?: boolean }[] = [
    { x: -7, z: -15, wall: '#c96a2e', roof: '#c25a33' },
    { x: 7, z: -17, wall: '#7a4a2e', roof: '#d97a3d' },
    { x: -7, z: -23, wall: '#b5451f', roof: '#8a4a30', chimney: true }, // Mira's
    { x: 7, z: -26, wall: '#5a7a96', roof: '#c25a33' }, // Sera's
    { x: -7, z: -31, wall: '#8a5a36', roof: '#b5502c' },
    { x: 7, z: -34, wall: '#c96a2e', roof: '#7a4632' },
  ];
  for (const home of laneHomes) {
    makeBuilding(ctx, {
      x: home.x,
      z: home.z,
      rotY: home.x < 0 ? Math.PI / 2 : -Math.PI / 2, // doors face the lane
      w: 6.5,
      d: 4.6,
      wall: home.wall,
      roof: home.roof,
      roofRise: 0.85,
      wideWindows: true,
      awning: '#4a3b2e',
      chimney: home.chimney,
    });
    // Wild green hugging each house front.
    const front = home.x < 0 ? home.x + 3.4 : home.x - 3.4;
    makeShrub(ctx, front, home.z - 2.4, 1.1);
    makeShrub(ctx, front, home.z + 2.5, 0.9);
  }
  makeShrub(ctx, -3.4, -12, 1.2);
  makeShrub(ctx, 3.6, -20.5, 1);
  makeShrub(ctx, -3.5, -28, 0.9);
  makeShrub(ctx, 3.4, -36.5, 1.15);

  // Wires criss-cross the lane between telegraph poles.
  const laneP1 = makePowerPole(ctx, -10.5, -13);
  const laneP2 = makePowerPole(ctx, 10.5, -21);
  const laneP3 = makePowerPole(ctx, -10.5, -29);
  const laneP4 = makePowerPole(ctx, 10.5, -37);
  makeWire(ctx, laneP1, laneP2);
  makeWire(ctx, laneP2, laneP3);
  makeWire(ctx, laneP3, laneP4);

  // Bram's place on the west rise.
  makeBuilding(ctx, { x: -28, z: 12, rotY: Math.PI * 0.65, w: 5, d: 4.2, wall: '#e9e4d8', roof: '#3a5aa8' });

  // Village threshold gate on the valley road.
  makeTorii(ctx, 42, 9.3, Math.atan2(12, 2));

  // Telegraph poles with sagging lines along the main street.
  const pole1 = makePowerPole(ctx, 9, -8);
  const pole2 = makePowerPole(ctx, 20, -3);
  const pole3 = makePowerPole(ctx, 31, 1);
  const pole4 = makePowerPole(ctx, -8, 6);
  makeWire(ctx, pole4, pole1);
  makeWire(ctx, pole1, pole2);
  makeWire(ctx, pole2, pole3);

  // --- Community crafting pavilion (open structure) ---
  const pav = new THREE.Group();
  const py = terrainHeight(POI.craftingPavilion.x, POI.craftingPavilion.z);
  pav.position.set(POI.craftingPavilion.x, py, POI.craftingPavilion.z);
  const postMat = createToonMaterial('#8a6243');
  for (const [px, pz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3, 7), postMat);
    post.position.set(px, 1.5, pz);
    post.castShadow = true;
    pav.add(post);
    ctx.physics.addCylinder(POI.craftingPavilion.x + px, py + 1.5, POI.craftingPavilion.z + pz, 1.5, 0.2);
  }
  const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.7, 4), createToonMaterial('#3a5aa8'));
  pavRoof.rotation.y = Math.PI / 4;
  pavRoof.position.y = 3.8;
  pavRoof.castShadow = true;
  pav.add(pavRoof);
  // Workbench (the crafting interactable target).
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), createToonMaterial('#a97e52'));
  bench.position.set(0, 0.45, 0);
  bench.castShadow = true;
  pav.add(bench);
  const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 1.2), createToonMaterial('#c8b190'));
  anvilTop.position.set(0, 0.95, 0);
  pav.add(anvilTop);
  ctx.physics.addBox(POI.craftingPavilion.x, py + 0.5, POI.craftingPavilion.z, 1.1, 0.5, 0.55);
  village.add(pav);

  // --- Festival stage ---
  const stage = new THREE.Group();
  const sy = terrainHeight(POI.festivalStage.x, POI.festivalStage.z);
  stage.position.set(POI.festivalStage.x, sy, POI.festivalStage.z);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.6, 10), createToonMaterial('#b98e60'));
  platform.position.y = 0.3;
  platform.castShadow = true;
  platform.receiveShadow = true;
  stage.add(platform);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.16, 8, 20, Math.PI), createToonMaterial('#d9a05a'));
  arch.position.y = 0.6;
  stage.add(arch);
  village.add(stage);
  ctx.physics.addCylinder(POI.festivalStage.x, sy + 0.3, POI.festivalStage.z, 0.3, 4.3);
  ctx.blockers.push(platform);
  makeStringLights(
    ctx,
    new THREE.Vector3(POI.festivalStage.x - 3, sy + 3.4, POI.festivalStage.z),
    new THREE.Vector3(POI.festivalStage.x + 3, sy + 3.4, POI.festivalStage.z)
  );

  // --- Notice board & friendship board ---
  const boardTex = ctx.assets.makeCanvasTexture(256, 192, (c) => {
    c.fillStyle = '#e9dbbc';
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = '#fdf7e8';
    for (const [nx, ny] of [[24, 26], [122, 40], [64, 104], [160, 112]] as const) {
      c.fillRect(nx, ny, 68, 52);
    }
    c.fillStyle = '#33415c';
    c.font = 'bold 20px sans-serif';
    c.fillText('Village Notices', 60, 20);
  });
  const noticeBoard = new THREE.Group();
  const ny = terrainHeight(POI.noticeBoard.x, POI.noticeBoard.z);
  noticeBoard.position.set(POI.noticeBoard.x, ny, POI.noticeBoard.z);
  noticeBoard.rotation.y = -Math.PI * 0.35;
  const bFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 0.14), createToonMaterial('#8a6243'));
  bFrame.position.y = 1.7;
  const bFace = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.4),
    new THREE.MeshBasicMaterial({ map: boardTex })
  );
  bFace.position.set(0, 1.7, 0.08);
  for (const lx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), createToonMaterial('#8a6243'));
    leg.position.set(lx, 0.55, 0);
    noticeBoard.add(leg);
  }
  noticeBoard.add(bFrame, bFace);
  village.add(noticeBoard);
  ctx.physics.addBox(POI.noticeBoard.x, ny + 1, POI.noticeBoard.z, 1.2, 1, 0.2, -Math.PI * 0.35);

  // --- Community garden ---
  const garden = new THREE.Group();
  const gy = terrainHeight(POI.garden.x, POI.garden.z);
  garden.position.set(POI.garden.x, gy, POI.garden.z);
  const soilMat = createToonMaterial('#7a5a3d');
  const sproutMat = createToonMaterial('#8fd06e');
  for (let row = 0; row < 3; row++) {
    const soil = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 0.9), soilMat);
    soil.position.set(0, 0.12, row * 1.4 - 1.4);
    garden.add(soil);
    for (let i = 0; i < 4; i++) {
      const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 5), sproutMat);
      sprout.position.set(i * 1.1 - 1.65, 0.4, row * 1.4 - 1.4);
      garden.add(sprout);
    }
  }
  village.add(garden);

  // --- Pond pier ---
  const pier = new THREE.Group();
  const pierY = terrainHeight(POND.x + POND.radius - 1, POND.z) + 0.25;
  pier.position.set(POND.x + POND.radius - 2.2, pierY, POND.z);
  pier.rotation.y = Math.PI / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.4), createToonMaterial('#a97e52'));
  deck.castShadow = true;
  pier.add(deck);
  for (const [px, pz] of [[-1.4, -0.5], [-1.4, 0.5], [1.4, -0.5], [1.4, 0.5]] as const) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 6), createToonMaterial('#8a6243'));
    pile.position.set(px, -0.5, pz);
    pier.add(pile);
  }
  village.add(pier);
  ctx.physics.addBox(POND.x + POND.radius - 2.2, pierY, POND.z, 0.7, 0.1, 1.7, 0);

  // --- Plaza dressing ---
  makeBench(ctx, -4, 10.5, Math.PI);
  makeBench(ctx, 4, 10.5, Math.PI);
  makeBench(ctx, 10.5, -4, Math.PI / 2);
  makeBench(ctx, -10.5, 4, -Math.PI / 2);
  for (const [lx, lz] of [[-11, -11], [11, 11], [-11, 11], [11, -11], [22, -6], [-20, 8]] as const) {
    makeLampPost(ctx, lx, lz);
  }
  makePlanter(ctx, -6, -10);
  makePlanter(ctx, 6, -10);
  makePlanter(ctx, 19, 6);
  makePlanter(ctx, -16, -8);
  makeFlag(ctx, 9, 14, '#e8a04c');
  makeFlag(ctx, -9, 18, '#7fae6b');

  // Plaza string lights — festival bulbs criss-crossing between the lamps.
  const lampY = (lx: number, lz: number) => terrainHeight(lx, lz) + 2.62;
  makeStringLights(ctx, new THREE.Vector3(-11, lampY(-11, -11), -11), new THREE.Vector3(11, lampY(11, -11), -11));
  makeStringLights(ctx, new THREE.Vector3(11, lampY(11, -11), -11), new THREE.Vector3(11, lampY(11, 11), 11));
  makeStringLights(ctx, new THREE.Vector3(11, lampY(11, 11), 11), new THREE.Vector3(-11, lampY(-11, 11), 11));
  makeStringLights(ctx, new THREE.Vector3(-11, lampY(-11, 11), 11), new THREE.Vector3(-11, lampY(-11, -11), -11));

  // Trees hide the transition to open terrain — one giant amber landmark
  // shades the plaza's eastern edge.
  makeTree(ctx, -32, -18, 'round', 1.2);
  makeTree(ctx, 30, 18, 'amber', 2.5);
  makeTree(ctx, -18, 28, 'round', 1);
  makeTree(ctx, 24, -22, 'tall', 1.1);
  makeTree(ctx, -34, 2, 'tall', 1.3);
  makeTree(ctx, 36, -6, 'round', 1);
  makeRock(ctx, -26, 22, 1.1);
  makeRock(ctx, 33, 6, 0.9);

  // --- Player home plot marker ---
  const plot = new THREE.Group();
  const ply = terrainHeight(POI.homePlot.x, POI.homePlot.z);
  plot.position.set(POI.homePlot.x, ply, POI.homePlot.z);
  const postM = createToonMaterial('#a97e52');
  for (const [cx, cz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]] as const) {
    const cornerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), postM);
    cornerPost.position.set(cx, 0.5, cz);
    plot.add(cornerPost);
  }
  const plotSignTex = ctx.assets.makeCanvasTexture(256, 128, (c) => {
    c.fillStyle = '#f7efdd';
    c.beginPath();
    c.roundRect(4, 4, 248, 120, 20);
    c.fill();
    c.strokeStyle = '#8a6243';
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = '#33415c';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.fillText('🏡 Your Sanctuary', 128, 58);
    c.font = '22px sans-serif';
    c.fillText('Press H to build', 128, 96);
  });
  const plotSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1),
    new THREE.MeshBasicMaterial({ map: plotSignTex, transparent: true })
  );
  plotSign.position.set(0, 1.4, -7.6);
  plotSign.rotation.y = Math.PI;
  plot.add(plotSign);
  village.add(plot);

  ctx.group = prevGroup;
  ctx.group.add(village);
  return village;
}
