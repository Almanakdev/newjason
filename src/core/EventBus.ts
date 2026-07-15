import type { DayPhase, WeatherType } from '../types';

/** Every event that can travel through the game, with its payload type. */
export interface GameEvents {
  'dialogue:started': { npcId: string };
  'dialogue:ended': { npcId: string; nodeId: string };
  'item:added': { id: string; qty: number };
  'item:removed': { id: string; qty: number };
  'item:crafted': { id: string; qty: number };
  'resource:gathered': { nodeId: string; item: string };
  'echo:calmed': { echoId: string };
  'echo:bonded': { echoId: string; points: number };
  'waylight:restored': { id: string };
  'quest:started': { id: string };
  'quest:advanced': { id: string; step: number };
  'quest:completed': { id: string };
  'objective:progress': { questId: string };
  'friendship:changed': { id: string; points: number; level: number; leveledUp: boolean };
  'time:phase': { phase: DayPhase };
  'weather:changed': { type: WeatherType };
  notify: { text: string; icon?: string };
  'save:completed': { manual: boolean };
  'player:emote': { emote: string };
  'flag:set': { flag: string };
  'ui:modal': { open: boolean };
  'minigame:started': { id: string };
  'minigame:ended': { id: string; success: boolean };
  'net:playerJoined': { id: string; name: string };
  'net:playerLeft': { id: string };
  'community:progress': { projectId: string; current: number; required: number };
  'perf:changed': { preset: string };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/**
 * Typed publish/subscribe bus. Systems communicate through events instead of
 * holding references to each other wherever possible.
 */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        (h as Handler<K>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${String(event)}" failed`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
