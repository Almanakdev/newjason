import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { SceneManager } from '../core/SceneManager';
import type { SkyDome } from '../shaders/sky';
import type { DayPhase } from '../types';
import { GameConfig } from '../config/GameConfig';
import { damp, lerp } from '../utils/math';

interface LightKeyframe {
  t: number;
  top: string;
  horizon: string;
  sun: string;
  dirColor: string;
  dirIntensity: number;
  hemiSky: string;
  hemiGround: string;
  fog: string;
}

const KEYFRAMES: LightKeyframe[] = [
  { t: 0, top: '#17233f', horizon: '#2c3b5e', sun: '#0a0f1d', dirColor: '#9fb6e8', dirIntensity: 0.14, hemiSky: '#26334f', hemiGround: '#141b28', fog: '#1e2a44' },
  { t: 4.6, top: '#2b3560', horizon: '#6a5a80', sun: '#4d3a50', dirColor: '#c9a9c0', dirIntensity: 0.3, hemiSky: '#3d456b', hemiGround: '#2a2836', fog: '#4a4666' },
  { t: 6.5, top: '#6f9de0', horizon: '#ffc99a', sun: '#ffd9a0', dirColor: '#ffd6a4', dirIntensity: 0.9, hemiSky: '#9fb5d9', hemiGround: '#b5885f', fog: '#f0cdb5' },
  { t: 9, top: '#4da9ee', horizon: '#e6f4fa', sun: '#fff2c0', dirColor: '#fff0cd', dirIntensity: 1.22, hemiSky: '#b8dcf2', hemiGround: '#b0905f', fog: '#c9e2ef' },
  { t: 15, top: '#48a3ea', horizon: '#dcf0f7', sun: '#ffedb0', dirColor: '#ffe9bd', dirIntensity: 1.18, hemiSky: '#b0d7ef', hemiGround: '#b0905f', fog: '#c4dfee' },
  { t: 18.2, top: '#5a6fc0', horizon: '#ff9e66', sun: '#ffab6a', dirColor: '#ffb480', dirIntensity: 0.72, hemiSky: '#8c8ac4', hemiGround: '#8a6a52', fog: '#e8b294' },
  { t: 20.2, top: '#273459', horizon: '#54507c', sun: '#3d3450', dirColor: '#b3a9d9', dirIntensity: 0.24, hemiSky: '#39436b', hemiGround: '#242433', fog: '#3a3f5e' },
  { t: 24, top: '#17233f', horizon: '#2c3b5e', sun: '#0a0f1d', dirColor: '#9fb6e8', dirIntensity: 0.14, hemiSky: '#26334f', hemiGround: '#141b28', fog: '#1e2a44' },
];

export interface WeatherModifiers {
  fogScale: number;
  lightScale: number;
  cloudAmount: number;
  cloudColor: string;
  windStrength: number;
  rainStrength: number;
}

/** Full day/night cycle: sky, sun, hemisphere, fog, lamps and window glow. */
export class DayNightSystem {
  timeOfDay = GameConfig.startTimeOfDay;
  day = 1;
  phase: DayPhase = 'day';

  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  private lampIntensity = 0;

  private tmpA = new THREE.Color();
  private tmpB = new THREE.Color();
  private top = new THREE.Color();
  private horizon = new THREE.Color();
  private sunColor = new THREE.Color();
  private fogColor = new THREE.Color();
  private cloudColor = new THREE.Color('#ffffff');

