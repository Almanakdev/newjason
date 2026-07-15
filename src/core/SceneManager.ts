import * as THREE from 'three';

/**
 * Owns the scene graph layout: stable groups for world geometry, characters,
 * effects — plus the list of meshes the camera may not clip through.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly worldGroup = new THREE.Group();
  readonly characterGroup = new THREE.Group();
  readonly effectsGroup = new THREE.Group();
  /** Solid meshes used for camera occlusion raycasts. */
  readonly cameraBlockers: THREE.Object3D[] = [];

  constructor() {
    this.worldGroup.name = 'world';
    this.characterGroup.name = 'characters';
    this.effectsGroup.name = 'effects';
    this.scene.add(this.worldGroup, this.characterGroup, this.effectsGroup);
    this.scene.fog = new THREE.Fog(0xbfdcec, 60, 220);
  }

  addCameraBlocker(obj: THREE.Object3D): void {
    this.cameraBlockers.push(obj);
  }

  setFog(color: THREE.Color, near: number, far: number): void {
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(color);
    fog.near = near;
    fog.far = far;
  }
}
