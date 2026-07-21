import { el } from '../utils/dom';
import { MARKERS, PX_PER_UNIT, worldRaster, worldToRaster } from './mapRaster';

/** How many world metres the minimap shows across its width. */
const SPAN_UNITS = 64;
/** On-screen size in CSS px. */
const SIZE = 148;

/**
 * Always-on corner minimap. Draws a crop of the shared world raster centred
 * on the player, with POI pips and a heading arrow. Click to open the full map.
 */
export class MiniMap {
  readonly el: HTMLElement;
  private canvas = el('canvas', 'kp-minimap-canvas') as HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private raf = 0;
  private running = false;

  getPlayer: () => { x: number; z: number; yaw: number } = () => ({ x: 0, z: 0, yaw: 0 });

  constructor(root: HTMLElement, onExpand: () => void) {
    const wrap = el('div', 'kp-minimap');
    wrap.title = 'Open map (M)';
    wrap.append(this.canvas, el('div', 'kp-minimap-key', 'M'));
    wrap.addEventListener('click', onExpand);
    root.appendChild(wrap);
    this.el = wrap;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
    if (visible) this.start();
    else this.stop();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const draw = () => {
      if (!this.running) return;
      this.draw();
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    // Built lazily so the first frame of the game isn't blocked on the raster.
    if (!this.base) this.base = worldRaster();

    const w = this.canvas.width;
    const h = this.canvas.height;
    const p = this.getPlayer();
    const { px, py } = worldToRaster(p.x, p.z);
    const srcSpan = SPAN_UNITS * PX_PER_UNIT;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Circular mask.
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    ctx.clip();

    // Backdrop for areas outside the raster (edge of the world).
    ctx.fillStyle = '#0c1006';
    ctx.fillRect(0, 0, w, h);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.base,
      px - srcSpan / 2,
      py - srcSpan / 2,
      srcSpan,
      srcSpan,
      0,
      0,
      w,
      h
    );

    // POI pips — only those inside the visible span.
    const scale = w / srcSpan;
    for (const m of MARKERS) {
      const mp = worldToRaster(m.x, m.z);
      const dx = (mp.px - px) * scale + w / 2;
      const dy = (mp.py - py) * scale + h / 2;
      if (dx < 0 || dy < 0 || dx > w || dy > h) continue;
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ec4380';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // Player arrow, always centred.
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-p.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#0c1006';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
