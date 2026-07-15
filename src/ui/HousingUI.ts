import { el, button, clearChildren } from '../utils/dom';
import type { HousingManager } from '../housing/HousingManager';

/** Build-mode bar: furniture catalog, controls help and validity readout. */
export class HousingUI {
  readonly el: HTMLElement;
  private catalog = el('div', 'kp-housing-catalog');
  private validity = el('span', 'kp-validity ok', '');
  private selectedId: string | null = null;

  constructor(
    root: HTMLElement,
    private housing: HousingManager,
    onExit: () => void
  ) {
    this.el = el('div', 'kp-housing-bar');
    const head = el('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'center';
    head.style.marginBottom = '8px';
    const titleSpan = el('span');
    titleSpan.style.fontWeight = '800';
    titleSpan.append(document.createTextNode('🔨 Sanctuary Build Mode  '), this.validity);
    head.append(titleSpan, button('kp-btn kp-btn--small', 'Done (H)', onExit));
    const help = el('div', 'kp-housing-help');
    help.innerHTML =
      '<span><b>E</b> place</span><span><b>R</b> rotate</span><span><b>G</b> snap</span><span><b>F</b> recolor</span><span><b>X</b> remove nearby</span><span>walk to move the ghost</span>';
    this.el.append(head, this.catalog, help);
    this.el.style.display = 'none';
    root.appendChild(this.el);
    housing.onChanged = () => this.refresh();
  }

  show(): void {
    this.el.style.display = '';
    this.refresh();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  setValidity(ok: boolean, text: string): void {
    this.validity.className = `kp-validity ${ok ? 'ok' : 'bad'}`;
    this.validity.textContent = text;
  }

  private refresh(): void {
    clearChildren(this.catalog);
    for (const def of this.housing.catalog()) {
      const item = button(`kp-housing-item${this.selectedId === def.id ? ' selected' : ''}`, '', () => {
        this.selectedId = def.id;
        this.housing.select(def.id);
        this.refresh();
      });
      item.append(el('div', 'icon', def.icon), el('div', 'label', def.name));
      this.catalog.appendChild(item);
    }
  }
}
