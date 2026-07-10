import { useMemo, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { checkWin, canCaiPiao } from '../engine/win';
import { getAnKongOptions, getJiaGangOptions } from '../engine/hand';
import { isFortuneTile } from '../engine/tile';
import type { Tile } from '../engine/types';

/**
 * usePlayerActions — human player's derived state + event handlers.
 *
 * Returns everything the game-screen UI needs to render the human's
 * interactive elements (tile selection, self-hu, ankong, jiagang,
 * reaction buttons) without leaking store / engine details.
 */
export function usePlayerActions() {
  const gameState = useGameStore((s) => s.gameState);
  const selectedTileId = useGameStore((s) => s.selectedTileId);

  const discardTile = useGameStore((s) => s.discardTile);
  const claimCaiPiao = useGameStore((s) => s.claimCaiPiao);
  const claimChi = useGameStore((s) => s.claimChi);
  const claimPong = useGameStore((s) => s.claimPong);
  const claimKong = useGameStore((s) => s.claimKong);
  const claimAnKong = useGameStore((s) => s.claimAnKong);
  const claimJiaGang = useGameStore((s) => s.claimJiaGang);
  const claimHu = useGameStore((s) => s.claimHu);
  const passReaction = useGameStore((s) => s.passReaction);
  const setSelectedTile = useGameStore((s) => s.setSelectedTile);

  // ── Derived flags ────────────────────────────────────────
  const isMyDiscardPhase =
    gameState.phase === 'awaiting_discard' && gameState.currentPlayerIndex === 0;

  const isMyReaction =
    gameState.phase === 'awaiting_reactions' &&
    gameState.pendingReactions.some((r) => r.playerIndex === 0);

  const isMyDiscard = isMyDiscardPhase;

  // ── Can human self-draw hu? ──────────────────────────────
  const canSelfHu = useMemo(() => {
    if (!isMyDiscardPhase || !gameState.fortuneTile || !gameState.drewFromWall) return false;
    const human = gameState.players[0];
    const lastTile = gameState.lastDrawnTile ?? human.hand[human.hand.length - 1];
    if (!lastTile) return false;
    const result = checkWin(human.hand, human.melds, lastTile, gameState.fortuneTile, {
      fromDraw: true,
      fromDiscard: false,
      drewFromKong: gameState.drewFromKong,
    });
    return result !== null;
  }, [isMyDiscardPhase, gameState.fortuneTile, gameState.drewFromWall, gameState.lastDrawnTile, gameState.players[0].hand, gameState.players[0].melds, gameState.drewFromKong]);
  
  // ── Can human do 财飘? ──────────────────────────────────
  const canCaiPiaoFlag = useMemo(() => {
    if (!isMyDiscardPhase || !gameState.fortuneTile) return false;
    const human = gameState.players[0];
    return canCaiPiao(human.hand, human.melds, gameState.fortuneTile);
  }, [isMyDiscardPhase, gameState.fortuneTile, gameState.players[0].hand, gameState.players[0].melds]);

  // ── Ankong / Jiagang options ─────────────────────────────
  const anKongOptions = useMemo<Tile[]>(() => {
    if (!isMyDiscardPhase) return [];
    return getAnKongOptions(gameState.players[0].hand);
  }, [isMyDiscardPhase, gameState.players[0].hand]);

  const jiaGangOptions = useMemo(() => {
    if (!isMyDiscardPhase) return [];
    return getJiaGangOptions(gameState.players[0].hand, gameState.players[0].melds);
  }, [isMyDiscardPhase, gameState.players[0].hand, gameState.players[0].melds]);

  // ── Event handlers ───────────────────────────────────────
  const handleTileClick = useCallback(
    (tileId: string) => {
      if (!isMyDiscardPhase) return;

      if (selectedTileId === tileId) {
        // Click on a selected tile - discard it
        discardTile(tileId);
        setSelectedTile(null);
      } else {
        // Select the tile
        setSelectedTile(tileId);
      }
    },
    [isMyDiscardPhase, selectedTileId, discardTile, setSelectedTile]
  );

  const handleSelfHu = useCallback(() => claimHu(), [claimHu]);
  
  const handleCaiPiao = useCallback(() => {
    const human = gameState.players[0];
    const fortuneTile = human.hand.find(t => isFortuneTile(t.type));
    if (fortuneTile) {
      claimCaiPiao(fortuneTile.id);
    }
  }, [gameState.players, claimCaiPiao]);

  const handleAnKong = useCallback(
    (tileId: string) => claimAnKong(tileId),
    [claimAnKong]
  );

  const handleJiaGang = useCallback(
    (tileId: string) => claimJiaGang(tileId),
    [claimJiaGang]
  );

  return {
    // State
    selectedTileId,
    isMyDiscard,
    isMyReaction,
    canSelfHu,
    canCaiPiao: canCaiPiaoFlag,
    anKongOptions,
    jiaGangOptions,
    // Actions
    handleTileClick,
    handleSelfHu,
    handleCaiPiao,
    handleAnKong,
    handleJiaGang,
    // Reaction panel actions (pass-through to store)
    onChi: claimChi,
    onPong: claimPong,
    onKong: claimKong,
    onHu: claimHu,
    onPass: passReaction,
  };
}
