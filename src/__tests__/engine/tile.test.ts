import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTileSet,
  createTile,
  tileTypeToCode,
  codeToTileType,
  isSameType,
  isFortuneTile,
  tileDisplayName,
  sortHand,
  isSequence,
  isTriplet,
  validateTileSet,
  findTileInHand,
  removeTilesFromHand,
  resetTileIdCounter,
} from '../../engine/tile';
import type { Tile } from '../../engine/types';

describe('Tile Operations', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('createTileSet', () => {
    it('creates exactly 136 tiles', () => {
      const tiles = createTileSet();
      expect(tiles).toHaveLength(136);
    });

    it('creates 4 copies of each tile type', () => {
      const tiles = createTileSet();
      expect(validateTileSet(tiles)).toBe(true);
    });

    it('gives each tile a unique ID', () => {
      const tiles = createTileSet();
      const ids = new Set(tiles.map((t) => t.id));
      expect(ids.size).toBe(136);
    });
  });

  describe('tileTypeToCode and codeToTileType', () => {
    it('round-trips all tile types correctly', () => {
      const tiles = createTileSet();
      const seen = new Set<number>();

      for (const tile of tiles) {
        const code = tileTypeToCode(tile.type);
        expect(code).toBeGreaterThanOrEqual(0);
        expect(code).toBeLessThan(34);
        seen.add(code);

        const decoded = codeToTileType(code);
        expect(isSameType(tile.type, decoded)).toBe(true);
      }

      expect(seen.size).toBe(34);
    });

    it('encodes 一万 as 0', () => {
      expect(tileTypeToCode({ suit: 'wan', rank: 1 })).toBe(0);
    });

    it('encodes 九筒 as 26', () => {
      expect(tileTypeToCode({ suit: 'tong', rank: 9 })).toBe(26);
    });

    it('encodes 东 as 27', () => {
      expect(tileTypeToCode({ honor: 'east' })).toBe(27);
    });

    it('encodes 白 as 33', () => {
      expect(tileTypeToCode({ honor: 'bai' })).toBe(33);
    });
  });

  describe('isSameType', () => {
    it('identifies same tile types', () => {
      expect(isSameType({ suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 })).toBe(true);
    });

    it('identifies different tile types', () => {
      expect(isSameType({ suit: 'wan', rank: 1 }, { suit: 'wan', rank: 2 })).toBe(false);
    });
  });

  describe('isFortuneTile', () => {
    it('白板 is fortune tile', () => {
      expect(isFortuneTile({ honor: 'bai' })).toBe(true);
    });

    it('other tiles are not fortune', () => {
      expect(isFortuneTile({ honor: 'zhong' })).toBe(false);
      expect(isFortuneTile({ suit: 'wan', rank: 1 })).toBe(false);
    });
  });

  describe('tileDisplayName', () => {
    it('returns correct Chinese names', () => {
      expect(tileDisplayName({ suit: 'wan', rank: 1 })).toBe('一万');
      expect(tileDisplayName({ suit: 'tiao', rank: 5 })).toBe('五条');
      expect(tileDisplayName({ suit: 'tong', rank: 9 })).toBe('九筒');
      expect(tileDisplayName({ honor: 'east' })).toBe('东');
      expect(tileDisplayName({ honor: 'bai' })).toBe('白');
    });
  });

  describe('sortHand', () => {
    it('sorts tiles by suit then rank', () => {
      const tiles: Tile[] = [
        createTile({ suit: 'tong', rank: 1 }),
        createTile({ suit: 'wan', rank: 9 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'tiao', rank: 5 }),
      ];

      const sorted = sortHand(tiles);
      expect(tileTypeToCode(sorted[0].type)).toBe(0); // 1万
      expect(tileTypeToCode(sorted[1].type)).toBe(8); // 9万
      expect(tileTypeToCode(sorted[2].type)).toBe(13); // 5条
      expect(tileTypeToCode(sorted[3].type)).toBe(18); // 1筒
    });
  });

  describe('isSequence', () => {
    it('detects valid sequences', () => {
      expect(
        isSequence(
          { suit: 'wan', rank: 1 },
          { suit: 'wan', rank: 2 },
          { suit: 'wan', rank: 3 }
        )
      ).toBe(true);
    });

    it('rejects cross-suit sequences', () => {
      expect(
        isSequence(
          { suit: 'wan', rank: 1 },
          { suit: 'tiao', rank: 2 },
          { suit: 'wan', rank: 3 }
        )
      ).toBe(false);
    });

    it('rejects non-consecutive sequences', () => {
      expect(
        isSequence(
          { suit: 'wan', rank: 1 },
          { suit: 'wan', rank: 2 },
          { suit: 'wan', rank: 4 }
        )
      ).toBe(false);
    });
  });

  describe('isTriplet', () => {
    it('detects valid triplets', () => {
      expect(
        isTriplet(
          { suit: 'wan', rank: 5 },
          { suit: 'wan', rank: 5 },
          { suit: 'wan', rank: 5 }
        )
      ).toBe(true);
    });

    it('rejects non-triplets', () => {
      expect(
        isTriplet(
          { suit: 'wan', rank: 5 },
          { suit: 'wan', rank: 5 },
          { suit: 'wan', rank: 6 }
        )
      ).toBe(false);
    });
  });

  describe('removeTilesFromHand', () => {
    it('removes specified tiles', () => {
      const tiles: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 2 }),
        createTile({ suit: 'wan', rank: 3 }),
      ];
      const toRemove = [tiles[1]];
      const result = removeTilesFromHand(tiles, toRemove);
      expect(result).toHaveLength(2);
      expect(result.map((t) => tileTypeToCode(t.type))).toEqual([0, 2]);
    });
  });

  describe('findTileInHand', () => {
    it('finds tile by ID', () => {
      const tile = createTile({ suit: 'wan', rank: 1 });
      expect(findTileInHand([tile], tile.id)).toBeDefined();
    });

    it('returns undefined for missing tile', () => {
      expect(findTileInHand([], 'nonexistent')).toBeUndefined();
    });
  });
});
