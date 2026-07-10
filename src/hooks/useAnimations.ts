import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import type { GamePhase, Tile } from '../engine/types';

// ============================================================
// Animation Types & Interfaces
// ============================================================

export type AnimationPhase =
  | 'idle'
  | 'drawing'        // Tile flying from wall to hand
  | 'discarding'     // Tile flying from hand to discard pool
  | 'reacting'       // Chi/pong/kong reaction
  | 'winning'        // Hu win animation
  | 'idle_phase';    // Between animations

export interface AnimationState {
  phase: AnimationPhase;
  playerIndex: number;
  tileId?: string;
  intensity: number; // 0-1 for win animation
  timestamp: number;
}

// Animation durations (ms) based on speed setting — tuned ~30% slower than before
const DURATION_MAP = {
  slow: { draw: 500, discard: 400, reaction: 300, hu: 800, transition: 200 },
  normal: { draw: 400, discard: 300, reaction: 200, hu: 600, transition: 150 },
  fast: { draw: 280, discard: 220, reaction: 150, hu: 450, transition: 120 },
} as const;

// Get duration for animation type and speed
export function getAnimationDuration(
  type: keyof typeof DURATION_MAP.normal,
  speed: 'slow' | 'normal' | 'fast'
): number {
  return DURATION_MAP[speed][type];
}

// Animation hook - manages all game animations
export function useAnimations() {
  const [animState, setAnimState] = useState<AnimationState>({
    phase: 'idle',
    playerIndex: 0,
    intensity: 0,
    timestamp: 0,
  });

  const [pendingTile, setPendingTile] = useState<Tile | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const gameState = useGameStore((s) => s.gameState);
  const settings = useSettingsStore((s) => s.settings);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  // Clear pending timeout on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  // Listen for game phase changes
  useEffect(() => {
    const currentPhase = gameState.phase;

    // Skip if phase hasn't changed (avoid duplicate animation triggers)
    if (prevPhaseRef.current === currentPhase) return;
    prevPhaseRef.current = currentPhase;

    // Handle phase-specific animations
    handlePhaseChange(currentPhase, gameState);
  }, [gameState.phase, gameState.eventLog]);

  // Handle phase transitions
  const handlePhaseChange = useCallback((phase: GamePhase, gs: typeof gameState) => {
    const currentPlayer = gs.players[gs.currentPlayerIndex];
    
    // Only animate for AI players (human players see animations from UI)
    if (!currentPlayer?.isHuman) {
      switch (phase) {
        case 'awaiting_discard':
          // Check if this came from a draw (not a reaction)
          if (gs.eventLog.length > 0) {
            const lastEvent = gs.eventLog[gs.eventLog.length - 1];
            if (lastEvent.kind === 'draw') {
              // Animate draw then discard
              animateDraw(lastEvent.playerIndex, lastEvent.tile);
            } else if (lastEvent.kind === 'pong' || lastEvent.kind === 'chi' || lastEvent.kind === 'kong') {
              // Animate reaction
              animateReaction(lastEvent.playerIndex, lastEvent.tile);
            }
          }
          break;
          
        case 'declaring_win':
          // Animate win
          if (gs.lastWinResult) {
            animateWin(gs.currentPlayerIndex);
          }
          break;
      }
    }
  }, []);

  // Animate draw
  const animateDraw = useCallback((playerIndex: number, tile: Tile | undefined) => {
    if (!tile) return;
    
    const duration = getAnimationDuration('draw', settings.animationSpeed);
    
    setAnimState({
      phase: 'drawing',
      playerIndex,
      tileId: tile.id,
      intensity: 1,
      timestamp: Date.now(),
    });
    setPendingTile(tile);
    setIsAnimating(true);
    
    animRef.current = setTimeout(() => {
      setAnimState(prev => ({ ...prev, phase: 'idle' }));
      setIsAnimating(false);
    }, duration);
  }, [settings.animationSpeed]);

  // Animate discard
  const animateDiscard = useCallback((playerIndex: number, tile: Tile) => {
    const duration = getAnimationDuration('discard', settings.animationSpeed);
    
    setAnimState({
      phase: 'discarding',
      playerIndex,
      tileId: tile.id,
      intensity: 1,
      timestamp: Date.now(),
    });
    setPendingTile(tile);
    setIsAnimating(true);
    
    animRef.current = setTimeout(() => {
      setAnimState(prev => ({ ...prev, phase: 'idle' }));
      setIsAnimating(false);
    }, duration);
  }, [settings.animationSpeed]);

  // Animate reaction (chi/pong/kong)
  const animateReaction = useCallback((playerIndex: number, tile: Tile | undefined) => {
    if (!tile) return;
    
    const duration = getAnimationDuration('reaction', settings.animationSpeed);
    
    setAnimState({
      phase: 'reacting',
      playerIndex,
      tileId: tile.id,
      intensity: 1,
      timestamp: Date.now(),
    });
    setPendingTile(tile);
    setIsAnimating(true);
    
    animRef.current = setTimeout(() => {
      setAnimState(prev => ({ ...prev, phase: 'idle' }));
      setIsAnimating(false);
    }, duration);
  }, [settings.animationSpeed]);

  // Animate win
  const animateWin = useCallback((playerIndex: number) => {
    const duration = getAnimationDuration('hu', settings.animationSpeed);
    
    setAnimState({
      phase: 'winning',
      playerIndex,
      intensity: 1,
      timestamp: Date.now(),
    });
    setIsAnimating(true);
    
    animRef.current = setTimeout(() => {
      setAnimState(prev => ({ ...prev, phase: 'idle' }));
      setIsAnimating(false);
    }, duration);
  }, [settings.animationSpeed]);

  // Update animation intensity during win animation
  useEffect(() => {
    if (animState.phase !== 'winning') return;
    
    const interval = setInterval(() => {
      setAnimState(prev => {
        const newIntensity = prev.intensity > 0 ? prev.intensity - 0.05 : 0;
        return { ...prev, intensity: newIntensity };
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [animState.phase]);

  return {
    animState,
    pendingTile,
    isAnimating,
    animateDraw,
    animateDiscard,
    animateReaction,
    animateWin,
    getDuration: (type: keyof typeof DURATION_MAP.normal) => 
      getAnimationDuration(type, settings.animationSpeed),
  };
}