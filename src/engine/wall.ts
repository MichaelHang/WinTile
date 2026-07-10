// ============================================================
// Hangzhou Mahjong (杭州麻将) - Wall Operations
// ============================================================

import type { Tile } from './types';
import { createTileSet, resetTileIdCounter } from './tile';
import { shuffleArray } from '../utils/shuffle';
import { DEAD_WALL_SIZE } from './constants';

// Build a complete wall with separate dead wall for kong replacements
export function buildWall(seed?: number): { wall: Tile[]; deadWall: Tile[] } {
  resetTileIdCounter();
  const allTiles = createTileSet();
  const shuffled = shuffleArray(allTiles, seed);

  // Last DEAD_WALL_SIZE tiles are the dead wall (kong replacements)
  const deadWall = shuffled.slice(-DEAD_WALL_SIZE);
  const wall = shuffled.slice(0, -DEAD_WALL_SIZE);

  return { wall, deadWall };
}

// Draw one tile from the live wall
export function drawTile(
  wall: Tile[]
): { tile: Tile; remainingWall: Tile[] } | null {
  if (wall.length === 0) return null;

  const tile = wall[0];
  const remainingWall = wall.slice(1);
  return { tile, remainingWall };
}

// Draw a replacement tile from dead wall (after kong)
export function drawReplacement(
  deadWall: Tile[]
): { tile: Tile; remainingDeadWall: Tile[] } | null {
  if (deadWall.length === 0) return null;

  const tile = deadWall[0];
  const remainingDeadWall = deadWall.slice(1);
  return { tile, remainingDeadWall };
}

// Deal initial tiles: 13 per player + 1 extra for dealer
export function dealTiles(
  wall: Tile[],
  dealerIndex: number
): { hands: [Tile[], Tile[], Tile[], Tile[]]; remainingWall: Tile[] } {
  const hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];

  // Deal 4 tiles at a time, 3 rounds = 12 tiles per player
  let tileIndex = 0;
  for (let round = 0; round < 3; round++) {
    for (let player = 0; player < 4; player++) {
      for (let i = 0; i < 4; i++) {
        hands[player].push(wall[tileIndex++]);
      }
    }
  }

  // Deal 1 more tile to each player (13th tile)
  for (let player = 0; player < 4; player++) {
    hands[player].push(wall[tileIndex++]);
  }

  // Dealer gets the 14th tile
  hands[dealerIndex].push(wall[tileIndex++]);

  const remainingWall = wall.slice(tileIndex);

  return { hands, remainingWall };
}

// How many tiles remain in the wall
export function tilesRemaining(wall: Tile[]): number {
  return wall.length;
}
