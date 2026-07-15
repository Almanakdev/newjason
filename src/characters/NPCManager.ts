import * as THREE from 'three';
import npcData from '../data/npcs.json';
import { NPC } from './NPC';
import type { EventBus } from '../core/EventBus';
import type { NPCDef } from '../types';

/** Spawns and updates all villagers; reacts to weather and player emotes. */
export class NPCManager {
  private npcs = new Map<string, NPC>();

  constructor(parent: THREE.Group, bus: EventBus, getPlayerPos: () => THREE.Vector3) {
    for (const def of npcData as unknown as NPCDef[]) {
      this.npcs.set(def.id, new NPC(def, parent));
    }
    bus.on('weather:changed', ({ type }) => {
      const raining = type === 'drizzle' || type === 'storm';
      for (const npc of this.npcs.values()) npc.raining = raining;
    });
    bus.on('player:emote', () => {
      const pp = getPlayerPos();
      for (const npc of this.npcs.values()) {
        if (npc.position.distanceTo(pp) < 5) npc.reactToEmote();
      }
    });
  }

  get(id: string): NPC | undefined {
    return this.npcs.get(id);
  }

  all(): NPC[] {
    return Array.from(this.npcs.values());
  }

  nameOf(id: string): string {
    return this.npcs.get(id)?.def.name ?? id;
  }

  update(dt: number, t: number, timeOfDay: number, playerPos: THREE.Vector3): void {
    for (const npc of this.npcs.values()) npc.update(dt, t, timeOfDay, playerPos);
  }
}
