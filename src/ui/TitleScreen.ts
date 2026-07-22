import { el, button } from '../utils/dom';
import { GameConfig } from '../config/GameConfig';
import {
  autoConnect,
  connectDemo,
  connectEthereum,
  connectBinance,
  hasEthereum,
  hasBinance,
  save as saveWallet,
  clear as clearWallet,
  shortAddress,
  type WalletConnection,
} from '../wallet/Wallet';

export type TitleChoice = 'new' | 'continue' | 'import';

/** Animated title screen. Resolves with the player's choice. */
export class TitleScreen {
  private screen: HTMLElement;
  private wallet: WalletConnection | null = null;
  /** Buttons that stay disabled until a wallet is connected. */
  private gated: HTMLButtonElement[] = [];
  private walletRow!: HTMLElement;
  private picker: HTMLElement | null = null;
  private hasSave = false;

  constructor(private root: HTMLElement) {
    this.screen = el('div', 'kp-title-screen');
  }

  show(hasSave: boolean): Promise<TitleChoice> {
    this.hasSave = hasSave;
    return new Promise((resolve) => {
      const s = this.screen;
      s.innerHTML = '';

      // Pink sun + city skyline (pure CSS shapes), matching the landing art.
      s.appendChild(el('div', 'kp-title-sun'));
      // [leftPercent, widthPx, heightPx] — towers rise from the bottom edge.
      const towers: [number, number, number][] = [
        [2, 54, 150], [9, 38, 220], [15, 62, 120], [22, 44, 275],
        [29, 34, 170], [35, 58, 235], [43, 40, 130], [56, 44, 195],
        [63, 60, 145], [71, 36, 260], [78, 52, 165], [86, 42, 225], [93, 56, 135],
      ];
      towers.forEach(([x, w, h], i) => {
        const tower = el('div', 'kp-title-island');
        tower.style.left = `${x}%`;
        tower.style.bottom = '0';
        tower.style.width = `${w}px`;
        tower.style.height = `${h}px`;
        tower.style.animationDelay = `${(i % 5) * 1.3}s`;
        s.appendChild(tower);
      });

      const card = el('div', 'kp-title-card');
      card.append(
        el('h1', 'kp-game-title', GameConfig.title),
        el('div', 'kp-game-subtitle', GameConfig.subtitle),
        el('div', 'kp-game-tagline', GameConfig.tagline)
      );

      const done = (choice: TitleChoice) => {
        this.hide();
        resolve(choice);
      };

      // ---- wallet gate -----------------------------------------------------
      this.walletRow = el('div', 'kp-wallet');
      card.appendChild(this.walletRow);

      // ---- play buttons (disabled until a wallet connects) -----------------
      const buttons = el('div', 'kp-title-buttons');
      const newBtn = button('kp-btn kp-btn--primary', '{ } New Journey', () => done('new'));
      const cont = button('kp-btn', '▶ Continue', () => done('continue'));
      const imp = button('kp-btn', '↑ Import save file', () => done('import'));
      this.gated = [newBtn, cont, imp];
      buttons.append(newBtn, cont, imp);
      card.appendChild(buttons);

      s.appendChild(card);
      s.appendChild(el('div', 'kp-title-version', `v${GameConfig.version} · research build`));
      this.root.appendChild(s);

      this.renderWallet();
      this.applyGate();

      // Restore a previous session without prompting.
      void autoConnect().then((conn) => {
        if (!conn) return;
        this.wallet = conn;
        this.renderWallet();
        this.applyGate();
      });
    });
  }

  /** Enable play only once a wallet (real or demo) is connected. */
  private applyGate(): void {
    const unlocked = this.wallet !== null;
    for (const b of this.gated) b.disabled = !unlocked;

    const cont = this.gated[1];
    if (!unlocked) {
      cont.textContent = '▶ Continue';
    } else if (!this.hasSave) {
      cont.disabled = true;
      cont.textContent = '▶ Continue (no journey yet)';
    } else {
      cont.textContent = '▶ Continue';
    }
  }

  private async run(fn: () => Promise<WalletConnection> | WalletConnection): Promise<void> {
    const status = this.picker?.querySelector('.kp-wallet-status') as HTMLElement | null;
    try {
      if (status) {
        status.textContent = '// waiting for wallet…';
        status.classList.remove('error');
      }
      const conn = await fn();
      this.wallet = conn;
      saveWallet(conn);
      this.closePicker();
      this.renderWallet();
      this.applyGate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect.';
      if (status) {
        status.textContent = `// ${msg}`;
        status.classList.add('error');
      }
    }
  }

  /** The wallet options only appear once the player asks for them. */
  private openPicker(): void {
    if (this.picker) return;

    const overlay = el('div', 'kp-wallet-modal');
    const panel = el('div', 'kp-wallet-panel');

    const head = el('div', 'kp-wallet-head');
    head.append(
      el('div', 'kp-wallet-title', 'Connect a wallet'),
      button('kp-wallet-x', '✕', () => this.closePicker())
    );
    panel.appendChild(head);

    const opts = el('div', 'kp-wallet-opts');
    opts.appendChild(
      button('kp-wallet-btn', hasEthereum() ? '⬡ MetaMask' : '⬡ MetaMask — install', () => {
        if (!hasEthereum()) {
          window.open('https://metamask.io/download/', '_blank', 'noopener');
          return;
        }
        void this.run(connectEthereum);
      })
    );
    opts.appendChild(
      button('kp-wallet-btn', hasBinance() ? '◆ Binance Wallet' : '◆ Binance Wallet — install', () => {
        if (!hasBinance() && !hasEthereum()) {
          window.open('https://www.binance.com/en/web3wallet', '_blank', 'noopener');
          return;
        }
        void this.run(connectBinance);
      })
    );
    opts.appendChild(
      button('kp-wallet-btn kp-wallet-btn--demo', '▷ Use demo wallet', () => {
        void this.run(connectDemo);
      })
    );
    panel.appendChild(opts);
    panel.appendChild(
      el('div', 'kp-wallet-status', 'No wallet? The demo wallet runs locally — full game, nothing to install.')
    );

    overlay.appendChild(panel);
    // Click the backdrop (but not the panel) to dismiss.
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.closePicker();
    });

    this.picker = overlay;
    this.screen.appendChild(overlay);
    document.addEventListener('keydown', this.onKey);
  }

  private closePicker(): void {
    if (!this.picker) return;
    this.picker.remove();
    this.picker = null;
    document.removeEventListener('keydown', this.onKey);
  }

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') this.closePicker();
  };

  private renderWallet(): void {
    const row = this.walletRow;
    row.innerHTML = '';

    if (this.wallet) {
      const chip = el('div', 'kp-wallet-chip');
      chip.append(
        el('span', 'dot'),
        el('span', 'label', this.wallet.label),
        el('span', 'addr', shortAddress(this.wallet.address))
      );
      chip.appendChild(
        button('kp-wallet-x', '✕', () => {
          clearWallet();
          this.wallet = null;
          this.renderWallet();
          this.applyGate();
        })
      );
      row.appendChild(chip);
      if (this.wallet.kind === 'demo') {
        row.appendChild(
          el('div', 'kp-wallet-status', '// demo wallet — local only, not a real address')
        );
      }
      return;
    }

    // Collapsed state: one button. Options live behind it.
    row.appendChild(
      button('kp-wallet-connect', 'Connect Wallet', () => this.openPicker())
    );
    row.appendChild(el('div', 'kp-wallet-status', 'Required to play'));
  }

  hide(): void {
    // closePicker also detaches the Escape listener, so this can't leak.
    this.closePicker();
    this.screen.remove();
  }
}
