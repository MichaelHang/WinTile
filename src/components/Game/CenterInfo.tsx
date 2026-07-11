import { useState, useEffect, useRef } from 'react';
import type { TileType } from '../../engine/types';
import { TileGraphics } from './TileGraphics';

// Human reaction timeout (30s) — matches useGameLoop
const HUMAN_REACTION_TIMEOUT = 30000;

interface CenterInfoProps {
  fortuneTile: TileType | null;
  wallRemaining: number;
  /** Phase of the game */
  phase: string;
  /** Whether the human player has a pending reaction to decide on */
  humanHasPendingReaction: boolean;
  /** Whether an AI is currently "thinking" (deciding its move) */
}

/** Countdown hook for human reaction timer */
function useReactionCountdown(active: boolean, onExpire?: () => void) {
  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      // Start fresh countdown
      setSeconds(Math.ceil(HUMAN_REACTION_TIMEOUT / 1000));
      startedRef.current = true;
    } else {
      // Reset
      setSeconds(0);
      startedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [active]);

  useEffect(() => {
    if (!startedRef.current) return;

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedRef.current, onExpire]);

  return seconds;
}

export function CenterInfo({
  fortuneTile,
  wallRemaining,
  phase,
  humanHasPendingReaction,
}: CenterInfoProps) {
  const centerTileW = 58;
  const centerTileH = 80;

  // Determine if we're in countdown mode
  const showCountdown =
    phase === 'awaiting_reactions' && humanHasPendingReaction;

  // Countdown timer (only meaningful when active)
  const seconds = useReactionCountdown(showCountdown);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      {/* Fortune Tile */}
      <div className="flex flex-col items-center">
        <span className="text-[18px] font-bold text-gold mb-1" style={{ textShadow: '0 0 8px rgba(201,169,78,0.6)' }}>财神</span>
        {fortuneTile ? (
          <div
            className="rounded-md fortune-glow"
            style={{
              width: centerTileW,
              height: centerTileH,
              background: 'linear-gradient(155deg, #fffef5 0%, #fef9e7 30%, #f5e6b8 70%, #e8d48b 100%)',
              border: '2px solid #c9a94e',
              boxShadow: '0 0 14px rgba(201,169,78,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TileGraphics
              honor="bai"
              isFortune={true}
              width={centerTileW - 6}
              height={centerTileH - 6}
            />
          </div>
        ) : (
          <div
            className="rounded-md flex items-center justify-center"
            style={{
              width: centerTileW,
              height: centerTileH,
              background: 'linear-gradient(135deg, #1e3a5f 0%, #152e4a 50%, #0d2137 100%)',
              border: '1.5px solid #d4ac0d',
            }}
          >
            <span className="text-[12px] text-gray-500">?</span>
          </div>
        )}
      </div>

      {/* Round Info */}
      <div className="text-center">
      </div>

      {/* Wall Counter */}
      <div className="text-center">
        <div className="text-lg font-bold text-ivory/60">
          剩余 {wallRemaining}
        </div>
      </div>

      {/* Countdown or AI thinking hint */}
      {showCountdown ? (
        <div className="text-center">
          <div
            className="text-lg font-bold transition-colors"
            style={{
              color: seconds <= 5 ? '#e07a7a' : seconds <= 10 ? '#e8d48b' : '#c9a94e',
            }}
          >
            {seconds}s
          </div>
        </div>
      ) : null}
    </div>
  );
}
