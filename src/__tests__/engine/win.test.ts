import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkWin,
  isBaoTouState,
  hasMinimumTai,
} from '../../engine/win';
import { calculatePatternMultiplier, getPatternName } from '../../engine/scoring';
import {
  createTile,
  resetTileIdCounter,
} from '../../engine/tile';
import type { Tile, WinResult } from '../../engine/types';

const FORTUNE_TYPE = { honor: 'bai' as const };

function makeHand(tiles: { suit?: string; rank?: number; honor?: string }[]): Tile[] {
  return tiles.map((t) => {
    if (t.honor) {
      return createTile({ honor: t.honor as 'east' | 'south' | 'west' | 'north' | 'zhong' | 'fa' | 'bai' });
    }
    return createTile({
      suit: t.suit as 'wan' | 'tiao' | 'tong',
      rank: t.rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    });
  });
}

describe('Win Detection', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('checkWin - Standard Form', () => {
    it('detects a basic winning hand: 123万 456万 789万 123筒 44筒', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 5 }, { suit: 'wan', rank: 6 },
        { suit: 'wan', rank: 7 }, { suit: 'wan', rank: 8 }, { suit: 'wan', rank: 9 },
        { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 3 },
        { suit: 'tong', rank: 4 }, { suit: 'tong', rank: 4 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
      expect(result!.fromWall).toBe(true);
    });

    it('detects win with all triplets: 111万 222筒 333条 444万 55筒', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 },
        { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 },
        { suit: 'tong', rank: 5 }, { suit: 'tong', rank: 5 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
    });

    it('detects win with all triplets in mixed suits: 111万 222筒 333条 444万 55筒', () => {
      const mixedWin = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 },
        { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 },
        { suit: 'tong', rank: 5 }, { suit: 'tong', rank: 5 },
      ]);

      const result = checkWin(mixedWin, [], mixedWin[mixedWin.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });
      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
    });

    it('rejects non-winning hand (1 tile short)', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 5 }, { suit: 'wan', rank: 6 },
        { suit: 'wan', rank: 7 }, { suit: 'wan', rank: 8 },
        { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 3 },
        { suit: 'tong', rank: 4 }, { suit: 'tong', rank: 4 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });
      expect(result).toBeNull();
    });

    it('rejects hand with too many of one tile type', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, // 5 copies, impossible in real game
        { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 3 },
        { suit: 'tiao', rank: 1 }, { suit: 'tiao', rank: 2 }, { suit: 'tiao', rank: 3 },
        { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 3 },
        { suit: 'tong', rank: 4 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });
      // The algorithm tries to decompose but 5 of same tile breaks triplet count
      // Hand has 14 tiles but 5+ of one type means it can't form valid melds+pair
      expect(result).toBeNull();
    });
  });

  describe('checkWin - Fortune Tile Substitution', () => {
    it('wins with fortune tile substituting for a missing triplet tile', () => {
      // 111万 222筒 333条 444万 + fortune + 5筒 (fortune pairs with 5筒)
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 2 },
        { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 }, { suit: 'tiao', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 },
        { honor: 'bai' }, { suit: 'tong', rank: 5 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.hasFortune).toBe(true);
    });

    it('wins with fortune tile substituting in a sequence', () => {
      // 123万 456万 78万 + fortune (as 9万) + 111筒 + 55筒
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 5 }, { suit: 'wan', rank: 6 },
        { suit: 'wan', rank: 7 }, { suit: 'wan', rank: 8 },
        { honor: 'bai' },
        { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 1 },
        { suit: 'tong', rank: 5 }, { suit: 'tong', rank: 5 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      // Fortune substitutes as 9万 to complete the 789 sequence
      // Pair is 55筒
      expect(result).not.toBeNull();
      expect(result!.hasFortune).toBe(true);
    });
  });

  describe('checkWin - Seven Pairs', () => {
    it('detects seven pairs', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 },
        { suit: 'tiao', rank: 5 }, { suit: 'tiao', rank: 5 },
        { suit: 'tiao', rank: 6 }, { suit: 'tiao', rank: 6 },
        { honor: 'zhong' }, { honor: 'zhong' },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('sevenPairs');
    });

    it('detects seven pairs with fortune tile', () => {
      // 6 pairs + 1 fortune + 1 single = 7 pairs (fortune pairs with the single)
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 }, { suit: 'wan', rank: 3 },
        { suit: 'tiao', rank: 4 }, { suit: 'tiao', rank: 4 },
        { suit: 'tiao', rank: 5 }, { suit: 'tiao', rank: 5 },
        { suit: 'tong', rank: 6 }, { suit: 'tong', rank: 6 },
        { honor: 'bai' }, // fortune
        { suit: 'wan', rank: 9 }, // single
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('sevenPairs');
    });

    it('detects luxury seven pairs (豪华七对 - one set of 4)', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, // 4 of same
        { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 }, { suit: 'wan', rank: 3 },
        { suit: 'tiao', rank: 4 }, { suit: 'tiao', rank: 4 },
        { suit: 'tiao', rank: 5 }, { suit: 'tiao', rank: 5 },
        { suit: 'tong', rank: 6 }, { suit: 'tong', rank: 6 },
      ]);

      const lastTile = hand[hand.length - 1];
      const result = checkWin(hand, [], lastTile, FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('sevenPairs');
      expect(result!.isLuxury).toBe(true);
      expect(result!.luxuryCount).toBe(1);
    });
  });

  describe('isBaoTouState', () => {
    it('detects 爆头: 4 melds + 1 fortune tile', () => {
      // 111万 222万 333万 444万 + 1 fortune
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 }, { suit: 'wan', rank: 3 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 4 },
        { honor: 'bai' },
      ]);

      const result = isBaoTouState(hand, [], FORTUNE_TYPE);
      expect(result).toBe(true);
    });

    it('rejects non-爆头 state', () => {
      const hand = makeHand([
        { suit: 'wan', rank: 1 }, { suit: 'wan', rank: 2 }, { suit: 'wan', rank: 3 },
        { suit: 'wan', rank: 4 }, { suit: 'wan', rank: 5 }, { suit: 'wan', rank: 6 },
        { suit: 'wan', rank: 7 }, { suit: 'wan', rank: 8 },
        { suit: 'tong', rank: 1 }, { suit: 'tong', rank: 2 }, { suit: 'tong', rank: 3 },
        { suit: 'tong', rank: 4 }, { suit: 'tong', rank: 4 },
      ]);

      const result = isBaoTouState(hand, [], FORTUNE_TYPE);
      expect(result).toBe(false);
    });
  });

  describe('hasMinimumTai', () => {
    it('self-draw with fortune tile has tai', () => {
      const result: WinResult = {
        winner: 0, form: 'standard', fromWall: true,
        isBaoTou: false, isCaiPiao: false, piaoCount: 0,
        isGangKai: false, gangCount: 0, isGangBao: false,
        hasFortune: true, isPure: false, isLuxury: false, luxuryCount: 0,
        melds: [], pair: [{ id: '', type: { honor: 'bai' } }, { id: '', type: { honor: 'bai' } }],
      };
      expect(hasMinimumTai(result, [], [])).toBe(true);
    });

    it('self-draw without fortune still has tai', () => {
      const result: WinResult = {
        winner: 0, form: 'standard', fromWall: true,
        isBaoTou: false, isCaiPiao: false, piaoCount: 0,
        isGangKai: false, gangCount: 0, isGangBao: false,
        hasFortune: false, isPure: false, isLuxury: false, luxuryCount: 0,
        melds: [], pair: [{ id: '', type: { suit: 'wan', rank: 1 } }, { id: '', type: { suit: 'wan', rank: 1 } }],
      };
      expect(hasMinimumTai(result, [], [])).toBe(true);
    });
  });
});

