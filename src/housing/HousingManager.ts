import * as THREE from 'three';
import { POI } from '../utils/constants';
import { terrainHeight } from '../world/Terrain';
import { allFurniture, buildFurnitureMesh, getFurniture } from './FurnitureCatalog';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { FurnitureDef, PlacedFurniture } from '../types';

const PLOT_HALF = 7.2;

interface PlacedInstance extends PlacedFurniture {
  mesh: THREE.Group;
}

export type PlacementValidity = 'ok' | 'outside' | 'overlap' | 'unsupported';

/**
 * Personal sanctuary building: grid-assisted ghost placement with rotation,
 * snapping, stacking on surfaces, validation and persistence.
 */
export class HousingManager {
  active = false;
  private placed: PlacedInstance[] = [];
  private ghost: THREE.Group | null = null;
  private ghostDef: FurnitureDef | null = null;
  private ghostRot = 0;
  private ghostColor = 0;
  snapEnabled = true;
  private validity: PlacementValidity = 'ok';
  /** UI refresh hook. */
  onChanged: (() => void) | null = null;

  constructor(
    private parent: THREE.Group,
    private bus: EventBus,
    private audio: AudioManager
  ) {}

  get plotCenter(): { x: number; z: number } {
    return POI.homePlot;
  }

  isInsidePlot(x: number, z: number, margin = 6): boolean {
    return (
      Math.abs(x - POI.homePlot.x) < PLOT_HALF + margin &&
      Math.abs(z - POI.homePlot.z) < PLOT_HALF + margin
    );
  }

  get selectedDef(): FurnitureDef | null {
    return this.ghostDef;
  }

  get currentValidity(): PlacementValidity {
    return this.validity;
  }

  catalog(): FurnitureDef[] {
    return allFurniture();
  }

  enterBuildMode(): void {
    this.active = true;
    this.bus.emit('notify', { text: 'Build mode — shape your sanctuary', icon: '🔨' });
    this.onChanged?.();
  }

  exitBuildMode(): void {
    this.active = false;
    this.clearGhost();
    this.onChanged?.();
  }

  select(defId: string): void {
    const def = getFurniture(defId);
    if (!def) return;
    this.clearGhost();
    this.ghostDef = def;
    this.ghostColor = 0;
    this.ghost = buildFurnitureMesh(def, this.ghostColor);
    this.setGhostOpacity(0.55);
    this.parent.add(this.ghost);
    this.onChanged?.();
  }

