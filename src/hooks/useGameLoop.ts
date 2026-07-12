import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { computeAIAction, decideReaction } from '../engine/ai';
import { checkWin } from '../engine/win';
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
 *   - replacement_draw  → transition to awaiting_discard, schedule AI discard if needed
 *   - awaiting_reactions → if no human reaction pending, process AI reactions or auto-advance
 *
 * Uses a ref to always have the latest state, so the effect doesn't re-fire on
 * unrelated state updates (e.g. score changes during hu).
 */
export function useGameLoop() {
  const gameState = useGameStore((s) => s.gameState);
  const isAutoPlay = useGameStore((s) => s.isAutoPlay);
  const gsRef = useRef(gameState);
  gsRef.current = gameState;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const gs = gsRef.current;
    const { phase, currentPlayerIndex, players, pendingReactions } = gs;

    // ---- REPLACEMENT DRAW: kong already drew tile, transition to discard ----
    if (phase === 'replacement_draw') {
      useGameStore.getState().setState({
        gameState: { ...gs, phase: 'awaiting_discard', drewFromWall: true },
      });
      return;
    }

    // ---- PLAYER TURN: draw ----
    if (phase === 'player_turn') {
      const next = executeDraw(gs);
      useGameStore.getState().setState({ gameState: next });

      if (next.phase === 'round_over') return;

      if (!players[currentPlayerIndex].isHuman) {
        scheduleTimer(() => doAIDiscard(), aiThinkDelay());
      }
      return;
    }

    // ---- AWAITING DISCARD: schedule AI discard if it's AI's turn ----
    if (phase === 'awaiting_discard') {
      const isHuman = players[currentPlayerIndex]?.isHuman;

      if (isHuman && isAutoPlay && gs.drewFromWall) {
        // Auto-play: check self-hu → otherwise auto-discard the drawn tile.
        // Delay matches AI think time so the human can see what's happening.
        scheduleTimer(() => doAutoPlayDiscard(), aiThinkDelay());
      } else if (!isHuman && players[currentPlayerIndex]?.hand.length > 0) {
        scheduleTimer(() => doAIDiscard(), aiThinkDelay());
      }
      return;
    }

    // ---- AWAITING REACTIONS ----
    if (phase === 'awaiting_reactions') {
      const hasHumanReaction = pendingReactions.some((r) => r.playerIndex === 0);
      const hasAIReaction = pendingReactions.some((r) => r.playerIndex !== 0);

      if (hasHumanReaction && isAutoPlay) {
        // Auto-play: if human can hu on this discard → auto-hu, else auto-pass.
        scheduleTimer(() => doAutoPlayReaction(), AUTO_ADVANCE_DELAY);
      } else if (hasHumanReaction) {
        scheduleTimer(() => {
          const cur = useGameStore.getState().gameState;
          if (cur.phase !== 'awaiting_reactions') return;
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
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.pendingReactions.length, isAutoPlay]);

  // ── Timer helper ──────────────────────────────────────────
  function scheduleTimer(fn: () => void, delay: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }

  // ── Auto-play: human's turn, auto-check self-hu or discard drawn tile ──
  function doAutoPlayDiscard() {
    const cur = useGameStore.getState().gameState;
    if (cur.phase !== 'awaiting_discard' || cur.currentPlayerIndex !== 0) return;
    if (!useGameStore.getState().isAutoPlay) return;

    const human = cur.players[0];

    // Check self-draw win
    if (cur.drewFromWall && cur.fortuneTile) {
      const lastTile = cur.lastDrawnTile ?? human.hand[human.hand.length - 1];
      if (lastTile) {
        const result = checkWin(human.hand, human.melds, lastTile, cur.fortuneTile, {
          fromDraw: true,
          fromDiscard: false,
          drewFromKong: cur.drewFromKong,
        });
        if (result) {
          useGameStore.getState().setState({ gameState: executeHu(cur, 0) });
          return;
        }
      }
    }

    // Not a win → auto-discard the drawn tile
    const drawnTile = cur.lastDrawnTile ?? human.hand[human.hand.length - 1];
    if (drawnTile) {
      useGameStore.getState().discardTile(drawnTile.id);
    }
  }

  // ── Auto-play: human reaction, auto-hu if possible, otherwise auto-pass ──
  function doAutoPlayReaction() {
    const cur = useGameStore.getState().gameState;
    if (cur.phase !== 'awaiting_reactions') return;
    if (!useGameStore.getState().isAutoPlay) return;

    const humanReactions = cur.pendingReactions.filter((r) => r.playerIndex === 0);
    const canHu = humanReactions.some((r) => r.kind === 'hu');

    if (canHu) {
      useGameStore.getState().setState({ gameState: executeHu(cur, 0) });
    } else {
      // Auto-pass all human reactions
      let newState = cur;
      for (const _ of humanReactions) {
        newState = executePlayerPass(newState, 0);
      }
      useGameStore.getState().setState({ gameState: newState });
    }
  }

  // ── AI discard (player_turn or replacement_draw → awaiting_discard) ──
  function doAIDiscard() {
    const cur = useGameStore.getState().gameState;
    const p = cur.players[cur.currentPlayerIndex];
    if (cur.phase !== 'awaiting_discard' || p.isHuman || p.hand.length === 0) return;

    const action = computeAIAction(cur, cur.currentPlayerIndex, cur.settings.aiDifficulty);

    if (action.kind === 'hu') {
      useGameStore.getState().setState({ gameState: executeHu(cur, cur.currentPlayerIndex) });
    } else if (action.kind === 'caiPiao') {
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
    // Guard: if the operation was a no-op (e.g. kong failed because dead-wall
    // was exhausted), pass this player to avoid an infinite retry / deadlock.
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
