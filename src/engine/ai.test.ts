// ============================================================
// computeAIAction Integration Tests
// 直接测试 AI 决策引擎，模拟真实游戏状态
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeAIAction } from '@/engine/ai';
import { createTile, resetTileIdCounter } from '@/engine/tile';
import type { GameState, Tile, Meld } from '@/engine/types';

// ---- Helper: build tile by code ----
function tileOfCode(code: number): Tile {
  if (code < 27) {
    const suits: ('wan' | 'tiao' | 'tong')[] = ['wan', 'tiao', 'tong'];
    const sIdx = Math.floor(code / 9);
    const rank = (code % 9) + 1;
    return createTile({ suit: suits[sIdx], rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
  } else {
    const honors: ('east' | 'south' | 'west' | 'north' | 'zhong' | 'fa' | 'bai')[] = ['east', 'south', 'west', 'north', 'zhong', 'fa', 'bai'];
    const hIdx = code - 27;
    return createTile({ honor: honors[hIdx] });
  }
}

function tilesOfType(suit: 'wan' | 'tiao' | 'tong', rank: number, n: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    tiles.push(createTile({ suit, rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }));
  }
  return tiles;
}

function fortuneTiles(n: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    tiles.push(createTile({ honor: 'bai' }));
  }
  return tiles;
}

function describeTile(tile: Tile): string {
  if ('honor' in tile.type) return `${tile.type.honor}`;
  return `${tile.type.suit}${tile.type.rank}`;
}

function describeHand(hand: Tile[]): string {
  return hand.map(t => describeTile(t)).join(', ');
}

// ---- Helper: build a minimal GameState for AI test ----
function buildGameState(hand: Tile[], melds: Meld[], playerIndex: number, settings: Partial<GameState> = {}): GameState {
  const allPlayers: [any, any, any, any] = [
    { index: 0, hand: [], melds: [], discards: [], isDealer: false, isHuman: true, score: 1000, name: '你' },
    { index: 1, hand: [], melds: [], discards: [], isDealer: false, isHuman: false, score: 1000, name: 'AI东' },
    { index: 2, hand: [], melds: [], discards: [], isDealer: false, isHuman: false, score: 1000, name: 'AI南' },
    { index: 3, hand: [], melds: [], discards: [], isDealer: false, isHuman: false, score: 1000, name: 'AI西' },
  ];
  allPlayers[playerIndex] = {
    index: playerIndex,
    hand,
    melds,
    discards: [],
    isDealer: false,
    isHuman: false,
    score: 1000,
    name: `AI测试${playerIndex}`,
  };

  return {
    wall: [],
    deadWall: [],
    players: allPlayers,
    currentPlayerIndex: playerIndex,
    phase: 'awaiting_discard',
    fortuneTile: { honor: 'bai' },
    dealerIndex: 0,
    laoCount: 1,
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    turnCount: 1,
    eventLog: [],
    settings: {
      baseScore: 10,
      initialScore: 1000,
      aiDifficulty: settings.aiDifficulty || 'medium',
      maxScore: 10000,
    } as any,
    exposureCounts: {},
    currentRoundDiscards: [],
    piaoTracker: { active: false, playerIndex: -1, count: 0 },
    lastWinResult: null,
    lastWinnerIndex: null,
    lastWinFromDiscard: false,
    lastDiscarderIndex: null,
    lastPayouts: undefined,
    drewFromWall: settings.drewFromWall ?? true,
    ...settings,
  } as unknown as GameState;
}

