import type { Appearance } from '../types';
import {
  BODY_NAMES,
  BROW_NAMES,
  CLOTH_COLORS,
  EYE_NAMES,
  FACE_SHAPE_NAMES,
  GLOVE_NAMES,
  HAIRSTYLE_NAMES,
  HAIR_COLORS,
  HAT_NAMES,
  MOUTH_NAMES,
  PIN_NAMES,
  BACKPACK_NAMES,
  SCARF_NAMES,
  SKIN_TONES,
  SLEEVE_NAMES,
} from '../utils/constants';

export function defaultAppearance(): Appearance {
  return {
    bodyType: 1,
    skinTone: 1,
    faceShape: 0,
    eyes: 0,
    brows: 0,
    mouth: 0,
    hairstyle: 1,
    hairColor: 1,
    sleeves: 1,
    jacket: 4,
    shirt: 9,
    pants: 10,
    shoes: 8,
    scarf: 1,
    hat: 0,
    backpack: 1,
    gloves: 0,
    pin: 1,
  };
}

export function randomAppearance(): Appearance {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    bodyType: r(3),
    skinTone: r(SKIN_TONES.length),
    faceShape: r(3),
    eyes: r(4),
    brows: r(3),
    mouth: r(3),
    hairstyle: r(6),
    hairColor: r(HAIR_COLORS.length),
    sleeves: r(2),
    jacket: r(CLOTH_COLORS.length),
    shirt: r(CLOTH_COLORS.length),
    pants: r(CLOTH_COLORS.length),
    shoes: r(CLOTH_COLORS.length),
    scarf: r(3),
    hat: r(4),
    backpack: r(3),
    gloves: r(2),
    pin: r(4),
  };
}

export interface CustomizationCategory {
  key: keyof Appearance;
  label: string;
  group: 'body' | 'face' | 'hair' | 'outfit' | 'accessories';
  names?: string[];
  colors?: string[];
  count: number;
}

export const CUSTOMIZATION_CATEGORIES: CustomizationCategory[] = [
  { key: 'bodyType', label: 'Body Type', group: 'body', names: BODY_NAMES, count: 3 },
  { key: 'skinTone', label: 'Skin Tone', group: 'body', colors: [...SKIN_TONES], count: SKIN_TONES.length },
  { key: 'faceShape', label: 'Face Shape', group: 'face', names: FACE_SHAPE_NAMES, count: 3 },
  { key: 'eyes', label: 'Eyes', group: 'face', names: EYE_NAMES, count: 4 },
  { key: 'brows', label: 'Eyebrows', group: 'face', names: BROW_NAMES, count: 3 },
  { key: 'mouth', label: 'Mouth', group: 'face', names: MOUTH_NAMES, count: 3 },
  { key: 'hairstyle', label: 'Hairstyle', group: 'hair', names: HAIRSTYLE_NAMES, count: 6 },
  { key: 'hairColor', label: 'Hair Color', group: 'hair', colors: [...HAIR_COLORS], count: HAIR_COLORS.length },
  { key: 'sleeves', label: 'Top Style', group: 'outfit', names: SLEEVE_NAMES, count: 2 },
  { key: 'jacket', label: 'Jacket (sleeved)', group: 'outfit', colors: [...CLOTH_COLORS], count: CLOTH_COLORS.length },
  { key: 'shirt', label: 'Shirt', group: 'outfit', colors: [...CLOTH_COLORS], count: CLOTH_COLORS.length },
  { key: 'pants', label: 'Pants', group: 'outfit', colors: [...CLOTH_COLORS], count: CLOTH_COLORS.length },
  { key: 'shoes', label: 'Shoes', group: 'outfit', colors: [...CLOTH_COLORS], count: CLOTH_COLORS.length },
  { key: 'scarf', label: 'Scarf', group: 'accessories', names: SCARF_NAMES, count: 3 },
  { key: 'hat', label: 'Hat', group: 'accessories', names: HAT_NAMES, count: 4 },
  { key: 'backpack', label: 'Backpack', group: 'accessories', names: BACKPACK_NAMES, count: 3 },
  { key: 'gloves', label: 'Gloves', group: 'accessories', names: GLOVE_NAMES, count: 2 },
  { key: 'pin', label: 'Pin', group: 'accessories', names: PIN_NAMES, count: 4 },
];
