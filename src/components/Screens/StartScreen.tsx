import { useMemo, useState } from 'react';
import { TileComponent } from '../Game/TileComponent';
import { createTile } from '../../engine/tile';
import { useSettingsStore } from '../../store/settingsStore';
import type { GameSettings } from '../../engine/types';
import { playClick } from '../../audio/soundManager';

interface StartScreenProps {
  onStart: (settings: Partial<GameSettings>) => void;
  onContinue?: () => void;
  hasSavedGame?: boolean;
  onShowStats?: () => void;
}

const DIFFICULTY_OPTIONS: { value: 'easy' | 'medium' | 'hard'; label: string; desc: string }[] = [
  { value: 'easy', label: '简单', desc: '新手友好，AI 较少主动进攻' },
  { value: 'medium', label: '中等', desc: '平衡，有基本防守意识' },
  { value: 'hard', label: '困难', desc: '激进，擅长读牌和算计' },
];

const ANIM_OPTIONS: { value: 'slow' | 'normal' | 'fast'; label: string }[] = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '正常' },
  { value: 'fast', label: '快' },
];

export function StartScreen({ onStart, onContinue, hasSavedGame, onShowStats }: StartScreenProps) {
  const { settings, update } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);

  const decorativeTiles = useMemo(
    () =>
      [
        { suit: 'wan' as const, rank: 1 as const },
        { suit: 'wan' as const, rank: 2 as const },
        { suit: 'wan' as const, rank: 3 as const },
        { suit: 'tiao' as const, rank: 5 as const },
        { suit: 'tiao' as const, rank: 6 as const },
        { suit: 'tiao' as const, rank: 7 as const },
        { suit: 'tong' as const, rank: 9 as const },
        { suit: 'tong' as const, rank: 9 as const },
        { honor: 'zhong' as const },
      ].map((t) => createTile(t)),
    []
  );

  const handleStart = () => {
    playClick();
    onStart({
      aiDifficulty: settings.aiDifficulty,
      soundEnabled: settings.soundEnabled,
      animationSpeed: settings.animationSpeed,
      baseScore: settings.baseScore,
      initialScore: settings.initialScore,
    });
  };

  const handleContinue = () => {
    playClick();
    onContinue?.();
  };

  const handleToggleSettings = () => { playClick(); setShowSettings((v) => !v); };
  const handleShowStats = () => { playClick(); onShowStats?.(); };

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, #1a2744 0%, #0f1a2e 50%, #0a101f 100%)',
      }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(201,169,78,0.3) 40px, rgba(201,169,78,0.3) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(201,169,78,0.3) 40px, rgba(201,169,78,0.3) 41px)`,
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <h1
            className="text-5xl font-bold tracking-[0.3em] mb-2"
            style={{
              color: '#c9a94e',
              fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
              textShadow: '0 0 40px rgba(201,169,78,0.3)',
            }}
          >
            杭州麻将
          </h1>
          <p className="text-sm tracking-[0.2em] text-ivory-dark/40">
            HANGZHOU MAHJONG
          </p>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-[#0a1628]/60 ring-1 ring-gold/20">
              <TileComponent tile={createTile({ honor: 'bai' })} faceUp size="large" />
            </div>
            <span className="text-sm text-gold/60">财神</span>
          </div>
          <div className="flex gap-1 p-3 rounded-xl bg-[#0a1628]/60 ring-1 ring-gold/10">
            {decorativeTiles.slice(1).map((t, i) => (
              <TileComponent key={i} tile={t} faceUp size="large" />
            ))}
          </div>
        </div>

        {/* Settings and Stats buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleToggleSettings}
            style={{
              padding: '6px 20px',
              fontSize: '13px',
              borderRadius: '6px',
              background: 'rgba(201,169,78,0.1)',
              color: '#c9a94e',
              border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', serif",
              letterSpacing: '0.1em',
            }}
          >
            {showSettings ? '收起设置' : '设置'}
            <span style={{ marginLeft: 6, transition: 'transform 0.2s', display: 'inline-block', transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </button>
          
          {onShowStats && (
            <button
              onClick={handleShowStats}
              style={{
                padding: '6px 20px',
                fontSize: '13px',
                borderRadius: '6px',
                background: 'rgba(201,169,78,0.1)',
                color: '#c9a94e',
                border: '1px solid rgba(201,169,78,0.3)',
                cursor: 'pointer',
                fontFamily: "'Noto Serif SC', serif",
                letterSpacing: '0.1em',
              }}
            >
              战绩统计
            </button>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '20px 28px',
            background: 'rgba(10,22,40,0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(201,169,78,0.15)',
            minWidth: 320,
          }}>
            {/* AI Difficulty */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', color: '#c9a94e', letterSpacing: '0.1em', minWidth: 50 }}>AI</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { playClick(); update({ aiDifficulty: opt.value }); }}
                    title={opt.desc}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: settings.aiDifficulty === opt.value
                        ? 'linear-gradient(135deg, #c9a94e, #e8d48b)'
                        : 'rgba(255,255,255,0.05)',
                      color: settings.aiDifficulty === opt.value ? '#0a1628' : 'rgba(255,255,255,0.6)',
                      border: settings.aiDifficulty === opt.value
                        ? '1px solid #c9a94e'
                        : '1px solid rgba(201,169,78,0.15)',
                      cursor: 'pointer',
                      fontWeight: settings.aiDifficulty === opt.value ? 700 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation speed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', color: '#c9a94e', letterSpacing: '0.1em', minWidth: 50 }}>动画</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {ANIM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { playClick(); update({ animationSpeed: opt.value }); }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: settings.animationSpeed === opt.value
                        ? 'rgba(201,169,78,0.2)'
                        : 'rgba(255,255,255,0.05)',
                      color: settings.animationSpeed === opt.value ? '#c9a94e' : 'rgba(255,255,255,0.5)',
                      border: settings.animationSpeed === opt.value
                        ? '1px solid rgba(201,169,78,0.4)'
                        : '1px solid rgba(201,169,78,0.1)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', color: '#c9a94e', letterSpacing: '0.1em', minWidth: 50 }}>音效</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => { playClick(); update({ soundEnabled: !settings.soundEnabled }); }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: '12px',
                    padding: 0,
                    background: settings.soundEnabled
                      ? 'linear-gradient(135deg, #c9a94e, #e8d48b)'
                      : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(201,169,78,0.3)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    left: settings.soundEnabled ? 22 : 2,
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: '11px', color: settings.soundEnabled ? '#c9a94e' : 'rgba(255,255,255,0.3)', width: 30, textAlign: 'right' }}>
                  {settings.soundEnabled ? '开' : '关'}
                </span>
              </div>
            </div>

            {/* Base score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', color: '#c9a94e', letterSpacing: '0.1em', minWidth: 50 }}>底分</label>
              <button
                onClick={() => { playClick(); update({ baseScore: Math.max(1, settings.baseScore - 1) }); }}
                style={{
                  width: 28, height: 28, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
                  cursor: 'pointer', fontSize: '16px',
                }}
              >−</button>
              <span style={{ fontSize: '16px', color: '#fff', fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{settings.baseScore}</span>
              <button
                onClick={() => { playClick(); update({ baseScore: Math.min(20, settings.baseScore + 1) }); }}
                style={{
                  width: 28, height: 28, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
                  cursor: 'pointer', fontSize: '16px',
                }}
              >+</button>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>×{settings.baseScore}</span>
            </div>

            {/* Initial score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', color: '#c9a94e', letterSpacing: '0.1em', minWidth: 50 }}>初始积分</label>
              <button
                onClick={() => { playClick(); update({ initialScore: Math.max(500, settings.initialScore - 500) }); }}
                style={{
                  width: 28, height: 28, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
                  cursor: 'pointer', fontSize: '16px',
                }}
              >−</button>
              <span style={{ fontSize: '16px', color: '#fff', fontWeight: 700, minWidth: 50, textAlign: 'center' }}>{settings.initialScore}</span>
              <button
                onClick={() => { playClick(); update({ initialScore: Math.min(10000, settings.initialScore + 500) }); }}
                style={{
                  width: 28, height: 28, borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
                  cursor: 'pointer', fontSize: '16px',
                }}
              >+</button>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Continue button - only show if there's a saved game */}
          {hasSavedGame && onContinue && (
            <button
              onClick={handleContinue}
              style={{
                padding: '14px 48px',
                minWidth: '200px',
                fontSize: '20px',
                fontWeight: 700,
                borderRadius: '10px',
                letterSpacing: '0.3em',
                background:
                  'linear-gradient(135deg, #c9a94e 0%, #e8d48b 50%, #c9a94e 100%)',
                color: '#0a1628',
                boxShadow: '0 4px 24px rgba(201,169,78,0.4)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              继续游戏
            </button>
          )}
          
          {/* New game button */}
          <button
            onClick={handleStart}
            style={{
              padding: '14px 48px',
              minWidth: '200px',
              fontSize: '20px',
              fontWeight: 700,
              borderRadius: '10px',
              letterSpacing: '0.3em',
              background:
                'linear-gradient(135deg, #c9a94e 0%, #e8d48b 50%, #c9a94e 100%)',
              color: '#0a1628',
              boxShadow: '0 4px 24px rgba(201,169,78,0.4)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', serif",
            }}
          >
            {hasSavedGame ? '新游戏' : '开始游戏'}
          </button>
        </div>
        
        <div className="text-center space-y-1">
          <p className="text-xs text-ivory-dark/30">
            四人麻将 · 136张牌 · 白板万能财神
          </p>
          <p className="text-xs text-ivory-dark/20">
            自摸胡为主 · 三老庄可放铳 · 爆头财飘杠开
          </p>
        </div>
      </div>
    </div>
  );
}
