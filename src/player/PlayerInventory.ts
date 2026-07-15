import type { EventBus } from '../core/EventBus';
import { getItem } from '../crafting/Items';

/** Player inventory: stackable items, tools, and event notifications. */
export class PlayerInventory {
  private counts: Record<string, number> = {};
  activeTool: string | null = null;

  constructor(private bus: EventBus) {}

  add(id: string, qty = 1, silent = false): void {
    const def = getItem(id);
    this.counts[id] = Math.min((this.counts[id] ?? 0) + qty, def.stack * 99);
    this.bus.emit('item:added', { id, qty });
    if (!silent) this.bus.emit('notify', { text: `+${qty} ${def.name}`, icon: def.icon });
    if (def.category === 'tool' && !this.activeTool) this.activeTool = id;
  }

  remove(id: string, qty = 1): boolean {
    if ((this.counts[id] ?? 0) < qty) return false;
    this.counts[id] -= qty;
    if (this.counts[id] <= 0) delete this.counts[id];
    this.bus.emit('item:removed', { id, qty });
    return true;
  }

  count(id: string): number {
    return this.counts[id] ?? 0;
  }

  has(id: string, qty = 1): boolean {
    return this.count(id) >= qty;
  }

  entries(): [string, number][] {
    return Object.entries(this.counts);
  }

  tools(): string[] {
    return Object.keys(this.counts).filter((id) => getItem(id).category === 'tool');
  }

  serialize(): Record<string, number> {
    return { ...this.counts };
  }

  load(data: Record<string, number>, activeTool: string | null): void {
    this.counts = { ...data };
    this.activeTool = activeTool;
  }
}
