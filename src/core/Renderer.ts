import * as THREE from 'three';

/** Thin wrapper around WebGLRenderer with resize + quality handling. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private pixelRatioCap = 1.5;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applySize();
    window.addEventListener('resize', () => this.applySize());
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
    this.applySize();
  }

  setShadowsEnabled(enabled: boolean): void {
    this.gl.shadowMap.enabled = enabled;
    // Force material recompile so the change takes effect immediately.
    this.gl.shadowMap.needsUpdate = true;
  }

  private applySize(): void {
    const pr = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    this.gl.setPixelRatio(pr);
    this.gl.setSize(window.innerWidth, window.innerHeight);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.render(scene, camera);
  }

  dispose(): void {
    this.gl.dispose();
  }
}
