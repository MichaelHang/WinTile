// ============================================================
// Hangzhou Mahjong (杭州麻将) - Tile Operations
// ============================================================

import type { Tile, TileType, Suit, HonorName, SuitTile } from './types';
import {
  SUITS,
  RANKS,
  HONORS,
  SUIT_NAMES,
  RANK_NAMES,
  HONOR_NAMES,
  TOTAL_TILES,
} from './constants';

let nextTileId = 0;

function generateTileId(): string {
  return `tile_${nextTileId++}`;
}

// Reset tile ID counter (for testing)
export function resetTileIdCounter(): void {
  nextTileId = 0;
}

// Create a single tile
export function createTile(type: TileType): Tile {
  return {
    id: generateTileId(),
    type,
  };
}

// Create all 136 tiles (4 copies of each of the 34 types)
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];

  // 3 suits × 9 ranks = 27 types, ×4 copies = 108
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      for (let i = 0; i < 4; i++) {
        tiles.push(
          createTile({
            suit: suit as Suit,
            rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
          })
        );
      }
    }
  }

  // 7 honors × 4 copies = 28
  for (const honor of HONORS) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createTile({ honor: honor as HonorName }));
    }
  }

  return tiles;
}

// Encode tile type to a number 0-33 for fast array-based hand analysis
export function tileTypeToCode(type: TileType): number {
  if ('suit' in type) {
    const suitIndex = SUITS.indexOf(type.suit);
    return suitIndex * 9 + type.rank - 1;
  } else {
    const honorIndex = HONORS.indexOf(type.honor);
    return 27 + honorIndex;
  }
}

// Decode a number 0-33 back to TileType
export function codeToTileType(code: number): TileType {
  if (code < 27) {
    const suitIndex = Math.floor(code / 9);
    const rank = (code % 9) + 1;
    return {
      suit: SUITS[suitIndex],
      rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    };
  } else {
    return { honor: HONORS[code - 27] };
  }
}

// Check if two tile types are the same
export function isSameType(a: TileType, b: TileType): boolean {
  return tileTypeToCode(a) === tileTypeToCode(b);
}

// Check if a tile is the fortune tile (白板)
export function isFortuneTile(type: TileType): boolean {
  if ('honor' in type && type.honor === 'bai') return true;
  return false;
}

// Check if a tile is a suit tile
export function isSuitTile(type: TileType): type is SuitTile {
  return 'suit' in type;
}

// Check if a tile is an honor tile
export function isHonorTile(type: TileType): boolean {
  return 'honor' in type;
}

// Get human-readable Chinese name for a tile
export function tileDisplayName(type: TileType): string {
  if ('suit' in type) {
    return `${RANK_NAMES[type.rank]}${SUIT_NAMES[type.suit]}`;
  } else {
    return HONOR_NAMES[type.honor];
  }
}

// Sort key for ordering tiles in hand display
export function tileSortKey(type: TileType): number {
  return tileTypeToCode(type);
}

// Sort a hand of tiles by suit then rank
export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => tileSortKey(a.type) - tileSortKey(b.type));
}

// Check if three suit tiles form a valid sequence (e.g., 1-2-3 of same suit)
export function isSequence(a: TileType, b: TileType, c: TileType): boolean {
  if (!isSuitTile(a) || !isSuitTile(b) || !isSuitTile(c)) return false;
  if (a.suit !== b.suit || b.suit !== c.suit) return false;

  const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
  return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
}

// Check if three tile types form a triplet (same type, 3 copies)
export function isTriplet(a: TileType, b: TileType, c: TileType): boolean {
  return isSameType(a, b) && isSameType(b, c);
}

// Validate that the tile set has exactly 136 tiles with correct counts
export function validateTileSet(tiles: Tile[]): boolean {
  if (tiles.length !== TOTAL_TILES) return false;

  const counts = new Array(34).fill(0);
  for (const tile of tiles) {
    counts[tileTypeToCode(tile.type)]++;
  }

  return counts.every((c) => c === 4);
}

// Pick a tile from a hand by ID
export function findTileInHand(hand: Tile[], tileId: string): Tile | undefined {
  return hand.find((t) => t.id === tileId);
}

// Remove specific tiles from a hand
export function removeTilesFromHand(hand: Tile[], tilesToRemove: Tile[]): Tile[] {
  const removeIds = new Set(tilesToRemove.map((t) => t.id));
  return hand.filter((t) => !removeIds.has(t.id));
}
