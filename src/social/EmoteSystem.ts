import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerController } from '../player/PlayerController';
import type { ActionName } from '../player/PlayerAnimator';

const EMOTE_TO_ACTION: Record<string, ActionName> = {
  wave: 'wave',
  cheer: 'cheer',
  dance: 'dance',
  sit: 'sit',
  laugh: 'laugh',
  heart: 'heart',
  hug: 'hug',
};

/**
 * Plays emotes locally and broadcasts them on the bus so NPCs react and the
 * network layer can relay them to other players.
 */
export class EmoteSystem {
  constructor(
    private bus: EventBus,
    private audio: AudioManager,
    private player: PlayerController
  ) {}

  play(emoteId: string): void {
    const action = EMOTE_TO_ACTION[emoteId];
    if (!action) return;
    this.player.playAction(action, emoteId === 'sit' ? Infinity : undefined);
    this.audio.playSfx('emote');
    this.bus.emit('player:emote', { emote: emoteId });
  }

  stop(): void {
    this.player.stopAction();
  }
}
