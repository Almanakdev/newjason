import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial, makeGradientMap } from './toon';
import { seededRandom } from '../utils/math';

/**
 * Instanced wind-swaying grass tufts and oversized flowers.
 * A single draw call per field; sway is injected into the toon material's
 * vertex shader and phased by instance position.
 */

function makeTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.PlaneGeometry(0.34, 0.9, 1, 2);
    plane.translate(0, 0.45, 0);
    plane.rotateY((i / 3) * Math.PI);
    blades.push(plane);
  }
  const merged = mergeGeometries(blades);
  blades.forEach((b) => b.dispose());
  return merged ?? new THREE.PlaneGeometry(0.34, 0.9);
}

function makeWindyMaterial(color: string): { mat: THREE.MeshToonMaterial; timeRef: { value: number } } {
  const timeRef = { value: 0 };
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: makeGradientMap(3, 0.55),
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeRef as unknown as THREE.IUniform;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 kpBase = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float kpSway = sin(uTime * 1.7 + kpBase.x * 0.4 + kpBase.z * 0.31) * 0.14 * transformed.y;
          transformed.x += kpSway;
          transformed.z += kpSway * 0.55;
        #endif`
      );
  };
  return { mat, timeRef };
}

export interface GrassPlacementFn {
  /** Return null to skip a candidate spot, or a ground height to place at. */
  (x: number, z: number): number | null;
}

export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private timeRef: { value: number };

  constructor(
    centerX: number,
    centerZ: number,
    radius: number,
    count: number,
    placement: GrassPlacementFn,
    seed = 7,
    baseColor = '#7fc46a'
  ) {
    const geo = makeTuftGeometry();
    const { mat, timeRef } = makeWindyMaterial(baseColor);
    this.timeRef = timeRef;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.name = 'grass-field';
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    const rng = seededRandom(seed);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const x = centerX + Math.cos(ang) * r;
      const z = centerZ + Math.sin(ang) * r;
      const y = placement(x, z);
      if (y === null) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const s = 0.7 + rng() * 0.9;
      dummy.scale.set(s, s * (0.8 + rng() * 0.7), s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, dummy.matrix);
      color.setHSL(0.28 + rng() * 0.06, 0.58 + rng() * 0.22, 0.44 + rng() * 0.14);
      this.mesh.setColorAt(placed, color);
      placed++;
    }
    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Reduce visible instances for performance presets (0..1). */
  setDensity(fraction: number): void {
    const max = this.mesh.instanceMatrix.count;
    this.mesh.count = Math.floor(max * Math.max(0.05, Math.min(1, fraction)));
  }

  update(time: number): void {
    this.timeRef.value = time;
  }
}

export class FlowerField {
  readonly mesh: THREE.InstancedMesh;
  private timeRef: { value: number };

  constructor(
    centerX: number,
    centerZ: number,
    radius: number,
    count: number,
    placement: GrassPlacementFn,
    seed = 21
  ) {
    // Oversized whimsical flower: stem + big blossom ball + center bead.
    const stem = new THREE.CylinderGeometry(0.03, 0.05, 0.8, 5);
    stem.translate(0, 0.4, 0);
    const blossom = new THREE.IcosahedronGeometry(0.24, 1);
    blossom.scale(1, 0.62, 1);
    blossom.translate(0, 0.86, 0);
    const merged = mergeGeometries([stem, blossom]) ?? blossom;
    const { mat, timeRef } = makeWindyMaterial('#ffffff');
    mat.vertexColors = false;
    this.timeRef = timeRef;
    this.mesh = new THREE.InstancedMesh(merged, mat, count);
    this.mesh.name = 'flower-field';

    const petalColors = ['#f2a1b8', '#f7c873', '#b79ae0', '#8fd0e8', '#f28d6b', '#fdf3ff'];
    const rng = seededRandom(seed);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const x = centerX + Math.cos(ang) * r;
      const z = centerZ + Math.sin(ang) * r;
      const y = placement(x, z);
      if (y === null) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const s = 0.8 + rng() * 1.4;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, dummy.matrix);
      color.set(petalColors[Math.floor(rng() * petalColors.length)]);
      this.mesh.setColorAt(placed, color);
      placed++;
    }
    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(time: number): void {
    this.timeRef.value = time;
  }
}

/** Ambient floating pollen / spirit motes. */
export class PollenParticles {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private speeds: Float32Array;
  private center: THREE.Vector3;
  private radius: number;

  constructor(center: THREE.Vector3, radius: number, count = 120, color = '#fff7d9') {
    this.center = center.clone();
    this.radius = radius;
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    const rng = seededRandom(99);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = center.x + (rng() - 0.5) * radius * 2;
      this.positions[i * 3 + 1] = center.y + rng() * 6 + 0.5;
      this.positions[i * 3 + 2] = center.z + (rng() - 0.5) * radius * 2;
      this.speeds[i] = 0.2 + rng() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.09,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, time: number): void {
    const n = this.speeds.length;
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] += Math.sin(time * 0.6 + i) * 0.12 * dt;
      this.positions[i * 3 + 1] += this.speeds[i] * dt * 0.25;
      this.positions[i * 3 + 2] += Math.cos(time * 0.5 + i * 1.3) * 0.12 * dt;
      if (this.positions[i * 3 + 1] > this.center.y + 7) {
        this.positions[i * 3 + 1] = this.center.y + 0.5;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

export { createToonMaterial };
