import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildWall,
  drawTile,
  drawReplacement,
  dealTiles,
  tilesRemaining,
} from '../../engine/wall';
import { resetTileIdCounter } from '../../engine/tile';
import { DEAD_WALL_SIZE, TILES_PER_PLAYER, TOTAL_TILES } from '../../engine/constants';

describe('Wall Operations', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('buildWall', () => {
    it('builds a complete wall with correct sizes', () => {
      const { wall, deadWall } = buildWall(42);
      expect(wall).toHaveLength(TOTAL_TILES - DEAD_WALL_SIZE);
      expect(deadWall).toHaveLength(DEAD_WALL_SIZE);
      expect(wall.length + deadWall.length).toBe(TOTAL_TILES);
    });

    it('produces deterministic results with the same seed', () => {
      const a = buildWall(123);
      const b = buildWall(123);
      expect(a.wall.map((t) => t.id)).toEqual(b.wall.map((t) => t.id));
      expect(a.deadWall.map((t) => t.id)).toEqual(b.deadWall.map((t) => t.id));
    });

    it('produces different results with different seeds', () => {
      const a = buildWall(123);
      const b = buildWall(456);
      const aIds = a.wall.map((t) => t.id);
      const bIds = b.wall.map((t) => t.id);
      expect(aIds).not.toEqual(bIds);
    });
  });

  describe('drawTile', () => {
    it('draws the first tile from the wall', () => {
      const { wall } = buildWall(42);
      const result = drawTile(wall);
      expect(result).not.toBeNull();
      expect(result!.tile.id).toBe(wall[0].id);
      expect(result!.remainingWall).toHaveLength(wall.length - 1);
    });

    it('returns null when wall is empty', () => {
      expect(drawTile([])).toBeNull();
    });
  });

  describe('drawReplacement', () => {
    it('draws the first tile from dead wall', () => {
      const { deadWall } = buildWall(42);
      const result = drawReplacement(deadWall);
      expect(result).not.toBeNull();
      expect(result!.remainingDeadWall).toHaveLength(DEAD_WALL_SIZE - 1);
    });

    it('returns null when dead wall is empty', () => {
      expect(drawReplacement([])).toBeNull();
    });
  });

  describe('dealTiles', () => {
    it('deals correct number of tiles to each player', () => {
      const { wall } = buildWall(42);
      const { hands, remainingWall } = dealTiles(wall, 0);

      // Dealer (index 0) gets 14, others get 13
      expect(hands[0]).toHaveLength(TILES_PER_PLAYER + 1);
      expect(hands[1]).toHaveLength(TILES_PER_PLAYER);
      expect(hands[2]).toHaveLength(TILES_PER_PLAYER);
      expect(hands[3]).toHaveLength(TILES_PER_PLAYER);

      // Total tiles: 13*3 + 14 + remaining = 136
      const dealt = hands[0].length + hands[1].length + hands[2].length + hands[3].length;
      expect(dealt + remainingWall.length).toBe(TOTAL_TILES - DEAD_WALL_SIZE);
    });

    it('each player has unique tiles (no duplicates across hands)', () => {
      const { wall } = buildWall(42);
      const { hands } = dealTiles(wall, 0);
      const allIds = new Set<string>();

      for (const hand of hands) {
        for (const tile of hand) {
          expect(allIds.has(tile.id)).toBe(false);
          allIds.add(tile.id);
        }
      }
    });

    it('dealer at index 1 gets 14 tiles', () => {
      const { wall } = buildWall(42);
      const { hands } = dealTiles(wall, 1);
      expect(hands[1]).toHaveLength(TILES_PER_PLAYER + 1);
      expect(hands[0]).toHaveLength(TILES_PER_PLAYER);
    });

    it('tilesRemaining reports correct count', () => {
      const { wall } = buildWall(42);
      expect(tilesRemaining(wall)).toBe(wall.length);
    });
  });
});
