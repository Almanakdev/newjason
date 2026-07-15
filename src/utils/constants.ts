/** Palettes, friendship levels and other tunable constants. */

export const FRIENDSHIP_LEVELS = [
  { level: 1, name: 'Stranger', threshold: 0 },
  { level: 2, name: 'Acquaintance', threshold: 10 },
  { level: 3, name: 'Companion', threshold: 25 },
  { level: 4, name: 'Trusted Friend', threshold: 55 },
  { level: 5, name: 'Kindred', threshold: 100 },
] as const;

export function friendshipLevel(points: number): number {
  let lvl = 1;
  for (const f of FRIENDSHIP_LEVELS) if (points >= f.threshold) lvl = f.level;
  return lvl;
}

export function friendshipLevelName(level: number): string {
  const f = FRIENDSHIP_LEVELS.find((e) => e.level === level);
  return f ? f.name : 'Stranger';
}

/** Customization palettes — hex colors as strings for THREE.Color. */
export const SKIN_TONES = [
  '#f5d3b8', '#eab88f', '#d9985f', '#b97a4b', '#8d5a33', '#6b4226', '#f7e0cc', '#c98a63',
];

export const HAIR_COLORS = [
  '#2e2620', '#5a4632', '#8a6543', '#c99b62', '#e8d4a2', '#a33e2f', '#d96f43', '#5b6d8f',
  '#7e5a9e', '#4f7d62', '#d9d9e2', '#31435c',
];

export const CLOTH_COLORS = [
  '#d96a5a', '#e8a04c', '#e5ce6f', '#7fae6b', '#4f9e8f', '#5f8fc9', '#7e6bb5', '#c96b9e',
  '#8a7a68', '#e9e4d8', '#3f4a5c', '#a34a3f',
  '#f7f6f0', // crisp white (tank tops, tees)
  '#2c3654', // deep navy (shorts)
  '#d93a2b', // sneaker red
];

export const HAIRSTYLE_NAMES = ['Short Crop', 'Wind Tuft', 'Long Braid', 'Cloud Curls', 'Side Sweep', 'Messy Spikes'];
export const SLEEVE_NAMES = ['Sleeveless', 'Sleeved'];
export const HAT_NAMES = ['None', 'Traveler Beanie', 'Ranger Beret', 'Straw Sunhat'];
export const SCARF_NAMES = ['None', 'Wayfarer Scarf', 'Knit Wrap'];
export const BACKPACK_NAMES = ['None', 'Canvas Pack', 'Ranger Satchel'];
export const FACE_SHAPE_NAMES = ['Round', 'Oval', 'Soft Square'];
export const EYE_NAMES = ['Bright', 'Sleepy', 'Wide', 'Gentle'];
export const BROW_NAMES = ['Soft', 'Straight', 'Arched'];
export const MOUTH_NAMES = ['Smile', 'Small', 'Grin'];
export const BODY_NAMES = ['Slim', 'Average', 'Sturdy'];
export const GLOVE_NAMES = ['None', 'Gathering Gloves'];
export const PIN_NAMES = ['None', 'Star Pin', 'Leaf Pin', 'Wave Pin'];

/** Named locations used by map, quests and NPC schedules. */
export const POI = {
  villageCenter: { x: 0, z: 0 },
  waylightTower: { x: 0, z: -6 },
  craftingPavilion: { x: 14, z: 8 },
  cafe: { x: -14, z: -14 },
  generalStore: { x: 16, z: -12 },
  tailor: { x: 24, z: 2 },
  spiritClinic: { x: -24, z: -2 },
  festivalStage: { x: -8, z: 24 },
  noticeBoard: { x: 5, z: -2 },
  pond: { x: -18, z: 14 },
  garden: { x: 8, z: 20 },
  homePlot: { x: 34, z: -26 },
  valleyGate: { x: 46, z: 10 },
  valleyMeadow: { x: 150, z: 80 },
  valleyShrine: { x: 176, z: 96 },
  orinCamp: { x: 132, z: 96 },
  riverBridge: { x: 118, z: 56 },
} as const;

export type PoiId = keyof typeof POI;

export const EMOTES = [
  { id: 'wave', name: 'Wave', icon: '👋' },
  { id: 'cheer', name: 'Cheer', icon: '🎉' },
  { id: 'dance', name: 'Dance', icon: '💃' },
  { id: 'sit', name: 'Sit', icon: '🪑' },
  { id: 'laugh', name: 'Laugh', icon: '😄' },
  { id: 'heart', name: 'Heart', icon: '💗' },
] as const;
