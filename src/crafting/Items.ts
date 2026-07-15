import itemsData from '../data/items.json';
import type { ItemDef } from '../types';

/** Item registry loaded from JSON — add new items in src/data/items.json. */
const ITEMS = new Map<string, ItemDef>();
for (const item of itemsData as unknown as ItemDef[]) ITEMS.set(item.id, item);

export function getItem(id: string): ItemDef {
  const def = ITEMS.get(id);
  if (def) return def;
  console.warn(`[Items] unknown item id "${id}"`);
  return { id, name: id, description: '', category: 'resource', icon: '❔', stack: 99 };
}

export function allItems(): ItemDef[] {
  return Array.from(ITEMS.values());
}
