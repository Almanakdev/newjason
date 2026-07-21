/**
 * Wallet — connect flow for the title screen.
 *
 * Ethereum-first: MetaMask (or any injected EIP-1193 provider) and Robinhood
 * Wallet, plus a local "demo wallet" so the game is playable without installing
 * anything.
 *
 * Scope note: this only ever requests the public address. It never requests
 * signatures, never moves funds, and never touches private keys.
 */

export type WalletKind = 'ethereum' | 'robinhood' | 'demo';

export interface WalletConnection {
  kind: WalletKind;
  /** Public address. For 'demo' this is a locally generated placeholder. */
  address: string;
  /** Human label for the provider, e.g. 'MetaMask', 'Robinhood', 'Demo wallet'. */
  label: string;
}

const STORAGE_KEY = 'jsonsaga-show-wallet';

/* ------------------------------ provider types ----------------------------- */

interface EthereumProvider {
  isMetaMask?: boolean;
  isRobinhood?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: EthereumProvider[];
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/* -------------------------------- detection -------------------------------- */

function ethereumProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

/** Pick a specific injected provider when several coexist (multi-wallet). */
function pickProvider(flag: 'isMetaMask' | 'isRobinhood'): EthereumProvider | null {
  const root = ethereumProvider();
  if (!root) return null;
  if (root.providers?.length) {
    const match = root.providers.find((p) => p[flag]);
    if (match) return match;
  }
  return root; // fall back to whatever single provider is injected
}

export function hasEthereum(): boolean {
  return ethereumProvider() !== null;
}

export function hasRobinhood(): boolean {
  const root = ethereumProvider();
  if (!root) return false;
  if (root.isRobinhood) return true;
  return !!root.providers?.some((p) => p.isRobinhood);
}

function ethereumLabel(p: EthereumProvider | null): string {
  if (p?.isRobinhood) return 'Robinhood';
  if (p?.isMetaMask) return 'MetaMask';
  return 'Ethereum wallet';
}

/** Short display form: `AbCd…WxYz`. */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

/* -------------------------------- connecting ------------------------------- */

async function requestAccount(provider: EthereumProvider): Promise<string> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('No account was shared.');
  return accounts[0];
}

export async function connectEthereum(): Promise<WalletConnection> {
  const provider = pickProvider('isMetaMask') ?? ethereumProvider();
  if (!provider) throw new Error('No Ethereum wallet found. Install MetaMask to continue.');
  const address = await requestAccount(provider);
  return { kind: 'ethereum', address, label: ethereumLabel(provider) };
}

export async function connectRobinhood(): Promise<WalletConnection> {
  // Robinhood Wallet's extension injects an EIP-1193 provider like any other.
  const provider = pickProvider('isRobinhood') ?? ethereumProvider();
  if (!provider) throw new Error('Robinhood Wallet not found. Install it to continue.');
  const address = await requestAccount(provider);
  return { kind: 'robinhood', address, label: 'Robinhood' };
}

/**
 * A local, offline stand-in so players without a wallet can still get in.
 * The address is random and has no on-chain meaning whatsoever.
 */
export function connectDemo(): WalletConnection {
  const saved = load();
  if (saved?.kind === 'demo') return saved;

  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return { kind: 'demo', address: `demo-${hex}`, label: 'Demo wallet' };
}

/* ------------------------------- persistence ------------------------------- */

export function save(conn: WalletConnection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
  } catch {
    // storage can be unavailable (private mode) — connection just won't persist
  }
}

export function load(): WalletConnection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletConnection;
    if (!parsed?.address || !parsed?.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Silently restore a previous session. Ethereum/Robinhood are re-checked with
 * `eth_accounts` (which never prompts); the demo wallet is restored from storage.
 */
export async function autoConnect(): Promise<WalletConnection | null> {
  const saved = load();
  if (!saved) return null;

  if (saved.kind === 'demo') return saved;

  const provider = ethereumProvider();
  if (!provider) return null;
  try {
    // eth_accounts does not prompt — it returns only already-authorized accounts.
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    if (!accounts?.length) return null;
    const label = saved.kind === 'robinhood' ? 'Robinhood' : ethereumLabel(provider);
    return { kind: saved.kind, address: accounts[0], label };
  } catch {
    return null;
  }
}
