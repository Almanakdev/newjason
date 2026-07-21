/**
 * GameConfig — the single place to change game identity and global tuning.
 * Everything here is safe to edit without touching engine code.
 */
export const GameConfig = {
  /** Game identity — change the working title here. */
  title: 'JSONSAGA SHOW',
  subtitle: 'The Kiriko Vale Startup Story',
  tagline: 'Write code. Make friends. Put a village back on the map.',
  version: '0.1.0',
  saveVersion: 1,
  saveKey: 'kindred-peaks-save',

  /** World & time */
  dayLengthMinutes: 20, // one full in-game day in real minutes
  startTimeOfDay: 9.5, // hours, 0-24
  worldSize: 480, // terrain span in meters
  terrainSegments: 128,

  /** Player movement */
  walkSpeed: 2.6,
  jogSpeed: 5.2,
  jumpVelocity: 6.5,
  gravity: -18,
  acceleration: 14,
  deceleration: 18,
  turnSpeed: 12,

  /** Camera */
  cameraDistance: 4.6,
  cameraMinDistance: 1.8,
  cameraMaxDistance: 8.5,
  cameraHeight: 1.55,
  cameraFov: 55,
  cameraSensitivity: 1.0,

  /** Gameplay */
  resourceRespawnSeconds: 90,
  autosaveSeconds: 60,
  interactRadius: 2.6,

  /** Multiplayer */
  networkMode: 'mock' as 'mock' | 'socket',
  serverUrl: 'ws://localhost:2567',
  snapshotRateHz: 10,
  interpolationDelayMs: 150,
} as const;

export type GameConfigType = typeof GameConfig;
