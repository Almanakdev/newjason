import recipesData from '../data/recipes.json';
import { getItem } from './Items';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerInventory } from '../player/PlayerInventory';
import type { PlayerController } from '../player/PlayerController';
import type { RecipeDef } from '../types';

/** Recipe registry + crafting execution. Recipes live in src/data/recipes.json. */
export class CraftingSystem {
  private recipes = new Map<string, RecipeDef>();

  constructor(
    private bus: EventBus,
    private audio: AudioManager,
    private inventory: PlayerInventory,
    private player: PlayerController
  ) {
    for (const r of recipesData as unknown as RecipeDef[]) this.recipes.set(r.id, r);
  }

  all(): RecipeDef[] {
    return Array.from(this.recipes.values());
  }

  byCategory(category: RecipeDef['category']): RecipeDef[] {
    return this.all().filter((r) => r.category === category);
  }

  get(id: string): RecipeDef | undefined {
    return this.recipes.get(id);
  }

  canCraft(id: string): boolean {
    const r = this.recipes.get(id);
    if (!r) return false;
    return r.ingredients.every((ing) => this.inventory.has(ing.item, ing.qty));
  }

  missing(id: string): { item: string; have: number; need: number }[] {
    const r = this.recipes.get(id);
    if (!r) return [];
    return r.ingredients
      .filter((ing) => !this.inventory.has(ing.item, ing.qty))
      .map((ing) => ({ item: ing.item, have: this.inventory.count(ing.item), need: ing.qty }));
  }

  craft(id: string): boolean {
    const r = this.recipes.get(id);
    if (!r || !this.canCraft(id)) {
      this.audio.playSfx('fail');
      return false;
    }
    for (const ing of r.ingredients) this.inventory.remove(ing.item, ing.qty);
    this.inventory.add(r.result, r.qty, true);
    this.player.playAction('craft');
    this.audio.playSfx('craft');
    const def = getItem(r.result);
    this.bus.emit('item:crafted', { id: r.result, qty: r.qty });
    this.bus.emit('notify', { text: `Crafted ${def.name}!`, icon: def.icon });
    return true;
  }
}
