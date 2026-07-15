import RAPIER from '@dimforge/rapier3d-compat';

export interface CharacterHandle {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
}

/**
 * Rapier 3D wrapper. The world uses fixed static colliders (terrain trimesh +
 * building cuboids) and kinematic character controllers for the player.
 */
export class Physics {
  world!: RAPIER.World;

  static async create(): Promise<Physics> {
    await RAPIER.init();
    const p = new Physics();
    p.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    return p;
  }

  addTrimesh(vertices: Float32Array, indices: Uint32Array): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    return this.world.createCollider(desc);
  }

  addBox(
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
    rotY = 0
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(cx, cy, cz)
      .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    return this.world.createCollider(desc);
  }

  addCylinder(cx: number, cy: number, cz: number, halfHeight: number, radius: number): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(cx, cy, cz);
    return this.world.createCollider(desc);
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, true);
  }

  /**
   * Kinematic capsule character with autostep, slope limits and ground snap.
   * `pos` is the capsule center.
   */
  createCharacter(x: number, y: number, z: number): CharacterHandle {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.32);
    const collider = this.world.createCollider(colliderDesc, body);
    const controller = this.world.createCharacterController(0.04);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.enableAutostep(0.55, 0.2, true);
    controller.enableSnapToGround(0.55);
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(false);
    return { body, collider, controller };
  }

  /**
   * Move a kinematic character by `desired` displacement, respecting
   * collisions. Returns the applied movement and grounded state.
   */
  moveCharacter(
    handle: CharacterHandle,
    desiredX: number,
    desiredY: number,
    desiredZ: number
  ): { x: number; y: number; z: number; grounded: boolean } {
    handle.controller.computeColliderMovement(handle.collider, {
      x: desiredX,
      y: desiredY,
      z: desiredZ,
    });
    const mv = handle.controller.computedMovement();
    const p = handle.body.translation();
    handle.body.setNextKinematicTranslation({ x: p.x + mv.x, y: p.y + mv.y, z: p.z + mv.z });
    return { x: mv.x, y: mv.y, z: mv.z, grounded: handle.controller.computedGrounded() };
  }

  step(dt: number): void {
    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();
  }
}
