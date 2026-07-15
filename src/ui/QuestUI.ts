import { el, button, clearChildren } from '../utils/dom';
import type { QuestManager } from '../quests/QuestManager';
import type { UIPanel } from './UIManager';

/** Quest log (J): active quests with live objectives, plus completed list. */
export class QuestUI {
  readonly panel: UIPanel;
  private list = el('div', 'kp-panel-scroll');

  constructor(onClose: () => void, private quests: QuestManager) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, '📜 Quest Journal'), button('kp-btn kp-close', '✕', onClose));
    root.append(title, this.list);
    this.panel = { id: 'quests', el: root, onOpen: () => this.refresh() };
  }

  private refresh(): void {
    clearChildren(this.list);
    const active = this.quests.activeQuests();
    if (active.length === 0) {
      this.list.appendChild(el('div', 'kp-empty-hint', 'No active quests. Talk to the villagers of Kiriko Vale!'));
    }
    for (const { def, state } of active) {
      const block = el('div', 'kp-quest-block');
      const titleRow = el('div', 'qtitle');
      titleRow.append(el('span', undefined, def.title), el('span', 'qtype', def.type.toUpperCase()));
      block.appendChild(titleRow);
      block.appendChild(el('div', 'qdesc', def.description));
      const step = def.steps[state.step];
      if (step) {
        block.appendChild(el('div', 'kp-step-title', `Now: ${step.title}`));
        step.objectives.forEach((o, i) => {
          const status = this.quests.objectiveStatus(state, o, i);
          const row = el('div', `kp-obj${status.done ? ' done' : ''}`);
          const countText = status.required > 1 ? ` (${status.current}/${status.required})` : '';
          row.append(el('span', undefined, status.done ? '✅' : '⬜'), el('span', undefined, `${o.label}${countText}`));
          block.appendChild(row);
        });
        if (step.hint) block.appendChild(el('div', 'qdesc', `💡 ${step.hint}`));
      }
      this.list.appendChild(block);
    }

    const completed = this.quests.completedQuests();
    if (completed.length > 0) {
      this.list.appendChild(el('h2', undefined, 'Completed'));
      for (const def of completed) {
        const block = el('div', 'kp-quest-block');
        block.appendChild(el('div', 'qtitle', `🌟 ${def.title}`));
        this.list.appendChild(block);
      }
    }
  }
}
