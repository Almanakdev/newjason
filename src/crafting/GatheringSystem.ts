import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';
import { ResourceNode, type ResourceNodeConfig } from './ResourceNode';
import { getItem } from './Items';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { PlayerInventory } from '../player/PlayerInventory';
import type { PlayerController } from '../player/PlayerController';
import type { InteractionController } from '../player/InteractionController';

/** Default resource layout — extend freely; positions are world-space. */
const NODE_LAYOUT: ResourceNodeConfig[] = [
  // Wild fiber for the first quest — near the village gate & valley path.
  { id: 'fiber1', type: 'fiber', item: 'wild_fiber', x: 44, z: 16 },
  { id: 'fiber2', type: 'fiber', item: 'wild_fiber', x: 52, z: 8 },
  { id: 'fiber3', type: 'fiber', item: 'wild_fiber', x: 58, z: 20 },
  { id: 'fiber4', type: 'fiber', item: 'wild_fiber', x: 72, z: 30 },
  { id: 'fiber5', type: 'fiber', item: 'wild_fiber', x: 140, z: 88 },
  { id: 'fiber6', type: 'fiber', item: 'wild_fiber', x: 156, z: 74 },
  // Wood branches under trees.
  { id: 'branch1', type: 'branch', item: 'wood', x: -30, z: -16 },
  { id: 'branch2', type: 'branch', item: 'wood', x: 31, z: 16 },
  { id: 'branch3', type: 'branch', item: 'wood', x: 122, z: 88 },
  { id: 'branch4', type: 'branch', item: 'wood', x: 166, z: 76 },
  // Smooth stones.
  { id: 'stone1', type: 'stone', item: 'smooth_stone', x: -24, z: 24 },
  { id: 'stone2', type: 'stone', item: 'smooth_stone', x: 35, z: 4 },
  { id: 'stone3', type: 'stone', item: 'smooth_stone', x: 128, z: 72 },
  { id: 'stone4', type: 'stone', item: 'smooth_stone', x: 152, z: 60 },
  // Clay near the pond.
  { id: 'clay1', type: 'clay', item: 'clay', x: -22, z: 18 },
  { id: 'clay2', type: 'clay', item: 'clay', x: -14, z: 22 },
  // River shells.
  { id: 'shell1', type: 'shell', item: 'river_shell', x: 110, z: 50 },
  { id: 'shell2', type: 'shell', item: 'river_shell', x: 122, z: 64 },
  // Moon petals bloom deeper in the valley.
  { id: 'petal1', type: 'moonpetal', item: 'moon_petals', x: 170, z: 100 },
  { id: 'petal2', type: 'moonpetal', item: 'moon_petals', x: 160, z: 96 },
  // Glow moss by the shrine.
  { id: 'moss1', type: 'glowmoss', item: 'glow_moss', x: 178, z: 92 },
];

/**
 * Resource nodes: animated collection, particles, sound, respawn timers and
 * quest-spawned one-off pickups.
 */
export class GatheringSystem {
  private nodes = new Map<string, ResourceNode>();
  private pendingGather: { node: ResourceNode; timer: number } | null = null;
  private bursts: { points: THREE.Points; life: number }[] = [];

  constructor(
    private parent: THREE.Group,
    private effects: THREE.Group,
    private bus: EventBus,
    private audio: AudioManager,
    private inventory: PlayerInventory,
    private player: PlayerController,
    private interactions: InteractionController
  ) {
    for (const cfg of NODE_LAYOUT) this.addNode(cfg);
  }

  addNode(cfg: ResourceNodeConfig): void {
    const node = new ResourceNode(cfg);
    this.nodes.set(cfg.id, node);
    this.parent.add(node.group);
    this.interactions.register({
      id: `gather-${cfg.id}`,
      position: () => node.position,
      prompt: () => `Gather ${getItem(cfg.item).name}`,
      radius: 2.2,
      enabled: () => !node.collected && node.group.visible && this.pendingGather === null,
      onInteract: () => this.beginGather(node),
    });
  }

  /** Quest logic can drop special one-off pickups (e.g. Piproot's seeds). */
  spawnSpecial(id: string, item: string, x: number, z: number): void {
    if (this.nodes.has(id)) return;
    this.addNode({ id, type: 'sparkle', item, x, z, oneOff: true });
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    this.parent.remove(node.group);
    this.nodes.delete(id);
    this.interactions.unregister(`gather-${id}`);
  }

  private beginGather(node: ResourceNode): void {
    this.player.playAction('gather');
    this.audio.playSfx('gather');
    this.pendingGather = { node, timer: 0.85 };
  }

  private completeGather(node: ResourceNode): void {
    node.collected = true;
    node.group.visible = false;
    node.respawnTimer = GameConfig.resourceRespawnSeconds;
    this.spawnBurst(node.position.add(new THREE.Vector3(0, 0.5, 0)));
    this.audio.playSfx('pickup');
    this.inventory.add(node.config.item, 1);
    this.bus.emit('resource:gathered', { nodeId: node.config.id, item: node.config.item });
    if (node.config.oneOff) this.removeNode(node.config.id);
  }

  private spawnBurst(pos: THREE.Vector3): void {
    const count = 14;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = Math.random() * 0.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffe9a8',
      size: 0.1,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.position.copy(pos);
    this.effects.add(points);
    this.bursts.push({ points, life: 0.7 });
  }

  update(dt: number, t: number): void {
    if (this.pendingGather) {
      this.pendingGather.timer -= dt;
      if (this.pendingGather.timer <= 0) {
        this.completeGather(this.pendingGather.node);
        this.pendingGather = null;
      }
    }
    for (const node of this.nodes.values()) node.update(dt, t);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      b.points.position.y += dt * 0.9;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / 0.7);
      if (b.life <= 0) {
        this.effects.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
