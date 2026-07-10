// ============================================================
// Hangzhou Mahjong (杭州麻将) - Game State Machine
// Pure state transition functions: (state, action) => newState
// ============================================================

import type {
  GameState,
  GameSettings,
  PlayerState,
  Tile,
  Meld,
  GameEvent,
} from './types';
import { buildWall, drawTile, drawReplacement, dealTiles } from './wall';
import { sortHand, tileTypeToCode, isFortuneTile } from './tile';
import {
  getTilesOfType,
  getAnKongOptions,
  getJiaGangOptions,
} from './hand';
import { checkWin, hasMinimumTai, canCaiPiao } from './win';
import { getAvailableReactions, getNextPlayerIndex } from './rules';
import { WALL_EXHAUST_THRESHOLD } from './constants';
import { calculatePayouts } from './scoring';
import type { PayoutEntry } from './types';

// Helper: random dealer for new game
function randomDealerIndex(): number {
  return Math.floor(Math.random() * 4);
}

// Create initial game state
export function createInitialState(settings: GameSettings, dealerIndex?: number): GameState {
  const finalDealerIndex = dealerIndex ?? randomDealerIndex();
  return {
    wall: [],
    deadWall: [],
    players: [
      createPlayer(0, '你', finalDealerIndex === 0, true, settings.initialScore),
      createPlayer(1, 'AI 东', finalDealerIndex === 1, false, settings.initialScore),
      createPlayer(2, 'AI 南', finalDealerIndex === 2, false, settings.initialScore),
      createPlayer(3, 'AI 西', finalDealerIndex === 3, false, settings.initialScore),
    ],
    currentPlayerIndex: finalDealerIndex,
    phase: 'idle',
    fortuneTile: null,
    dealerIndex: finalDealerIndex,
    laoCount: 1,
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    turnCount: 0,
    eventLog: [],
    settings,
    exposureCounts: {},
    currentRoundDiscards: [],
    passedReactions: {},
    piaoTracker: {
      active: false,
      playerIndex: -1,
      count: 0,
    },
    lastWinResult: null,
    lastWinnerIndex: null,
    lastWinFromDiscard: false,
    lastDiscarderIndex: null,
    lastPayouts: undefined,
    winCounts: [0, 0, 0, 0],
    drewFromWall: false,
    drewFromKong: false,
  };
}

function createPlayer(
  index: number,
  name: string,
  isDealer: boolean,
  isHuman: boolean,
  initialScore: number
): PlayerState {
  return {
    index,
    hand: [],
    melds: [],
    discards: [],
    isDealer,
    isHuman,
    score: initialScore,
    name,
  };
}

// Start a new round
export function startRound(state: GameState, seed?: number): GameState {
  const { wall, deadWall } = buildWall(seed);
  const { hands, remainingWall } = dealTiles(wall, state.dealerIndex);

  const players = state.players.map((p, i) => ({
    ...p,
    hand: sortHand(hands[i]),
    melds: [],
    discards: [],
  })) as unknown as [PlayerState, PlayerState, PlayerState, PlayerState];

  // Fortune tile is 白板 (White Dragon)
  const fortuneTile = { honor: 'bai' as const };

  const event: GameEvent = {
    kind: 'round_start',
    playerIndex: state.dealerIndex,
    timestamp: Date.now(),
    description: `第${state.laoCount}老庄 - 庄家: ${players[state.dealerIndex].name}`,
  };

  return {
    ...state,
    wall: remainingWall,
    deadWall,
    players,
    fortuneTile,
    currentPlayerIndex: state.dealerIndex,
    phase: 'player_turn',
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    turnCount: 0,
    eventLog: [...state.eventLog, event],
    currentRoundDiscards: [],
    passedReactions: {},
    exposureCounts: {},
    piaoTracker: { active: false, playerIndex: -1, count: 0 },
    lastWinResult: null,
    lastWinnerIndex: null,
    lastWinFromDiscard: false,
    lastDiscarderIndex: null,
    lastPayouts: undefined,
    drewFromWall: false,
  };
}

