import { memo } from 'react';

// ============================================================
// SVG-based tile face rendering for mahjong suits
// Traditional Chinese mahjong tile designs
// ============================================================

// Circle colors
const C_GREEN = '#1a9e3a';
const C_BLUE = '#1a4db0';
const C_RED = '#c41e1e';
const C_WHITE = '#ffffff';

// ============================================================
// 筒子 (Tong / Circles) - Image-based rendering
// ============================================================

function TongImage({ rank, width, height }: { rank: number; width: number; height: number }) {
  return (
    <image
      href={`/assets/tong-${rank}.png`}
      x={width * 0.05}
      y={height * 0.02}
      width={width * 0.9}
      height={height * 0.96}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

// ============================================================
// 万子 (Wan / Characters) - Image-based rendering
// ============================================================

function WanImage({ rank, width, height }: { rank: number; width: number; height: number }) {
  return (
    <image
      href={`/assets/wan-${rank}.png`}
      x={width * 0.05}
      y={height * 0.02}
      width={width * 0.9}
      height={height * 0.96}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

// ============================================================
// 条子 (Tiao / Bamboo Sticks) - Green bamboo + bird for 1
// Traditional Chinese mahjong figure-8 bamboo shapes
// ============================================================

function renderBamboo({ cx, cy, w, h, isRed, isBlue }: {
  cx: number; cy: number; w: number; h: number; isRed?: boolean; isBlue?: boolean;
}) {
  const stickColor = isRed ? '#c41e1e' : isBlue ? '#1a4db0' : '#1a7a2a';
  // Half-width for the figure-8 arm spread
  const armW = w * 0.55;
  // Stroke width: thin enough that the two loops stay clearly separated
  const strokeW = armW * 0.55;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Figure-8 bamboo body: two symmetric arcs meeting at top and bottom */}
      <path
        d={`
          M 0, ${-h / 2}
          C ${armW}, ${-h * 0.67} ${armW}, ${-h * 0.17} 0, 0
          C ${armW}, ${h * 0.17} ${armW}, ${h * 0.67} 0, ${h / 2}
          M 0, ${-h / 2}
          C -${armW}, ${-h * 0.67} -${armW}, ${-h * 0.17} 0, 0
          C -${armW}, ${h * 0.17} -${armW}, ${h * 0.67} 0, ${h / 2}
        `}
        stroke={stickColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
      {/* Center white line (bamboo split) */}
      <rect
        x={-strokeW * 0.25}
        y={-h / 2}
        width={strokeW * 0.5}
        height={h}
        fill="#ffffff"
        opacity={0.88}
      />
      {/* Horizontal notch at center (connection point emphasis) */}
      <line
        x1={-armW * 0.6}
        y1={0}
        x2={armW * 0.6}
        y2={0}
        stroke={stickColor}
        strokeWidth={strokeW * 0.25}
        opacity={0.35}
      />
    </g>
  );
}

function TiaoSticks({ rank, width, height }: { rank: number; width: number; height: number }) {
  // 2-9条: 直接贴图
  if (rank >= 2 && rank <= 9) {
    return (
      <image
        href={`/assets/bamboo-${rank}.png`}
        x={width * 0.05}
        y={height * 0.02}
        width={width * 0.9}
        height={height * 0.96}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  // 1条: 直接贴图
  if (rank === 1) {
    return (
      <image
        href="/assets/bamboo-1.png"
        x={width * 0.05}
        y={height * 0.02}
        width={width * 0.9}
        height={height * 0.96}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  return null;
}

// ============================================================
// 字牌 (Honors) - 中發白東南西北
// ============================================================

function HonorTile({ honor, width, height }: { honor: string; width: number; height: number }) {
  // Honor tile images
  const honorImages: Record<string, string> = {
    zhong: '/assets/zhong.png',
    fa: '/assets/fa.png',
    bai: '/assets/bai.png',
    east: '/assets/east.png',
    south: '/assets/south.png',
    west: '/assets/west.png',
    north: '/assets/north.png',
  };

  const imgUrl = honorImages[honor];
  if (imgUrl) {
    return (
      <image
        href={imgUrl}
        x={width * 0.05}
        y={height * 0.02}
        width={width * 0.9}
        height={height * 0.96}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  return null;
}

// ============================================================
// Main component: renders the appropriate SVG for a suit tile
// ============================================================

interface TileGraphicsProps {
  suit?: 'wan' | 'tiao' | 'tong';
  rank?: number;
  width: number;
  height: number;
  honor?: string;
  isFortune?: boolean;
}

function TileGraphicsInner({ suit, rank, width, height, honor, isFortune }: TileGraphicsProps) {
  // Honor tile
  if (honor) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        <HonorTile honor={honor} width={width} height={height} />
      </svg>
    );
  }

  // Suit tile
  if (!suit || !rank) return null;

  const renderContent = () => {
    switch (suit) {
      case 'tong':
        return <TongImage rank={rank} width={width} height={height} />;
      case 'wan':
        return <WanImage rank={rank} width={width} height={height} />;
      case 'tiao':
        return <TiaoSticks rank={rank} width={width} height={height} />;
      default:
        return null;
    }
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {renderContent()}
    </svg>
  );
}

export const TileGraphics = memo(TileGraphicsInner);