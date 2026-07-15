import { el, button, clearChildren } from '../utils/dom';
import { getItem } from '../crafting/Items';
import type { SpiritManager } from '../spirits/SpiritManager';
import type { FriendshipSystem } from '../characters/FriendshipSystem';
import type { NPCManager } from '../characters/NPCManager';
import type { FishingGame } from '../minigames/FishingGame';
import type { UIPanel } from './UIManager';

const ALL_FISH = ['dawn_minnow', 'amber_carp', 'whisker_trout', 'starlight_eel'];

/** Journal: Echo spirits, villager friendships and the fish collection. */
export class JournalUI {
  readonly panel: UIPanel;
  private tabs = el('div', 'kp-tabs');
  private list = el('div', 'kp-panel-scroll');
  private tab: 'echoes' | 'friends' | 'fish' = 'echoes';

  constructor(
    onClose: () => void,
    private spirits: SpiritManager,
    private friendship: FriendshipSystem,
    private npcs: NPCManager,
    private fishing: FishingGame
  ) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, "📖 Founder's Journal"), button('kp-btn kp-close', '✕', onClose));
    root.append(title, this.tabs, this.list);
    this.panel = { id: 'journal', el: root, onOpen: () => this.refresh() };
  }

  private refresh(): void {
    clearChildren(this.tabs);
    const tabs: { id: typeof this.tab; label: string }[] = [
      { id: 'echoes', label: '✨ Echoes' },
      { id: 'friends', label: '💛 Friends' },
      { id: 'fish', label: '🐟 Fish' },
    ];
    for (const t of tabs) {
      this.tabs.appendChild(
        button(`kp-tab${t.id === this.tab ? ' active' : ''}`, t.label, () => {
          this.tab = t.id;
          this.refresh();
        })
      );
    }

    clearChildren(this.list);
    if (this.tab === 'echoes') {
      for (const echo of this.spirits.all()) {
        const met = echo.calmed || this.spirits.bondOf(echo.def.id) > 0;
        const row = el('div', `kp-journal-row${met ? '' : ' kp-unknown'}`);
        const info = el('div', 'info');
        info.append(
          el('div', 'jname', met ? `${echo.def.name} · ${echo.def.variant} Echo` : '??? · undiscovered'),
          el('div', 'jdesc', met ? `${echo.def.description} Ability: ${echo.def.ability}` : 'A spirit you have not yet befriended.')
        );
        const bond = el('div', 'kp-hearts', '♥'.repeat(Math.min(5, Math.floor(this.spirits.bondOf(echo.def.id) / 5) + (echo.calmed ? 1 : 0))));
        row.append(el('div', 'icon', met ? '✨' : '❔'), info, bond);
        this.list.appendChild(row);
      }
    } else if (this.tab === 'friends') {
      for (const npc of this.npcs.all()) {
        const row = el('div', 'kp-journal-row');
        const info = el('div', 'info');
        info.append(
          el('div', 'jname', `${npc.def.name} · ${npc.def.role}`),
          el('div', 'jdesc', `${this.friendship.pointsOf(npc.def.id)} warmth`)
        );
        const chip = el('span', 'kp-level-chip', this.friendship.levelName(npc.def.id));
        row.append(el('div', 'icon', '🙂'), info, chip);
        this.list.appendChild(row);
      }
    } else {
      const caught = new Set(this.fishing.fishCaught);
      for (const id of ALL_FISH) {
        const def = getItem(id);
        const known = caught.has(id);
        const row = el('div', `kp-journal-row${known ? '' : ' kp-unknown'}`);
        const info = el('div', 'info');
        info.append(
          el('div', 'jname', known ? def.name : '???'),
          el('div', 'jdesc', known ? def.description : 'Not caught yet.')
        );
        row.append(el('div', 'icon', known ? def.icon : '❔'), info);
        this.list.appendChild(row);
      }
    }
  }
}
