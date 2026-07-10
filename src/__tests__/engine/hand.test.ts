import { describe, it, expect, beforeEach } from 'vitest';
import {
  handToCounts,
  countFortuneTiles,
  getChiOptions,
  canPong,
  canMingKong,
  getAnKongOptions,
  getJiaGangOptions,
  getTilesOfType,
  isTerminalOrHonor,
} from '../../engine/hand';
import { createTile, resetTileIdCounter, tileTypeToCode } from '../../engine/tile';
import type { Tile } from '../../engine/types';
import { TOTAL_TILE_TYPES } from '../../engine/constants';

describe('Hand Analysis', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('handToCounts', () => {
    it('returns a 34-element array', () => {
      const hand: Tile[] = [];
      const counts = handToCounts(hand);
      expect(counts).toHaveLength(TOTAL_TILE_TYPES);
      expect(counts.every((c) => c === 0)).toBe(true);
    });

    it('counts tiles correctly', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ honor: 'zhong' }),
      ];
      const counts = handToCounts(hand);
      expect(counts[tileTypeToCode({ suit: 'wan', rank: 1 })]).toBe(3);
      expect(counts[tileTypeToCode({ honor: 'zhong' })]).toBe(1);
    });
  });

  describe('countFortuneTiles', () => {
    it('counts 白板 tiles', () => {
      const hand: Tile[] = [
        createTile({ honor: 'bai' }),
        createTile({ honor: 'bai' }),
        createTile({ suit: 'wan', rank: 1 }),
      ];
      expect(countFortuneTiles(hand)).toBe(2);
    });

    it('returns 0 when no fortune tiles', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'tiao', rank: 5 }),
      ];
      expect(countFortuneTiles(hand)).toBe(0);
    });
  });

  describe('getChiOptions', () => {
    it('finds chi options for middle tile', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 3 }),
        createTile({ suit: 'wan', rank: 4 }),
        createTile({ suit: 'tiao', rank: 1 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      const options = getChiOptions(hand, discard);
      expect(options).toHaveLength(1); // 3,4 + 5 = 345
    });

    it('finds chi options when discard is the first tile', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 2 }),
        createTile({ suit: 'wan', rank: 3 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 1 });
      const options = getChiOptions(hand, discard);
      expect(options).toHaveLength(1); // 2,3 + 1 = 123
    });

    it('finds chi options when discard is the last tile', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 7 }),
        createTile({ suit: 'wan', rank: 8 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 9 });
      const options = getChiOptions(hand, discard);
      expect(options).toHaveLength(1); // 7,8 + 9 = 789
    });

    it('returns empty for honor tiles (cannot chi honors)', () => {
      const hand: Tile[] = [
        createTile({ honor: 'zhong' }),
        createTile({ honor: 'fa' }),
      ];
      const discard = createTile({ honor: 'bai' });
      const options = getChiOptions(hand, discard);
      expect(options).toHaveLength(0);
    });

    it('returns empty when no valid chi exists', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'tiao', rank: 5 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      const options = getChiOptions(hand, discard);
      expect(options).toHaveLength(0);
    });
  });

  describe('canPong', () => {
    it('detects pong opportunity', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'tiao', rank: 1 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      expect(canPong(hand, discard)).toBe(true);
    });

    it('returns false when only one matching tile', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'tiao', rank: 1 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      expect(canPong(hand, discard)).toBe(false);
    });
  });

  describe('canMingKong', () => {
    it('detects ming kong opportunity', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      expect(canMingKong(hand, discard)).toBe(true);
    });

    it('returns false when only two matching tiles', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
      ];
      const discard = createTile({ suit: 'wan', rank: 5 });
      expect(canMingKong(hand, discard)).toBe(false);
    });
  });

  describe('getAnKongOptions', () => {
    it('finds concealed kong when holding 4 identical tiles', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
      ];
      const options = getAnKongOptions(hand);
      expect(options).toHaveLength(1);
    });

    it('returns empty when no concealed kong exists', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
        createTile({ suit: 'wan', rank: 1 }),
      ];
      const options = getAnKongOptions(hand);
      expect(options).toHaveLength(0);
    });
  });

  describe('getJiaGangOptions', () => {
    it('finds jia gang when holding tile matching an exposed pong', () => {
      const pongTile = createTile({ suit: 'wan', rank: 5 });
      const melds = [
        {
          kind: 'pong' as const,
          tiles: [pongTile, pongTile, pongTile],
          discardFrom: 1,
        },
      ];
      const hand: Tile[] = [createTile({ suit: 'wan', rank: 5 })];
      const options = getJiaGangOptions(hand, melds);
      expect(options).toHaveLength(1);
      expect(options[0].meldIndex).toBe(0);
    });

    it('returns empty when no matching tile in hand', () => {
      const pongTile = createTile({ suit: 'wan', rank: 5 });
      const melds = [
        {
          kind: 'pong' as const,
          tiles: [pongTile, pongTile, pongTile],
          discardFrom: 1,
        },
      ];
      const hand: Tile[] = [createTile({ suit: 'tiao', rank: 3 })];
      const options = getJiaGangOptions(hand, melds);
      expect(options).toHaveLength(0);
    });
  });

  describe('getTilesOfType', () => {
    it('returns specified count of matching tiles', () => {
      const hand: Tile[] = [
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
        createTile({ suit: 'wan', rank: 5 }),
      ];
      const result = getTilesOfType(hand, { suit: 'wan', rank: 5 }, 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('isTerminalOrHonor', () => {
    it('identifies terminal 1', () => {
      expect(isTerminalOrHonor({ suit: 'wan', rank: 1 })).toBe(true);
    });
    it('identifies terminal 9', () => {
      expect(isTerminalOrHonor({ suit: 'wan', rank: 9 })).toBe(true);
    });
    it('identifies honor', () => {
      expect(isTerminalOrHonor({ honor: 'zhong' })).toBe(true);
    });
    it('returns false for middle tiles', () => {
      expect(isTerminalOrHonor({ suit: 'wan', rank: 5 })).toBe(false);
    });
  });
});
