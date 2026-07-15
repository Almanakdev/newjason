import * as THREE from 'three';
import { io, type Socket } from 'socket.io-client';
import { GameConfig } from '../config/GameConfig';
import { terrainHeight } from '../world/Terrain';
import { NetworkPlayer } from './NetworkPlayer';
import type { PlayerSnapshot } from './StateInterpolation';
import type { EventBus } from '../core/EventBus';
import type { Appearance } from '../types';
import type { ActionName } from '../player/PlayerAnimator';
import { randomAppearance } from '../player/PlayerCustomization';

export interface NetworkHandlers {
  onPlayerJoined(id: string, name: string, appearance: Appearance): void;
  onPlayerLeft(id: string): void;
  onSnapshot(id: string, snap: PlayerSnapshot): void;
  onEmote(id: string, emote: string): void;
}

export interface NetworkAdapter {
  connect(handlers: NetworkHandlers): void;
  disconnect(): void;
  sendSnapshot(snap: PlayerSnapshot): void;
  sendEmote(emote: string): void;
  update?(dt: number): void;
}

/* ------------------------------ Mock mode ------------------------------ */

/**
 * Simulated remote Wayfarer so the social systems (interpolation, emotes,
 * name tags) run end-to-end before a real server exists.
 */
class MockAdapter implements NetworkAdapter {
  private handlers: NetworkHandlers | null = null;
  private waypoints: [number, number][] = [
    [8, 18], [20, 6], [10, -12], [-10, -10], [-16, 8], [-4, 20],
  ];
  private wp = 0;
  private x = 8;
  private z = 18;
  private yaw = 0;
  private sendAccum = 0;
  private emoteAccum = 20;
  private clock = 0;

  connect(handlers: NetworkHandlers): void {
    this.handlers = handlers;
    handlers.onPlayerJoined('mock-rae', 'Rae (Villager)', {
      ...randomAppearance(),
      hat: 2,
      backpack: 2,
    });
  }

  disconnect(): void {
    this.handlers?.onPlayerLeft('mock-rae');
    this.handlers = null;
  }

  sendSnapshot(): void {
    /* mock server discards local state */
  }

  sendEmote(): void {
    /* mock server discards local emotes */
  }

  update(dt: number): void {
    if (!this.handlers) return;
    this.clock += dt;
    const [tx, tz] = this.waypoints[this.wp];
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      this.wp = (this.wp + 1) % this.waypoints.length;
    } else {
      const step = Math.min(dist, 1.9 * dt);
      this.x += (dx / dist) * step;
      this.z += (dz / dist) * step;
      this.yaw = Math.atan2(dx, dz);
    }
    this.sendAccum += dt;
    if (this.sendAccum >= 1 / GameConfig.snapshotRateHz) {
      this.sendAccum = 0;
      this.handlers.onSnapshot('mock-rae', {
        x: this.x,
        y: terrainHeight(this.x, this.z),
        z: this.z,
        yaw: this.yaw,
        anim: 'walk',
        time: this.clock,
      });
    }
    this.emoteAccum -= dt;
    if (this.emoteAccum <= 0) {
      this.emoteAccum = 25 + Math.random() * 20;
      this.handlers.onEmote('mock-rae', 'wave');
    }
  }
}

/* ----------------------------- Socket mode ----------------------------- */

/** Real transport for the server in /server — same events, same payloads. */
class SocketAdapter implements NetworkAdapter {
  private socket: Socket | null = null;

  connect(handlers: NetworkHandlers): void {
    this.socket = io(GameConfig.serverUrl, { transports: ['websocket'] });
    this.socket.on('player:joined', (d: { id: string; name: string; appearance: Appearance }) =>
      handlers.onPlayerJoined(d.id, d.name, d.appearance)
    );
    this.socket.on('player:left', (d: { id: string }) => handlers.onPlayerLeft(d.id));
    this.socket.on('player:state', (d: { id: string; snap: PlayerSnapshot }) =>
      handlers.onSnapshot(d.id, d.snap)
    );
    this.socket.on('player:emote', (d: { id: string; emote: string }) =>
      handlers.onEmote(d.id, d.emote)
    );
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  sendSnapshot(snap: PlayerSnapshot): void {
    this.socket?.emit('state', snap);
  }

  sendEmote(emote: string): void {
    this.socket?.emit('emote', emote);
  }
}

/* ------------------------------- Manager ------------------------------- */

const EMOTE_ACTIONS: Record<string, ActionName> = {
  wave: 'wave', cheer: 'cheer', dance: 'dance', sit: 'sit', laugh: 'laugh', heart: 'heart',
};

/**
 * Multiplayer-ready networking layer. Runs in mock mode by default
 * (GameConfig.networkMode); switch to 'socket' to talk to /server.
 * Remote players use snapshot buffering + interpolation, never per-frame sync.
 */
export class NetworkManager {
  private adapter: NetworkAdapter | null = null;
  private players = new Map<string, NetworkPlayer>();
  private sendAccum = 0;
  private clock = 0;

  constructor(
    private parent: THREE.Group,
    private bus: EventBus
  ) {
    bus.on('player:emote', ({ emote }) => this.adapter?.sendEmote(emote));
  }

  start(enableMock: boolean): void {
    if (this.adapter) return;
    if (GameConfig.networkMode === 'socket') {
      this.adapter = new SocketAdapter();
    } else if (enableMock) {
      this.adapter = new MockAdapter();
    } else {
      return;
    }
    this.adapter.connect({
      onPlayerJoined: (id, name, appearance) => {
        this.players.set(id, new NetworkPlayer(id, name, appearance, this.parent));
        this.bus.emit('net:playerJoined', { id, name });
        this.bus.emit('notify', { text: `${name} is exploring nearby`, icon: '🧭' });
      },
      onPlayerLeft: (id) => {
        this.players.get(id)?.dispose(this.parent);
        this.players.delete(id);
        this.bus.emit('net:playerLeft', { id });
      },
      onSnapshot: (id, snap) => this.players.get(id)?.pushSnapshot(snap),
      onEmote: (id, emote) => {
        const action = EMOTE_ACTIONS[emote];
        if (action) this.players.get(id)?.playEmote(action);
      },
    });
  }

  stop(): void {
    this.adapter?.disconnect();
    this.adapter = null;
    for (const p of this.players.values()) p.dispose(this.parent);
    this.players.clear();
  }

  get connectedPlayers(): { id: string; name: string }[] {
    return Array.from(this.players.values()).map((p) => ({ id: p.id, name: p.name }));
  }

  update(dt: number, t: number, localPos: THREE.Vector3, localYaw: number, localAnim: string): void {
    this.clock += dt;
    this.adapter?.update?.(dt);

    // Broadcast local state at snapshot rate (not every frame).
    this.sendAccum += dt;
    if (this.adapter && this.sendAccum >= 1 / GameConfig.snapshotRateHz) {
      this.sendAccum = 0;
      this.adapter.sendSnapshot({
        x: localPos.x, y: localPos.y, z: localPos.z,
        yaw: localYaw, anim: localAnim, time: this.clock,
      });
    }

    const renderTime = this.clock - GameConfig.interpolationDelayMs / 1000;
    for (const p of this.players.values()) p.update(dt, t, renderTime);
  }
}
