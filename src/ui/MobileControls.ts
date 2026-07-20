import { el } from '../utils/dom';
import type { InputManager, GameAction } from '../core/InputManager';

/**
 * Touch controls: virtual joystick (lower-left), camera swipe area (right),
 * and context buttons. Respects safe areas via CSS env().
 */
export class MobileControls {
  readonly els: HTMLElement[] = [];
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private joyPointer: number | null = null;
  private lookPointer: number | null = null;
  private lastLook = { x: 0, y: 0 };

  constructor(root: HTMLElement, input: InputManager) {
    // Look area sits underneath the buttons (added first).
    const look = el('div', 'kp-look-area');
    look.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      input.addLook((e.clientX - this.lastLook.x) * 1.4, (e.clientY - this.lastLook.y) * 1.4);
      this.lastLook = { x: e.clientX, y: e.clientY };
    });
    const lookEnd = (e: PointerEvent) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    look.addEventListener('pointerup', lookEnd);
    look.addEventListener('pointercancel', lookEnd);

    // Joystick.
    this.joyBase = el('div', 'kp-joystick');
    this.joyKnob = el('div', 'kp-joystick-knob');
    this.joyBase.appendChild(this.joyKnob);
    const setKnob = (dx: number, dy: number) => {
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    this.joyBase.addEventListener('pointerdown', (e) => {
      this.joyPointer = e.pointerId;
      this.joyBase.setPointerCapture(e.pointerId);
    });
    this.joyBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      const rect = this.joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width / 2 - 18;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      setKnob(dx, dy);
      input.setJoystick(dx / max, dy / max);
    });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      setKnob(0, 0);
      input.setJoystick(0, 0);
    };
    this.joyBase.addEventListener('pointerup', joyEnd);
    this.joyBase.addEventListener('pointercancel', joyEnd);

    // Buttons.
    const buttons = el('div', 'kp-touch-buttons');
    const mkBtn = (label: string, action: GameAction, title: string) => {
      const b = el('button', 'kp-touch-btn', label);
      b.title = title;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.pressVirtual(action);
      });
      buttons.appendChild(b);
      return b;
    };
    // Two rows of three. Interact sits bottom-right, nearest the thumb.
    mkBtn('🗺', 'map', 'Map');
    mkBtn('🎒', 'inventory', 'Inventory');
    mkBtn('☰', 'menu', 'Menu');
    mkBtn('🙂', 'emote', 'Emotes');
    mkBtn('⤴', 'jump', 'Jump');
    mkBtn('E', 'interact', 'Interact');

    this.els.push(look, this.joyBase, buttons);
    for (const e of this.els) root.appendChild(e);
  }

  setVisible(visible: boolean): void {
    for (const e of this.els) e.style.display = visible ? '' : 'none';
  }
}
