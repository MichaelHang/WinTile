import { memo } from 'react';
import type { Tile, Suit } from '../../engine/types';
import { TileGraphics } from './TileGraphics';

interface TileComponentProps {
  tile: Tile;
  faceUp?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  size?: 'small' | 'normal' | 'large';
  rot?: number; // rotation in degrees: 0 (bottom/top), 90 (left AI), -90 (right AI)
  onClick?: () => void;
  className?: string;
  // Animation props
  animating?: 'draw' | 'discard' | 'reaction' | 'win' | 'breathe' | 'land' | 'meld' | null;
  animDuration?: number;
}

const SUIT_INFO: Record<Suit, { color: string; light: string }> = {
  wan: { color: '#1a3a5c', light: '#dce8f2' },
  tiao: { color: '#1a5c2e', light: '#dcefe4' },
  tong: { color: '#8b1a1a', light: '#f5e0e0' },
};

function getHonorDisplay(honor: string): {
  main: string; sub: string; color: string; bg: string;
  isFortune: boolean; isRed: boolean;
} {
  const isFortune = honor === 'bai';
  const honorDisplay: Record<string, { text: string; color: string; red: boolean }> = {
    east: { text: '東', color: '#2c3e50', red: false },
    south: { text: '南', color: '#2c3e50', red: false },
    west: { text: '西', color: '#2c3e50', red: false },
    north: { text: '北', color: '#2c3e50', red: false },
    zhong: { text: '中', color: '#cc0000', red: true },
    fa: { text: '發', color: '#006600', red: false },
    bai: { text: '白', color: '#888888', red: false },
  };
  const d = honorDisplay[honor] || { text: '?', color: '#333', red: false };
  return {
    main: d.text,
    sub: '',
    color: isFortune ? '#b8941f' : d.color,
    bg: isFortune ? '#fefce8' : '#faf7f2',
    isFortune,
    isRed: d.red,
  };
}

// ============================================================
// SIZE CONFIGURATION — increased for touch-friendly gameplay
// ============================================================
const SIZES = {
  // AI side (compact display) & discard pool
  small:  { w: 42, h: 60, fs: 16, ss: 9, br: 4 },
  // Human hand (touch-friendly)
  normal: { w: 60, h: 80, fs: 22, ss: 12, br: 5 },
  // Large (for meld display)
  large:  { w: 50, h: 70, fs: 19, ss: 11, br: 5 },
};

function TileComponentInner({
  tile, faceUp = true, selected = false, highlighted = false,
  size = 'normal', rot = 0, onClick, className = '',
  animating = null, animDuration = 400,
}: TileComponentProps) {
  const s = SIZES[size];

  // Determine tile display info
  const type = tile.type;
  const isSuit = !('honor' in type);
  const honorInfo = isSuit ? null : getHonorDisplay((type as { honor: string }).honor);

  const isFortune = honorInfo?.isFortune || false;

  // Tile is always rendered in its natural vertical orientation.
  // For left/right AI, we rotate the entire tile as a whole using CSS transform.
  const needsRotate = rot !== 0 && Math.abs(rot) === 90;
  const outerW = needsRotate ? s.h : s.w;
  const outerH = needsRotate ? s.w : s.h;

  // Shadow and gradient
  const shadowColor = selected ? 'rgba(201,169,78,0.6)' : 'rgba(0,0,0,0.25)';
  const faceGradient = isFortune
    ? 'linear-gradient(155deg, #fffef5 0%, #fef9e7 30%, #f5e6b8 70%, #e8d48b 100%)'
    : 'linear-gradient(155deg, #fdfcfa 0%, #f5f0e8 25%, #ede4d4 60%, #e0d5c0 100%)';

  // Determine animation class
  const animClass = animating ? `tile-anim-${animating}` : '';

  // Build transform string
  const baseTransform = needsRotate ? `rotate(${rot}deg)` : '';
  const selectedTransform = selected ? 'translateY(-3px)' : '';
  const combinedTransform = [baseTransform, selectedTransform].filter(Boolean).join(' ');

  return (
    <div
      style={{
        width: outerW,
        height: outerH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClick}
        className={`relative select-none ${animClass} ${
          onClick ? 'cursor-pointer active:scale-95' : ''
        } ${className}`}
        style={{
          width: s.w,
          height: s.h,
          borderRadius: s.br,
          background: faceUp
            ? faceGradient
            : 'linear-gradient(155deg, #1e3a5f 0%, #152e4a 50%, #0d2137 100%)',
          border: faceUp
            ? isFortune
              ? '1.5px solid #c9a94e'
              : '1px solid #c4b998'
            : '1px solid #1a3a5c',
          boxShadow: faceUp
            ? `${selected ? '0 0 0 2px #c9a94e, ' : ''}0 1.5px 3px ${shadowColor}, inset 0 1px 0 rgba(255,255,255,0.4)`
            : `0 1.5px 3px ${shadowColor}`,
          // Set --rot CSS custom property for animations to use
          '--rot': needsRotate ? `${rot}deg` : '0deg',
          // Set --anim-duration so the speed setting actually drives animation length
          '--anim-duration': `${animDuration}ms`,
          // Only set inline transform when NOT animating (animations override it)
          ...(animating ? {} : { transform: combinedTransform || undefined }),
          transformOrigin: 'center center',
          transition: 'all 0.15s ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {faceUp ? (
          <>
            {/* Inner engraved border */}
            <div
              className="absolute pointer-events-none rounded-sm"
              style={{
                inset: size === 'small' ? '2px' : '3px',
                border: `1px solid ${isFortune ? 'rgba(201,169,78,0.3)' : 'rgba(180,165,140,0.3)'}`,
              }}
            />

            {/* ========================= */}
            {/* Tile Face Rendering       */}
            {/* ========================= */}

            {/* Honor tiles: use SVG graphics */}
            {honorInfo ? (
              <>
                <TileGraphics
                  width={s.w - 6}
                  height={s.h - 6}
                  honor={(type as { honor: string }).honor}
                  isFortune={isFortune}
                />
                {/* Fortune star indicator */}
                {isFortune && (
                  <span
                    className="absolute leading-none"
                    style={{
                      fontSize: s.ss - 1,
                      color: '#c9a94e',
                      top: '1px',
                      right: '1px',
                    }}
                  >
                    ★
                  </span>
                )}
              </>
            ) : (
              /* Suit tiles: use SVG graphics */
              <TileGraphics
                suit={type.suit}
                rank={type.rank}
                width={s.w - 6}
                height={s.h - 6}
              />
            )}
          </>
        ) : (
          /* Face-down tile back */
          <div
            className="rounded-sm flex items-center justify-center"
            style={{
              width: s.w - 6,
              height: s.h - 10,
              background: 'linear-gradient(135deg, rgba(30,58,95,0.5), rgba(20,46,74,0.3))',
              border: '1px solid rgba(80,130,180,0.2)',
            }}
          >
            <span
              style={{
                fontSize: s.fs - 2,
                color: 'rgba(130,170,210,0.25)',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              麻
            </span>
          </div>
        )}

        {/* Highlight overlay */}
        {highlighted && (
          <div
            className="absolute inset-0 rounded-sm pointer-events-none"
            style={{
              background: 'rgba(255,255,100,0.15)',
              boxShadow: 'inset 0 0 4px rgba(255,255,100,0.3)',
            }}
          />
        )}
      </div>
    </div>
  );
}

export const TileComponent = memo(TileComponentInner);