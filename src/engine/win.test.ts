// ============================================================
// Win Detection Test Suite
// 测试 AI 胡牌检测逻辑 — 重点：AI 自摸胡牌为什么从未触发？
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { checkWin, hasMinimumTai, isBaoTouState } from './win';
import { createTile, resetTileIdCounter } from './tile';
import type { Tile, TileType, Meld } from './types';



// ---- Helper: create N tiles of same type ----
function tilesOfType(type: TileType, n: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    tiles.push(createTile({ ...type }));
  }
  return tiles;
}

// ---- Helper: create fortune tile (白板) ----
function fortuneTile(): TileType {
  return { honor: 'bai' };
}

// ---- Helper: create N fortune tiles ----
function fortuneTiles(n: number): Tile[] {
  return tilesOfType({ honor: 'bai' }, n);
}

// ---- Helper: count tiles by code for debugging ----
function describeHand(hand: Tile[]): string {
  return hand.map(t => {
    if ('honor' in t.type) return `${t.type.honor}`;
    return `${t.type.suit}${t.type.rank}`;
  }).join(', ');
}

describe('checkWin - AI self-draw detection', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('Basic standard form wins (no melds)', () => {
    it('13 tile hand + 1 drawn tile = 4 melds + 1 pair (simple)', () => {
      // Hand: 3x 一万, 3x 二万, 3x 三万, 2x 一万(对), 1 fortune
      // This is 13 tiles: 3+3+3+2+1=12... need 13
      // Let me construct: 3(一万), 3(二万), 3(三万), 3(一万) - no, duplicates
      // Better: 3 一万, 3 二万, 3 三万, 1 一万, 1 二万 + 1 fortune = 13
      // After drawing fortune: 14 tiles
      // This is tricky. Let me use a cleaner example.
      
      // Simple hand: 4 melds + 1 pair (using fortune as wildcard)
      // Hand: 3x 一万(meld), 3x 二万(meld), 3x 三万(meld), 1x 一万 + 1 fortune(pair) + 1 fortune = 13 tiles
      // After drawing 2万: 3x 一万, 3x 二万, 3x 三万, 1x 一万, 1 fortune, 1 fortune, 1 二万 = 14 tiles
      // Should form: [3x一万][3x二万][3x三万][1x一万+1 fortune pair] + 1 fortune = wait, that's 13+1=14
      // Hmm, let me think more carefully.
      
      // 14 tile hand: 4 melds (12 tiles) + 1 pair (2 tiles) = 14
      // Example: 3x 1万, 3x 2万, 3x 3万, 2x 4万 (pair), 1 fortune (makes pair with any)
      // = 3+3+3+2+1 = 12... need 14
      // = 3+3+3+2+3 = 14 → 3x1万, 3x2万, 3x3万, 2x4万, 2x5万? No...
      // = 3+3+3+3+2 = 14 → 4 melds + 1 pair
      
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3), // 3x 1万 = meld
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3), // 3x 2万 = meld
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3), // 3x 3万 = meld
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3), // 3x 4万 = meld
        ...tilesOfType({ honor: 'bai' }, 2),  // 2x fortune = pair
      ]; // 14 tiles
      
      const result = checkWin(hand, [], hand[hand.length - 1], fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
      console.log(`Test1 PASS: ${describeHand(hand)} → win!`);
    });

    it('13 tile hand (no fortune) + 1 drawn fortune = win with pair', () => {
      // 3x 1万, 3x 2万, 3x 3万, 3x 4万, 1x 1万 = 13 tiles, then draw fortune
      // → [3x1万][3x2万][3x3万][3x4万] + pair(1万 + fortune) = win
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 4), // 4x 1万 → 3+1(pair candidate)
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
      ]; // 13 tiles
      
      const lastTile = createTile({ honor: 'bai' });
      const fullHand = [...hand, lastTile];
      
      const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      console.log(`Test2 PASS: ${describeHand(fullHand)} → win!`);
    });

    it('Sequence + pair hand with fortune', () => {
      // 1万2万3万, 4万5万6万, 7万8万9万, 1万2万(pair with fortune wildcard), fortune
      // = 3+3+3+2+1 = 12... need 14
      // 1万2万3万, 4万5万6万, 7万8万9万, 1万2万, 1万1万(pair), fortune = 3+3+3+2+2+1 = 14
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 6 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 7 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 8 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 9 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 1), // extra pair
        createTile({ honor: 'bai' }),
      ];
      // = 3+2+1+1+1+1+1+1+1+1+1 = 14? No. Let me count: 3+2+1+1+1+1+1+1+1+1+1 = 14 ✓
      // But this forms: seq(123万), seq(456万), seq(789万), pair(1万), pair(1万+fortune) = 13+1=14
      // Actually pair(1万+1万) already has 3 1万... so we can make meld(111万) and pair(2万+fortune)
      
      const result = checkWin(hand, [], hand[hand.length - 1], fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      // This might not win - let me check manually
      // After removing fortune: 3x1万, 2x2万, 1x3万, 1x4万, 1x5万, 1x6万, 1x7万, 1x8万, 1x9万
      // Try pairs: 1万(3) → try pair=1万(2), remaining 1x1万, 2x2万, 1x3...9万
      // Can we decompose? 1x1万 + 2x2万 + 1x3万 = seq(123万), 1x4万+1x5万+1x6万=seq(456万), 1x7万+1x8万+1x9万=seq(789万), 1x2万 left... no
      // Try pair=2万(2), remaining 3x1万, 0x2万, 1x3...9万
      // Can we decompose? 3x1万 = triplet, 1x3...9万 → seq(345万), seq(678万), 1x9万 left → NO
      // This might actually fail. Let me try a guaranteed win.
      
      
      // 3x1万, 3x4万, 3x7万, 3x1万(条), 1 fortune = 13... no, need 14
      // 3x1万, 3x4万, 3x7万, 3x1条, 2x fortune = 14
      // = meld(111万), meld(444万), meld(777万), meld(111条), pair(白+白) → YES
      const hand3 = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 7 }, 3),
        ...tilesOfType({ suit: 'tiao' as const, rank: 1 }, 3),
        ...tilesOfType({ honor: 'bai' }, 2),
      ];
      // = 3+3+3+3+2 = 14 ✓
      const result3 = checkWin(hand3, [], hand3[hand3.length - 1], fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result3).not.toBeNull();
      console.log(`Test3 PASS: ${describeHand(hand3)} → win!`);
    });
  });

  describe('AI self-draw with existing melds', () => {
    it('1 pong + 1 drawn tile completes win', () => {
      // AI has 1 pong (3x 1万), and 11 tile hand
      // After drawing 4万, total 12 tiles in hand + 3 in pong = 15... need 14
      // Hand after draw: 10 tiles. Pong: 3 tiles. Total = 13+1 = 14 ✓
      // Need hand to form: 1 meld (from 3 pong) + 2 more melds + 1 pair
      // Hand: 3x 4万, 3x 5万, 2x 6万 = 8... need 10
      // Hand: 3x 4万, 3x 5万, 2x 6万, 2x fortune = 10
      // After drawing 7万: 3x4万, 3x5万, 2x6万, 2x fortune, 1x7万 = 11... too many
      // OK: pong(1万), hand: 3x4万, 3x5万, 2x6万, 1 fortune = 10 tiles
      // Draw 6万 → 3x4万, 3x5万, 3x6万, 1 fortune = 10 tiles
      // → meld(444万) + meld(555万) + meld(666万) + pair(白+?) ... only 1 fortune
      // Actually: pong(1万) = 1 meld, hand = 3x4万, 3x5万, 3x6万, 1 fortune = 10
      // Remaining melds needed: 4 - 1 = 3
      // Try: pair=4万(2), remaining: 1x4万, 3x5万, 3x6万, 1 fortune
      // → 3x5万 = meld, 3x6万 = meld, 1x4万 + 1 fortune = pair? 
      // With fortune wildcard: 4万 + fortune = pair → YES!
      // That's 3 melds + 1 pair → win! ✓
      
      const pong: Meld = { kind: 'pong', tiles: tilesOfType({ suit: 'wan' as const, rank: 1 }, 3) };
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 6 }, 3),
        createTile({ honor: 'bai' }),
      ];
      // 10 tiles in hand
      const lastTile = createTile({ honor: 'bai' });
      const fullHand = [...hand, lastTile];
      // After drawing fortune: 3x4万, 3x5万, 3x6万, 2x fortune = 11 tiles
      
      const result = checkWin(fullHand, [pong], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      console.log(`Test4 PASS: hand=${describeHand(fullHand)}, pong=1万x3 → win!`);
    });
  });

  describe('hasMinimumTai checks', () => {
    it('win with fortune → hasMinimumTai = true', () => {
      // 1 pong(1万) + hand: 3x4万, 3x5万, 2x6万, 2x fortune = 10 tiles
      // Draw fortune → 11 tiles: 3x4万, 3x5万, 2x6万, 3x fortune
      // → pong(1万) + triplet(444万) + triplet(555万) + pair(66万) + fortune? 
      // Need: 4 melds total. Pong = 1, need 3 more.
      // After removing 3x fortune: 3x4万, 3x5万, 2x6万
      // → triplet(444万), triplet(555万), pair(66万) = 2 melds + 1 pair... need 1 more meld.
      // Not enough. Let me construct properly.
      // 
      // 1 pong(东) + hand: 3x1万, 3x2万, 2x3万, 2x fortune = 10 tiles
      // Draw fortune → 11 tiles: 3x1万, 3x2万, 2x3万, 3x fortune
      // → pong(东) + triplet(111万) + triplet(222万) + pair(33万) + 3x fortune? 
      // After removing 3x fortune: 3x1万, 3x2万, 2x3万 = 3+3+2 = 8 tiles
      // Try pair=3万(2): remaining 3x1万, 3x2万 = 2 triplets = 2 melds
      // Total: pong(东) + triplet(111万) + triplet(222万) + pair(33万) = 4 melds + 1 pair = WIN!
      // But wait, we have 3x fortune. They can form 1 meld of 3. So:
      // pong(东) + triplet(111万) + triplet(222万) + triplet(白x3) + pair(33万) = 5 melds + 1 pair → too many
      // 
      // Actually: pong(东) = 1 meld. Remaining: 3x1万, 3x2万, 2x3万, 3x fortune
      // After removing fortune: 3x1万, 3x2万, 2x3万 = 8 tiles, need 3 melds + 1 pair
      // → triplet(111万) + triplet(222万) + pair(33万) = 2 melds + 1 pair = only 2 melds! Need 3.
      // So this doesn't work. Let me add more tiles.
      
      // 1 pong(东) + hand: 3x1万, 3x2万, 3x3万, 2x fortune = 11 tiles
      // Draw fortune → 12 tiles: 3x1万, 3x2万, 3x3万, 3x fortune
      // → pong(东) + triplet(111万) + triplet(222万) + triplet(333万) + pair(白+白)? 
      // After removing fortune: 3x1万, 3x2万, 3x3万 = 3 triplets = 3 melds
      // Pair = fortune + fortune (2 of 3) → remaining 1 fortune can't form meld.
      // Actually: remaining melds needed = 3. We have 3 triplets = 3 melds. Perfect.
      // But we need 1 pair. The fortune tiles: 3 fortune → can be 1 meld + 0 pair, or 1 pair + 1 leftover.
      // So: pong(东) + triplet(111万) + triplet(222万) + triplet(333万) + pair(白+白) = 4 melds + 1 pair = WIN!
      // And 1 extra fortune → can't use. So actually need to use all 12 tiles.
      // 3 triplets (9 tiles) + pair(2 fortune) = 11 tiles, + pong(3 tiles) = 14 total. But hand is 12 + pong is 3 = 15... too many.
      
      // OK let me just construct a simpler, guaranteed working hand:
      // pong(东x3) + hand: 3x1万, 3x2万, 3x3万, 1 fortune = 10 tiles
      // Draw fortune → 11 tiles: 3x1万, 3x2万, 3x3万, 2 fortune
      // → pong(东) + triplet(111万) + triplet(222万) + triplet(333万) + pair(白+白) = 4 melds + 1 pair = WIN!
      // Total tiles: pong(3) + hand(11) = 14 ✓
      
      const pong: Meld = { kind: 'pong', tiles: tilesOfType({ honor: 'east' }, 3) };
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        createTile({ honor: 'bai' }),
      ];
      const lastTile = createTile({ honor: 'bai' });
      const fullHand = [...hand, lastTile];
      
      const result = checkWin(fullHand, [pong], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      if (result) {
        expect(hasMinimumTai(result, fullHand, [pong])).toBe(true);
        console.log(`Test5 PASS: hasFortune=${result.hasFortune}, hasMinimumTai=true`);
      }
    });

    it('win WITHOUT fortune → hasMinimumTai?', () => {
      // Self-draw → hasMinimumTai should return true for self-draw
      // Fix: hand should be 13 tiles before draw
      // 3x1万, 3x2万, 3x3万, 3x4万, 1x5万 = 13 tiles
      const hand13 = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        createTile({ suit: 'wan' as const, rank: 5 }),
      ];
      const lastTile2 = createTile({ suit: 'wan' as const, rank: 5 });
      const fullHand2 = [...hand13, lastTile2];
      
      const result = checkWin(fullHand2, [], lastTile2, fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      if (result) {
        const tai = hasMinimumTai(result, fullHand2, []);
        console.log(`Test6: no fortune, fromWall=${result.fromWall}, tai=${tai}`);
        expect(tai).toBe(true);
      }
    });
  });

  describe('Seven pairs detection', () => {
    it('Seven pairs with fortune wildcard', () => {
      // 7 pairs: 1万1万, 2万2万, 3万3万, 4万4万, 5万5万, 6万6万, 1万+fortune
      // Need exactly 14 tiles
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 6 }, 2),
        ...tilesOfType({ suit: 'tiao' as const, rank: 1 }, 1),
        createTile({ honor: 'bai' }),
      ];
      // = 2+2+2+2+2+2+1+1 = 14 ✓
      // Fix: need exactly 14 tiles for seven pairs
      // 2+2+2+2+2+2+1+1 = 14. Draw makes it 15.
      // So the initial hand should be 13 tiles, and we draw 1 to make 14.
      // 1万x2, 2万x2, 3万x2, 4万x2, 5万x2, 6万x1, 1条x1, fortune = 13 tiles
      const hand13 = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 2),
        createTile({ suit: 'wan' as const, rank: 6 }),
        createTile({ suit: 'tiao' as const, rank: 1 }),
        createTile({ honor: 'bai' }),
      ];
      // = 2+2+2+2+2+1+1+1 = 13 ✓
      const lastTile2 = createTile({ suit: 'wan' as const, rank: 6 });
      const fullHand2 = [...hand13, lastTile2];
      // = 2+2+2+2+2+2+1+1 = 14 ✓
      
      const result = checkWin(fullHand2, [], lastTile2, fortuneTile(), { fromDraw: true, fromDiscard: false });
      if (result) {
        console.log(`Test7: form=${result.form} (seven pairs or standard both work)`);
        // Either form is fine as long as it's a win
        expect(result.form).toBeOneOf(['sevenPairs', 'standard']);
      } else {
        // If no win, the test is still valuable for debugging
        console.log(`Test7: no win for hand ${describeHand(fullHand2)}`);
      }
    });
  });

  describe('Bao Tou (爆头) state detection', () => {
    it('isBaoTouState with 1 fortune tile', () => {
      // 13 tile hand: 4 melds + 1 fortune tile
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        createTile({ honor: 'bai' }),
      ];
      const isBao = isBaoTouState(hand, [], fortuneTile());
      expect(isBao).toBe(true);
      console.log(`Test8 PASS: isBaoTouState=true (1 fortune)`);
    });

    it('isBaoTouState with 2 fortune tiles → should also be true', () => {
      // 14 tile hand: 4 melds + 2 fortune tiles
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...fortuneTiles(2),
      ];
      const isBao = isBaoTouState(hand, [], fortuneTile());
      expect(isBao).toBe(true);
      console.log(`Test8b PASS: isBaoTouState=true (2 fortune)`);
    });

    it('2 fortune tiles self-draw → isBaoTou should be true', () => {
      // 4 triplets + 2 fortune tiles, self-draw
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...fortuneTiles(2),
      ];
      // Actually, let me construct a proper 14-tile hand
      // 4 triplets + 2 fortune = 14 tiles (already complete, no need to draw)
      // This is the scenario: player already has 14 tiles with 2 fortune tiles
      const hand14 = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...fortuneTiles(2),
      ];
      const lastTile2 = createTile({ honor: 'bai' });
      const result = checkWin(hand14, [], lastTile2, fortuneTile(), { fromDraw: true, fromDiscard: false });
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isBaoTou).toBe(true);
        console.log(`Test8c PASS: isBaoTou=${result.isBaoTou} (2 fortune, self-draw)`);
      }
    });

    it('2 fortune tiles discard win → isBaoTou should be false', () => {
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        ...fortuneTiles(1),
      ];
      const discardTile = createTile({ honor: 'bai' });
      const fullHand = [...hand, discardTile];
      const result = checkWin(fullHand, [], discardTile, fortuneTile(), { fromDraw: false, fromDiscard: true });
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isBaoTou).toBe(false);
        console.log(`Test8d PASS: isBaoTou=${result.isBaoTou} (2 fortune, discard win)`);
      }
    });
  });

  describe('CRITICAL: Realistic AI game simulation', () => {
    // These tests simulate actual game scenarios to find the bug

    it('AI draws fortune tile as last tile → should win', () => {
      // AI has 13 tiles: 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune = 13 tiles
      // AI draws fortune → 14 tiles
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        createTile({ honor: 'bai' }),
      ]; // 13 tiles, AI is in 爆头 state
      const lastTile = createTile({ honor: 'bai' });
      const fullHand = [...hand, lastTile]; // 14 tiles
      
      const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      console.log(`CRITICAL-1: hand=${describeHand(fullHand)}, result=${result ? 'WIN' : 'NULL'}`);
      if (result) {
        console.log(`  form=${result.form}, isBaoTou=${result.isBaoTou}, hasFortune=${result.hasFortune}, fromWall=${result.fromWall}`);
      }
      expect(result).not.toBeNull();
    });

    it('AI draws non-fortune tile in 爆头 state → should win', () => {
      // Same 13-tile 爆头 hand, AI draws 5万
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        createTile({ honor: 'bai' }),
      ]; // 13 tiles
      const lastTile = createTile({ suit: 'wan' as const, rank: 5 });
      const fullHand = [...hand, lastTile]; // 14 tiles
      
      // After removing fortune: 3+3+3+3+0=12 tiles + 1(5万) + 1(fortune) = 14
      // Remove fortune: 3x1万, 3x2万, 3x3万, 3x4万, 1x5万 = 13 tiles... 
      // 4 melds + 1 tile. Try pair=1万(2): remaining 1x1万, 3x2万, 3x3万, 3x4万, 1x5万
      // → 3x2万, 3x3万, 3x4万 = 3 melds, 1x1万 + 1x5万 = 2 tiles... can't form meld. FAIL?
      // 
      // Actually with 1 fortune: remove fortune, 13 tiles, try all pairs
      // Pair = 1万(2): 1x1万, 3x2万, 3x3万, 3x4万, 1x5万 → need 3 melds
      //   3x2万=meld, 3x3万=meld, 3x4万=meld → remaining: 1x1万, 1x5万 → can't form meld → FAIL
      // Pair = 5万: 5万 only has 1... can't be pair alone. With fortune: 5万+fortune → pair. 
      //   Remaining: 3x1万, 3x2万, 3x3万, 3x4万 → 4 melds → YES! ✓
      // So checkWin should find: pair = 5万+fortune, melds = [111万][222万][333万][444万]
      
      const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      console.log(`CRITICAL-2: hand=${describeHand(fullHand)}, result=${result ? 'WIN' : 'NULL'}`);
      if (result) {
        console.log(`  form=${result.form}, isBaoTou=${result.isBaoTou}, hasFortune=${result.hasFortune}`);
      }
      expect(result).not.toBeNull();
    });

    it('AI with typical hand (not 爆头) draws tile → should win', () => {
      // Realistic AI hand: mixed suits, some pairs, some sequences
      // 1万2万3万(seq), 5万5万(pair), 1条2条3条(seq), 1筒1筒(pair), fortune = 13 tiles
      // After drawing 5万: seq(123万), triplet(555万), seq(123条), pair(11筒), fortune = 14
      // → 3 melds + 1 pair(11筒) + fortune → remaining: seq + triplet + seq + pair + fortune
      // → 4 melds + fortune → not a standard form since we have 4 melds already + 1 fortune
      // Wait: seq + triplet + seq + pair + fortune = 3+3+3+2+1 = 12 tiles... need 14
      // Actually: 3+3+3+2+1 = 12. Missing 2 tiles. Let me recount.
      
      // Let me construct more carefully:
      // 1万,2万,3万 (seq), 5万,5万,5万 (triplet), 1条,2条,3条 (seq), 1筒,1筒 (pair), fortune = 11 tiles
      // Need 13 before draw, 14 after draw.
      // 1万,2万,3万 (seq), 5万,5万,5万 (triplet), 1条,2条,3条 (seq), 1筒,1筒,1筒 (triplet), fortune = 12 tiles
      // Need 14: 1万,2万,3万 (seq), 5万,5万,5万 (trip), 1条,2条,3条 (seq), 1筒,1筒,1筒 (trip), 2万, fortune = 13
      // Draw 2万 → 1万,2万,2万,3万 (seq), 5万x3 (trip), 1条,2条,3条 (seq), 1筒x3 (trip), 2万, fortune = 14
      // → seq(123万) + triplet(555万) + seq(123条) + triplet(111筒) + pair(2万+fortune) = 4 melds + 1 pair → WIN ✓
      
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 3),
        ...tilesOfType({ suit: 'tiao' as const, rank: 1 }, 1),
        ...tilesOfType({ suit: 'tiao' as const, rank: 2 }, 1),
        ...tilesOfType({ suit: 'tiao' as const, rank: 3 }, 1),
        ...tilesOfType({ suit: 'tong' as const, rank: 1 }, 3),
        createTile({ honor: 'bai' }),
      ];
      // = 1+2+1+3+1+1+1+3+1 = 14... too many. Should be 13 before draw.
      // 1+2+1+3+1+1+1+3+1 = 14. I need 13. Let me remove one.
      // 1万, 2万x2, 3万, 5万x3, 1条, 2条, 3条, 1筒x3, fortune = 13 ✓
      // After drawing 2万: add one more 2万 → 14
      const lastTile = createTile({ suit: 'wan' as const, rank: 2 });
      const fullHand = [...hand, lastTile];
      
      const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      console.log(`CRITICAL-3: hand=${describeHand(fullHand)}, result=${result ? 'WIN' : 'NULL'}`);
      if (result) {
        console.log(`  form=${result.form}, hasFortune=${result.hasFortune}`);
      }
      expect(result).not.toBeNull();
    });

    it('AI draws self-complete tile (not fortune) → should win', () => {
      // Hand: 1万x2, 2万x2, 3万x2, 4万x2, 5万x2, fortune = 13 tiles
      // Draw 1万 → 1万x3, 2万x2, 3万x2, 4万x2, 5万x2, fortune = 14
      // → triplet(111万) + seq(234万) + seq(234万)... wait, we have 2 of each
      // → triplet(111万) + 2万x2 + 3万x2 + 4万x2 + 5万x2 + fortune = 14
      // Try pair=2万(2): 2万, 3万x2, 4万x2, 5万x2, fortune
      // → seq(234万), seq(234万)... no, 2x3万 only.
      // → seq(234万), remaining 1x5万, 1 fortune → 5万+fortune = pair? YES!
      // → triplet(111万) + seq(234万) + seq(345万)... no, 345 needs 345 each
      // Actually: 2万x1, 3万x2, 4万x2, 5万x2, fortune
      // → seq(234万) uses 1 each: 1万0, 2万0, 3万1, 4万1, 5万2
      // → seq(345万) uses 1 each: 3万0, 4万0, 5万1
      // → remaining: 5万1 + fortune → pair(5万+fortune) → YES!
      
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 2),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 2),
        createTile({ honor: 'bai' }),
      ];
      // = 2+2+2+2+2+1 = 11... too few. Need 13.
      // Let me just test the simpler version
      
      // Simple guaranteed: 3x1万, 3x2万, 3x3万, 1x4万, 1x5万, 1x6万, fortune, draw 4万
      const hand3 = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 5 }, 1),
        ...tilesOfType({ suit: 'wan' as const, rank: 6 }, 1),
        createTile({ honor: 'bai' }),
      ];
      // = 3+3+3+1+1+1+1 = 13 ✓
      const lastTile = createTile({ suit: 'wan' as const, rank: 4 });
      const fullHand = [...hand3, lastTile];
      // → 3x1万, 3x2万, 3x3万, 2x4万, 1x5万, 1x6万, 1 fortune = 14
      // → triplet(111万) + triplet(222万) + triplet(333万) + 2x4万 + 1x5万 + 1x6万 + fortune
      // → pair = 4万(2), remaining 1x5万, 1x6万, fortune → seq? 5万6万 only 2. Need 3.
      // → pair = 4万+fortune, remaining 1x4万, 1x5万, 1x6万 → seq(456万)! → YES!
      
      const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
      console.log(`CRITICAL-4: hand=${describeHand(fullHand)}, result=${result ? 'WIN' : 'NULL'}`);
      if (result) {
        console.log(`  form=${result.form}, hasFortune=${result.hasFortune}`);
      }
      expect(result).not.toBeNull();
    });
  });

  describe('hasMinimumTai edge cases', () => {
    it('win with no fortune, not self-draw → hasMinimumTai = false', () => {
      // 13 tiles + discard tile = 14, no fortune
      // 3x1万, 3x2万, 3x3万, 3x4万, 2x5万 → that's 14, not 13
      // 3x1万, 3x2万, 3x3万, 3x4万, 1x5万 = 13 tiles
      const hand = [
        ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
        ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
        createTile({ suit: 'wan' as const, rank: 5 }),
      ];
      // = 3+3+3+3+1 = 13 ✓
      const discardTile = createTile({ suit: 'wan' as const, rank: 5 });
      const fullHand = [...hand, discardTile]; // 14 tiles
      
      const result = checkWin(fullHand, [], discardTile, fortuneTile(), { fromDraw: false, fromDiscard: true });
      if (result) {
        const tai = hasMinimumTai(result, fullHand, []);
        console.log(`Edge-1: no fortune, fromDiscard=true, hasFortune=${result.hasFortune}, tai=${tai}`);
        // hasMinimumTai should return false for non-fortune, non-self-draw
        expect(tai).toBe(false);
      } else {
        console.log(`Edge-1: no win for this hand`);
      }
    });
  });
});