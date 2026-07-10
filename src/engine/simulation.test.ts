// ============================================================
// Monte Carlo Game Simulation Test (Fixed)
// 模拟完整游戏，正确驱动所有阶段状态机
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeAIAction, decideReaction } from './ai';
import {
  createInitialState,
  startRound,
  executeDraw,
  executeDiscard,
  executePong,
  executeChi,
  executeAnKong,
  executeMingKong,
  executeHu,
  executePassAll,
  executePlayerPass,
  checkWallExhaustion,
} from './state';
import type { AIAction, GameSettings } from './types';



// ---- Simulate one full round, properly driving ALL phases ----
function simulateRound(seed: number): {
  winnerIndex: number | null;
  winnerFromDraw: boolean;
  totalTurns: number;
  aiHuCount: number;
  humanHuCount: number;
  draws: number;
  lastEvents: string[];
} {
  const settings: GameSettings = {
    humanPlayerIndex: 0,
    baseScore: 10,
    initialScore: 1000,
    aiDifficulty: 'medium',
    animationSpeed: 'normal',
    soundEnabled: false,
  };

  let state = createInitialState(settings);
  state = startRound(state, seed);

  const events: string[] = [];
  let turnCount = 0;
  const maxTurns = 500;

  while (turnCount < maxTurns) {
    turnCount++;

    // ---- Phase: player_turn → execute draw ----
    if (state.phase === 'player_turn') {
      state = executeDraw(state);

      if (state.phase === 'round_over') {
        events.push(`Turn ${turnCount}: round over - wall exhausted`);
        return {
          winnerIndex: null, winnerFromDraw: false, totalTurns: turnCount,
          aiHuCount: 0, humanHuCount: 0, draws: 1, lastEvents: events.slice(-10),
        };
      }

      const player = state.players[state.currentPlayerIndex];

      // Check wall exhaustion after draw
      const wallCheck = checkWallExhaustion(state);
      if (wallCheck.phase === 'round_over') {
        events.push(`Turn ${turnCount}: round over - wall exhausted after draw`);
        return {
          winnerIndex: null, winnerFromDraw: false, totalTurns: turnCount,
          aiHuCount: 0, humanHuCount: 0, draws: 1, lastEvents: events.slice(-10),
        };
      }
      state = wallCheck;

      // ---- AI action ----
      if (!player.isHuman) {
        const action = computeAIAction(state, state.currentPlayerIndex, state.settings.aiDifficulty);

        if (action.kind === 'hu') {
          state = executeHu(state, state.currentPlayerIndex);
          events.push(`Turn ${turnCount}: AI ${player.name} HU! (self-draw)`);
          return {
            winnerIndex: state.currentPlayerIndex, winnerFromDraw: true, totalTurns: turnCount,
            aiHuCount: 1, humanHuCount: 0, draws: 0, lastEvents: events.slice(-10),
          };
        } else if (action.kind === 'kong' && action.kongType === 'ankong') {
          state = executeAnKong(state, action.tileId || '');
          events.push(`Turn ${turnCount}: AI ${player.name} anKong`);
        } else if (action.kind === 'discard') {
          state = executeDiscard(state, action.tileId);
        } else {
          // Fallback
          state = executeDiscard(state, player.hand[player.hand.length - 1].id);
        }
      } else {
        // Human player → auto-discard last tile
        const tile = player.hand[player.hand.length - 1];
        state = executeDiscard(state, tile.id);
      }
      continue;
    }

    // ---- Phase: awaiting_discard (replacement_draw or after chi/pong) ----
    if (state.phase === 'awaiting_discard') {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman && player.hand.length > 0) {
        const action = computeAIAction(state, state.currentPlayerIndex, state.settings.aiDifficulty);
        if (action.kind === 'hu') {
          state = executeHu(state, state.currentPlayerIndex);
          events.push(`Turn ${turnCount}: AI ${player.name} HU! (awaiting_discard self-draw)`);
          return {
            winnerIndex: state.currentPlayerIndex, winnerFromDraw: true, totalTurns: turnCount,
            aiHuCount: 1, humanHuCount: 0, draws: 0, lastEvents: events.slice(-10),
          };
        } else if (action.kind === 'kong' && action.kongType === 'ankong') {
          state = executeAnKong(state, action.tileId || '');
        } else if (action.kind === 'discard' || action.kind === 'caiPiao') {
          state = executeDiscard(state, action.tileId);
        } else {
          state = executeDiscard(state, player.hand[player.hand.length - 1].id);
        }
      } else {
        // Human player → auto-discard last tile
        const tile = player.hand[player.hand.length - 1];
        state = executeDiscard(state, tile.id);
      }
      continue;
    }

    // ---- Phase: awaiting_reactions ----
    if (state.phase === 'awaiting_reactions') {
      const humanCanReact = state.pendingReactions.some((r) => r.playerIndex === 0);
      const aiCanReact = state.pendingReactions.some((r) => r.playerIndex !== 0);

      if (humanCanReact) {
        state = executePlayerPass(state, 0);
        if (state.phase !== 'awaiting_reactions') continue;
      }

      if (aiCanReact) {
        const aiReactions = state.pendingReactions.filter((r) => r.playerIndex !== 0);
        let bestAction: { playerIndex: number; action: AIAction } | null = null;
        const priority: Record<string, number> = { hu: 0, kong: 1, pong: 2, chi: 3 };

        for (const rx of aiReactions) {
          const action = decideReaction(state, rx.playerIndex, state.settings.aiDifficulty);
          if (action.kind !== 'pass') {
            if (!bestAction || (priority[action.kind] ?? 9) < (priority[bestAction.action.kind] ?? 9)) {
              bestAction = { playerIndex: rx.playerIndex, action };
            }
          }
        }

        if (bestAction) {
          if (bestAction.action.kind === 'hu') {
            state = executeHu(state, bestAction.playerIndex);
            events.push(`Turn ${turnCount}: AI ${state.players[bestAction.playerIndex].name} HU! (discard win)`);
            return {
              winnerIndex: bestAction.playerIndex, winnerFromDraw: false, totalTurns: turnCount,
              aiHuCount: 1, humanHuCount: 0, draws: 0, lastEvents: events.slice(-10),
            };
          } else if (bestAction.action.kind === 'kong') {
            state = executeMingKong(state, bestAction.playerIndex);
          } else if (bestAction.action.kind === 'pong') {
            state = executePong(state, bestAction.playerIndex);
          } else if (bestAction.action.kind === 'chi' && bestAction.action.chiOptionIndex !== undefined) {
            state = executeChi(state, bestAction.playerIndex, bestAction.action.chiOptionIndex);
          }
        } else {
          state = executePassAll(state);
        }
      } else {
        state = executePassAll(state);
      }
      continue;
    }

    // ---- Phase: replacement_draw (after kong) ----
    if (state.phase === 'replacement_draw') {
      // Transition to awaiting_discard with drewFromWall = true
      state = { ...state, phase: 'awaiting_discard' as const, drewFromWall: true };
      continue;
    }

    // ---- Phase: declaring_win ----
    if (state.phase === 'declaring_win') {
      const winnerIdx = state.lastWinnerIndex ?? null;
      const fromDraw = state.lastWinFromDiscard === false;
      events.push(`Turn ${turnCount}: Win declared - player ${winnerIdx} (fromWall=${fromDraw})`);
      if (winnerIdx === null) {
        return {
          winnerIndex: null, winnerFromDraw: false, totalTurns: turnCount,
          aiHuCount: 0, humanHuCount: 0, draws: 1, lastEvents: events.slice(-10),
        };
      }
      const isHuman = state.players[winnerIdx].isHuman;
      return {
        winnerIndex: winnerIdx, winnerFromDraw: fromDraw, totalTurns: turnCount,
        aiHuCount: isHuman ? 0 : 1, humanHuCount: isHuman ? 1 : 0, draws: 0, lastEvents: events.slice(-10),
      };
    }

    // ---- Unknown phase ----
    events.push(`Turn ${turnCount}: unknown phase ${state.phase}, currentPlayer=${state.currentPlayerIndex}`);
    break;
  }

  events.push(`Turn ${turnCount}: max turns reached`);
  return {
    winnerIndex: null, winnerFromDraw: false, totalTurns: turnCount,
    aiHuCount: 0, humanHuCount: 0, draws: 1, lastEvents: events.slice(-10),
  };
}