// Execute a draw (current player draws from wall)
// If the player already has 14 tiles (e.g., dealer's first turn), skip draw
export function executeDraw(state: GameState): GameState {
  if (state.phase !== 'player_turn') return state;

  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];

  // 庄家第一轮不摸牌（起手 14 张）
  if (state.turnCount === 0 && player.hand.length >= 14) {
    return {
      ...state,
      phase: 'awaiting_discard',
    };
  }

  const result = drawTile(state.wall);
  if (!result) {
    // Wall exhausted
    return {
      ...state,
      phase: 'round_over',
      eventLog: [
        ...state.eventLog,
        {
          kind: 'round_end' as const,
          playerIndex: -1,
          timestamp: Date.now(),
          description: '流局 - 牌墙已空',
        },
      ],
    };
  }

  const { tile, remainingWall } = result;
  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: sortHand([...players[playerIndex].hand, tile]),
  };

  const event: GameEvent = {
    kind: 'draw',
    playerIndex,
    tile,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 摸牌`,
  };

  const newState: GameState = {
    ...state,
    wall: remainingWall,
    players,
    phase: 'awaiting_discard',
    eventLog: [...state.eventLog, event],
    turnCount: state.turnCount + 1,
    drewFromWall: true,
    drewFromKong: false, // Regular draw, not kong replacement
    lastDrawnTile: tile, // Store the drawn tile for display
  };

  // Check wall exhaustion after draw
  if (
    newState.wall.length + newState.deadWall.length <=
    WALL_EXHAUST_THRESHOLD
  ) {
    return {
      ...newState,
      phase: 'round_over',
      eventLog: [
        ...newState.eventLog,
        {
          kind: 'round_end' as const,
          playerIndex: -1,
          timestamp: Date.now(),
          description: '流局 - 牌墙不足',
        },
      ],
    };
  }

  return newState;
}

// Execute a discard (current player discards chosen tile)
export function executeDiscard(state: GameState, tileId: string): GameState {
  if (state.phase !== 'awaiting_discard') return state;

  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];
  const tileIndex = player.hand.findIndex((t) => t.id === tileId);
  if (tileIndex === -1) return state;

  const discarded = player.hand[tileIndex];
  const newHand = sortHand(
    player.hand.filter((_, idx) => idx !== tileIndex)
  );

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: newHand,
    discards: [...players[playerIndex].discards, discarded],
  };

  // Auto-detect 财飘: if the player discards a fortune tile and the resulting hand is
  // in 爆头 state (would win on any tile), treat it as 财飘 automatically — no separate
  // declaration button required. This matches the rule "2 财神, discard 1 → 财飘".
  // (The explicit `executeCaiPiao` flow is still valid and reinforces the same tracker.)
  let piaoTracker = state.piaoTracker;
  let discardDescription = `${players[playerIndex].name} 打出 ${getTileName(discarded)}`;
  if (
    state.fortuneTile &&
    isFortuneTile(discarded.type) &&
    // canCaiPiao expects the hand BEFORE this discard (it discards one fortune internally
    // and requires ≥2 fortune tiles), so pass the original 14-tile hand.
    canCaiPiao(player.hand, players[playerIndex].melds, state.fortuneTile)
  ) {
    piaoTracker = {
      active: true,
      playerIndex,
      count:
        state.piaoTracker.active && state.piaoTracker.playerIndex === playerIndex
          ? state.piaoTracker.count + 1
          : 1,
    };
    discardDescription = `${players[playerIndex].name} 财飘 - 打出财神`;
  }

  const event: GameEvent = {
    kind: 'discard',
    playerIndex,
    tile: discarded,
    timestamp: Date.now(),
    description: discardDescription,
  };

  // Compute available reactions for other players
  const lastDiscard = { tile: discarded, playerIndex };
  const reactions = getAvailableReactions(
    { ...state, players, lastDiscard },
    lastDiscard
  );

  const newState: GameState = {
    ...state,
    players,
    lastDiscard,
    lastDrawnTile: null, // Drawn tile is no longer "just drawn" — clears the right-side indicator
    pendingReactions: reactions,
    responders: [],
    phase: 'awaiting_reactions',
    eventLog: [...state.eventLog, event],
    currentRoundDiscards: [
      ...state.currentRoundDiscards,
      { tile: discarded.type, playerIndex },
    ],
    piaoTracker,
  };

  return newState;
}

// Execute chi reaction
export function executeChi(
  state: GameState,
  playerIndex: number,
  chiOptionIndex: number
): GameState {
  if (!state.lastDiscard) return state;

  const reaction = state.pendingReactions.find(
    (r) => r.kind === 'chi' && r.playerIndex === playerIndex
  );
  if (!reaction || !reaction.chiOptions || chiOptionIndex >= reaction.chiOptions.length) {
    return state;
  }

  const chiTiles = reaction.chiOptions[chiOptionIndex].tiles;
  const discard = state.lastDiscard.tile;
  const discarderIndex = state.lastDiscard.playerIndex;

  // Create meld: 2 hand tiles + 1 claimed discard
  const meld: Meld = {
    kind: 'chi',
    tiles: [discard, ...chiTiles],
    discardFrom: discarderIndex,
  };

  const player = state.players[playerIndex];
  const newHand = sortHand(
    player.hand.filter((t) => !chiTiles.some((ct) => ct.id === t.id))
  );

  // Remove the chi'd tile from the discarder's discards (it's now in the chi meld)
  const discarder = state.players[discarderIndex];
  const discardIdx = discarder.discards.findIndex((d) => d.id === discard.id);
  const newDiscards = discardIdx >= 0
    ? discarder.discards.filter((_, idx) => idx !== discardIdx)
    : discarder.discards;

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: newHand,
    melds: [...players[playerIndex].melds, meld],
  };
  // Update discarder's discards
  players[discarderIndex] = {
    ...players[discarderIndex],
    discards: newDiscards,
  };

  // Update exposure counts
  const exposureCounts = { ...state.exposureCounts };
  const key = `${state.lastDiscard.playerIndex}->${playerIndex}`;
  exposureCounts[key] = (exposureCounts[key] || 0) + 1;

  const event: GameEvent = {
    kind: 'chi',
    playerIndex,
    tile: discard,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 吃`,
  };

  return {
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    phase: 'awaiting_discard',
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    eventLog: [...state.eventLog, event],
    exposureCounts,
    drewFromWall: false,
    drewFromKong: false,
  };
}

