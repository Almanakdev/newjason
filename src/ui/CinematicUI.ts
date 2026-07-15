import { el, button } from '../utils/dom';

/** Letterboxed text cinematic used for the prologue. Skippable. */
export class CinematicUI {
  static play(root: HTMLElement, lines: string[], msPerLine = 4200): Promise<void> {
    return new Promise((resolve) => {
      const screen = el('div', 'kp-cinematic');
      const lineEl = el('div', 'line');
      screen.appendChild(lineEl);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        screen.style.transition = 'opacity 0.8s';
        screen.style.opacity = '0';
        window.setTimeout(() => {
          screen.remove();
          resolve();
        }, 800);
      };
      screen.appendChild(button('kp-btn kp-btn--small kp-skip', 'Skip ⏭', finish));
      root.appendChild(screen);

      let i = 0;
      const showNext = () => {
        if (finished) return;
        if (i >= lines.length) {
          finish();
          return;
        }
        lineEl.classList.remove('visible');
        window.setTimeout(() => {
          lineEl.textContent = lines[i];
          lineEl.classList.add('visible');
          i++;
          window.setTimeout(showNext, msPerLine);
        }, 600);
      };
      showNext();
    });
  }
}
