import type { EventBus } from '../core/EventBus';
import { friendshipLevel, friendshipLevelName } from '../utils/constants';

/**
 * Friendship progression shared by NPCs, Echo spirits and (later) players.
 * Five levels: Stranger → Acquaintance → Companion → Trusted Friend → Kindred.
 */
export class FriendshipSystem {
  private points: Record<string, number> = {};
  /** Resolve a friendly display name for level-up notifications. */
  nameResolver: (id: string) => string = (id) => id;

  constructor(private bus: EventBus) {}

  add(id: string, delta: number): void {
    const before = friendshipLevel(this.points[id] ?? 0);
    this.points[id] = Math.max(0, (this.points[id] ?? 0) + delta);
    const after = friendshipLevel(this.points[id]);
    const leveledUp = after > before;
    this.bus.emit('friendship:changed', {
      id,
      points: this.points[id],
      level: after,
      leveledUp,
    });
    if (leveledUp) {
      this.bus.emit('notify', {
        text: `${this.nameResolver(id)} is now a ${friendshipLevelName(after)}!`,
        icon: '💛',
      });
    }
  }

  pointsOf(id: string): number {
    return this.points[id] ?? 0;
  }

  level(id: string): number {
    return friendshipLevel(this.points[id] ?? 0);
  }

  levelName(id: string): string {
    return friendshipLevelName(this.level(id));
  }

  all(): Record<string, number> {
    return { ...this.points };
  }

  load(data: Record<string, number>): void {
    this.points = { ...data };
  }
}
