import { describe, it, expect, beforeEach } from 'vitest';
import { checkWin } from './win';
import { createTile, resetTileIdCounter } from './tile';
import type { TileType, Tile } from './types';

function ft(): TileType { return { honor: 'bai' }; }
function t(type: TileType, n: number): Tile[] {
  return Array.from({ length: n }, () => createTile({ ...type }));
}

describe('爆头 debug - 3 fortune各种组合', () => {
  beforeEach(() => resetTileIdCounter());

  it('4刻子+2对子候选+3财神 自摸', () => {
    // 13 tile hand before draw: 111 222 333 44 万 + 白白
    const hand13 = [
      ...t({ suit: 'wan', rank: 1 }, 3),
      ...t({ suit: 'wan', rank: 2 }, 3),
      ...t({ suit: 'wan', rank: 3 }, 3),
      ...t({ suit: 'wan', rank: 4 }, 2),
      ...t(ft(), 2),
    ];
    const drawn = createTile({ ...ft() }); // 摸白
    const full = [...hand13, drawn];
    const result = checkWin(full, [], drawn, ft(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    expect(result!.isBaoTou).toBe(true);
    console.log('4刻+2对+3财自摸财:', result!.isBaoTou);
  });

  it('3刻子+1顺子+2对子候选+3财神 自摸', () => {
    // 13 tile: 111 222 333 456 万 + 白白
    const hand13 = [
      ...t({ suit: 'wan', rank: 1 }, 3),
      ...t({ suit: 'wan', rank: 2 }, 3),
      ...t({ suit: 'wan', rank: 3 }, 3),
      createTile({ suit: 'wan', rank: 4 }),
      createTile({ suit: 'wan', rank: 5 }),
      createTile({ suit: 'wan', rank: 6 }),
      ...t(ft(), 2),
    ];
    const drawn = createTile({ ...ft() });
    const full = [...hand13, drawn];
    const result = checkWin(full, [], drawn, ft(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    expect(result!.isBaoTou).toBe(true);
    console.log('3刻+1顺+3财自摸财:', result!.isBaoTou);
  });

  it('3刻子+1顺子+3财神 自摸非财', () => {
    // 13 tile: 111 222 333 456 万 + 白白 (2财神)
    const hand13 = [
      ...t({ suit: 'wan', rank: 1 }, 3),
      ...t({ suit: 'wan', rank: 2 }, 3),
      ...t({ suit: 'wan', rank: 3 }, 3),
      createTile({ suit: 'wan', rank: 4 }),
      createTile({ suit: 'wan', rank: 5 }),
      createTile({ suit: 'wan', rank: 6 }),
      ...t(ft(), 2),
    ];
    const drawn = createTile({ suit: 'wan', rank: 7 }); // 摸非财
    const full = [...hand13, drawn];
    const result = checkWin(full, [], drawn, ft(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    expect(result!.isBaoTou).toBe(true);
    console.log('3刻+1顺+3财自摸非财:', result!.isBaoTou);
  });

  it('需要财神做面子的牌型+3财神 自摸', () => {
    // 13 tile: 111 222 3万4万 白白白白白 (5财神) → 等等，只测3财
    // 111 222 34 万 + 白白白 (3财神，13 tiles)
    const hand13 = [
      ...t({ suit: 'wan', rank: 1 }, 3),
      ...t({ suit: 'wan', rank: 2 }, 3),
      createTile({ suit: 'wan', rank: 3 }),
      createTile({ suit: 'wan', rank: 4 }),
      ...t(ft(), 3),
    ];
    // 财神需要补: 3万+财→面子, 4万做对子, 还剩2财
    // 摸5万
    const drawn = createTile({ suit: 'wan', rank: 5 });
    const full = [...hand13, drawn];
    const result = checkWin(full, [], drawn, ft(), { fromDraw: true, fromDiscard: false });
    console.log('需要财做面子+3财自摸:', result ? { isBaoTou: result.isBaoTou, form: result.form } : null);
  });

  it('财神做对子+3财神 自摸', () => {
    // 13 tile: 111 222 333 444 万 + 白 (1财)
    // 爆头状态: 4组+1财做对子
    // 摸白 → 4组+2财
    const hand13 = [
      ...t({ suit: 'wan', rank: 1 }, 3),
      ...t({ suit: 'wan', rank: 2 }, 3),
      ...t({ suit: 'wan', rank: 3 }, 3),
      ...t({ suit: 'wan', rank: 4 }, 3),
      createTile({ ...ft() }),
    ];
    const drawn = createTile({ ...ft() });
    const full = [...hand13, drawn];
    const result = checkWin(full, [], drawn, ft(), { fromDraw: true, fromDiscard: false });
    expect(result).not.toBeNull();
    console.log('财做对子+摸财:', result!.isBaoTou);
  });
});
