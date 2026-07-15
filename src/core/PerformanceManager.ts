import type { EventBus } from './EventBus';
import type { Renderer } from './Renderer';
import type { QualityPreset } from '../types';

export interface QualityValues {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  grassDensity: number;
  fogFar: number;
  postfx: boolean;
}

const PRESETS: Record<'low' | 'medium' | 'high', QualityValues> = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 1024, grassDensity: 0.35, fogFar: 140, postfx: false },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, grassDensity: 0.7, fogFar: 190, postfx: true },
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, grassDensity: 1, fogFar: 240, postfx: true },
};

/**
 * Quality presets + adaptive mode. In 'auto', FPS is sampled and the preset
 * steps up or down to hold ~50+ FPS.
 */
export class PerformanceManager {
  private preset: QualityPreset = 'auto';
  private autoLevel: 'low' | 'medium' | 'high' = 'medium';
  private frames = 0;
  private elapsed = 0;
  private sampleTime = 0;
  fps = 60;

  constructor(
    private renderer: Renderer,
    private bus: EventBus
  ) {}

  get current(): QualityValues {
    const level = this.preset === 'auto' ? this.autoLevel : this.preset;
    return PRESETS[level];
  }

  get presetName(): QualityPreset {
    return this.preset;
  }

  setPreset(preset: QualityPreset): void {
    this.preset = preset;
    this.apply();
  }

  private apply(): void {
    const q = this.current;
    this.renderer.setPixelRatioCap(q.pixelRatioCap);
    this.renderer.setShadowsEnabled(q.shadows);
    this.bus.emit('perf:changed', { preset: this.preset === 'auto' ? `auto (${this.autoLevel})` : this.preset });
  }

  update(dt: number): void {
    this.frames++;
    this.elapsed += dt;
    this.sampleTime += dt;
    if (this.elapsed >= 0.5) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
    }
    if (this.preset === 'auto' && this.sampleTime >= 4) {
      this.sampleTime = 0;
      if (this.fps < 42 && this.autoLevel !== 'low') {
        this.autoLevel = this.autoLevel === 'high' ? 'medium' : 'low';
        this.apply();
      } else if (this.fps > 57 && this.autoLevel !== 'high') {
        this.autoLevel = this.autoLevel === 'low' ? 'medium' : 'high';
        this.apply();
      }
    }
  }
}
