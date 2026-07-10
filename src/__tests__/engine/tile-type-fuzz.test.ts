// Fuzz test: drive full games and assert every Tile.type is an object.
// Reproduces the render crash "type is not an Object. (evaluating '"honor" in type')".
import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startRound,
  executeDraw,
  executeDiscard,
  executeChi,
  executePong,
  executeMingKong,
  executeHu,
  executePassAll,
} from '../../engine/state';
import { decideReaction, pickDiscard } from '../../engine/ai';
import { resetTileIdCounter } from '../../engine/tile';
import type { GameState, GameSettings } from '../../engine/types';

const SETTINGS: GameSettings = {
  humanPlayerIndex: 0,
  aiDifficulty: 'hard',
  animationSpeed: 'normal',
  baseScore: 10,
  initialScore: 500,
  soundEnabled: false,
};

function validateTiles(state: GameState, ctx: string) {
  const check = (tile: any, where: string) => {
    if (tile === null || tile === undefined) {
      throw new Error(`[${ctx}] null/undefined tile at ${where}`);
    }
    if (typeof tile !== 'object' || Array.isArray(tile) || tile.type === undefined) {
      throw new Error(`[${ctx}] bad tile at ${where}: ${JSON.stringify(tile)}`);
    }
    const t = tile.type;
    if (typeof t !== 'object' || t === null || Array.isArray(t)) {
      throw new Error(`[${ctx}] tile.type is not an object at ${where}: type=${JSON.stringify(t)} tile=${JSON.stringify(tile)}`);
    }
    const ok = ('suit' in t && typeof t.suit === 'string' && 'rank' in t) ||
      ('honor' in t && typeof t.honor === 'string');
    if (!ok) {
      throw new Error(`[${ctx}] tile.type has no suit/honor at ${where}: type=${JSON.stringify(t)}`);
    }
  };

  state.players.forEach((p, pi) => {
    p.hand.forEach((t, i) => check(t, `players[${pi}].hand[${i}]`));
    p.melds.forEach((m, mi) => m.tiles.forEach((t, i) => check(t, `players[${pi}].melds[${mi}].tiles[${i}]`)));
    p.discards.forEach((t, i) => check(t, `players[${pi}].discards[${i}]`));
  });
  state.wall.forEach((t, i) => check(t, `wall[${i}]`));
  state.deadWall.forEach((t, i) => check(t, `deadWall[${i}]`));
  if (state.lastDiscard) check(state.lastDiscard.tile, 'lastDiscard.tile');
  if (state.lastDrawnTile) check(state.lastDrawnTile, 'lastDrawnTile');
  state.eventLog.forEach((e, i) => { if (e.tile) check(e.tile, `eventLog[${i}].tile`); });
  if (state.lastWinResult) {
    state.lastWinResult.melds.forEach((m, mi) => m.tiles.forEach((t, i) => check(t, `winResult.melds[${mi}].tiles[${i}]`)));
    check(state.lastWinResult.pair[0], 'winResult.pair[0]');
    check(state.lastWinResult.pair[1], 'winResult.pair[1]');
  }
  // Pending reactions: chiOptions[].tiles and kongTile are rendered by ActionPanel
  state.pendingReactions.forEach((r, ri) => {
    if (r.kongTile) check(r.kongTile, `pendingReactions[${ri}].kongTile`);
    if (r.chiOptions) {
      r.chiOptions.forEach((opt, oi) => {
        opt.tiles.forEach((t, ti) => check(t, `pendingReactions[${ri}].chiOptions[${oi}].tiles[${ti}]`));
      });
    }
  });
}

function driveGame(seed: number): GameState {
  let state = createInitialState(SETTINGS);
  state = startRound(state, seed);
  if (state.players[state.currentPlayerIndex].isHuman) {
    // human is AI-controlled in this sim too
  }

  let steps = 0;
  const MAX = 2000;
  while (state.phase !== 'round_over' && state.phase !== 'game_over' && steps < MAX) {
    steps++;
    const ctx = `seed=${seed} step=${steps} phase=${state.phase} cp=${state.currentPlayerIndex}`;

    if (state.phase === 'player_turn' || state.phase === 'replacement_draw') {
      state = executeDraw(state);
      validateTiles(state, ctx + ' after draw');
      continue;
    }

    if (state.phase === 'awaiting_discard') {
      const pi = state.currentPlayerIndex;
      const player = state.players[pi];
      const tileId = pickDiscard(player.hand, state.fortuneTile, player.melds.length, SETTINGS.aiDifficulty);
      state = executeDiscard(state, tileId);
      validateTiles(state, ctx + ' after discard');
      continue;
    }

    if (state.phase === 'awaiting_reactions') {
      // Resolve reactions: process one claimed reaction, else pass all.
      const reactions = state.pendingReactions;
      let claimed = false;
      for (const r of reactions) {
        const action = decideReaction(state, r.playerIndex, SETTINGS.aiDifficulty);
        if (action.kind === 'hu') {
          state = executeHu(state, r.playerIndex);
          claimed = true;
          break;
        }
        if (action.kind === 'pong') {
          state = executePong(state, r.playerIndex);
          claimed = true;
          break;
        }
        if (action.kind === 'kong' && action.kongType === 'mingkong') {
          state = executeMingKong(state, r.playerIndex);
          claimed = true;
          break;
        }
        if (action.kind === 'chi') {
          state = executeChi(state, r.playerIndex, 0);
          claimed = true;
          break;
        }
      }
      if (!claimed) {
        state = executePassAll(state);
      }
      validateTiles(state, ctx + ' after reaction');
      continue;
    }

    // Self-hu / kong on own turn (awaiting_discard can also self-hu)
    if (state.phase === 'declaring_win') {
      state = executeHu(state, state.currentPlayerIndex);
      validateTiles(state, ctx + ' after hu');
      continue;
    }

    // Fallback: advance
    break;
  }

  // Also validate final win result / next round state
  validateTiles(state, `seed=${seed} FINAL phase=${state.phase}`);
  return state;
}

describe('Tile.type integrity fuzz', () => {
  beforeEach(() => resetTileIdCounter());

  it('runs many full games without producing a non-object tile.type', () => {
    for (let seed = 1; seed <= 25; seed++) {
      expect(() => driveGame(seed * 7 + 1)).not.toThrow();
    }
  }, 120000);
});
