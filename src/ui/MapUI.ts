import { el, button } from '../utils/dom';
import { VIEW, labelledRaster } from './mapRaster';
import type { UIPanel } from './UIManager';

/** Hand-drawn style world map (M) rendered from the same terrain function. */
export class MapUI {
  readonly panel: UIPanel;
  private canvas = el('canvas', 'kp-map-canvas') as HTMLCanvasElement;
  private baseMap: HTMLCanvasElement | null = null;
  private raf = 0;
  getPlayer: () => { x: number; z: number; yaw: number } = () => ({ x: 0, z: 0, yaw: 0 });

  constructor(onClose: () => void) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, '🗺 Kiriko Vale — Known Reaches'), button('kp-btn kp-close', '✕', onClose));
    root.append(title, this.canvas);
    this.panel = {
      id: 'map',
      el: root,
      onOpen: () => this.startDrawing(),
      onClose: () => cancelAnimationFrame(this.raf),
    };
  }

  private startDrawing(): void {
    // Raster is shared with the minimap and memoised, so this is cheap after
    // the first call.
    if (!this.baseMap) this.baseMap = labelledRaster();
    this.canvas.width = this.baseMap.width;
    this.canvas.height = this.baseMap.height;
    const draw = () => {
      const ctx = this.canvas.getContext('2d');
      if (ctx && this.baseMap) {
        ctx.drawImage(this.baseMap, 0, 0);
        const p = this.getPlayer();
        const px = ((p.x - VIEW.minX) / (VIEW.maxX - VIEW.minX)) * this.canvas.width;
        const py = ((p.z - VIEW.minZ) / (VIEW.maxZ - VIEW.minZ)) * this.canvas.height;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-p.yaw);
        ctx.fillStyle = '#d96a5a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(11, 13);
        ctx.lineTo(-11, 13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }
}