// Execute pong reaction
export function executePong(
  state: GameState,
  playerIndex: number
): GameState {
  if (!state.lastDiscard) return state;

  const discard = state.lastDiscard.tile;
  const player = state.players[playerIndex];
  const discarderIndex = state.lastDiscard.playerIndex;

  // Get 2 matching tiles from hand
  const matchingTiles = getTilesOfType(player.hand, discard.type, 2);
  if (matchingTiles.length < 2) return state;

  const meld: Meld = {
    kind: 'pong',
    tiles: [discard, ...matchingTiles],
    discardFrom: discarderIndex,
  };

  const newHand = sortHand(
    player.hand.filter((t) => !matchingTiles.some((mt) => mt.id === t.id))
  );

  // Remove the ponged tile from the discarder's discards (it's now in the ponger's meld)
  const discarder = state.players[discarderIndex];
  const discardIdx = discarder.discards.findIndex((d) => d.id === discard.id);
  const newDiscards = discardIdx >= 0
    ? discarder.discards.filter((_, idx) => idx !== discardIdx)
    : discarder.discards;

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: newHand,
    melds: [...players[playerIndex].melds, meld],
  };
  // Update discarder's discards
  players[discarderIndex] = {
    ...players[discarderIndex],
    discards: newDiscards,
  };

  const exposureCounts = { ...state.exposureCounts };
  const key = `${state.lastDiscard.playerIndex}->${playerIndex}`;
  exposureCounts[key] = (exposureCounts[key] || 0) + 1;

  const event: GameEvent = {
    kind: 'pong',
    playerIndex,
    tile: discard,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 碰`,
  };

  return {
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    phase: 'awaiting_discard',
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    eventLog: [...state.eventLog, event],
    exposureCounts,
    drewFromWall: false,
    drewFromKong: false,
  };
}

// Execute kong (明杠 from discard)
export function executeMingKong(
  state: GameState,
  playerIndex: number
): GameState {
  if (!state.lastDiscard) return state;

  const discard = state.lastDiscard.tile;
  const player = state.players[playerIndex];
  const discarderIndex = state.lastDiscard.playerIndex;
  const matchingTiles = getTilesOfType(player.hand, discard.type, 3);
  if (matchingTiles.length < 3) return state;

  const meld: Meld = {
    kind: 'mingkong',
    tiles: [discard, ...matchingTiles],
    discardFrom: discarderIndex,
  };

  const newHand = sortHand(
    player.hand.filter((t) => !matchingTiles.some((mt) => mt.id === t.id))
  );

  // Remove the kong'd tile from the discarder's discards (it's now in the kong meld)
  const discarder = state.players[discarderIndex];
  const discardIdx = discarder.discards.findIndex((d) => d.id === discard.id);
  const newDiscards = discardIdx >= 0
    ? discarder.discards.filter((_, idx) => idx !== discardIdx)
    : discarder.discards;

  // Draw replacement from dead wall
  const replResult = drawReplacement(state.deadWall);
  if (!replResult) return state;

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: sortHand([...newHand, replResult.tile]),
    melds: [...players[playerIndex].melds, meld],
  };
  // Update discarder's discards
  players[discarderIndex] = {
    ...players[discarderIndex],
    discards: newDiscards,
  };

  const event: GameEvent = {
    kind: 'kong',
    playerIndex,
    tile: discard,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 明杠`,
  };

  return {
    ...state,
    players,
    deadWall: replResult.remainingDeadWall,
    currentPlayerIndex: playerIndex,
    phase: 'replacement_draw',
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
    eventLog: [...state.eventLog, event],
    lastDrawnTile: replResult.tile, // Track replacement tile for win detection
    drewFromKong: true, // Mark as kong replacement draw
  };
}

