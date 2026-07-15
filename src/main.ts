import './ui/styles.css';
import { GameConfig } from './config/GameConfig';
import { Game } from './core/Game';
import { AudioManager } from './core/AudioManager';
import { SaveManager, DEFAULT_SETTINGS } from './core/SaveManager';
import { TitleScreen } from './ui/TitleScreen';
import { CustomizationUI } from './ui/CustomizationUI';
import { CinematicUI } from './ui/CinematicUI';
import { defaultAppearance } from './player/PlayerCustomization';
import { el } from './utils/dom';
import type { SaveData } from './types';

const PROLOGUE_LINES = [
  'You quit on a Tuesday. Laptop, one bag, and a business plan written on the back of a resignation letter.',
  'The last train of the day climbs into the Kiriko mountains — toward a village so far off the map that no map will admit it exists.',
  'Kiriko Vale had a Signal Tower once. It carried the village to the world: letters, songs, one very beloved weather page. Years ago, it went dark.',
  '“So you’re the programmer,” says the old woman sharing your train seat. Mira Vale. Retired signal engineer. Extremely unimpressed by your laptop stickers.',
  'She hands you a battered lantern, warm and faintly humming. “It renders what the eye can’t. Signals. Spirits. The village is full of both.”',
  '“Build your company here, if you like. But understand — nothing ships from Kiriko Vale until that tower sings again.”',
  'The train doors open onto mountain air. Somewhere ahead, a village is waiting to come back online.',
];

async function boot(): Promise<void> {
  document.title = `${GameConfig.title} — ${GameConfig.subtitle}`;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    console.error('[main] missing #game-canvas or #ui-root');
    return;
  }

  // Audio unlocks on the first user gesture (title button counts).
  const audio = new AudioManager();
  const unlock = () => {
    audio.init();
    audio.resume();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  const saveManager = new SaveManager();
  await saveManager.open();
  let save: SaveData | null = null;
  try {
    save = await saveManager.load();
  } catch (err) {
    console.warn('[main] could not load save', err);
  }

  const title = new TitleScreen(uiRoot);
  let choice = await title.show(!!save);

  if (choice === 'import') {
    const imported = await saveManager.importFromFile();
    if (imported) {
      save = imported;
      await saveManager.save(imported);
      choice = 'continue';
    } else {
      // Fall back to the title flow.
      window.location.reload();
      return;
    }
  }

  if (choice === 'new' || !save) {
    const result = await new CustomizationUI().show(uiRoot, '', defaultAppearance());
    const name = result?.name ?? 'Founder';
    const appearance = result?.appearance ?? defaultAppearance();
    await CinematicUI.play(uiRoot, PROLOGUE_LINES);
    save = saveManager.createNew(name, appearance, { ...DEFAULT_SETTINGS });
    await saveManager.save(save);
  }

  // Loading screen while the world builds.
  const loading = el('div', 'kp-loading');
  const orb = el('div', 'orb');
  const msg = el('div', 'msg', 'Crossing the cloud line…');
  loading.append(orb, msg);
  uiRoot.appendChild(loading);

  try {
    const game = await Game.create(canvas, audio, saveManager, save, (progress) => {
      msg.textContent = progress;
    });
    loading.remove();
    game.start();
  } catch (err) {
    console.error('[main] failed to start', err);
    msg.textContent = '// error: something drifted loose while loading. Please refresh to try again.';
    orb.style.background = '#e5202e';
    orb.style.boxShadow = '0 0 46px 16px rgba(229, 32, 46, 0.5)';
  }
}

void boot();
