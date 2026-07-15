import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { AudioManager } from '../core/AudioManager';
import type { WeatherType } from '../types';
import type { WeatherModifiers } from './DayNightSystem';
import { damp, seededRandom } from '../utils/math';

interface WeatherProfile {
  fogScale: number;
  lightScale: number;
  cloudAmount: number;
  cloudColor: string;
  windStrength: number;
  rainStrength: number;
}

const PROFILES: Record<WeatherType, WeatherProfile> = {
  clear: { fogScale: 1, lightScale: 1, cloudAmount: 0.55, cloudColor: '#ffffff', windStrength: 0.2, rainStrength: 0 },
  cloudy: { fogScale: 0.85, lightScale: 0.8, cloudAmount: 0.85, cloudColor: '#e6e9ef', windStrength: 0.45, rainStrength: 0 },
  drizzle: { fogScale: 0.62, lightScale: 0.66, cloudAmount: 1.0, cloudColor: '#cdd6e2', windStrength: 0.6, rainStrength: 0.7 },
  fog: { fogScale: 0.34, lightScale: 0.75, cloudAmount: 0.9, cloudColor: '#e8ecf0', windStrength: 0.15, rainStrength: 0 },
  storm: { fogScale: 0.45, lightScale: 0.5, cloudAmount: 1.0, cloudColor: '#9aa3b5', windStrength: 1, rainStrength: 1 },
};

const WEATHER_NAMES: Record<WeatherType, string> = {
  clear: 'Clear skies',
  cloudy: 'Drifting clouds',
  drizzle: 'Magical drizzle',
  fog: 'Low valley fog',
  storm: 'Hollow storm',
};

/**
 * Weather cycles between calm states. The heavy Hollow storm is reserved for
 * story moments (chapter five) and never rolls randomly.
 */
export class WeatherManager {
  current: WeatherType = 'clear';
  private timer = 120;
  private mods: WeatherModifiers = { ...PROFILES.clear };
  private target: WeatherProfile = PROFILES.clear;
  private rng = seededRandom(Date.now() % 100000);

  readonly rain: THREE.Points;
  private rainPositions: Float32Array;

  constructor(
    private bus: EventBus,
    private audio: AudioManager
  ) {
    const count = 1100;
    this.rainPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.resetDrop(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#bfe4ff',
      size: 0.08,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
  }

  private resetDrop(i: number, randomY = false): void {
    this.rainPositions[i * 3] = (this.rng() - 0.5) * 46;
    this.rainPositions[i * 3 + 1] = randomY ? this.rng() * 22 : 20 + this.rng() * 4;
    this.rainPositions[i * 3 + 2] = (this.rng() - 0.5) * 46;
  }

  get modifiers(): WeatherModifiers {
    return this.mods;
  }

  /** Story systems can force weather (e.g. the chapter-five storm). */
  setWeather(type: WeatherType, announce = true): void {
    if (type === this.current) return;
    this.current = type;
    this.target = PROFILES[type];
    this.bus.emit('weather:changed', { type });
    if (announce) this.bus.emit('notify', { text: WEATHER_NAMES[type], icon: this.icon(type) });
  }

  icon(type: WeatherType = this.current): string {
    switch (type) {
      case 'clear': return '☀️';
      case 'cloudy': return '⛅';
      case 'drizzle': return '🌦️';
      case 'fog': return '🌫️';
      case 'storm': return '🌩️';
    }
  }

  update(dt: number, cameraPos: THREE.Vector3, isNight: boolean): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 150 + this.rng() * 160;
      const roll = this.rng();
      let next: WeatherType = 'clear';
      if (roll > 0.82) next = 'drizzle';
      else if (roll > 0.6) next = 'cloudy';
      else if (roll > 0.5 && isNight) next = 'fog';
      this.setWeather(next);
    }

    // Ease modifiers toward the target profile.
    const k = 0.5;
    this.mods.fogScale = damp(this.mods.fogScale, this.target.fogScale, k, dt);
    this.mods.lightScale = damp(this.mods.lightScale, this.target.lightScale, k, dt);
    this.mods.cloudAmount = damp(this.mods.cloudAmount, this.target.cloudAmount, k, dt);
    this.mods.windStrength = damp(this.mods.windStrength, this.target.windStrength, k, dt);
    this.mods.rainStrength = damp(this.mods.rainStrength, this.target.rainStrength, k, dt);
    this.mods.cloudColor = this.target.cloudColor;

    this.audio.setWind(this.mods.windStrength);
    this.audio.setRain(this.mods.rainStrength);

    // Rain particles follow the camera.
    const strength = this.mods.rainStrength;
    this.rain.visible = strength > 0.02;
    (this.rain.material as THREE.PointsMaterial).opacity = Math.min(0.8, strength);
    if (this.rain.visible) {
      this.rain.position.set(cameraPos.x, 0, cameraPos.z);
      const n = this.rainPositions.length / 3;
      for (let i = 0; i < n; i++) {
        this.rainPositions[i * 3 + 1] -= dt * 9;
        if (this.rainPositions[i * 3 + 1] < 0) this.resetDrop(i);
      }
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