// Execute concealed kong (暗杠)
export function executeAnKong(
  state: GameState,
  _tileId: string
): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];

  const anKongOptions = getAnKongOptions(player.hand);
  if (anKongOptions.length === 0) return state;

  // Find the 4 identical tiles
  const targetTiles = player.hand.filter(
    (t) => tileTypeToCode(t.type) === tileTypeToCode(anKongOptions[0].type)
  );
  if (targetTiles.length < 4) return state;

  const meld: Meld = {
    kind: 'ankong',
    tiles: targetTiles.slice(0, 4),
  };

  const newHand = sortHand(
    player.hand.filter((t) => !targetTiles.slice(0, 4).some((kt) => kt.id === t.id))
  );

  // Draw replacement
  const replResult = drawReplacement(state.deadWall);
  if (!replResult) return state;

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: sortHand([...newHand, replResult.tile]),
    melds: [...players[playerIndex].melds, meld],
  };

  const event: GameEvent = {
    kind: 'kong',
    playerIndex,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 暗杠`,
  };

  return {
    ...state,
    players,
    deadWall: replResult.remainingDeadWall,
    phase: 'replacement_draw',
    eventLog: [...state.eventLog, event],
    lastDrawnTile: replResult.tile, // Track replacement tile for win detection
    drewFromKong: true, // Mark as kong replacement draw
  };
}

// Execute jia gang (加杠 - add to existing pong)
export function executeJiaGang(
  state: GameState,
  _tileId: string
): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];

  const jiaGangOptions = getJiaGangOptions(player.hand, player.melds);
  if (jiaGangOptions.length === 0) return state;

  const option = jiaGangOptions[0];
  const meld = player.melds[option.meldIndex];
  const tile = option.tile;

  // Update meld from pong to jiagang
  const newMelds = [...player.melds];
  newMelds[option.meldIndex] = {
    ...meld,
    kind: 'jiagang' as const,
    tiles: [...meld.tiles, tile],
  };

  const newHand = sortHand(player.hand.filter((t) => t.id !== tile.id));

  // Draw replacement
  const replResult = drawReplacement(state.deadWall);
  if (!replResult) return state;

  const players = [...state.players] as [
    PlayerState,
    PlayerState,
    PlayerState,
    PlayerState,
  ];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: sortHand([...newHand, replResult.tile]),
    melds: newMelds,
  };

  const event: GameEvent = {
    kind: 'kong',
    playerIndex,
    tile,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 加杠`,
  };

  return {
    ...state,
    players,
    deadWall: replResult.remainingDeadWall,
    phase: 'replacement_draw',
    eventLog: [...state.eventLog, event],
    lastDrawnTile: replResult.tile, // Track replacement tile for win detection
    drewFromKong: true, // Mark as kong replacement draw
  };
}


