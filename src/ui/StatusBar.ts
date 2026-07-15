import { el } from '../utils/dom';
import { load as loadWallet, shortAddress } from '../wallet/Wallet';

/**
 * Top-left status strip: connected wallet + a way back to the landing page.
 *
 * Reads the wallet from storage rather than taking it as a param, because the
 * connection is established on the title screen before Game exists.
 */
export class StatusBar {
  readonly el: HTMLElement;

  constructor(root: HTMLElement, onHome: () => void) {
    const wrap = el('div', 'kp-statusbar');

    // --- back to home ---
    const home = el('button', 'kp-status-home');
    home.title = 'Back to home page';
    home.append(el('span', 'ico', '←'), el('span', undefined, 'Home'));
    home.addEventListener('click', onHome);
    wrap.appendChild(home);

    // --- wallet status ---
    const wallet = loadWallet();
    const chip = el('div', 'kp-status-wallet');
    if (wallet) {
      chip.classList.add(wallet.kind === 'demo' ? 'demo' : 'live');
      chip.append(
        el('span', 'dot'),
        el('span', 'label', wallet.kind === 'demo' ? 'Demo' : wallet.label),
        el('span', 'addr', shortAddress(wallet.address))
      );
      chip.title =
        wallet.kind === 'demo'
          ? 'Demo wallet — local only, not a real address'
          : `${wallet.label} · ${wallet.address}`;
    } else {
      // Shouldn't happen (the title screen gates on it), but never render a lie.
      chip.classList.add('none');
      chip.append(el('span', 'dot'), el('span', 'label', 'No wallet'));
    }
    wrap.appendChild(chip);

    root.appendChild(wrap);
    this.el = wrap;
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }
}
