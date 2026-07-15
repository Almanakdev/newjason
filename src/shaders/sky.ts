import * as THREE from 'three';

/**
 * Stylized gradient sky dome with animated sun disc, procedural stars and
 * soft cloud bands. Driven by DayNightSystem + WeatherManager.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#6db3e8') },
        uHorizonColor: { value: new THREE.Color('#dff0f7') },
        uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.2).normalize() },
        uSunColor: { value: new THREE.Color('#fff2c9') },
        uStarAmount: { value: 0 },
        uCloudAmount: { value: 0.35 },
        uCloudColor: { value: new THREE.Color('#ffffff') },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uStarAmount;
        uniform float uCloudAmount;
        uniform vec3 uCloudColor;
        uniform float uTime;
        varying vec3 vDir;

        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(vec3(i, 1.0));
          float b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
          float c = hash(vec3(i + vec2(0.0, 1.0), 1.0));
          float d = hash(vec3(i + vec2(1.0, 1.0), 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, -0.1, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(max(h, 0.0), 0.65));

          // Sun disc + halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sunDot, 350.0) * 1.2 + pow(sunDot, 24.0) * 0.25);

          // Soft drifting cloud bands
          float cloudBand = smoothstep(0.02, 0.35, dir.y) * (1.0 - smoothstep(0.55, 0.9, dir.y));
          vec2 cuv = dir.xz / max(dir.y + 0.25, 0.12);
          float cn = noise2(cuv * 1.6 + vec2(uTime * 0.008, 0.0));
          cn += 0.5 * noise2(cuv * 3.4 + vec2(uTime * 0.014, 3.7));
          float clouds = smoothstep(0.85, 1.25, cn) * cloudBand * uCloudAmount;
          col = mix(col, uCloudColor, clamp(clouds, 0.0, 0.85));

          // Stars (night only)
          if (uStarAmount > 0.001 && dir.y > 0.0) {
            vec3 sp = floor(dir * 160.0);
            float star = step(0.9985, hash(sp));
            float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp * 1.7) * 40.0);
            col += vec3(1.0, 0.98, 0.9) * star * twinkle * uStarAmount * smoothstep(0.05, 0.3, dir.y);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
  }

  set(
    top: THREE.Color,
    horizon: THREE.Color,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    starAmount: number,
    cloudAmount: number,
    cloudColor: THREE.Color
  ): void {
    const u = this.material.uniforms;
    (u.uTopColor.value as THREE.Color).copy(top);
    (u.uHorizonColor.value as THREE.Color).copy(horizon);
    (u.uSunDir.value as THREE.Vector3).copy(sunDir);
    (u.uSunColor.value as THREE.Color).copy(sunColor);
    u.uStarAmount.value = starAmount;
    u.uCloudAmount.value = cloudAmount;
    (u.uCloudColor.value as THREE.Color).copy(cloudColor);
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