// Execute 财飘 (voluntarily discard fortune tile for multiplier)
export function executeCaiPiao(
  state: GameState,
  tileId: string
): GameState {
  if (state.phase !== 'awaiting_discard') return state;
  
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];
  
  // Find the tile to discard
  const tileIndex = player.hand.findIndex(t => t.id === tileId);
  if (tileIndex === -1) return state;
  
  const tile = player.hand[tileIndex];
  
  // Verify it's a fortune tile
  if (!state.fortuneTile || !isFortuneTile(tile.type)) return state;
  
  // Discard the fortune tile
  const newHand = player.hand.filter((_, idx) => idx !== tileIndex);
  
  const players = [...state.players] as [PlayerState, PlayerState, PlayerState, PlayerState];
  players[playerIndex] = {
    ...players[playerIndex],
    hand: newHand,
    discards: [...players[playerIndex].discards, tile],
  };
  
  // Update piao tracker
  const piaoTracker = {
    active: true,
    playerIndex: playerIndex,
    count: state.piaoTracker.active && state.piaoTracker.playerIndex === playerIndex
      ? state.piaoTracker.count + 1
      : 1,
  };
  
  const event: GameEvent = {
    kind: 'discard',
    playerIndex,
    tile,
    timestamp: Date.now(),
    description: `${players[playerIndex].name} 财飘 - 打出财神`,
  };
  
  return {
    ...state,
    players,
    phase: 'awaiting_reactions',
    lastDiscard: { tile, playerIndex },
    pendingReactions: [],
    responders: [],
    eventLog: [...state.eventLog, event],
    currentRoundDiscards: [
      ...state.currentRoundDiscards,
      { tile: tile.type, playerIndex },
    ],
    piaoTracker,
  };
}

// Execute hu (declare win)
export function executeHu(
  state: GameState,
  playerIndex: number
): GameState {
  const player = state.players[playerIndex];

  // Determine the winning tile and how it was obtained
  let lastTile: Tile;
  let fromDraw = false;

  if (state.lastDiscard && state.phase === 'awaiting_reactions') {
    // Win from discard
    lastTile = state.lastDiscard.tile;
    fromDraw = false;
  } else if (state.drewFromWall) {
    // Win from self-draw (must have drawn from wall)
    lastTile = state.lastDrawnTile ?? player.hand[player.hand.length - 1];
    fromDraw = true;
  } else {
    // Cannot self-hu if didn't draw from wall (e.g., after chi/pong)
    return state;
  }

  const winResult = checkWin(
    fromDraw ? player.hand : [...player.hand, lastTile],
    player.melds,
    lastTile,
    state.fortuneTile,
    { fromDraw, fromDiscard: !fromDraw, drewFromKong: state.drewFromKong }
  );

  if (!winResult) return state;
  
  // Check for 财飘: if player discarded fortune tile(s) and now wins
  if (state.piaoTracker.active && state.piaoTracker.playerIndex === playerIndex) {
    winResult.isCaiPiao = true;
    winResult.piaoCount = state.piaoTracker.count;
  }

  // Check minimum tai requirement
  if (!hasMinimumTai(winResult, player.hand, player.melds)) {
    return state;
  }

  // Calculate payouts and update scores
  const discarderIndex = fromDraw ? null : (state.lastDiscard?.playerIndex ?? null);
  const payouts = calculatePayouts(
    playerIndex,
    discarderIndex,
    state.players,
    winResult,
    state.laoCount,
    state.settings.baseScore,
    state.exposureCounts
  );

  // Apply payouts to player scores
  const newPlayers = state.players.map((p) => ({ ...p })) as GameState['players'];
  for (const payout of payouts) {
    newPlayers[payout.fromPlayer].score -= payout.amount;
    newPlayers[payout.toPlayer].score += payout.amount;
  }

  const event: GameEvent = {
    kind: 'hu',
    playerIndex,
    tile: lastTile,
    timestamp: Date.now(),
    description: `${player.name} 胡了! ${fromDraw ? '(自摸)' : '(放铳)'}`,
  };

  // Increment win count for the winner
  const winCounts = [...state.winCounts] as [number, number, number, number];
  winCounts[playerIndex]++;

  return {
    ...state,
    players: newPlayers,
    phase: 'declaring_win',
    eventLog: [...state.eventLog, event],
    lastWinResult: winResult,
    lastWinnerIndex: playerIndex,
    lastWinFromDiscard: !fromDraw,
    lastDiscarderIndex: discarderIndex,
    lastPayouts: payouts,
    winCounts,
  };
}

