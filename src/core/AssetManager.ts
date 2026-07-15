import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/**
 * Central loader with caching. The MVP builds everything procedurally, but the
 * pipeline (GLTF + Draco + KTX2) is ready: drop .glb files into public/models
 * and call loadModel(). Missing assets resolve to null so callers can keep
 * their procedural fallback.
 */
export class AssetManager {
  private gltfLoader: GLTFLoader;
  private textureLoader = new THREE.TextureLoader();
  private modelCache = new Map<string, GLTF>();
  private textureCache = new Map<string, THREE.Texture>();

  constructor(renderer: THREE.WebGLRenderer) {
    this.gltfLoader = new GLTFLoader();
    const draco = new DRACOLoader();
    // Decoder files can be copied into public/draco/ for fully offline builds.
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(draco);
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('https://unpkg.com/three@0.169.0/examples/jsm/libs/basis/');
    ktx2.detectSupport(renderer);
    this.gltfLoader.setKTX2Loader(ktx2);
  }

  async loadModel(url: string): Promise<GLTF | null> {
    const cached = this.modelCache.get(url);
    if (cached) return cached;
    try {
      const gltf = await this.gltfLoader.loadAsync(url);
      this.modelCache.set(url, gltf);
      return gltf;
    } catch {
      console.warn(`[AssetManager] model missing, using procedural fallback: ${url}`);
      return null;
    }
  }

  async loadTexture(url: string): Promise<THREE.Texture | null> {
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    try {
      const tex = await this.textureLoader.loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textureCache.set(url, tex);
      return tex;
    } catch {
      return null;
    }
  }

  /** Draw into a canvas and get a texture — used for signs, faces, name tags. */
  makeCanvasTexture(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) draw(ctx);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
}
