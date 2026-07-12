// ============================================================
// Hangzhou Mahjong (杭州麻将) - Constants
// ============================================================

import type { Suit, HonorName, TileType } from './types';

// === Tile Sets ===

export const SUITS: Suit[] = ['wan', 'tiao', 'tong'];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const HONORS: HonorName[] = [
  'east',
  'south',
  'west',
  'north',
  'zhong',
  'fa',
  'bai',
];

// Total tiles: 3 suits × 9 ranks × 4 copies + 7 honors × 4 copies = 108 + 28 = 136
export const TOTAL_TILES = 136;
export const TILES_PER_PLAYER = 13;
export const DEAD_WALL_SIZE = 14; // 7 stacks reserved for kong replacements
export const WALL_EXHAUST_THRESHOLD = 20; // ≤20 tiles left → draw (流局)

// === Tile Display Names (Chinese) ===

export const SUIT_NAMES: Record<Suit, string> = {
  wan: '万',
  tiao: '条',
  tong: '筒',
};

export const RANK_NAMES: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
};

export const HONOR_NAMES: Record<HonorName, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
  zhong: '中',
  fa: '发',
  bai: '白',
};

// === Fortune Tile (财神) ===
// 白板 (White Dragon) is the permanent fortune tile
export const FORTUNE_TILE: TileType = { honor: 'bai' };

// === Tile Encoding ===
// Encode 34 tile types into numbers 0-33 for fast array-based operations
// 0-8: wan 1-9
// 9-17: tiao 1-9
// 18-26: tong 1-9
// 27-30: east, south, west, north
// 31-33: zhong, fa, bai

export const TILE_ENCODING: Record<string, number> = {};

// Build encoding map
SUITS.forEach((suit, si) => {
  RANKS.forEach((rank) => {
    const key = `${suit}${rank}`;
    TILE_ENCODING[key] = si * 9 + rank - 1;
  });
});

HONORS.forEach((honor, hi) => {
  TILE_ENCODING[honor] = 27 + hi;
});

export const TOTAL_TILE_TYPES = 34;

// Lao multiplier by consecutive dealer wins
export function getLaoMultiplier(
  laoCount: number,
  isWinnerDealer: boolean,
  isLoserDealer: boolean
): number {
  // Between dealer and non-dealer: apply lao multiplier
  if (isWinnerDealer !== isLoserDealer) {
    if (laoCount >= 3) return 8;
    if (laoCount === 2) return 4;
    return 2; // 1 lao
  }
  // Between non-dealers: always 1
  return 1;
}

// === AI Timing ===
export const AI_THINK_DELAY_MS = 600;
export const AI_DISCARD_DELAY_MS = 500;
export const HUMAN_REACTION_TIMEOUT_MS = 15000;
