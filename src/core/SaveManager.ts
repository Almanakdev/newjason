import { GameConfig } from '../config/GameConfig';
import type { Appearance, SaveData, Settings } from '../types';

const DB_NAME = 'kindred-peaks';
const STORE = 'saves';
const KEY = 'main';

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  invertY: false,
  cameraSensitivity: 1,
  showFps: false,
  mockPlayers: true,
  stylizedOutlines: true,
};

/** Versioned persistence backed by IndexedDB with a localStorage fallback. */
export class SaveManager {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (!('indexedDB' in window)) return;
    this.db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[SaveManager] IndexedDB unavailable, falling back to localStorage');
        resolve(null);
      };
    });
  }

  async load(): Promise<SaveData | null> {
    let raw: unknown = null;
    if (this.db) {
      raw = await new Promise((resolve) => {
        const tx = (this.db as IDBDatabase).transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } else {
      const s = localStorage.getItem(GameConfig.saveKey);
      raw = s ? JSON.parse(s) : null;
    }
    if (!raw || typeof raw !== 'object') return null;
    return this.migrate(raw as SaveData);
  }

  async save(data: SaveData): Promise<void> {
    data.updatedAt = Date.now();
    if (this.db) {
      await new Promise<void>((resolve) => {
        const tx = (this.db as IDBDatabase).transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(data, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } else {
      try {
        localStorage.setItem(GameConfig.saveKey, JSON.stringify(data));
      } catch (err) {
        console.error('[SaveManager] save failed', err);
      }
    }
  }

  async clear(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve) => {
        const tx = (this.db as IDBDatabase).transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    localStorage.removeItem(GameConfig.saveKey);
  }

  /** Upgrade older saves to the current version. */
  private migrate(data: SaveData): SaveData {
    if (typeof data.version !== 'number') return data;
    // Future migrations: if (data.version === 1) { ...upgrade...; data.version = 2; }
    data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
    // Appearance fields added after release default sensibly for older saves.
    data.appearance = { sleeves: 1, ...(data.appearance ?? {}) } as Appearance;
    return data;
  }

  exportToFile(data: SaveData): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kindred-peaks-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importFromFile(): Promise<SaveData | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const parsed = JSON.parse(await file.text()) as SaveData;
          if (typeof parsed.version !== 'number' || !parsed.appearance) {
            console.warn('[SaveManager] invalid save file');
            return resolve(null);
          }
          resolve(this.migrate(parsed));
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  }

  createNew(playerName: string, appearance: Appearance, settings: Settings): SaveData {
    return {
      version: GameConfig.saveVersion,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playerName,
      appearance,
      position: { x: -2, y: 3, z: 16 },
      yaw: Math.PI,
      timeOfDay: GameConfig.startTimeOfDay,
      day: 1,
      inventory: {},
      activeTool: null,
      quests: [],
      flags: [],
      friendships: {},
      echoBonds: {},
      calmedEchoes: [],
      restoredWaylights: [],
      housing: [],
      recipesUnlocked: [],
      fishCaught: [],
      communityProjects: {},
      settings,
    };
  }
}
