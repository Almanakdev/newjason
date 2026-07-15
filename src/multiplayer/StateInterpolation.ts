/** Snapshot buffering + interpolation for remote players. */

export interface PlayerSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: string;
  time: number; // sender clock, seconds
}

/**
 * Remote entities render slightly in the past (interpolation delay) and lerp
 * between buffered snapshots — never one network packet per frame.
 */
export class SnapshotBuffer {
  private buffer: PlayerSnapshot[] = [];

  push(snap: PlayerSnapshot): void {
    this.buffer.push(snap);
    // keep a couple seconds of history
    while (this.buffer.length > 40) this.buffer.shift();
  }

  /** Sample the interpolated state at renderTime (sender clock). */
  sample(renderTime: number): PlayerSnapshot | null {
    const b = this.buffer;
    if (b.length === 0) return null;
    if (renderTime <= b[0].time) return b[0];
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i];
      const c = b[i + 1];
      if (renderTime >= a.time && renderTime <= c.time) {
        const t = (renderTime - a.time) / Math.max(0.0001, c.time - a.time);
        let dyaw = c.yaw - a.yaw;
        if (dyaw > Math.PI) dyaw -= Math.PI * 2;
        if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        return {
          x: a.x + (c.x - a.x) * t,
          y: a.y + (c.y - a.y) * t,
          z: a.z + (c.z - a.z) * t,
          yaw: a.yaw + dyaw * t,
          anim: c.anim,
          time: renderTime,
        };
      }
    }
    return b[b.length - 1];
  }
}
