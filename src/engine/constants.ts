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

// === Scoring Tables ===

// Pattern multiplier table
export const PATTERN_MULTIPLIERS: Record<string, number> = {
  basic: 1,
  baoTou: 2, // 爆头
  sevenPairs: 2, // 七对
  gangKai: 2, // 杠开
  caiPiao: 4, // 财飘
  gangBao: 4, // 杠爆
  luxurySevenPairs: 4, // 豪华七对
  qingQiDui: 4, // 清七对 (no fortune)
  doubleCaiPiao: 8, // 双财飘
  doubleGangKai: 4, // 双杠开
  gangPiao: 8, // 杠飘
  doubleGangBao: 8, // 双杠爆
  doubleLuxurySevenPairs: 8, // 双豪华七对
  sevenGuest: 4, // 七客 (七对+爆头)
  luxurySevenGuest: 8, // 豪华七客
  tripleCaiPiao: 16, // 三财飘
  tripleGangKai: 8, // 三杠开
  tripleGangBao: 16, // 三杠爆
  tripleLuxurySevenPairs: 16, // 三豪华七对
  doubleLuxurySevenGuest: 16, // 双豪华七客
  tripleLuxurySevenGuest: 32, // 三豪华七客
  // 清一色系列
  qingYiSe: 4, // 清一色
  hunYiSe: 2, // 混一色
  ziYiSe: 8, // 字一色
  
  // 组合牌型
  qingYiSeBaoTou: 8, // 清一色 + 爆头
  qingYiSeCaiPiao: 16, // 清一色 + 财飘
  hunYiSeBaoTou: 4, // 混一色 + 爆头
  
  max: 256, // Cap
};

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
