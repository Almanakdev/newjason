import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';

export interface Interactable {
  id: string;
  position: THREE.Vector3 | (() => THREE.Vector3);
  prompt: string | (() => string);
  radius?: number;
  enabled?: () => boolean;
  onInteract: () => void;
}

/**
 * Tracks nearby interactables, surfaces the closest one as a HUD prompt and
 * dispatches E / tap interactions.
 */
export class InteractionController {
  private interactables = new Map<string, Interactable>();
  private currentId: string | null = null;
  /** HUD binds this to show/hide the interaction prompt. */
  onPromptChange: ((prompt: string | null) => void) | null = null;

  register(item: Interactable): void {
    this.interactables.set(item.id, item);
  }

  unregister(id: string): void {
    this.interactables.delete(id);
    if (this.currentId === id) {
      this.currentId = null;
      this.onPromptChange?.(null);
    }
  }

  get current(): Interactable | null {
    return this.currentId ? (this.interactables.get(this.currentId) ?? null) : null;
  }

  update(playerPos: THREE.Vector3, interactPressed: boolean): void {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.interactables.values()) {
      if (item.enabled && !item.enabled()) continue;
      const pos = typeof item.position === 'function' ? item.position() : item.position;
      const d = pos.distanceTo(playerPos);
      const radius = item.radius ?? GameConfig.interactRadius;
      if (d <= radius && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }

    const newId = best?.id ?? null;
    if (newId !== this.currentId) {
      this.currentId = newId;
      const prompt = best ? (typeof best.prompt === 'function' ? best.prompt() : best.prompt) : null;
      this.onPromptChange?.(prompt);
    }
    if (interactPressed && best) best.onInteract();
  }
}
