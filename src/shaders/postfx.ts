import * as THREE from 'three';

/**
 * Stylized post-processing: depth-based painted ink outlines, saturation +
 * warmth grade and a soft vignette — the "animated film" finish. Renders the
 * scene into an MSAA target with a depth texture, then composites through a
 * fullscreen shader. Toggleable in Settings and disabled on the Low preset.
 */
export class StylizedPipeline {
  enabled = true;
  private target: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private lastW = 0;
  private lastH = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = this.makeTarget(size.x, size.y);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uNear: { value: 0.1 },
        uFar: { value: 900 },
        uOutline: { value: 0.85 },
        uSaturation: { value: 1.22 },
        uWarmth: { value: new THREE.Vector3(1.05, 1.0, 0.93) },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uResolution;
        uniform float uNear;
        uniform float uFar;
        uniform float uOutline;
        uniform float uSaturation;
        uniform vec3 uWarmth;
        varying vec2 vUv;

        float linearDepth(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          float z = d * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
        }

        void main() {
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          // encode linear -> display space, then grade like a painted still
          col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

          // --- painted ink outlines from depth discontinuities ---
          float center = linearDepth(vUv);
          vec2 px = 1.0 / uResolution;
          float dx = abs(linearDepth(vUv + vec2(px.x, 0.0)) - center)
                   + abs(linearDepth(vUv - vec2(px.x, 0.0)) - center);
          float dy = abs(linearDepth(vUv + vec2(0.0, px.y)) - center)
                   + abs(linearDepth(vUv - vec2(0.0, px.y)) - center);
          float ratio = (dx + dy) / max(center * 0.06, 0.02);
          float edge = smoothstep(0.25, 0.6, ratio);
          // keep distant hills painterly, not scratchy
          edge *= 1.0 - smoothstep(55.0, 150.0, center);
          col = mix(col, col * vec3(0.16, 0.13, 0.2), edge * uOutline);

          // --- hand-painted grade: saturation, warmth, warm shadow lift ---
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, uSaturation);
          col *= uWarmth;
          col += vec3(0.035, 0.02, 0.004) * (1.0 - l);

          // --- soft vignette ---
          float v = smoothstep(0.95, 0.4, distance(vUv, vec2(0.5)));
          col *= mix(0.9, 1.0, v);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  private makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const depthTexture = new THREE.DepthTexture(w, h);
    // Linear half-float target: the scene renders linear; the composite pass
    // encodes to sRGB itself (ShaderMaterial skips automatic conversion).
    return new THREE.WebGLRenderTarget(w, h, {
      depthTexture,
      depthBuffer: true,
      samples: 4,
      type: THREE.HalfFloatType,
    });
  }

  private ensureSize(): void {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x === this.lastW && size.y === this.lastH) return;
    this.lastW = size.x;
    this.lastH = size.y;
    this.target.dispose();
    this.target = this.makeTarget(size.x, size.y);
    this.material.uniforms.tDiffuse.value = this.target.texture;
    this.material.uniforms.tDepth.value = this.target.depthTexture;
    (this.material.uniforms.uResolution.value as THREE.Vector2).set(size.x, size.y);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.ensureSize();
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
