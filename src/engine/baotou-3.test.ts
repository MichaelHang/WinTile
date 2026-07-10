// ============================================================
// 爆头 3 财神专项测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { checkWin, isBaoTouState } from '@/engine/win';
import { createTile, resetTileIdCounter } from '@/engine/tile';
import type { TileType, Meld } from '@/engine/types';

function fortuneTile(): TileType {
  return { honor: 'bai' };
}

function tilesOfType(type: TileType, n: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    tiles.push(createTile({ ...type }));
  }
  return tiles;
}

function fortuneTiles(n: number): Tile[] {
  return tilesOfType({ honor: 'bai' }, n);
}

function describeHand(hand: Tile[]): string {
  return hand.map(t => {
    if ('honor' in t.type) return `${t.type.honor}`;
    return `${t.type.suit}${t.type.rank}`;
  }).join(', ');
}

describe('爆头 - 3 fortune tiles', () => {
  beforeEach(() => resetTileIdCounter());

  it('isBaoTouState with 3 fortune tiles → should be true', () => {
    // 14 tile hand: 4 melds + 2 fortune (爆头状态摸牌前)
    // 3x1万, 3x2万, 3x3万, 3x4万, 2 fortune = 14 tiles
    const hand = [
      ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
      ...fortuneTiles(2),
    ];
    const isBao = isBaoTouState(hand, [], fortuneTile());
    console.log(`isBaoTouState (3 fortune): ${isBao}`);
    expect(isBao).toBe(true);
  });

  it('3 fortune tiles self-draw → should be 爆头', () => {
    // 13 tile hand: 4 groups + 2 fortune (爆头 state)
    // Draw 3rd fortune → 14 tiles: 4 groups + 3 fortune
    // This should be 爆头
    const hand = [
      ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
      ...fortuneTiles(2),
    ];
    const lastTile = createTile({ honor: 'bai' });
    const fullHand = [...hand, lastTile];
    console.log(`3 fortune hand: ${describeHand(fullHand)}`);

    const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    expect(result!.isBaoTou).toBe(true);
    console.log(`3 fortune self-draw: isBaoTou=${result!.isBaoTou}, form=${result!.form}`);
  });

  it('3 fortune tiles, non-fortune self-draw → should be 爆头', () => {
    // Same 13 tile 爆头 hand, draw non-fortune
    const hand = [
      ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
      ...fortuneTiles(2),
    ];
    const lastTile = createTile({ suit: 'wan' as const, rank: 5 });
    const fullHand = [...hand, lastTile];
    console.log(`3 fortune + non-fortune hand: ${describeHand(fullHand)}`);

    const result = checkWin(fullHand, [], lastTile, fortuneTile(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    // This should also be 爆头 because before drawing we had 4 groups + 2 fortune = 爆头 state
    expect(result!.isBaoTou).toBe(true);
    console.log(`3 fortune + non-fortune self-draw: isBaoTou=${result!.isBaoTou}`);
  });

  it('3 fortune tiles discard win → should NOT be 爆头', () => {
    // 13 tile hand: 4 groups + 1 fortune, discard of 2nd fortune makes it 4 groups + 2 fortune
    const hand = [
      ...tilesOfType({ suit: 'wan' as const, rank: 1 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 2 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 3 }, 3),
      ...tilesOfType({ suit: 'wan' as const, rank: 4 }, 3),
      createTile({ honor: 'bai' }),
    ];
    const discardTile = createTile({ honor: 'bai' });
    const fullHand = [...hand, discardTile];
    console.log(`3 fortune discard win hand: ${describeHand(fullHand)}`);

    const result = checkWin(fullHand, [], discardTile, fortuneTile(), { fromDraw: false, fromDiscard: true });
    expect(result).not.toBeNull();
    expect(result!.isBaoTou).toBe(false);
    console.log(`3 fortune discard win: isBaoTou=${result!.isBaoTou}`);
  });
});