import { el } from '../utils/dom';
import { getItem } from '../crafting/Items';
import type { EventBus } from '../core/EventBus';
import type { QuestManager } from '../quests/QuestManager';

/**
 * Always-on HUD: quest tracker, clock/weather, interaction prompt, active
 * tool, notifications and optional FPS readout.
 */
export class HUD {
  private objectiveBox = el('div', 'kp-hud-objective');
  private clockBox = el('div', 'kp-hud-clock');
  private clockText = el('span');
  private weatherIcon = el('span', undefined, '☀️');
  private fpsText = el('span', 'kp-fps');
  private promptBox = el('div', 'kp-prompt');
  private toolSlot = el('div', 'kp-toolslot');
  private notifyStack = el('div', 'kp-notify-stack');
  /** Last rendered objective state, so we only bump on an actual change. */
  private lastObjectiveSig = '';
  showFps = false;

  constructor(
    root: HTMLElement,
    private bus: EventBus,
    private quests: QuestManager
  ) {
    this.clockBox.append(this.weatherIcon, this.clockText, this.fpsText);
    this.promptBox.style.display = 'none';
    this.objectiveBox.style.display = 'none';
    this.toolSlot.style.display = 'none';
    root.append(this.objectiveBox, this.clockBox, this.promptBox, this.toolSlot, this.notifyStack);

    bus.on('notify', ({ text, icon }) => this.pushNotification(text, icon));
    bus.on('weather:changed', () => undefined); // icon set from update()
    const refresh = () => this.refreshObjectives();
    bus.on('quest:started', refresh);
    bus.on('quest:advanced', refresh);
    bus.on('quest:completed', refresh);
    bus.on('objective:progress', refresh);
    bus.on('item:added', refresh);
    bus.on('item:removed', refresh);
    this.refreshObjectives();
  }

  setPrompt(prompt: string | null): void {
    if (!prompt) {
      this.promptBox.style.display = 'none';
      return;
    }
    this.promptBox.innerHTML = '';
    const key = el('span', 'kp-key', 'E');
    this.promptBox.append(key, document.createTextNode(prompt));
    this.promptBox.style.display = '';
  }

  setTool(itemId: string | null): void {
    if (!itemId) {
      this.toolSlot.style.display = 'none';
      return;
    }
    const def = getItem(itemId);
    this.toolSlot.innerHTML = '';
    this.toolSlot.append(document.createTextNode(def.icon), el('span', undefined, 'F'));
    this.toolSlot.style.display = '';
    this.toolSlot.title = def.name;
  }

  refreshObjectives(): void {
    const tracked = this.quests.tracked();
    if (!tracked) {
      this.objectiveBox.style.display = 'none';
      return;
    }
    // Signature of the current state, so we only animate on a real change.
    const sig = tracked
      ? `${tracked.questTitle}|${tracked.stepTitle}|${tracked.objectives
          .map((o) => `${o.label}:${o.current}/${o.required}`)
          .join(',')}`
      : '';
    const changed = sig !== this.lastObjectiveSig;
    this.lastObjectiveSig = sig;

    this.objectiveBox.style.display = '';
    this.objectiveBox.innerHTML = '';
    this.objectiveBox.append(
      el('div', 'kp-quest-title', `📜 ${tracked.questTitle}`),
      el('div', 'kp-step-title', tracked.stepTitle)
    );
    for (const o of tracked.objectives) {
      const row = el('div', `kp-obj${o.done ? ' done' : ''}`);
      const countText = o.required > 1 ? ` (${o.current}/${o.required})` : '';
      row.append(el('span', undefined, o.done ? '✅' : '⬜'), el('span', undefined, `${o.label}${countText}`));
      this.objectiveBox.appendChild(row);
    }

    if (changed) {
      // Restart the animation: removing and re-adding in one frame is a no-op,
      // so force a reflow between.
      this.objectiveBox.classList.remove('bump');
      void this.objectiveBox.offsetWidth;
      this.objectiveBox.classList.add('bump');
    }
  }

  updateClock(timeOfDay: number, day: number, weatherIcon: string, fps: number): void {
    const h = Math.floor(timeOfDay);
    const m = Math.floor((timeOfDay - h) * 60);
    this.clockText.textContent = `Day ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.weatherIcon.textContent = weatherIcon;
    this.fpsText.textContent = this.showFps ? ` ${Math.round(fps)} fps` : '';
  }

  private pushNotification(text: string, icon?: string): void {
    const note = el('div', 'kp-notify', `${icon ?? 'ℹ️'} ${text}`);
    this.notifyStack.appendChild(note);
    while (this.notifyStack.children.length > 5) this.notifyStack.firstChild?.remove();
    window.setTimeout(() => note.classList.add('fade'), 3200);
    window.setTimeout(() => note.remove(), 3800);
  }
}
