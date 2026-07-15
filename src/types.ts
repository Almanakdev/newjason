/** Shared type definitions used across systems and JSON data files. */

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherType = 'clear' | 'cloudy' | 'drizzle' | 'fog' | 'storm';
export type QualityPreset = 'low' | 'medium' | 'high' | 'auto';

/** Character appearance — every field is an index into a palette/variant list. */
export interface Appearance {
  bodyType: number;
  skinTone: number;
  faceShape: number;
  eyes: number;
  brows: number;
  mouth: number;
  hairstyle: number;
  hairColor: number;
  /** 0 = sleeveless (shirt color covers torso, bare arms), 1 = sleeved jacket. */
  sleeves: number;
  jacket: number;
  shirt: number;
  pants: number;
  shoes: number;
  scarf: number; // 0 = none
  hat: number; // 0 = none
  backpack: number; // 0 = none
  gloves: number; // 0 = none
  pin: number; // 0 = none
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: 'resource' | 'tool' | 'food' | 'furniture' | 'gift' | 'fish' | 'special';
  icon: string;
  stack: number;
}

export interface RecipeIngredient {
  item: string;
  qty: number;
}

export interface RecipeDef {
  id: string;
  result: string;
  qty: number;
  ingredients: RecipeIngredient[];
  category: 'tools' | 'food' | 'furniture' | 'decorations' | 'gifts' | 'waylight' | 'clothing';
  station?: string;
}

export type NPCActivity = 'idle' | 'wander' | 'sit' | 'work' | 'sleep';

export interface NPCScheduleEntry {
  start: number; // hour 0-24
  end: number;
  x: number;
  z: number;
  activity: NPCActivity;
}

export interface NPCDef {
  id: string;
  name: string;
  role: string;
  region: string;
  appearance: Appearance;
  dialogueKey: string;
  giftPreference?: string;
  home: { x: number; z: number };
  schedule: NPCScheduleEntry[];
}

export interface DialogueCondition {
  questAt?: { quest: string; step: number };
  questActive?: string;
  questCompleted?: string;
  notQuestStarted?: string;
  hasItem?: { id: string; qty: number };
  flag?: string;
  notFlag?: string;
  friendshipAtLeast?: { id: string; level: number };
  phase?: DayPhase;
}

export interface DialogueEffects {
  startQuest?: string;
  giveItems?: { id: string; qty: number }[];
  takeItems?: { id: string; qty: number }[];
  friendship?: { id: string; delta: number };
  setFlag?: string;
  openCrafting?: boolean;
  openCustomization?: boolean;
  unlockRecipe?: string;
  calmEcho?: string;
  echoBond?: { id: string; delta: number };
}

export interface DialogueChoice {
  text: string;
  next?: string;
  effects?: DialogueEffects;
  conditions?: DialogueCondition;
}

export interface DialogueNode {
  speaker?: string;
  lines: string[];
  choices?: DialogueChoice[];
  next?: string;
  effects?: DialogueEffects;
}

/** One conversation variant; NPCs pick the first entry whose conditions pass. */
export interface DialogueEntry {
  id: string;
  conditions?: DialogueCondition;
  start: string;
  nodes: Record<string, DialogueNode>;
}

export type DialogueFile = Record<string, DialogueEntry[]>;

export type ObjectiveType =
  | 'talk'
  | 'gather'
  | 'craft'
  | 'calmEcho'
  | 'restoreWaylight'
  | 'interact'
  | 'reach';

export interface ObjectiveDef {
  type: ObjectiveType;
  target?: string;
  item?: string;
  count?: number;
  label: string;
}

export interface QuestStep {
  id: string;
  title: string;
  hint?: string;
  objectives: ObjectiveDef[];
  onComplete?: DialogueEffects;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side' | 'daily' | 'friendship' | 'memory';
  giver: string;
  steps: QuestStep[];
}

export interface QuestSaveState {
  id: string;
  step: number;
  progress: Record<string, number>;
  completed: boolean;
}

export type SpiritVariant = 'meadow' | 'river' | 'hearth' | 'cloud' | 'night' | 'storm' | 'guardian';

export interface SpiritDef {
  id: string;
  name: string;
  variant: SpiritVariant;
  personality: string;
  habitat: string;
  ability: string;
  favoriteGift: string;
  description: string;
  palette: { body: string; glow: string; accent: string };
  spawn: { x: number; z: number };
  nightOnly?: boolean;
}

export interface FurnitureDef {
  id: string;
  name: string;
  icon: string;
  category: 'structure' | 'furniture' | 'decoration' | 'lighting' | 'garden';
  size: { w: number; h: number; d: number };
  color: string;
  colors?: string[];
  /** Other items may be stacked on top of this one. */
  surface?: boolean;
}

export interface PlacedFurniture {
  defId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  colorIndex: number;
}

export interface Settings {
  quality: QualityPreset;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  invertY: boolean;
  cameraSensitivity: number;
  showFps: boolean;
  mockPlayers: boolean;
  stylizedOutlines: boolean;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  playerName: string;
  appearance: Appearance;
  position: { x: number; y: number; z: number };
  yaw: number;
  timeOfDay: number;
  day: number;
  inventory: Record<string, number>;
  activeTool: string | null;
  quests: QuestSaveState[];
  flags: string[];
  friendships: Record<string, number>;
  echoBonds: Record<string, number>;
  calmedEchoes: string[];
  restoredWaylights: string[];
  housing: PlacedFurniture[];
  recipesUnlocked: string[];
  fishCaught: string[];
  communityProjects: Record<string, number>;
  settings: Settings;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}
