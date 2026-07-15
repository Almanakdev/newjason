import chapter1 from '../data/quests/chapter1.json';
import sideQuests from '../data/quests/side.json';
import type { EventBus } from '../core/EventBus';
import type { PlayerInventory } from '../player/PlayerInventory';
import type {
  DialogueEffects,
  ObjectiveDef,
  QuestDef,
  QuestSaveState,
  QuestStep,
} from '../types';
import { POI, type PoiId } from '../utils/constants';

export interface TrackedObjective {
  label: string;
  current: number;
  required: number;
  done: boolean;
}

/**
 * JSON-driven quest engine. Objectives complete via bus events; step
 * completion effects are executed through the same effect runner dialogue
 * uses, so quests can grant items, friendship, flags and follow-up quests.
 */
export class QuestManager {
  private defs = new Map<string, QuestDef>();
  private states = new Map<string, QuestSaveState>();
  /** Injected by Game (shared with DialogueController). */
  runEffects: (e?: DialogueEffects) => void = () => undefined;

  constructor(
    private bus: EventBus,
    private inventory: PlayerInventory
  ) {
    const questDefs = [
      ...(chapter1 as unknown as QuestDef[]),
      ...(sideQuests as unknown as QuestDef[]),
    ];
    for (const def of questDefs) {
      this.defs.set(def.id, def);
    }

    bus.on('dialogue:ended', ({ npcId }) => this.progressEvent('talk', npcId));
    bus.on('item:added', () => this.reevaluateGather());
    bus.on('item:crafted', ({ id }) => this.progressEvent('craft', id));
    bus.on('echo:calmed', ({ echoId }) => this.progressEvent('calmEcho', echoId));
    bus.on('waylight:restored', ({ id }) => this.progressEvent('restoreWaylight', id));
  }

  /* ------------------------------ queries ------------------------------ */

  def(id: string): QuestDef | undefined {
    return this.defs.get(id);
  }

  isActive(id: string): boolean {
    const s = this.states.get(id);
    return !!s && !s.completed;
  }

  isCompleted(id: string): boolean {
    return this.states.get(id)?.completed ?? false;
  }

  isStarted(id: string): boolean {
    return this.states.has(id);
  }

  stepIndex(id: string): number {
    return this.states.get(id)?.step ?? -1;
  }

  questAt(id: string, step: number): boolean {
    const s = this.states.get(id);
    return !!s && !s.completed && s.step === step;
  }

  activeQuests(): { def: QuestDef; state: QuestSaveState }[] {
    const out: { def: QuestDef; state: QuestSaveState }[] = [];
    for (const [id, state] of this.states) {
      const def = this.defs.get(id);
      if (def && !state.completed) out.push({ def, state });
    }
    return out;
  }

  completedQuests(): QuestDef[] {
    const out: QuestDef[] = [];
    for (const [id, state] of this.states) {
      const def = this.defs.get(id);
      if (def && state.completed) out.push(def);
    }
    return out;
  }

  private currentStep(id: string): QuestStep | null {
    const def = this.defs.get(id);
    const state = this.states.get(id);
    if (!def || !state || state.completed) return null;
    return def.steps[state.step] ?? null;
  }

  /** Up to three pinned objectives for the HUD tracker (main quest first). */
  tracked(): { questTitle: string; stepTitle: string; objectives: TrackedObjective[] } | null {
    const active = this.activeQuests().sort((a, b) =>
      a.def.type === 'main' ? -1 : b.def.type === 'main' ? 1 : 0
    );
    const first = active[0];
    if (!first) return null;
    const step = first.def.steps[first.state.step];
    if (!step) return null;
    return {
      questTitle: first.def.title,
      stepTitle: step.title,
      objectives: step.objectives.slice(0, 3).map((o, i) => this.objectiveStatus(first.state, o, i)),
    };
  }