// All players passed on reactions - advance to next turn
export function executePassAll(state: GameState): GameState {
  if (state.phase !== 'awaiting_reactions') return state;

  const nextPlayer = getNextPlayerIndex(state.currentPlayerIndex);

  // Copy state to new object
  const newState: GameState = {
    ...state,
    currentPlayerIndex: nextPlayer,
    phase: 'player_turn',
    lastDiscard: null,
    pendingReactions: [],
    responders: [],
  };

  return newState;
}

// Execute pass for a specific player (removes their reactions from pending)
export function executePlayerPass(
  state: GameState,
  playerIndex: number
): GameState {
  // Remove this player's reactions from pending list
  const remainingReactions = state.pendingReactions.filter(
    (r) => r.playerIndex !== playerIndex
  );

  const responders = [...state.responders, playerIndex];

  // Track passed tile type for 漏胡/漏碰
  const passedReactions = { ...state.passedReactions };
  if (state.lastDiscard) {
    const tileCode = tileTypeToCode(state.lastDiscard.tile.type);
    if (!passedReactions[playerIndex]) {
      passedReactions[playerIndex] = new Set();
    }
    passedReactions[playerIndex].add(tileCode);
  }

  // If no more reactions pending, advance to next player's turn
  if (remainingReactions.length === 0) {
    return {
      ...state,
      currentPlayerIndex: getNextPlayerIndex(state.currentPlayerIndex),
      phase: 'player_turn' as const,
      lastDiscard: null,
      pendingReactions: [],
      responders: [],
      passedReactions,
    };
  }

  // Still have other players' reactions to process
  return {
    ...state,
    pendingReactions: remainingReactions,
    responders,
    passedReactions,
  };
}

// Check and handle wall exhaustion
export function checkWallExhaustion(state: GameState): GameState {
  if (
    state.phase === 'player_turn' &&
    state.wall.length + state.deadWall.length <= WALL_EXHAUST_THRESHOLD
  ) {
    return {
      ...state,
      phase: 'round_over',
      eventLog: [
        ...state.eventLog,
        {
          kind: 'round_end',
          playerIndex: -1,
          timestamp: Date.now(),
          description: '流局 - 牌墙不足',
        },
      ],
    };
  }
  return state;
}

// Advance dealer (or maintain for consecutive wins)
// Also syncs isDealer flags on all player objects so callers don't need to patch.
export function advanceDealer(
  state: GameState,
  winnerIndex: number | null
): GameState {
  let dealerIndex: number;
  let laoCount: number;

  if (winnerIndex === null) {
    // Draw - no winner, dealer continues
    dealerIndex = state.dealerIndex;
    laoCount = Math.min(state.laoCount + 1, 3);
  } else if (state.players[winnerIndex].isDealer) {
    // Dealer won - continues as dealer, lao increases
    dealerIndex = winnerIndex;
    laoCount = Math.min(state.laoCount + 1, 3);
  } else {
    // Non-dealer won - dealer rotates to winner
    dealerIndex = winnerIndex;
    laoCount = 1;
  }

  return {
    ...state,
    dealerIndex,
    laoCount,
    players: state.players.map((p, i) => ({
      ...p,
      isDealer: i === dealerIndex,
    })) as GameState['players'],
  };
}

// Rotate player positions for display
export function rotatePositions(state: GameState): GameState {
  // In the display, we always show the human at bottom (index 0)
  // This just updates the dealer and isDealer statuses
  return state;
}

// Helper: get tile display name
function getTileName(tile: Tile): string {
  const type = tile.type;
  if ('honor' in type) {
    const names: Record<string, string> = {
      east: '东',
      south: '南',
      west: '西',
      north: '北',
      zhong: '中',
      fa: '发',
      bai: '白',
    };
    return names[type.honor] || type.honor;
  } else {
    const suitNames: Record<string, string> = {
      wan: '万',
      tiao: '条',
      tong: '筒',
    };
    return `${type.rank}${suitNames[type.suit]}`;
  }
}