describe('computeAIAction - self-draw win detection', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  it('AI with 4 triplets + 2 fortune draws fortune → should hu', () => {
    // AI has: 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune, draws 1 fortune
    // → 3x1万, 3x2万, 3x3万, 3x4万, 2 fortune = 14 tiles
    // Should win: 4 triplets + pair(2 fortune)
    const hand = [
      ...tilesOfType('wan', 1, 3),
      ...tilesOfType('wan', 2, 3),
      ...tilesOfType('wan', 3, 3),
      ...tilesOfType('wan', 4, 3),
      ...fortuneTiles(2),
    ];
    const state = buildGameState(hand, [], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A1: hand=${describeHand(hand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).toBe('hu');
  });

  it('AI with 4 triplets + 1 fortune draws non-fortune → should hu', () => {
    // AI has: 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune, draws 5万
    // → 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune, 1 5万 = 14 tiles
    // Should win: 4 triplets + pair(5万+fortune)
    const hand = [
      ...tilesOfType('wan', 1, 3),
      ...tilesOfType('wan', 2, 3),
      ...tilesOfType('wan', 3, 3),
      ...tilesOfType('wan', 4, 3),
      ...fortuneTiles(1),
      tileOfCode(6), // 7万 (code 6 = 7万)
    ];
    const state = buildGameState(hand, [], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A2: hand=${describeHand(hand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).toBe('hu');
  });

  it('AI with 1 pong + 3 triplets + 1 fortune draws fortune → should hu', () => {
    // AI has pong(东x3) + hand: 3x1万, 3x2万, 3x3万, 1 fortune, draws 1 fortune
    // Hand after draw: 3x1万, 3x2万, 3x3万, 2 fortune = 11 tiles
    // Total: pong(东) + 3 triplets + pair(2 fortune) = 4 melds + 1 pair = win ✓
    const pong: Meld = { kind: 'pong', tiles: [
      createTile({ honor: 'east' }),
      createTile({ honor: 'east' }),
      createTile({ honor: 'east' }),
    ] };
    const hand = [
      ...tilesOfType('wan', 1, 3),
      ...tilesOfType('wan', 2, 3),
      ...tilesOfType('wan', 3, 3),
      ...fortuneTiles(2),
    ];
    const state = buildGameState(hand, [pong], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A3: hand=${describeHand(hand)}, pong=东x3, action=${JSON.stringify(action)}`);
    expect(action.kind).toBe('hu');
  });

  it('AI with 13-tile 爆头 hand draws any tile → should hu', () => {
    // 爆头: 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune = 13 tiles
    // Draw 5万 → should win
    const hand = [
      ...tilesOfType('wan', 1, 3),
      ...tilesOfType('wan', 2, 3),
      ...tilesOfType('wan', 3, 3),
      ...tilesOfType('wan', 4, 3),
      ...fortuneTiles(1),
      tileOfCode(5), // 6万
    ];
    const state = buildGameState(hand, [], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A4: 爆头 hand=${describeHand(hand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).toBe('hu');
  });

  it('AI with realistic mixed hand draws completing tile → should hu', () => {
    // Realistic hand: seq(123万), seq(456万), seq(123条), pair(1筒), fortune, draws 1万
    // = 1万,2万,3万, 4万,5万,6万, 1条,2条,3条, 1筒,1筒, fortune, draw=1万
    // → triplet(111万), seq(456万), seq(123条), pair(11筒), fortune = 4 melds + fortune... 
    // Wait, triplet(111万) + seq(456万) + seq(123条) + pair(11筒) + fortune = 3+3+3+2+1 = 12... need 14
    // Actually 3+3+3+2+1 = 12. 13 + 1(draw) = 14. Let me recount:
    // 1万,2万,3万, 4万,5万,6万, 1条,2条,3条, 1筒,1筒 = 11 tiles
    // + fortune = 12 tiles. + draw 1万 = 13 tiles. Need 14.
    
    // Let me redo: seq(123万), seq(456万), seq(789万), pair(1筒), pair(2条), fortune = 14
    // = 1万,2万,3万, 4万,5万,6万, 7万,8万,9万, 1筒,1筒, 2条,2条, fortune = 14
    // This hand already has 14 tiles. But AI should have 13 before draw.
    
    // Let me construct: 13-tile hand that wins after drawing 1万
    // 2万,3万,4万,5万,6万,7万, 1条,2条,3条, 1筒,1筒,1筒, fortune
    // = 2万,3万,4万,5万,6万,7万, 1条,2条,3条, 1筒x3, fortune = 13 tiles
    // Draw 1万 → 1万,2万,3万,4万,5万,6万,7万, 1条,2条,3条, 1筒x3, fortune = 14
    // → seq(123万) + seq(456万) + 7万 + seq(123条) + triplet(111筒) + fortune
    // → seq(123万) + seq(456万) + seq(7?need 789万) + ...
    // Actually: seq(123万) + seq(456万) + 7万 + seq(123条) + triplet(111筒) + fortune
    // → seq(123万) + seq(456万) + 7万 + seq(123条) + triplet(111筒) + fortune
    // Need to use 7万 somewhere... seq(789万)? No 8万, 9万.
    // Try: pair = 1万+fortune, remaining: 2万,3万,4万,5万,6万,7万, 1条,2条,3条, 1筒x3
    // → seq(234万) + seq(567万) + seq(123条) + triplet(111筒) = 4 melds ✓ → WIN!
    
    const hand = [
      ...tilesOfType('wan', 2, 1),
      ...tilesOfType('wan', 3, 1),
      ...tilesOfType('wan', 4, 1),
      ...tilesOfType('wan', 5, 1),
      ...tilesOfType('wan', 6, 1),
      ...tilesOfType('wan', 7, 1),
      ...tilesOfType('tiao', 1, 1),
      ...tilesOfType('tiao', 2, 1),
      ...tilesOfType('tiao', 3, 1),
      ...tilesOfType('tong', 1, 3),
      ...fortuneTiles(1),
    ];
    // = 1+1+1+1+1+1+1+1+1+3+1 = 13 ✓
    
    // Simulate draw of 1万
    const drawnTile = createTile({ suit: 'wan', rank: 1 });
    const fullHand = [...hand, drawnTile];
    
    const state = buildGameState(fullHand, [], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A5: hand=${describeHand(fullHand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).toBe('hu');
  });

  it('AI draws tile that does NOT complete a win → should NOT hu', () => {
    // AI has: 3x1万, 3x2万, 3x3万, 3x4万, 1 fortune, draws 1万
    // → 4x1万, 3x2万, 3x3万, 3x4万, 1 fortune = 14 tiles
    // Actually this CAN win: pair=1万+fortune, 4 triplets → win
    // Let me construct a hand that truly can't win:
    // 1万,2万,3万, 5万,6万,7万, 1条,3条,5条, 1筒,3筒,5筒, fortune, draw=8万
    // = 1万,2万,3万, 5万,6万,7万, 1条,3条,5条, 1筒,3筒,5筒, fortune, 8万 = 14 tiles
    // Remove fortune: 1万,2万,3万, 5万,6万,7万, 1条,3条,5条, 1筒,3筒,5筒, 8万 = 13 tiles
    // Try all pairs → no valid decomposition
    const hand = [
      ...tilesOfType('wan', 1, 1),
      ...tilesOfType('wan', 2, 1),
      ...tilesOfType('wan', 3, 1),
      ...tilesOfType('wan', 5, 1),
      ...tilesOfType('wan', 6, 1),
      ...tilesOfType('wan', 7, 1),
      ...tilesOfType('tiao', 1, 1),
      ...tilesOfType('tiao', 3, 1),
      ...tilesOfType('tiao', 5, 1),
      ...tilesOfType('tong', 1, 1),
      ...tilesOfType('tong', 3, 1),
      ...tilesOfType('tong', 5, 1),
      ...fortuneTiles(1),
      tileOfCode(7), // 8万
    ];
    // = 1+1+1+1+1+1+1+1+1+1+1+1+1+1 = 14 ✓
    const state = buildGameState(hand, [], 1);
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A6: hand=${describeHand(hand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).not.toBe('hu');
  });

  it('AI hand = 14 tiles but not ready to win → should NOT hu', () => {
    // 1万,3万,5万,7万, 1条,3条,5条,7条, 1筒,3筒,5筒,7筒, 东, fortune
    // This hand has no sequences and no triplets → can't form 4 melds + 1 pair
    const hand = [
      ...tilesOfType('wan', 1, 1),
      ...tilesOfType('wan', 3, 1),
      ...tilesOfType('wan', 5, 1),
      ...tilesOfType('wan', 7, 1),
      ...tilesOfType('tiao', 1, 1),
      ...tilesOfType('tiao', 3, 1),
      ...tilesOfType('tiao', 5, 1),
      ...tilesOfType('tiao', 7, 1),
      ...tilesOfType('tong', 1, 1),
      ...tilesOfType('tong', 3, 1),
      ...tilesOfType('tong', 5, 1),
      ...tilesOfType('tong', 7, 1),
      createTile({ honor: 'east' }),
      ...fortuneTiles(1),
    ];
    // = 1+1+1+1+1+1+1+1+1+1+1+1+1+1 = 14 ✓
    const state = buildGameState(hand, [], 1, { drewFromWall: true });
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A7: hand=${describeHand(hand)}, action=${JSON.stringify(action)}`);
    expect(action.kind).not.toBe('hu');
  });

  it('AI with drawnFromWall=false → should NOT check for self-draw win', () => {
    // Even with a winning hand, if drewFromWall is false, AI should NOT hu
    const hand = [
      ...tilesOfType('wan', 1, 3),
      ...tilesOfType('wan', 2, 3),
      ...tilesOfType('wan', 3, 3),
      ...tilesOfType('wan', 4, 3),
      ...fortuneTiles(2),
    ];
    const state = buildGameState(hand, [], 1, { drewFromWall: false });
    const action = computeAIAction(state, 1, 'medium');
    console.log(`Test-A8: drewFromWall=false, action=${JSON.stringify(action)}`);
    expect(action.kind).not.toBe('hu');
  });
});