  constructor(
    private sceneMgr: SceneManager,
    private sky: SkyDome,
    private bus: EventBus,
    private nightGlow: THREE.MeshToonMaterial[],
    private lampLights: THREE.PointLight[]
  ) {
    this.sunLight = new THREE.DirectionalLight('#fff2d9', 1.1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 160;
    const s = 42;
    this.sunLight.shadow.camera.left = -s;
    this.sunLight.shadow.camera.right = s;
    this.sunLight.shadow.camera.top = s;
    this.sunLight.shadow.camera.bottom = -s;
    this.sunLight.shadow.bias = -0.0022;
    this.hemiLight = new THREE.HemisphereLight('#bcd9ee', '#9aa584', 0.75);
    sceneMgr.scene.add(this.sunLight, this.sunLight.target, this.hemiLight);
  }

  setShadowMapSize(size: number): void {
    if (this.sunLight.shadow.mapSize.x !== size) {
      this.sunLight.shadow.mapSize.set(size, size);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  private samplePhase(): DayPhase {
    const t = this.timeOfDay;
    if (t >= 5 && t < 8) return 'dawn';
    if (t >= 8 && t < 17.5) return 'day';
    if (t >= 17.5 && t < 20.5) return 'dusk';
    return 'night';
  }

  update(dt: number, mods: WeatherModifiers, playerPos: THREE.Vector3, fogFarBase: number): void {
    const hoursPerSecond = 24 / (GameConfig.dayLengthMinutes * 60);
    this.timeOfDay += dt * hoursPerSecond;
    if (this.timeOfDay >= 24) {
      this.timeOfDay -= 24;
      this.day++;
    }
    const newPhase = this.samplePhase();
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.bus.emit('time:phase', { phase: newPhase });
    }

    // Interpolate lighting keyframes.
    const t = this.timeOfDay;
    let a = KEYFRAMES[0];
    let b = KEYFRAMES[KEYFRAMES.length - 1];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (t >= KEYFRAMES[i].t && t <= KEYFRAMES[i + 1].t) {
        a = KEYFRAMES[i];
        b = KEYFRAMES[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const f = (t - a.t) / span;

    this.top.set(a.top).lerp(this.tmpA.set(b.top), f);
    this.horizon.set(a.horizon).lerp(this.tmpA.set(b.horizon), f);
    this.sunColor.set(a.sun).lerp(this.tmpA.set(b.sun), f);
    this.fogColor.set(a.fog).lerp(this.tmpA.set(b.fog), f);
    const dirIntensity = lerp(a.dirIntensity, b.dirIntensity, f) * mods.lightScale;
    this.sunLight.color.set(a.dirColor).lerp(this.tmpB.set(b.dirColor), f);
    this.sunLight.intensity = dirIntensity;
    this.hemiLight.color.set(a.hemiSky).lerp(this.tmpB.set(b.hemiSky), f);
    this.hemiLight.groundColor.set(a.hemiGround).lerp(this.tmpB.set(b.hemiGround), f);
    this.hemiLight.intensity = 0.55 + dirIntensity * 0.35;

    // Sun position follows the player so shadows stay crisp everywhere.
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const sunDir = new THREE.Vector3(
      Math.cos(sunAngle) * 0.9,
      Math.sin(sunAngle),
      Math.sin(sunAngle * 0.5) * 0.35 + 0.25
    ).normalize();
    this.sunLight.position.copy(playerPos).addScaledVector(sunDir, 70);
    this.sunLight.target.position.copy(playerPos);

    // Stars fade in at night; clouds tint from weather.
    const starAmount =
      t < 4.5 ? 1 : t < 6.5 ? 1 - (t - 4.5) / 2 : t > 21.5 ? Math.min(1, (t - 21.5) / 1.5) : t > 19.5 ? (t - 19.5) / 2 * 0.5 : 0;
    this.cloudColor.set(mods.cloudColor);
    this.sky.set(this.top, this.horizon, sunDir, this.sunColor, starAmount, mods.cloudAmount, this.cloudColor);

    // Fog blends day color and weather density.
    const far = fogFarBase * mods.fogScale;
    this.sceneMgr.setFog(this.fogColor, far * 0.22, far);
    this.sceneMgr.scene.background = null; // sky dome handles the backdrop

    // Lamps & windows.
    const wantLamps = this.phase === 'night' || this.phase === 'dusk' ? 1 : 0;
    this.lampIntensity = damp(this.lampIntensity, wantLamps, 2, dt);
    for (const l of this.lampLights) l.intensity = this.lampIntensity * 1.7;
    // Windows and signage keep a cozy daytime glow, then bloom at night.
    for (const m of this.nightGlow) m.emissiveIntensity = 0.24 + this.lampIntensity * 0.9;
  }
}
