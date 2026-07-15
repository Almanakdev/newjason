import * as THREE from 'three';

/**
 * Custom toon shading built on MeshToonMaterial:
 * - stepped shadow ramp (2 or 3 tones, adjustable threshold)
 * - soft rim light injected into the fragment shader
 * - optional inverted-hull outline for hero characters
 * - per-biome tint support via multiplyTint()
 */

const gradientCache = new Map<string, THREE.DataTexture>();

export function makeGradientMap(steps: 2 | 3 = 3, shadowLevel = 0.45): THREE.DataTexture {
  const key = `${steps}-${shadowLevel}`;
  const cached = gradientCache.get(key);
  if (cached) return cached;
  const values =
    steps === 3
      ? [shadowLevel, (shadowLevel + 1) / 2 + 0.08, 1.0]
      : [shadowLevel, 1.0];
  const data = new Uint8Array(values.length * 4);
  values.forEach((v, i) => {
    const b = Math.round(v * 255);
    data[i * 4] = b;
    data[i * 4 + 1] = b;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, values.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  gradientCache.set(key, tex);
  return tex;
}

export interface ToonOptions {
  steps?: 2 | 3;
  shadowLevel?: number;
  rimColor?: string;
  rimStrength?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
}

export function createToonMaterial(color: string | number, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: makeGradientMap(opts.steps ?? 3, opts.shadowLevel ?? 0.56),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
  });
  if (opts.emissive) {
    mat.emissive = new THREE.Color(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  const rimColor = new THREE.Color(opts.rimColor ?? '#ffe3bd');
  const rimStrength = opts.rimStrength ?? 0.27;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec3 kpRimDir = normalize( vViewPosition );
        float kpRim = pow( 1.0 - clamp( dot( normal, kpRimDir ), 0.0, 1.0 ), 3.0 );
        gl_FragColor.rgb += uRimColor * kpRim * uRimStrength;`
      )
      .replace(
        'void main() {',
        `uniform vec3 uRimColor;
        uniform float uRimStrength;
        void main() {`
      );
  };
  return mat;
}

/** Multiply a biome tint into an existing toon material's base color. */
export function multiplyTint(mat: THREE.MeshToonMaterial, tint: THREE.Color): void {
  mat.color.multiply(tint);
}

/** Inverted-hull outline for important characters. Adds a slightly scaled backface shell. */
export function addOutline(target: THREE.Mesh, thickness = 0.025, color = '#2b2233'): THREE.Mesh {
  const outlineMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const shell = new THREE.Mesh(target.geometry, outlineMat);
  shell.scale.setScalar(1 + thickness);
  shell.raycast = () => undefined; // outlines never intercept interaction rays
  target.add(shell);
  return shell;
}
