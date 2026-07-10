import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { computeAIAction, decideReaction } from '../engine/ai';
import {
  executeDraw,
  executePassAll,
  executePlayerPass,
  executeAnKong,
  executeMingKong,
  executePong,
  executeChi,
  executeCaiPiao,
  executeHu,
} from '../engine/state';
import type { AIAction, GameState } from '../engine/types';

// AI think time (ms) — randomized to mimic human deliberation, not robotic fixed delay
const AI_THINK_MIN = 800;
const AI_THINK_MAX = 1700;
const AUTO_ADVANCE_DELAY = 500; // beat before next turn when all passed
const HUMAN_REACTION_TIMEOUT = 30000; // Human must act within 30s, otherwise auto-pass

// Human-like randomized think delay
export function aiThinkDelay(): number {
  return Math.floor(AI_THINK_MIN + Math.random() * (AI_THINK_MAX - AI_THINK_MIN));
}

/**
 * useGameLoop — the game state machine.
 *
 * Watches `gameState.phase` and drives transitions:
 *   - player_turn       → execute draw, then schedule AI discard if it's AI's turn
 *   - replacement_draw   → transition to awaiting_discard, schedule AI discard if needed
 *   - awaiting_reactions → if no human reaction pending, process AI reactions or auto-advance
 *
 * All writes go through the Zustand store. The hook returns nothing.
 */
export function useGameLoop() {
  const gameState = useGameStore((s) => s.gameState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const { phase, currentPlayerIndex, players, pendingReactions } = gameState;

    // ---- REPLACEMENT DRAW: kong already drew tile, transition to discard ----
    if (phase === 'replacement_draw') {
      useGameStore.getState().setState({
        gameState: { ...gameState, phase: 'awaiting_discard', drewFromWall: true },
      });
      // Note: do NOT schedule doAIDiscard here — the effect will re-run
      // with phase='awaiting_discard' and handle it in the awaiting_discard block.
      // Scheduling here would create a duplicate timer that gets cleared anyway.
      return;
    }

    // ---- PLAYER TURN: draw ----
    if (phase === 'player_turn') {
      const next = executeDraw(gameState);
      useGameStore.getState().setState({ gameState: next });

      // Wall exhausted → round_over, let UI handle
      if (next.phase === 'round_over') return;

      if (!players[currentPlayerIndex].isHuman) {
        scheduleTimer(() => doAIDiscard(), aiThinkDelay());
      }
      return;
    }

    // ---- AWAITING DISCARD: schedule AI discard if it's AI's turn ----
    if (phase === 'awaiting_discard') {
      if (!players[currentPlayerIndex].isHuman && players[currentPlayerIndex].hand.length > 0) {
        scheduleTimer(() => doAIDiscard(), aiThinkDelay());
      }
      return;
    }

    // ---- AWAITING REACTIONS ----
    if (phase === 'awaiting_reactions') {
      const hasHumanReaction = pendingReactions.some((r) => r.playerIndex === 0);
      const hasAIReaction = pendingReactions.some((r) => r.playerIndex !== 0);

      if (hasHumanReaction) {
        // Wait for human, but add timeout to prevent permanent hang
        scheduleTimer(() => {
          const cur = useGameStore.getState().gameState;
          if (cur.phase !== 'awaiting_reactions') return;
          // Auto-pass for human (removes all human reactions from pending in one call)
          const newState = executePlayerPass(cur, 0);
          useGameStore.getState().setState({ gameState: newState });
        }, HUMAN_REACTION_TIMEOUT);
      } else if (hasAIReaction) {
        scheduleTimer(() => processAIReactions(), aiThinkDelay());
      } else {
        scheduleTimer(() => advanceAfterReactions(), AUTO_ADVANCE_DELAY);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.pendingReactions.length]);

  // ── Timer helper ──────────────────────────────────────────
  function scheduleTimer(fn: () => void, delay: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }

  // ── AI discard (player_turn or replacement_draw → awaiting_discard) ──
  function doAIDiscard() {
    const cur = useGameStore.getState().gameState;
    const p = cur.players[cur.currentPlayerIndex];
    if (cur.phase !== 'awaiting_discard' || p.isHuman || p.hand.length === 0) return;

    const action = computeAIAction(cur, cur.currentPlayerIndex, cur.settings.aiDifficulty);

    if (action.kind === 'hu') {
      // AI self-draw win (including 爆头)
      useGameStore.getState().setState({ gameState: executeHu(cur, cur.currentPlayerIndex) });
    } else if (action.kind === 'caiPiao') {
      // AI 财飘 - discard fortune tile
      const newState = executeCaiPiao(cur, action.tileId);
      useGameStore.getState().setState({ gameState: newState });
    } else if (action.kind === 'discard') {
      useGameStore.getState().discardTile(action.tileId);
    } else if (action.kind === 'kong' && action.kongType === 'ankong') {
      const newState = executeAnKong(cur, action.tileId || '');
      useGameStore.getState().setState({ gameState: newState });
    } else {
      // Fallback: discard last tile
      useGameStore.getState().discardTile(p.hand[p.hand.length - 1].id);
    }
  }

  // ── AI reaction processing ───────────────────────────────
  function processAIReactions() {
    const cur = useGameStore.getState().gameState;
    if (cur.phase !== 'awaiting_reactions') return;

    const aiReactions = cur.pendingReactions.filter((r) => r.playerIndex !== 0);

    // Collect non-pass decisions from all AI that can react
    const decisions: { playerIndex: number; action: AIAction }[] = [];
    for (const rx of aiReactions) {
      const action = decideReaction(cur, rx.playerIndex, cur.settings.aiDifficulty);
      if (action.kind !== 'pass') {
        decisions.push({ playerIndex: rx.playerIndex, action });
      }
    }

    if (decisions.length === 0) {
      advanceAfterReactions();
      return;
    }

    // Priority: hu > kong > pong > chi
    const priority: Record<string, number> = { hu: 0, kong: 1, pong: 2, chi: 3 };
    decisions.sort(
      (a, b) => (priority[a.action.kind] ?? 9) - (priority[b.action.kind] ?? 9)
    );

    executeAIReaction(cur, decisions[0].playerIndex, decisions[0].action);
  }

  // ── Execute a single AI reaction ─────────────────────────
  function executeAIReaction(state: GameState, playerIndex: number, action: AIAction) {
    let newState: GameState;
    switch (action.kind) {
      case 'hu':
        newState = executeHu(state, playerIndex);
        break;
      case 'kong':
        newState = executeMingKong(state, playerIndex);
        break;
      case 'pong':
        newState = executePong(state, playerIndex);
        break;
      case 'chi':
        newState = executeChi(state, playerIndex, action.chiOptionIndex ?? 0);
        break;
      default:
        newState = state;
    }
    // 防御：若操作无效（如杠后摸牌堆耗尽导致 executeMingKong 返回原状态），
    // 该玩家放弃此反应，避免 useGameLoop 无限重试而死锁。
    if (newState === state) {
      newState = executePlayerPass(state, playerIndex);
    }
    useGameStore.getState().setState({ gameState: newState });
  }

  // ── Advance past reactions (all passed) ──────────────────
  function advanceAfterReactions() {
    const cur = useGameStore.getState().gameState;
    if (cur.phase !== 'awaiting_reactions') return;
    useGameStore.getState().setState({ gameState: executePassAll(cur) });
  }
}