  objectiveStatus(state: QuestSaveState, o: ObjectiveDef, index: number): TrackedObjective {
    const required = o.count ?? 1;
    let current = state.progress[`${state.step}:${index}`] ?? 0;
    if (o.type === 'gather' && o.item) {
      current = Math.max(current, Math.min(this.inventory.count(o.item), required));
    }
    return { label: o.label, current, required, done: current >= required };
  }

  /* ------------------------------ lifecycle ----------------------------- */

  start(id: string): void {
    if (this.states.has(id)) return;
    const def = this.defs.get(id);
    if (!def) {
      console.warn(`[QuestManager] unknown quest "${id}"`);
      return;
    }
    this.states.set(id, { id, step: 0, progress: {}, completed: false });
    this.bus.emit('quest:started', { id });
    this.bus.emit('notify', { text: `New quest: ${def.title}`, icon: '📜' });
    this.checkStep(id);
  }

  /** Interactables (shrines, waylights, repairs) report through here. */
  notifyInteract(targetId: string): void {
    this.progressEvent('interact', targetId);
  }

  /** Location objectives, checked from the game loop. */
  checkReach(px: number, pz: number): void {
    for (const { def, state } of this.activeQuests()) {
      const step = def.steps[state.step];
      if (!step) continue;
      step.objectives.forEach((o, i) => {
        if (o.type !== 'reach' || !o.target) return;
        const poi = POI[o.target as PoiId];
        if (!poi) return;
        const key = `${state.step}:${i}`;
        if ((state.progress[key] ?? 0) >= 1) return;
        if (Math.hypot(px - poi.x, pz - poi.z) < 7) {
          state.progress[key] = 1;
          this.bus.emit('objective:progress', { questId: def.id });
          this.checkStep(def.id);
        }
      });
    }
  }

  private progressEvent(type: ObjectiveDef['type'], target: string): void {
    for (const { def, state } of this.activeQuests()) {
      const step = def.steps[state.step];
      if (!step) continue;
      let touched = false;
      step.objectives.forEach((o, i) => {
        if (o.type !== type) return;
        const matches =
          type === 'craft' ? o.item === target : (o.target ?? o.item) === target;
        if (!matches) return;
        const key = `${state.step}:${i}`;
        const required = o.count ?? 1;
        if ((state.progress[key] ?? 0) >= required) return;
        state.progress[key] = (state.progress[key] ?? 0) + 1;
        touched = true;
      });
      if (touched) {
        this.bus.emit('objective:progress', { questId: def.id });
        this.checkStep(def.id);
      }
    }
  }

  private reevaluateGather(): void {
    for (const { def, state } of this.activeQuests()) {
      const step = def.steps[state.step];
      if (!step) continue;
      if (step.objectives.some((o) => o.type === 'gather')) {
        this.bus.emit('objective:progress', { questId: def.id });
        this.checkStep(def.id);
      }
    }
  }

  private checkStep(id: string): void {
    const def = this.defs.get(id);
    const state = this.states.get(id);
    const step = this.currentStep(id);
    if (!def || !state || !step) return;
    const allDone = step.objectives.every((o, i) => this.objectiveStatus(state, o, i).done);
    if (!allDone) return;

    this.runEffects(step.onComplete);
    state.step++;
    state.progress = {};
    if (state.step >= def.steps.length) {
      state.completed = true;
      this.bus.emit('quest:completed', { id });
      this.bus.emit('notify', { text: `Quest complete: ${def.title}`, icon: '🌟' });
    } else {
      this.bus.emit('quest:advanced', { id, step: state.step });
      const next = def.steps[state.step];
      if (next) this.bus.emit('notify', { text: next.title, icon: '📍' });
      // A freshly entered step may already be satisfied (e.g. items in hand).
      this.checkStep(id);
    }
  }

  serialize(): QuestSaveState[] {
    return Array.from(this.states.values()).map((s) => ({ ...s, progress: { ...s.progress } }));
  }

  load(states: QuestSaveState[]): void {
    this.states.clear();
    for (const s of states) this.states.set(s.id, { ...s, progress: { ...s.progress } });
  }
}
