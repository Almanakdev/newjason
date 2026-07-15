import { el, button, clearChildren } from '../utils/dom';
import { getItem } from '../crafting/Items';
import type { CraftingSystem } from '../crafting/CraftingSystem';
import type { PlayerInventory } from '../player/PlayerInventory';
import type { RecipeDef } from '../types';
import type { UIPanel } from './UIManager';

const CATEGORIES: { id: RecipeDef['category']; label: string }[] = [
  { id: 'waylight', label: '✨ Waylight' },
  { id: 'tools', label: '🛠 Tools' },
  { id: 'food', label: '🍲 Food' },
  { id: 'furniture', label: '🪑 Furniture' },
  { id: 'gifts', label: '🎁 Gifts' },
  { id: 'decorations', label: '🎀 Decor' },
];

/** Crafting panel, opened at the community crafting pavilion. */
export class CraftingUI {
  readonly panel: UIPanel;
  private list = el('div', 'kp-panel-scroll');
  private tabs = el('div', 'kp-tabs');
  private category: RecipeDef['category'] = 'waylight';

  constructor(
    onClose: () => void,
    private crafting: CraftingSystem,
    private inventory: PlayerInventory
  ) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, '🔨 Crafting Pavilion'), button('kp-btn kp-close', '✕', onClose));
    root.append(title, this.tabs, this.list);
    this.panel = { id: 'crafting', el: root, onOpen: () => this.refresh() };
  }

  private refresh(): void {
    clearChildren(this.tabs);
    for (const cat of CATEGORIES) {
      const tab = button(`kp-tab${cat.id === this.category ? ' active' : ''}`, cat.label, () => {
        this.category = cat.id;
        this.refresh();
      });
      this.tabs.appendChild(tab);
    }

    clearChildren(this.list);
    const recipes = this.crafting.byCategory(this.category);
    if (recipes.length === 0) {
      this.list.appendChild(el('div', 'kp-empty-hint', 'No recipes in this category yet.'));
      return;
    }
    for (const recipe of recipes) {
      const result = getItem(recipe.result);
      const row = el('div', 'kp-recipe');
      const info = el('div', 'info');
      info.appendChild(el('div', 'title', `${result.name}${recipe.qty > 1 ? ` ×${recipe.qty}` : ''}`));
      const ings = el('div', 'ings');
      recipe.ingredients.forEach((ing, i) => {
        const def = getItem(ing.item);
        const have = this.inventory.count(ing.item);
        const span = el('span', have >= ing.qty ? 'ing-ok' : 'ing-missing', `${def.icon} ${def.name} ${Math.min(have, ing.qty)}/${ing.qty}`);
        ings.appendChild(span);
        if (i < recipe.ingredients.length - 1) ings.appendChild(document.createTextNode('  ·  '));
      });
      info.appendChild(ings);
      const craftBtn = button('kp-btn kp-btn--primary kp-btn--small', 'Craft', () => {
        this.crafting.craft(recipe.id);
        this.refresh();
      });
      craftBtn.disabled = !this.crafting.canCraft(recipe.id);
      row.append(el('div', 'icon', result.icon), info, craftBtn);
      this.list.appendChild(row);
    }
  }
}