describe('Monte Carlo: AI win rate simulation (fixed)', () => {
  it('AI should win in some of 50 simulated games', () => {
    const N = 50;
    let aiWins = 0;
    let humanWins = 0;
    let draws = 0;
    let aiSelfDraws = 0;
    let aiDiscardWins = 0;

    const results: { seed: number; winner: string; turns: number }[] = [];

    for (let i = 0; i < N; i++) {
      const r = simulateRound(i * 7 + 13);

      if (r.winnerIndex === null) {
        draws++;
        results.push({ seed: i * 7 + 13, winner: 'draw', turns: r.totalTurns });
      } else if (r.winnerIndex === 0) {
        humanWins++;
        results.push({ seed: i * 7 + 13, winner: 'human', turns: r.totalTurns });
      } else {
        aiWins++;
        if (r.winnerFromDraw) aiSelfDraws++;
        else aiDiscardWins++;
        results.push({ seed: i * 7 + 13, winner: `AI(${r.winnerIndex})`, turns: r.totalTurns });
      }
    }

    console.log(`\n===== Monte Carlo Results (${N} games) =====`);
    console.log(`AI wins: ${aiWins} (${(aiWins / N * 100).toFixed(1)}%)`);
    console.log(`  - Self-draw: ${aiSelfDraws}`);
    console.log(`  - Discard win: ${aiDiscardWins}`);
    console.log(`Human wins: ${humanWins} (${(humanWins / N * 100).toFixed(1)}%)`);
    console.log(`Draws: ${draws} (${(draws / N * 100).toFixed(1)}%)`);
    console.log(`===============================\n`);

    console.log('All game results:');
    for (const r of results) {
      console.log(`  Seed=${r.seed}: ${r.winner} (${r.turns} turns)`);
    }

    // The bug we're investigating: AI never wins in real gameplay
    // If this test also shows 0 AI wins, it confirms the bug is in the engine
    // NOT in the simulation
    expect(aiWins).toBeGreaterThan(0);
  }, 120000);
});