import { useState, useEffect, useRef } from 'react';
import { GameTable } from '../Game/GameTable';
import { SettingsPanel } from '../SettingsPanel';
import type { GameState, Tile } from '../../engine/types';
import { useSettingsStore } from '../../store/settingsStore';
import { getAnimationDuration } from '../../hooks/useAnimations';

interface GameScreenProps {
  gameState: GameState;
  // Player actions (from usePlayerActions)
  selectedTileId: string | null;
  isMyDiscard: boolean;
  isMyReaction: boolean;
  isTenpai?: boolean;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  canSelfHu: boolean;
  canCaiPiao?: boolean;
  anKongOptions: Tile[];
  jiaGangOptions: { tile: Tile; meldIndex: number }[];
  onTileClick: (tileId: string) => void;
  onSelfHu: () => void;
  onCaiPiao?: () => void;
  onAnKong: (tileId: string) => void;
  onJiaGang: (tileId: string) => void;
  onChi: (optionIndex: number) => void;
  onPong: () => void;
  onKong: () => void;
  onHu: () => void;
  onPass: () => void;
  // Top-level
  onNewGame: () => void;
}

export function GameScreen({
  gameState,
  selectedTileId,
  isMyDiscard,
  isMyReaction,
  isTenpai,
  isAutoPlay,
  onToggleAutoPlay,
  canSelfHu,
  canCaiPiao,
  anKongOptions,
  jiaGangOptions,
  onTileClick,
  onSelfHu,
  onCaiPiao,
  onAnKong,
  onJiaGang,
  onChi,
  onPong,
  onKong,
  onHu,
  onPass,
  onNewGame,
}: GameScreenProps) {
  const { settings } = useSettingsStore();
  const drawDuration = getAnimationDuration('draw', settings.animationSpeed);
  const dealerName = gameState.players[gameState.dealerIndex]?.name || '';
  const discardDuration = getAnimationDuration('discard', settings.animationSpeed);
  const reactionDuration = getAnimationDuration('reaction', settings.animationSpeed);

  // Track animation state
  const [animatingTile, setAnimatingTile] = useState<{
    tileId: string;
    type: 'draw' | 'discard' | 'reaction' | 'win';
    playerId: number;
  } | null>(null);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Track last animated event index to prevent re-triggering
  const lastAnimatedIndexRef = useRef(-1);

  // Listen for game events to trigger animations
  useEffect(() => {
    if (!gameState.eventLog || gameState.eventLog.length === 0) return;
    
    const currentIndex = gameState.eventLog.length - 1;
    if (currentIndex <= lastAnimatedIndexRef.current) return;
    
    const lastEvent = gameState.eventLog[currentIndex];
    if (!lastEvent) return;

    // Skip if we're already animating
    if (animatingTile) return;

    // Trigger appropriate animation based on event type
    switch (lastEvent.kind) {
      case 'draw':
        setAnimatingTile({
          tileId: lastEvent.tile?.id || '',
          type: 'draw',
          playerId: lastEvent.playerIndex,
        });
        lastAnimatedIndexRef.current = currentIndex;
        break;
      case 'discard':
        setAnimatingTile({
          tileId: lastEvent.tile?.id || '',
          type: 'discard',
          playerId: lastEvent.playerIndex,
        });
        lastAnimatedIndexRef.current = currentIndex;
        break;
      case 'pong':
      case 'chi':
      case 'kong':
        setAnimatingTile({
          tileId: lastEvent.tile?.id || '',
          type: 'reaction',
          playerId: lastEvent.playerIndex,
        });
        lastAnimatedIndexRef.current = currentIndex;
        break;
      case 'hu':
        setAnimatingTile({
          tileId: lastEvent.tile?.id || '',
          type: 'win',
          playerId: lastEvent.playerIndex,
        });
        lastAnimatedIndexRef.current = currentIndex;
        break;
    }
  }, [gameState.eventLog, animatingTile]);

  // Clear animation after duration
  useEffect(() => {
    if (!animatingTile) return;

    const duration = animatingTile.type === 'win' 
      ? getAnimationDuration('hu', settings.animationSpeed)
      : animatingTile.type === 'draw' 
        ? drawDuration 
        : animatingTile.type === 'discard' 
          ? discardDuration 
          : reactionDuration;

    const timer = setTimeout(() => {
      setAnimatingTile(null);
    }, duration);

    return () => clearTimeout(timer);
  }, [animatingTile, drawDuration, discardDuration, reactionDuration, settings.animationSpeed]);

  // Reset last animated index on new game
  useEffect(() => {
    if (gameState.phase === 'idle') {
      lastAnimatedIndexRef.current = -1;
    }
  }, [gameState.phase]);

  const lastEvent = gameState.eventLog[gameState.eventLog.length - 1];
  const currentPlayerIndex = gameState.currentPlayerIndex;
  const { players, phase, pendingReactions } = gameState;
  const currentPlayerIsAI = !!players[currentPlayerIndex] && !players[currentPlayerIndex].isHuman;
  const aiHasPendingReaction = pendingReactions.some((r) => r.playerIndex !== 0);
  const humanHasPendingReaction = pendingReactions.some((r) => r.playerIndex === 0);
  const isAwaitingReactions = phase === 'awaiting_reactions';
  const aiThinking = (currentPlayerIsAI && (phase === 'player_turn' || phase === 'awaiting_discard')) || (isAwaitingReactions && aiHasPendingReaction && !humanHasPendingReaction);
  const currentPlayerName = players[currentPlayerIndex]?.name || '';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0d1b2a]">
      {/* Header */}
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          background: '#0a1628',
          borderBottom: '1px solid rgba(201,169,78,0.15)',
          padding: '6px 16px',
          minHeight: '36px',
        }}
      >
        <h1
          className="font-bold tracking-wider"
          style={{ color: '#c9a94e', fontFamily: "'Noto Serif SC', serif", fontSize: '17px', lineHeight: 1 }}
        >
          杭州麻将
        </h1>

        {/* Right: 第x老庄 + buttons */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '17px', lineHeight: 1, color: 'rgba(224,213,193,0.6)', whiteSpace: 'pre' }}>
            庄:{dealerName}{"  "}第{gameState.laoCount}老庄
          </span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showSettings ? 'rgba(201,169,78,0.2)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(201,169,78,0.3)',
              color: '#c9a94e',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            title="设置"
          >
            ⚙
          </button>
          <button
            onClick={onNewGame}
            style={{
              padding: '4px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '4px',
              background: 'rgba(201,169,78,0.7)',
              color: '#0a1628',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            重开
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowSettings(false)}
        >
            <div
              className="rounded-xl"
              style={{
                background: '#0a1628',
                border: '1px solid rgba(201,169,78,0.3)',
                borderRadius: '16px',
                padding: '20px 24px',
                width: 520,
                maxWidth: '90vw',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(201,169,78,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-6">
              <h3
                className="text-base font-bold"
                style={{ color: '#c9a94e', fontFamily: "'Noto Serif SC', serif", letterSpacing: '0.1em' }}
              >
                游戏设置
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(201,169,78,0.3)',
                  color: '#c9a94e', cursor: 'pointer', fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>
            <SettingsPanel />
          </div>
        </div>
      )}

      {/* Game Table */}
      <div className="flex-1 min-h-0">
        <GameTable
          gameState={gameState}
          selectedTileId={selectedTileId}
          onTileClick={onTileClick}
          onChi={onChi}
          onPong={onPong}
          onKong={onKong}
          onHu={onHu}
          onPass={onPass}
          canSelfHu={canSelfHu}
          onSelfHu={onSelfHu}
          canCaiPiao={canCaiPiao}
          onCaiPiao={onCaiPiao}
          anKongOptions={anKongOptions}
          jiaGangOptions={jiaGangOptions}
          onAnKong={onAnKong}
          onJiaGang={onJiaGang}
          animatingTile={animatingTile}
          currentPlayerIndex={currentPlayerIndex}
          drawDuration={drawDuration}
          discardDuration={discardDuration}
          reactionDuration={reactionDuration}
          lastDrawnTile={gameState.lastDrawnTile}
          isTenpai={isTenpai}
          isAutoPlay={isAutoPlay}
          onToggleAutoPlay={onToggleAutoPlay}
        />
      </div>

      {/* Bottom status bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between py-1"
        style={{
          background: '#0a1628',
          borderTop: '1px solid rgba(201,169,78,0.12)',
          minHeight: '26px',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'rgba(224,213,193,0.6)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lastEvent?.description || ''}
        </span>
        <span style={{ fontSize: '12px', flexShrink: 0, marginLeft: 8 }}>
          {isMyDiscard && (
            <span style={{ color: 'rgba(201,169,78,0.85)' }}>
              {selectedTileId ? '再点一次出牌' : '点牌选择，再点打出'}
            </span>
          )}
          {isMyReaction && (
            <span
              className="animate-pulse"
              style={{ color: 'rgba(201,169,78,0.9)' }}
            >
              ↓ 请选择操作
            </span>
          )}
          {aiThinking && (
            <span
              className="ai-thinking-pulse"
              style={{ color: 'rgba(201,169,78,0.9)' }}
            >
              {currentPlayerName} 思考中…
            </span>
          )}
        </span>
      </div>
    </div>
  );
}