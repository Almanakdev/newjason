import * as THREE from 'three';

/** Stylized animated water used for the village pond and valley river. */
export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(geometry: THREE.BufferGeometry) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#3d7fa8') },
        uShallow: { value: new THREE.Color('#7fc4d8') },
        uSparkle: { value: new THREE.Color('#ffffff') },
        uOpacity: { value: 0.82 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(uTime * 1.3 + position.x * 2.2) * 0.03
                + cos(uTime * 1.7 + position.y * 2.6) * 0.03;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSparkle;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          float ripple = sin(vWorldPos.x * 3.1 + uTime * 1.6) * cos(vWorldPos.z * 2.7 - uTime * 1.2);
          float band = smoothstep(0.35, 0.75, 0.5 + 0.5 * ripple);
          vec3 col = mix(uDeep, uShallow, band);
          // gentle radial shallowing toward edges
          float edge = smoothstep(0.36, 0.5, distance(vUv, vec2(0.5)));
          col = mix(col, uShallow, edge * 0.7);
          // sparkles
          float sp = sin(vWorldPos.x * 9.0 + uTime * 2.4) * sin(vWorldPos.z * 8.0 - uTime * 2.1);
          col += uSparkle * smoothstep(0.96, 1.0, sp) * 0.5;
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
  }

  setColors(deep: string, shallow: string): void {
    (this.material.uniforms.uDeep.value as THREE.Color).set(deep);
    (this.material.uniforms.uShallow.value as THREE.Color).set(shallow);
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
