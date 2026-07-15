import { clamp } from '../utils/math';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerInventory } from '../player/PlayerInventory';
import type { PlayerController } from '../player/PlayerController';
import type { InputManager } from '../core/InputManager';

export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'done';

export interface FishingView {
  phase: FishingPhase;
  tension: number; // 0..1 marker position while reeling
  zoneMin: number;
  zoneMax: number;
  progress: number; // 0..1 catch progress
  message: string;
}

interface FishEntry {
  item: string;
  weight: number;
  nightOnly?: boolean;
}

const POND_FISH: FishEntry[] = [
  { item: 'dawn_minnow', weight: 5 },
  { item: 'amber_carp', weight: 3 },
  { item: 'whisker_trout', weight: 1.6 },
  { item: 'starlight_eel', weight: 0.5, nightOnly: true },
];

const RIVER_FISH: FishEntry[] = [
  { item: 'dawn_minnow', weight: 4 },
  { item: 'whisker_trout', weight: 3 },
  { item: 'amber_carp', weight: 1.5 },
  { item: 'starlight_eel', weight: 0.4, nightOnly: true },
];

/**
 * Fishing: cast → wait → strike on the bite → keep the line tension inside
 * the sweet zone to reel in. Rarity depends on location and time of day.
 */
export class FishingGame {
  phase: FishingPhase = 'idle';
  private timer = 0;
  private tension = 0.5;
  private drift = 0.2;
  private progress = 0;
  private zoneMin = 0.35;
  private zoneMax = 0.72;
  private location: 'pond' | 'river' = 'pond';
  private isNight = false;
  private caught = new Set<string>();
  onView: ((view: FishingView | null) => void) | null = null;

  constructor(
    private bus: EventBus,
    private audio: AudioManager,
    private inventory: PlayerInventory,
    private player: PlayerController
  ) {}

  get fishCaught(): string[] {
    return Array.from(this.caught);
  }

  loadCaught(list: string[]): void {
    this.caught = new Set(list);
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  canFish(): boolean {
    return this.inventory.has('fishing_rod');
  }

  begin(location: 'pond' | 'river', isNight: boolean): void {
    if (this.active || !this.canFish()) return;
    this.location = location;
    this.isNight = isNight;
    this.phase = 'casting';
    this.timer = 0.7;
    this.player.inputEnabled = false;
    this.player.playAction('fish', Infinity);
    this.audio.playSfx('splash');
    this.bus.emit('minigame:started', { id: 'fishing' });
    this.push('You cast the line…');
  }

  private push(message: string): void {
    this.onView?.({
      phase: this.phase,
      tension: this.tension,
      zoneMin: this.zoneMin,
      zoneMax: this.zoneMax,
      progress: this.progress,
      message,
    });
  }

  private end(success: boolean, message: string): void {
    this.phase = 'done';
    this.push(message);
    this.bus.emit('minigame:ended', { id: 'fishing', success });
    window.setTimeout(() => {
      this.phase = 'idle';
      this.onView?.(null);
      this.player.stopAction();
      this.player.inputEnabled = true;
    }, 1400);
  }

  cancel(): void {
    if (!this.active) return;
    this.phase = 'idle';
    this.onView?.(null);
    this.player.stopAction();
    this.player.inputEnabled = true;
  }

  private pickFish(): string {
    const table = (this.location === 'pond' ? POND_FISH : RIVER_FISH).filter(
      (f) => !f.nightOnly || this.isNight
    );
    const total = table.reduce((s, f) => s + f.weight, 0);
    let roll = Math.random() * total;
    for (const f of table) {
      roll -= f.weight;
      if (roll <= 0) return f.item;
    }
    return table[0].item;
  }

  update(dt: number, input: InputManager): void {
    if (!this.active) return;
    const pressed = input.consumeAction('interact');
    const holding = input.isDown('KeyE') || input.isDown('Space');

    switch (this.phase) {
      case 'casting':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'waiting';
          this.timer = 1.5 + Math.random() * 3;
          this.push('Waiting for a nibble…');
        }
        break;
      case 'waiting':
        this.timer -= dt;
        if (pressed) {
          this.end(false, 'Too eager — the water stills.');
          this.audio.playSfx('fail');
          return;
        }
        if (this.timer <= 0) {
          this.phase = 'bite';
          this.timer = 0.9;
          this.audio.playSfx('bite');
          this.push('! Something bites — press E!');
        }
        break;
      case 'bite':
        this.timer -= dt;
        if (pressed) {
          this.phase = 'reeling';
          this.tension = 0.5;
          this.progress = 0;
          this.drift = 0.25 + Math.random() * 0.2;
          this.zoneMin = 0.3 + Math.random() * 0.12;
          this.zoneMax = this.zoneMin + 0.32;
          this.push('Hold E to raise tension — keep it in the glow!');
        } else if (this.timer <= 0) {
          this.end(false, 'It slipped away…');
          this.audio.playSfx('fail');
        }
        break;
      case 'reeling': {
        // Fish pulls down, holding E pulls up; occasional jerks.
        this.drift += (Math.random() - 0.5) * dt * 2.2;
        this.drift = clamp(this.drift, 0.14, 0.5);
        this.tension += (holding ? 0.75 : -this.drift - 0.35) * dt;
        this.tension = clamp(this.tension, 0, 1);
        if (this.tension <= 0.001) {
          this.end(false, 'The line went slack. It escaped!');
          this.audio.playSfx('fail');
          return;
        }
        if (this.tension >= 0.999) {
          this.end(false, 'The line snapped!');
          this.audio.playSfx('fail');
          return;
        }
        const inZone = this.tension >= this.zoneMin && this.tension <= this.zoneMax;
        this.progress += (inZone ? 0.4 : -0.12) * dt;
        this.progress = clamp(this.progress, 0, 1);
        if (this.progress >= 1) {
          const fish = this.pickFish();
          const isNew = !this.caught.has(fish);
          this.caught.add(fish);
          this.inventory.add(fish, 1);
          this.audio.playSfx('success');
          this.end(true, isNew ? 'A new species for your journal!' : 'A fine catch!');
          return;
        }
        this.push(inZone ? 'Steady…' : holding ? 'Ease off!' : 'Reel it in!');
        break;
      }
      case 'done':
        break;
      case 'idle':
        break;
    }
  }
}
