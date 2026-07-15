import { el } from '../utils/dom';
import type { FishingGame, FishingView } from '../minigames/FishingGame';

/** Overlay for the fishing mini-game: message, tension bar and progress. */
export class FishingUI {
  private box = el('div', 'kp-fishing');
  private msg = el('div', 'msg');
  private track = el('div', 'kp-tension-track');
  private zone = el('div', 'kp-tension-zone');
  private marker = el('div', 'kp-tension-marker');
  private progressTrack = el('div', 'kp-progress-track');
  private progressFill = el('div', 'kp-progress-fill');

  constructor(root: HTMLElement, fishing: FishingGame) {
    this.track.append(this.zone, this.marker);
    this.progressTrack.appendChild(this.progressFill);
    this.box.append(this.msg, this.track, this.progressTrack);
    this.box.style.display = 'none';
    root.appendChild(this.box);
    fishing.onView = (view) => this.render(view);
  }

  private render(view: FishingView | null): void {
    if (!view) {
      this.box.style.display = 'none';
      return;
    }
    this.box.style.display = '';
    this.msg.textContent = view.message;
    const reeling = view.phase === 'reeling';
    this.track.style.visibility = reeling ? 'visible' : 'hidden';
    this.progressTrack.style.visibility = reeling ? 'visible' : 'hidden';
    if (reeling) {
      this.zone.style.left = `${view.zoneMin * 100}%`;
      this.zone.style.width = `${(view.zoneMax - view.zoneMin) * 100}%`;
      this.marker.style.left = `${view.tension * 100}%`;
      this.progressFill.style.width = `${view.progress * 100}%`;
    }
  }
}
