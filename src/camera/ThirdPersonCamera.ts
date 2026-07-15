import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { angleDamp, clamp, damp } from '../utils/math';
import type { InputManager } from '../core/InputManager';

/**
 * Third-person orbit camera: smooth follow, zoom, wall collision, automatic
 * recentering behind the player, and a cinematic focus mode for dialogue.
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.34;
  private targetDistance = GameConfig.cameraDistance;
  private smoothedDistance = GameConfig.cameraDistance;
  private lastLookInput = 0;
  private focusPoint: THREE.Vector3 | null = null;
  private lookTarget = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  sensitivity = 1;
  invertY = false;

  constructor(initialYaw = Math.PI) {
    this.camera = new THREE.PerspectiveCamera(
      GameConfig.cameraFov,
      window.innerWidth / window.innerHeight,
      0.1,
      900
    );
    this.yaw = initialYaw;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  /** Cinematic dialogue framing — look between player and speaker. */
  focusOn(point: THREE.Vector3): void {
    this.focusPoint = point.clone();
  }

  clearFocus(): void {
    this.focusPoint = null;
  }

  update(
    dt: number,
    input: InputManager,
    head: THREE.Vector3,
    playerYaw: number,
    moving: boolean,
    blockers: THREE.Object3D[],
    elapsed: number
  ): void {
    const look = input.consumeLook();
    if (Math.abs(look.x) + Math.abs(look.y) > 0.5) this.lastLookInput = elapsed;
    const sens = 0.0034 * this.sensitivity;
    this.yaw -= look.x * sens;
    this.pitch += look.y * sens * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.2, 1.15);

    const zoom = input.consumeZoom();
    if (zoom !== 0) {
      this.targetDistance = clamp(
        this.targetDistance * (1 + zoom * 0.12),
        GameConfig.cameraMinDistance,
        GameConfig.cameraMaxDistance
      );
    }

    // Auto recenter behind the moving player after a short input pause.
    if (moving && elapsed - this.lastLookInput > 2 && !this.focusPoint) {
      this.yaw = angleDamp(this.yaw, playerYaw + Math.PI, 1.4, dt);
    }

    let wantedDistance = this.targetDistance;
    this.lookTarget.copy(head);
    if (this.focusPoint) {
      this.lookTarget.lerp(this.focusPoint, 0.45);
      wantedDistance = Math.min(wantedDistance, 3.1);
    }

    // Orbit position.
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);

    // Camera collision: pull in when something solid is between player & camera.
    this.raycaster.set(this.lookTarget, dir.clone().normalize());
    this.raycaster.far = wantedDistance + 0.3;
    const hits = this.raycaster.intersectObjects(blockers, true);
    for (const hit of hits) {
      if (hit.distance > 0.1) {
        wantedDistance = Math.min(wantedDistance, Math.max(0.55, hit.distance - 0.28));
        break;
      }
    }

    // Fast pull-in, slower push-out — avoids popping.
    const lambda = wantedDistance < this.smoothedDistance ? 18 : 4;
    this.smoothedDistance = damp(this.smoothedDistance, wantedDistance, lambda, dt);

    this.camera.position.copy(this.lookTarget).addScaledVector(dir, this.smoothedDistance);
    this.camera.lookAt(this.lookTarget.x, this.lookTarget.y + 0.12, this.lookTarget.z);
  }
}
