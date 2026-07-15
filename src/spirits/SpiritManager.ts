import * as THREE from 'three';
import spiritData from '../data/spirits.json';
import { Echo } from './Echo';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { SpiritDef } from '../types';

/**
 * Spawns Echo spirits, tracks bonds and calming, and answers queries from
 * quests and the journal UI.
 */
export class SpiritManager {
  private echoes = new Map<string, Echo>();
  private bonds: Record<string, number> = {};

  constructor(
    parent: THREE.Group,
    private bus: EventBus,
    private audio: AudioManager
  ) {
    for (const def of spiritData as unknown as SpiritDef[]) {
      this.echoes.set(def.id, new Echo(def, parent));
    }
  }

  get(id: string): Echo | undefined {
    return this.echoes.get(id);
  }

  all(): Echo[] {
    return Array.from(this.echoes.values());
  }

  nameOf(id: string): string {
    return this.echoes.get(id)?.def.name ?? id;
  }

  bondOf(id: string): number {
    return this.bonds[id] ?? 0;
  }

  addBond(id: string, delta: number): void {
    this.bonds[id] = (this.bonds[id] ?? 0) + delta;
    this.bus.emit('echo:bonded', { echoId: id, points: this.bonds[id] });
  }

  calm(id: string): void {
    const echo = this.echoes.get(id);
    if (!echo || echo.calmed) return;
    echo.calm();
    this.addBond(id, 10);
    this.audio.playSfx('chime');
    this.bus.emit('echo:calmed', { echoId: id });
    this.bus.emit('notify', { text: `${echo.def.name} feels safe again!`, icon: '✨' });
  }

  /** Give a gift; favorite gifts create much stronger bonds. */
  giveGift(id: string, itemId: string): boolean {
    const echo = this.echoes.get(id);
    if (!echo) return false;
    const favorite = echo.def.favoriteGift === itemId;
    this.addBond(id, favorite ? 8 : 3);
    this.audio.playSfx(favorite ? 'success' : 'pickup');
    this.bus.emit('notify', {
      text: favorite
        ? `${echo.def.name} adores the gift!`
        : `${echo.def.name} accepts the gift.`,
      icon: favorite ? '💖' : '🎁',
    });
    return true;
  }

  serialize(): { bonds: Record<string, number>; calmed: string[] } {
    return {
      bonds: { ...this.bonds },
      calmed: this.all().filter((e) => e.calmed).map((e) => e.def.id),
    };
  }

  load(bonds: Record<string, number>, calmed: string[]): void {
    this.bonds = { ...bonds };
    for (const id of calmed) {
      const echo = this.echoes.get(id);
      if (echo) echo.calmed = true;
    }
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, isNight: boolean): void {
    for (const echo of this.echoes.values()) echo.update(dt, t, playerPos, isNight);
  }
}
