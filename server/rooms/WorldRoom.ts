import type { Server, Socket } from 'socket.io';

interface PlayerSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: string;
  time: number;
}

interface PlayerState {
  id: string;
  name: string;
  appearance: Record<string, number>;
  snap: PlayerSnapshot | null;
}

/**
 * One shared village room. Authoritative in shape: the server owns the
 * roster and relays validated state; per-field validation and shared village
 * state (community projects, homes) hook in here as the game grows.
 */
export class WorldRoom {
  private players = new Map<string, PlayerState>();

  constructor(private io: Server) {}

  join(socket: Socket): void {
    const state: PlayerState = {
      id: socket.id,
      name: `Wayfarer-${socket.id.slice(0, 4)}`,
      appearance: {},
      snap: null,
    };
    this.players.set(socket.id, state);
    // Send the newcomer everyone already here.
    for (const other of this.players.values()) {
      if (other.id !== socket.id) {
        socket.emit('player:joined', {
          id: other.id,
          name: other.name,
          appearance: other.appearance,
        });
      }
    }
  }

  onHello(socket: Socket, data: { name?: string; appearance?: Record<string, number> }): void {
    const state = this.players.get(socket.id);
    if (!state) return;
    if (typeof data.name === 'string' && data.name.length <= 24) state.name = data.name;
    if (data.appearance && typeof data.appearance === 'object') state.appearance = data.appearance;
    socket.broadcast.emit('player:joined', {
      id: state.id,
      name: state.name,
      appearance: state.appearance,
    });
  }

  onState(socket: Socket, snap: PlayerSnapshot): void {
    const state = this.players.get(socket.id);
    if (!state || typeof snap?.x !== 'number') return;
    state.snap = snap;
    socket.broadcast.emit('player:state', { id: socket.id, snap });
  }

  onEmote(socket: Socket, emote: string): void {
    if (typeof emote !== 'string' || emote.length > 24) return;
    socket.broadcast.emit('player:emote', { id: socket.id, emote });
  }

  leave(socket: Socket): void {
    this.players.delete(socket.id);
    this.io.emit('player:left', { id: socket.id });
  }
}
