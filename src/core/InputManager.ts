/**
 * Unified input for keyboard, mouse, touch (via MobileControls) and gamepad.
 * Systems query state; edges are cleared once per frame by Game.
 */

export type GameAction =
  | 'jump'
  | 'interact'
  | 'tool'
  | 'emote'
  | 'inventory'
  | 'map'
  | 'housing'
  | 'menu'
  | 'quests'
  | 'rotate'
  | 'snap'
  | 'cancel';

const KEY_BINDINGS: Record<string, GameAction> = {
  Space: 'jump',
  KeyE: 'interact',
  KeyF: 'tool',
  KeyQ: 'emote',
  Tab: 'inventory',
  KeyM: 'map',
  KeyH: 'housing',
  Escape: 'menu',
  KeyJ: 'quests',
  KeyR: 'rotate',
  KeyG: 'snap',
  KeyX: 'cancel',
};

export class InputManager {
  private keysDown = new Set<string>();
  private actionsPressed = new Set<GameAction>();
  private lookDX = 0;
  private lookDY = 0;
  private zoomAccum = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private joystick = { x: 0, z: 0 };
  private gamepadButtonsPrev: boolean[] = [];

  /** When true (modal UI open), gameplay input is suppressed. */
  uiMode = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keysDown.add(e.code);
      const action = KEY_BINDINGS[e.code];
      if (action) this.actionsPressed.add(action);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => this.keysDown.clear());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // touch camera handled by MobileControls
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerType === 'touch') return;
      this.lookDX += e.clientX - this.lastPointer.x;
      this.lookDY += e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    const endDrag = () => (this.dragging = false);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAccum += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------- queries ---------- */

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  jogHeld(): boolean {
    return this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || this.joystickMagnitude() > 0.85;
  }

  actionPressed(action: GameAction): boolean {
    return this.actionsPressed.has(action);
  }

  /** Consume an action edge so no other system reacts to it this frame. */
  consumeAction(action: GameAction): boolean {
    if (this.actionsPressed.has(action)) {
      this.actionsPressed.delete(action);
      return true;
    }
    return false;
  }

  /** Movement input in local space: x = strafe, z = forward (−1..1). */
  moveVector(): { x: number; z: number } {
    if (this.uiMode) return { x: 0, z: 0 };
    let x = 0;
    let z = 0;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) z -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) z += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) x -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) x += 1;
    x += this.joystick.x;
    z += this.joystick.z;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  consumeLook(): { x: number; y: number } {
    const out = { x: this.lookDX, y: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return this.uiMode ? { x: 0, y: 0 } : out;
  }

  consumeZoom(): number {
    const z = this.zoomAccum;
    this.zoomAccum = 0;
    return this.uiMode ? 0 : z;
  }

  /* ---------- virtual (touch) input ---------- */

  setJoystick(x: number, z: number): void {
    this.joystick.x = x;
    this.joystick.z = z;
  }

  private joystickMagnitude(): number {
    return Math.hypot(this.joystick.x, this.joystick.z);
  }

  addLook(dx: number, dy: number): void {
    this.lookDX += dx;
    this.lookDY += dy;
  }

  pressVirtual(action: GameAction): void {
    this.actionsPressed.add(action);
  }

  /* ---------- gamepad ---------- */

  pollGamepad(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (!pad) return;
    const dead = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    const jx = dead(pad.axes[0] ?? 0);
    const jz = dead(pad.axes[1] ?? 0);
    if (jx !== 0 || jz !== 0) this.setJoystick(jx, jz);
    else if (this.joystickMagnitude() > 0 && !('ontouchstart' in window)) this.setJoystick(0, 0);
    this.lookDX += dead(pad.axes[2] ?? 0) * 14;
    this.lookDY += dead(pad.axes[3] ?? 0) * 14;

    const buttonMap: Record<number, GameAction> = {
      0: 'jump',
      2: 'interact',
      3: 'tool',
      1: 'cancel',
      9: 'menu',
      4: 'emote',
    };
    pad.buttons.forEach((b, i) => {
      const was = this.gamepadButtonsPrev[i] ?? false;
      if (b.pressed && !was) {
        const action = buttonMap[i];
        if (action) this.actionsPressed.add(action);
      }
      this.gamepadButtonsPrev[i] = b.pressed;
    });
  }

  /** Clear per-frame edges. Called once per frame after all systems update. */
  endFrame(): void {
    this.actionsPressed.clear();
  }
}
