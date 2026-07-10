// ============================================================
// Hangzhou Mahjong (杭州麻将) - Hand Analysis
// ============================================================

import type { Tile, TileType, Meld } from './types';
import { tileTypeToCode, isSameType, isSuitTile, isFortuneTile } from './tile';
import { TOTAL_TILE_TYPES } from './constants';

// Convert a hand of tiles to a 34-element count array
export function handToCounts(hand: Tile[]): number[] {
  const counts = new Array(TOTAL_TILE_TYPES).fill(0);
  for (const tile of hand) {
    counts[tileTypeToCode(tile.type)]++;
  }
  return counts;
}

// Count fortune tiles (白板) in a given set of tiles
export function countFortuneTiles(tiles: Tile[]): number {
  return tiles.filter((t) => isFortuneTile(t.type)).length;
}

// Get all valid chi (吃) combinations from a discard tile
// Returns arrays of 2 tiles from hand that complete a sequence with the discard
export function getChiOptions(hand: Tile[], discard: Tile): Tile[][] {
  const discardType = discard.type;
  if (!isSuitTile(discardType)) return [];

  const suit = discardType.suit;
  const rank = discardType.rank;
  const options: Tile[][] = [];

  // Check all possible chi patterns centered on the discard
  const patterns = [
    [rank - 2, rank - 1], // discard is the 3rd tile of sequence
    [rank - 1, rank + 1], // discard is the middle tile
    [rank + 1, rank + 2], // discard is the 1st tile
  ];

  for (const [r1, r2] of patterns) {
    if (r1 < 1 || r2 < 1 || r1 > 9 || r2 > 9) continue;

    const need1: TileType = { suit, rank: r1 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };
    const need2: TileType = { suit, rank: r2 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };

    const tile1 = findTileOfType(hand, need1);
    const tile2 = findTileOfType(hand, need2);

    if (tile1 && tile2 && tile1.id !== tile2.id) {
      options.push([tile1, tile2]);
    }
  }

  return options;
}

// Check if a hand can pong (碰) a discard
export function canPong(hand: Tile[], discard: Tile): boolean {
  const discardCode = tileTypeToCode(discard.type);
  const counts = handToCounts(hand);
  return counts[discardCode] >= 2;
}

// Check if a hand can ming kong (明杠) a discard
export function canMingKong(hand: Tile[], discard: Tile): boolean {
  const discardCode = tileTypeToCode(discard.type);
  const counts = handToCounts(hand);
  return counts[discardCode] >= 3;
}

// Get concealed kong (暗杠) options from a hand
export function getAnKongOptions(hand: Tile[]): Tile[] {
  const counts = handToCounts(hand);
  const options: Tile[] = [];

  for (let code = 0; code < TOTAL_TILE_TYPES; code++) {
    if (counts[code] >= 4) {
      // Find one tile of this type (any of the 4 copies)
      const tile = hand.find((t) => tileTypeToCode(t.type) === code);
      if (tile) {
        options.push(tile);
      }
    }
  }

  return options;
}

// Get jia gang (加杠) options: adding a tile to an existing exposed pong
export function getJiaGangOptions(
  hand: Tile[],
  melds: Meld[]
): { tile: Tile; meldIndex: number }[] {
  const options: { tile: Tile; meldIndex: number }[] = [];

  for (let i = 0; i < melds.length; i++) {
    const meld = melds[i];
    if (meld.kind !== 'pong') continue;

    const meldCode = tileTypeToCode(meld.tiles[0].type);
    const tileInHand = hand.find((t) => tileTypeToCode(t.type) === meldCode);

    if (tileInHand) {
      options.push({ tile: tileInHand, meldIndex: i });
    }
  }

  return options;
}

// Find the first tile in hand matching a given type
function findTileOfType(hand: Tile[], type: TileType): Tile | undefined {
  return hand.find((t) => isSameType(t.type, type));
}

// Get all tiles from hand that match a specific type (for pong/kong claims)
export function getTilesOfType(hand: Tile[], type: TileType, count: number): Tile[] {
  const matching = hand.filter((t) => isSameType(t.type, type));
  return matching.slice(0, count);
}

// Check if a tile type is a terminal (1 or 9) or honor - used for AI discard strategy
export function isTerminalOrHonor(type: TileType): boolean {
  if ('honor' in type) return true;
  return type.rank === 1 || type.rank === 9;
}

// Check if a tile type is an honor
export function isHonor(type: TileType): boolean {
  return 'honor' in type;
}

// Get the next tile in sequence (for suit tiles)
export function getNextTile(type: TileType): TileType | null {
  if (!isSuitTile(type)) return null;
  if (type.rank >= 9) return null;
  return { suit: type.suit, rank: (type.rank + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };
}

// Get the previous tile in sequence (for suit tiles)
export function getPrevTile(type: TileType): TileType | null {
  if (!isSuitTile(type)) return null;
  if (type.rank <= 1) return null;
  return { suit: type.suit, rank: (type.rank - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };
}

// Get tile codes that could form a pair (for tenpai analysis)
export function getPairCandidates(counts: number[]): number[] {
  const candidates: number[] = [];
  for (let code = 0; code < TOTAL_TILE_TYPES; code++) {
    if (counts[code] >= 1) {
      candidates.push(code);
    }
  }
  return candidates;
}
