export const TWO_PI = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing. `lambda` ≈ responsiveness. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function dist2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Shortest-path angle interpolation (radians). */
export function angleLerp(a: number, b: number, t: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return a + d * t;
}

export function angleDamp(current: number, target: number, lambda: number, dt: number): number {
  return angleLerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Deterministic seeded PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Distance from point to a polyline defined by [x, z] pairs. */
export function distToPolyline(x: number, z: number, points: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const t = len2 === 0 ? 0 : clamp(((x - ax) * abx + (z - az) * abz) / len2, 0, 1);
    const px = ax + abx * t;
    const pz = az + abz * t;
    const d = dist2D(x, z, px, pz);
    if (d < best) best = d;
  }
  return best;
}