describe('Scoring', () => {
  describe('calculatePatternMultiplier', () => {
    function makeResult(overrides: Partial<WinResult>): WinResult {
      return {
        winner: 0, form: 'standard', fromWall: true,
        isBaoTou: false, isCaiPiao: false, piaoCount: 0,
        isGangKai: false, gangCount: 0, isGangBao: false,
        hasFortune: false, isPure: false, isLuxury: false, luxuryCount: 0,
        melds: [], pair: [{ id: '', type: { honor: 'bai' } }, { id: '', type: { honor: 'bai' } }],
        ...overrides,
      };
    }

    it('basic win = 1', () => {
      expect(calculatePatternMultiplier(makeResult({}))).toBe(1);
    });

    it('爆头 = 2', () => {
      expect(calculatePatternMultiplier(makeResult({ isBaoTou: true }))).toBe(2);
    });

    it('七对 = 2', () => {
      expect(calculatePatternMultiplier(makeResult({ form: 'sevenPairs' }))).toBe(2);
    });

    it('杠开 = 2', () => {
      expect(calculatePatternMultiplier(makeResult({ isGangKai: true, gangCount: 1 }))).toBe(2);
    });

    it('财飘 = 4 (2^2)', () => {
      expect(calculatePatternMultiplier(makeResult({ isBaoTou: true, isCaiPiao: true, piaoCount: 1 }))).toBe(4);
    });

    it('杠爆 = 4 (gangKai ×2 + baoTou ×2)', () => {
      expect(
        calculatePatternMultiplier(
          makeResult({ isGangKai: true, gangCount: 1, isBaoTou: true, isGangBao: true })
        )
      ).toBe(4);
    });

    it('清七对 = 4', () => {
      expect(calculatePatternMultiplier(makeResult({ form: 'sevenPairs', isPure: true }))).toBe(4);
    });

    it('豪华七对 = 4', () => {
      expect(
        calculatePatternMultiplier(makeResult({ form: 'sevenPairs', isLuxury: true, luxuryCount: 1 }))
      ).toBe(4);
    });
  });

  describe('getPatternName', () => {
    function makeResult(overrides: Partial<WinResult>): WinResult {
      return {
        winner: 0, form: 'standard', fromWall: true,
        isBaoTou: false, isCaiPiao: false, piaoCount: 0,
        isGangKai: false, gangCount: 0, isGangBao: false,
        hasFortune: false, isPure: false, isLuxury: false, luxuryCount: 0,
        melds: [], pair: [{ id: '', type: { honor: 'bai' } }, { id: '', type: { honor: 'bai' } }],
        ...overrides,
      };
    }

    it('basic self-draw is 平胡(自摸)', () => {
      expect(getPatternName(makeResult({}))).toBe('平胡(自摸)');
    });

    it('爆头', () => {
      expect(getPatternName(makeResult({ isBaoTou: true }))).toBe('爆头');
    });

    it('七对', () => {
      expect(getPatternName(makeResult({ form: 'sevenPairs' }))).toBe('七对');
    });

    it('七对·爆头 = 七客', () => {
      expect(getPatternName(makeResult({ form: 'sevenPairs', isBaoTou: true }))).toContain('七客');
    });

    it('财飘 (includes 爆头 implicitly)', () => {
      const name = getPatternName(makeResult({ isBaoTou: true, isCaiPiao: true, piaoCount: 1 }));
      expect(name).toContain('财飘');
    });

    it('杠开·爆头', () => {
      const name = getPatternName(makeResult({ isGangKai: true, gangCount: 1, isBaoTou: true, isGangBao: true }));
      expect(name).toContain('杠爆');
    });

    it('豪华七对', () => {
      const name = getPatternName(makeResult({ form: 'sevenPairs', isLuxury: true, luxuryCount: 1 }));
      expect(name).toContain('豪华七对');
    });
  });
});
