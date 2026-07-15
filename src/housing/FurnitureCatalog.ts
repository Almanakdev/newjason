import * as THREE from 'three';
import furnitureData from '../data/furniture.json';
import { createToonMaterial } from '../shaders/toon';
import type { FurnitureDef } from '../types';

const DEFS = new Map<string, FurnitureDef>();
for (const def of furnitureData as unknown as FurnitureDef[]) DEFS.set(def.id, def);

export function allFurniture(): FurnitureDef[] {
  return Array.from(DEFS.values());
}

export function getFurniture(id: string): FurnitureDef | undefined {
  return DEFS.get(id);
}

/** Build the display mesh for a furniture piece. Origin sits on the floor. */
export function buildFurnitureMesh(def: FurnitureDef, colorIndex = 0): THREE.Group {
  const g = new THREE.Group();
  const color = def.colors?.[colorIndex] ?? def.color;
  const mat = createToonMaterial(color);
  const wood = createToonMaterial('#8a6243');
  const { w, h, d } = def.size;

  switch (def.id) {
    case 'wooden_bed': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), wood);
      frame.position.y = 0.15;
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.22, d * 0.92), mat);
      mattress.position.y = 0.4;
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.14, 0.35), createToonMaterial('#f5f1e6'));
      pillow.position.set(0, 0.56, -d / 2 + 0.3);
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.08), wood);
      headboard.position.set(0, 0.5, -d / 2);
      g.add(frame, mattress, pillow, headboard);
      break;
    }
    case 'round_table': {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 12), mat);
      top.position.y = h;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h, 8), wood);
      leg.position.y = h / 2;
      g.add(top, leg);
      break;
    }
    case 'cozy_chair': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), mat);
      seat.position.y = 0.42;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, 0.12), mat);
      back.position.set(0, 0.75, -d / 2 + 0.06);
      g.add(seat, back);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), wood);
        leg.position.set((lx * (w - 0.1)) / 2, 0.21, (lz * (d - 0.1)) / 2);
        g.add(leg);
      }
      break;
    }
    case 'shelf': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      frame.position.y = h / 2;
      g.add(frame);
      for (let i = 1; i <= 2; i++) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.05, d * 0.8), mat);
        board.position.y = (h / 3) * i;
        g.add(board);
      }
      break;
    }
    case 'lantern_lamp': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h, 6), wood);
      pole.position.y = h / 2;
      const shade = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        createToonMaterial('#ffe9b0', { emissive: '#ffca6b', emissiveIntensity: 0.8 })
      );
      shade.position.y = h;
      const light = new THREE.PointLight('#ffc873', 0.9, 6, 1.8);
      light.position.y = h;
      g.add(pole, shade, light);
      break;
    }
    case 'rug': {
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 16), mat);
      rug.position.y = 0.015;
      g.add(rug);
      break;
    }
    case 'potted_plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 8), createToonMaterial('#c96b52'));
      pot.position.y = 0.15;
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat);
      leaves.position.y = 0.55;
      g.add(pot, leaves);
      break;
    }
    case 'storage_chest': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), wood);
      box.position.y = (h * 0.7) / 2;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI), mat);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = h * 0.7;
      g.add(box, lid);
      break;
    }
    case 'wall_section': {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      wall.position.y = h / 2;
      g.add(wall);
      break;
    }
    case 'floor_tile': {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat);
      tile.position.y = 0.04;
      g.add(tile);
      break;
    }
    case 'garden_plot': {
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), createToonMaterial('#7a5a3d'));
      soil.position.y = 0.1;
      g.add(soil);
      for (let i = 0; i < 3; i++) {
        const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 5), createToonMaterial('#8fd06e'));
        sprout.position.set(i * 0.5 - 0.5, 0.3, 0);
        g.add(sprout);
      }
      break;
    }
    case 'window_frame': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      frame.position.y = h / 2;
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.75, h * 0.75, d * 0.5),
        createToonMaterial('#cfe8f2', { transparent: true, opacity: 0.6 })
      );
      glass.position.y = h / 2;
      g.add(frame, glass);
      break;
    }
    case 'doorway': {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, d), wood);
        post.position.set((side * (w - 0.14)) / 2, h / 2, 0);
        g.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), wood);
      lintel.position.y = h - 0.08;
      g.add(lintel);
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.y = h / 2;
      g.add(box);
    }
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
