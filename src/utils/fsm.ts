/** Lightweight finite-state machine used by NPCs and Echo spirits. */

export interface FSMState<T> {
  enter?: (owner: T) => void;
  update?: (owner: T, dt: number) => void;
  exit?: (owner: T) => void;
}

export class FSM<T> {
  private states = new Map<string, FSMState<T>>();
  private currentName = '';
  private current: FSMState<T> | null = null;
  timeInState = 0;

  constructor(private owner: T) {}

  add(name: string, state: FSMState<T>): this {
    this.states.set(name, state);
    return this;
  }

  get state(): string {
    return this.currentName;
  }

  set(name: string): void {
    if (name === this.currentName) return;
    const next = this.states.get(name);
    if (!next) {
      console.warn(`[FSM] Unknown state "${name}"`);
      return;
    }
    this.current?.exit?.(this.owner);
    this.currentName = name;
    this.current = next;
    this.timeInState = 0;
    next.enter?.(this.owner);
  }

  update(dt: number): void {
    this.timeInState += dt;
    this.current?.update?.(this.owner, dt);
  }
}
