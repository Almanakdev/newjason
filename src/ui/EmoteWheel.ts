import { el, button } from '../utils/dom';
import { EMOTES } from '../utils/constants';

/** Quick emote wheel (Q). */
export class EmoteWheel {
  readonly el: HTMLElement;
  private visible = false;

  constructor(root: HTMLElement, onEmote: (id: string) => void) {
    this.el = el('div', 'kp-emote-wheel');
    for (const emote of EMOTES) {
      const b = button('kp-emote-btn', '', () => {
        onEmote(emote.id);
        this.hide();
      });
      b.append(el('div', undefined, emote.icon), el('small', undefined, emote.name));
      this.el.appendChild(b);
    }
    this.el.style.display = 'none';
    root.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  get isOpen(): boolean {
    return this.visible;
  }
}
