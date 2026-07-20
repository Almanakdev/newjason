/**
 * Wallet — connect flow for the title screen.
 *
 * Supports Solana (Phantom / Solflare) and Ethereum (MetaMask and any other
 * EIP-1193 provider), plus a local "demo wallet" so the game is playable
 * without installing anything.
 *
 * Scope note: this only ever requests the public address. It never requests
 * signatures, never moves funds, and never touches private keys.
 */

export type WalletKind = 'solana' | 'ethereum' | 'demo';

export interface WalletConnection {
  kind: WalletKind;
  /** Public address. For 'demo' this is a locally generated placeholder. */
  address: string;
  /** Human label for the provider, e.g. 'Phantom', 'MetaMask', 'Demo wallet'. */
  label: string;
}

const STORAGE_KEY = 'jsonscript-show-wallet';

/* ------------------------------ provider types ----------------------------- */

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    ethereum?: EthereumProvider;
  }
}

/* -------------------------------- detection -------------------------------- */

function solanaProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  return window.phantom?.solana ?? window.solana ?? window.solflare ?? null;
}

function ethereumProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function hasSolana(): boolean {
  return solanaProvider() !== null;
}

export function hasEthereum(): boolean {
  return ethereumProvider() !== null;
}

function solanaLabel(): string {
  const p = solanaProvider();
  if (p?.isPhantom) return 'Phantom';
  if (p?.isSolflare) return 'Solflare';
  return 'Solana wallet';
}

function ethereumLabel(): string {
  return ethereumProvider()?.isMetaMask ? 'MetaMask' : 'Ethereum wallet';
}

/** Short display form: `AbCd…WxYz`. */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

/* -------------------------------- connecting ------------------------------- */

export async function connectSolana(): Promise<WalletConnection> {
  const provider = solanaProvider();
  if (!provider) throw new Error('No Solana wallet found. Install Phantom to continue.');
  const res = await provider.connect();
  const address = res.publicKey.toString();
  return { kind: 'solana', address, label: solanaLabel() };
}

export async function connectEthereum(): Promise<WalletConnection> {
  const provider = ethereumProvider();
  if (!provider) throw new Error('No Ethereum wallet found. Install MetaMask to continue.');
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.length) throw new Error('No account was shared.');
  return { kind: 'ethereum', address: accounts[0], label: ethereumLabel() };
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
 * Silently restore a previous session. Real wallets are re-checked with
 * `onlyIfTrusted` so the user isn't prompted on load; the demo wallet is
 * restored straight from storage.
 */
export async function autoConnect(): Promise<WalletConnection | null> {
  const saved = load();
  if (!saved) return null;

  if (saved.kind === 'demo') return saved;

  if (saved.kind === 'solana') {
    const provider = solanaProvider();
    if (!provider) return null;
    try {
      const res = await provider.connect({ onlyIfTrusted: true });
      return { kind: 'solana', address: res.publicKey.toString(), label: solanaLabel() };
    } catch {
      return null;
    }
  }

  if (saved.kind === 'ethereum') {
    const provider = ethereumProvider();
    if (!provider) return null;
    try {
      // eth_accounts does not prompt — it returns only already-authorized accounts.
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts?.length) return null;
      return { kind: 'ethereum', address: accounts[0], label: ethereumLabel() };
    } catch {
      return null;
    }
  }

  return null;
}