  private setGhostOpacity(opacity: number, tint?: THREE.Color): void {
    this.ghost?.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshToonMaterial;
        if (m && 'opacity' in m) {
          m.transparent = true;
          m.opacity = opacity;
          if (tint && m.color) m.color.lerp(tint, 0.4);
        }
      }
    });
  }

  rotateGhost(): void {
    this.ghostRot = (this.ghostRot + Math.PI / 4) % (Math.PI * 2);
    this.audio.playSfx('ui');
  }

  toggleSnap(): void {
    this.snapEnabled = !this.snapEnabled;
    this.bus.emit('notify', { text: this.snapEnabled ? 'Snap on' : 'Snap off', icon: '🧲' });
  }

  recolorGhost(): void {
    if (!this.ghostDef?.colors || !this.ghost) return;
    this.ghostColor = (this.ghostColor + 1) % this.ghostDef.colors.length;
    this.parent.remove(this.ghost);
    this.ghost = buildFurnitureMesh(this.ghostDef, this.ghostColor);
    this.setGhostOpacity(0.55);
    this.parent.add(this.ghost);
    this.audio.playSfx('ui');
  }

  /** Ghost floats in front of the player; validity is re-checked each frame. */
  updateGhost(playerX: number, playerZ: number, playerYaw: number): void {
    if (!this.ghost || !this.ghostDef) return;
    let x = playerX + Math.sin(playerYaw) * 2.4;
    let z = playerZ + Math.cos(playerYaw) * 2.4;
    if (this.snapEnabled) {
      x = Math.round(x * 2) / 2;
      z = Math.round(z * 2) / 2;
    }
    const y = this.computeSupportY(x, z, this.ghostDef);
    this.ghost.position.set(x, y, z);
    this.ghost.rotation.y = this.ghostRot;

    this.validity = this.validate(x, z, y, this.ghostDef);
    const tint = this.validity === 'ok' ? new THREE.Color('#7fe07f') : new THREE.Color('#e07f7f');
    // Rebuild tint each frame is wasteful; instead pulse emissive via traversal.
    this.ghost.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshToonMaterial;
        if (m && m.emissive) {
          m.emissive.copy(tint);
          m.emissiveIntensity = 0.35;
        }
      }
    });
  }

  /** Ground height, or the top of a surface item underneath. */
  private computeSupportY(x: number, z: number, def: FurnitureDef): number {
    let y = terrainHeight(x, z);
    for (const p of this.placed) {
      const pDef = getFurniture(p.defId);
      if (!pDef?.surface) continue;
      if (
        Math.abs(x - p.x) < (pDef.size.w + def.size.w) / 2 - 0.1 &&
        Math.abs(z - p.z) < (pDef.size.d + def.size.d) / 2 - 0.1
      ) {
        y = Math.max(y, p.y + pDef.size.h);
      }
    }
    return y;
  }

  private validate(x: number, z: number, y: number, def: FurnitureDef): PlacementValidity {
    if (
      Math.abs(x - POI.homePlot.x) > PLOT_HALF ||
      Math.abs(z - POI.homePlot.z) > PLOT_HALF
    ) {
      return 'outside';
    }
    // No floating: must rest on ground or a surface (computeSupportY guarantees
    // this), but reject if the spot hangs over a steep drop.
    const ground = terrainHeight(x, z);
    if (y - ground > 3) return 'unsupported';
    // Overlap check against placed items on the same level.
    for (const p of this.placed) {
      const pDef = getFurniture(p.defId);
      if (!pDef) continue;
      const overlapX = Math.abs(x - p.x) < (pDef.size.w + def.size.w) / 2 * 0.82;
      const overlapZ = Math.abs(z - p.z) < (pDef.size.d + def.size.d) / 2 * 0.82;
      const overlapY = Math.abs(y - p.y) < Math.max(pDef.size.h, def.size.h) * 0.8;
      if (overlapX && overlapZ && overlapY && !(pDef.surface && y > p.y + pDef.size.h - 0.15)) {
        return 'overlap';
      }
    }
    return 'ok';
  }

  confirmPlace(): boolean {
    if (!this.ghost || !this.ghostDef || this.validity !== 'ok') {
      this.audio.playSfx('fail');
      return false;
    }
    const mesh = buildFurnitureMesh(this.ghostDef, this.ghostColor);
    mesh.position.copy(this.ghost.position);
    mesh.rotation.y = this.ghostRot;
    this.parent.add(mesh);
    this.placed.push({
      defId: this.ghostDef.id,
      x: this.ghost.position.x,
      y: this.ghost.position.y,
      z: this.ghost.position.z,
      rotY: this.ghostRot,
      colorIndex: this.ghostColor,
      mesh,
    });
    this.audio.playSfx('place');
    this.bus.emit('notify', { text: `${this.ghostDef.name} placed`, icon: this.ghostDef.icon });
    this.onChanged?.();
    return true;
  }

  /** Remove the placed item nearest the player (within reach). */
  removeNearest(x: number, z: number): boolean {
    let bestIdx = -1;
    let bestDist = 2.6;
    this.placed.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    if (bestIdx < 0) return false;
    const [removed] = this.placed.splice(bestIdx, 1);
    this.parent.remove(removed.mesh);
    this.audio.playSfx('gather');
    this.onChanged?.();
    return true;
  }

  clearGhost(): void {
    if (this.ghost) this.parent.remove(this.ghost);
    this.ghost = null;
    this.ghostDef = null;
  }

  serialize(): PlacedFurniture[] {
    return this.placed.map(({ mesh: _mesh, ...rest }) => ({ ...rest }));
  }

  load(items: PlacedFurniture[]): void {
    for (const p of this.placed) this.parent.remove(p.mesh);
    this.placed = [];
    for (const item of items) {
      const def = getFurniture(item.defId);
      if (!def) continue;
      const mesh = buildFurnitureMesh(def, item.colorIndex);
      mesh.position.set(item.x, item.y, item.z);
      mesh.rotation.y = item.rotY;
      this.parent.add(mesh);
      this.placed.push({ ...item, mesh });
    }
  }
}
