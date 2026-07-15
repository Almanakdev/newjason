import { el, button, clearChildren } from '../utils/dom';
import { getItem } from '../crafting/Items';
import type { PlayerInventory } from '../player/PlayerInventory';
import type { UIPanel } from './UIManager';

/** Inventory panel (Tab): item grid with tool equipping. */
export class InventoryUI {
  readonly panel: UIPanel;
  private grid = el('div', 'kp-grid');
  onToolEquipped: ((id: string) => void) | null = null;

  constructor(onClose: () => void, private inventory: PlayerInventory) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, '🎒 Inventory'), button('kp-btn kp-close', '✕', onClose));
    const scroll = el('div', 'kp-panel-scroll');
    scroll.appendChild(this.grid);
    root.append(title, scroll);
    this.panel = { id: 'inventory', el: root, onOpen: () => this.refresh() };
  }

  refresh(): void {
    clearChildren(this.grid);
    const entries = this.inventory.entries();
    if (entries.length === 0) {
      this.grid.appendChild(
        el('div', 'kp-empty-hint', 'Nothing yet — gather fiber, wood and stones out in the world.')
      );
      return;
    }
    for (const [id, count] of entries) {
      const def = getItem(id);
      const card = el('div', 'kp-item-card');
      if (def.category === 'tool' && this.inventory.activeTool === id) card.classList.add('equipped');
      card.append(el('div', 'icon', def.icon), el('div', 'name', def.name), el('div', 'count', `×${count}`));
      card.title = def.description;
      if (def.category === 'tool') {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          this.inventory.activeTool = id;
          this.onToolEquipped?.(id);
          this.refresh();
        });
      }
      this.grid.appendChild(card);
    }
  }
}
