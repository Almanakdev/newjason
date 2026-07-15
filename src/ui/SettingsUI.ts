import { el, button, clearChildren } from '../utils/dom';
import type { Settings, QualityPreset } from '../types';
import type { UIPanel } from './UIManager';

export interface MenuCallbacks {
  onResume: () => void;
  onOpenJournal: () => void;
  onSaveNow: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onQuitToTitle: () => void;
  onSettingsChanged: (settings: Settings) => void;
}

/** Pause menu (Esc) with a System tab and a full Settings tab. */
export class SettingsUI {
  readonly panel: UIPanel;
  private tabs = el('div', 'kp-tabs');
  private body = el('div', 'kp-panel-scroll');
  private tab: 'system' | 'settings' = 'system';

  constructor(
    private settings: Settings,
    private cb: MenuCallbacks
  ) {
    const root = el('div', 'kp-panel kp-modal');
    const title = el('h2');
    title.append(el('span', undefined, '⛰ Kindred Peaks'), button('kp-btn kp-close', '✕', () => cb.onResume()));
    root.append(title, this.tabs, this.body);
    this.panel = { id: 'menu', el: root, onOpen: () => this.refresh() };
  }

  private refresh(): void {
    clearChildren(this.tabs);
    for (const t of [
      { id: 'system' as const, label: '🏠 Menu' },
      { id: 'settings' as const, label: '⚙️ Settings' },
    ]) {
      this.tabs.appendChild(
        button(`kp-tab${this.tab === t.id ? ' active' : ''}`, t.label, () => {
          this.tab = t.id;
          this.refresh();
        })
      );
    }
    clearChildren(this.body);
    if (this.tab === 'system') this.renderSystem();
    else this.renderSettings();
  }

  private renderSystem(): void {
    const box = el('div', 'kp-menu-buttons');
    box.append(
      button('kp-btn kp-btn--primary', '▶ Resume', () => this.cb.onResume()),
      button('kp-btn', "📖 Founder's Journal", () => this.cb.onOpenJournal()),
      button('kp-btn', '💾 Save now', () => this.cb.onSaveNow()),
      button('kp-btn', '📤 Export save file', () => this.cb.onExport()),
      button('kp-btn', '📥 Import save file', () => this.cb.onImport()),
      button('kp-btn kp-btn--danger', '🗑 Reset save (confirm ×2)', () => this.confirmReset()),
      button('kp-btn', '🚪 Quit to title', () => this.cb.onQuitToTitle())
    );
    this.body.appendChild(box);
  }

  private resetArmed = false;
  private confirmReset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      window.setTimeout(() => (this.resetArmed = false), 4000);
      return;
    }
    this.resetArmed = false;
    this.cb.onReset();
  }

  private renderSettings(): void {
    const s = this.settings;
    const push = () => this.cb.onSettingsChanged(this.settings);

    const slider = (label: string, value: number, onChange: (v: number) => void) => {
      const row = el('div', 'kp-setting-row');
      const lab = el('label', undefined, label);
      const input = el('input') as HTMLInputElement;
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.05';
      input.value = String(value);
      input.addEventListener('input', () => {
        onChange(parseFloat(input.value));
        push();
      });
      row.append(lab, input);
      return row;
    };
    const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => {
      const row = el('div', 'kp-setting-row');
      const lab = el('label', undefined, label);
      const input = el('input') as HTMLInputElement;
      input.type = 'checkbox';
      input.checked = value;
      input.style.width = '22px';
      input.style.height = '22px';
      input.addEventListener('change', () => {
        onChange(input.checked);
        push();
      });
      row.append(lab, input);
      return row;
    };

    const qualityRow = el('div', 'kp-setting-row');
    qualityRow.appendChild(el('label', undefined, 'Graphics quality'));
    const select = el('select') as HTMLSelectElement;
    for (const q of ['auto', 'low', 'medium', 'high'] as QualityPreset[]) {
      const opt = el('option', undefined, q);
      opt.value = q;
      if (q === s.quality) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      s.quality = select.value as QualityPreset;
      push();
    });
    qualityRow.appendChild(select);

    const sensRow = el('div', 'kp-setting-row');
    sensRow.appendChild(el('label', undefined, 'Camera sensitivity'));
    const sens = el('input') as HTMLInputElement;
    sens.type = 'range';
    sens.min = '0.3';
    sens.max = '2';
    sens.step = '0.1';
    sens.value = String(s.cameraSensitivity);
    sens.addEventListener('input', () => {
      s.cameraSensitivity = parseFloat(sens.value);
      push();
    });
    sensRow.appendChild(sens);

    this.body.append(
      qualityRow,
      slider('Master volume', s.masterVolume, (v) => (s.masterVolume = v)),
      slider('Music volume', s.musicVolume, (v) => (s.musicVolume = v)),
      slider('Effects volume', s.sfxVolume, (v) => (s.sfxVolume = v)),
      sensRow,
      toggle('Painted outlines & color grade', s.stylizedOutlines, (v) => (s.stylizedOutlines = v)),
      toggle('Invert camera Y', s.invertY, (v) => (s.invertY = v)),
      toggle('Show FPS', s.showFps, (v) => (s.showFps = v)),
      toggle('Wandering Wayfarer (demo multiplayer)', s.mockPlayers, (v) => (s.mockPlayers = v))
    );
  }
}
