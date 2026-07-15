import type { EventBus } from '../core/EventBus';
import type { InputManager } from '../core/InputManager';

export interface UIPanel {
  id: string;
  el: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Owns the DOM overlay. One modal panel at a time; while a modal is open,
 * gameplay input is suppressed via InputManager.uiMode.
 */
export class UIManager {
  readonly root: HTMLElement;
  private panels = new Map<string, UIPanel>();
  private openId: string | null = null;

  constructor(
    private bus: EventBus,
    private input: InputManager
  ) {
    const root = document.getElementById('ui-root');
    if (!root) throw new Error('Missing #ui-root element');
    this.root = root;
  }

  register(panel: UIPanel): void {
    this.panels.set(panel.id, panel);
    panel.el.style.display = 'none';
    this.root.appendChild(panel.el);
  }

  isOpen(id?: string): boolean {
    return id ? this.openId === id : this.openId !== null;
  }

  get currentPanel(): string | null {
    return this.openId;
  }

  open(id: string): void {
    if (this.openId === id) return;
    this.closeAll(true);
    const panel = this.panels.get(id);
    if (!panel) return;
    panel.el.style.display = '';
    this.openId = id;
    this.input.uiMode = true;
    panel.onOpen?.();
    this.bus.emit('ui:modal', { open: true });
  }

  toggle(id: string): void {
    if (this.openId === id) this.closeAll();
    else this.open(id);
  }

  closeAll(silent = false): void {
    if (this.openId) {
      const panel = this.panels.get(this.openId);
      if (panel) {
        panel.el.style.display = 'none';
        panel.onClose?.();
      }
      this.openId = null;
    }
    this.input.uiMode = false;
    if (!silent) this.bus.emit('ui:modal', { open: false });
  }
}
