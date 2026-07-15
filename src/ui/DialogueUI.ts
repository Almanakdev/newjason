import { el, button, clearChildren } from '../utils/dom';
import type { AudioManager } from '../core/AudioManager';
import type { DialogueController, DialogueView } from '../characters/DialogueController';

const PORTRAIT_COLORS = ['#d96a5a', '#7fae6b', '#5f8fc9', '#7e6bb5', '#e8a04c', '#4f9e8f', '#c96b9e', '#8a7a68'];

/**
 * Cinematic dialogue box: portrait, typewriter text, choices, skip and a
 * collapsible history. Click/tap or E advances.
 */
export class DialogueUI {
  readonly el: HTMLElement;
  private portrait = el('div', 'kp-portrait');
  private speaker = el('div', 'kp-speaker');
  private text = el('div', 'kp-dialogue-text');
  private nextHint = el('div', 'kp-dialogue-next', '▼ continue');
  private choicesBox = el('div', 'kp-choices');
  private historyBox = el('div', 'kp-dialogue-history');
  private history: string[] = [];
  private typeTimer: number | null = null;
  private fullLine = '';
  private typing = false;

  constructor(
    root: HTMLElement,
    private controller: DialogueController,
    private audio: AudioManager
  ) {
    this.el = el('div', 'kp-dialogue');
    const head = el('div', 'kp-dialogue-head');
    head.append(this.portrait, this.speaker);
    const tools = el('div', 'kp-dialogue-tools');
    const historyBtn = button('kp-btn kp-btn--small', '🕮', () => {
      this.historyBox.style.display = this.historyBox.style.display === 'none' ? '' : 'none';
    });
    historyBtn.title = 'Dialogue history';
    const skipBtn = button('kp-btn kp-btn--small', 'Skip ⏭', () => this.controller.skip());
    tools.append(historyBtn, skipBtn);
    this.historyBox.style.display = 'none';
    this.el.append(tools, head, this.text, this.nextHint, this.choicesBox, this.historyBox);
    this.el.style.display = 'none';
    root.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.advance();
    });

    controller.onUpdate = (view) => this.render(view);
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  /** E key routes here while dialogue is open. */
  advance(): void {
    if (this.typing) {
      this.finishTyping();
    } else {
      this.controller.advance();
    }
  }

  private render(view: DialogueView | null): void {
    if (!view) {
      this.el.style.display = 'none';
      this.history = [];
      this.historyBox.style.display = 'none';
      clearChildren(this.historyBox);
      return;
    }
    this.el.style.display = '';
    const colorIdx = Math.abs([...view.npcId].reduce((s, c) => s + c.charCodeAt(0), 0)) % PORTRAIT_COLORS.length;
    this.portrait.style.background = PORTRAIT_COLORS[colorIdx];
    this.portrait.textContent = view.speaker.charAt(0);
    this.speaker.textContent = view.speaker;

    clearChildren(this.choicesBox);
    if (view.choices) {
      this.nextHint.style.display = 'none';
      for (const choice of view.choices) {
        this.choicesBox.appendChild(
          button('kp-choice', choice.text, () => {
            this.audio.playSfx('ui');
            this.controller.choose(choice);
          })
        );
      }
    } else {
      this.nextHint.style.display = '';
    }

    this.history.push(`${view.speaker}: ${view.line}`);
    const histLine = el('div', undefined, this.history[this.history.length - 1]);
    this.historyBox.appendChild(histLine);
    this.historyBox.scrollTop = this.historyBox.scrollHeight;

    this.startTyping(view.line);
  }

  private startTyping(line: string): void {
    if (this.typeTimer !== null) window.clearInterval(this.typeTimer);
    this.fullLine = line;
    this.typing = true;
    this.text.textContent = '';
    let i = 0;
    this.typeTimer = window.setInterval(() => {
      i++;
      this.text.textContent = line.slice(0, i);
      if (i % 3 === 0) this.audio.playSfx('dialogue');
      if (i >= line.length) this.finishTyping();
    }, 18);
  }

  private finishTyping(): void {
    if (this.typeTimer !== null) window.clearInterval(this.typeTimer);
    this.typeTimer = null;
    this.text.textContent = this.fullLine;
    this.typing = false;
  }
}
