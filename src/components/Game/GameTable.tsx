import type { GameState, Tile } from '../../engine/types';
import { PlayerArea } from './PlayerArea';
import { CenterInfo } from './CenterInfo';
import { ActionPanel } from './ActionPanel';

interface GameTableProps {
  gameState: GameState;
  selectedTileId: string | null;
  onTileClick: (tileId: string) => void;
  onChi: (optionIndex: number) => void;
  onPong: () => void;
  onKong: () => void;
  onHu: () => void;
  onPass: () => void;
  canSelfHu: boolean;
  onSelfHu: () => void;
  canCaiPiao?: boolean;
  onCaiPiao?: () => void;
  anKongOptions: Tile[];
  jiaGangOptions: { tile: Tile; meldIndex: number }[];
  onAnKong: (tileId: string) => void;
  onJiaGang: (tileId: string) => void;
  // Animation state (from GameScreen)
  animatingTile?: {
    tileId: string;
    type: 'draw' | 'discard' | 'reaction' | 'win';
    playerId: number;
  } | null;
  currentPlayerIndex: number;
  drawDuration: number;
  discardDuration: number;
  reactionDuration: number;
  lastDrawnTile?: Tile | null;
}

export function GameTable({
  gameState, selectedTileId, onTileClick,
  onChi, onPong, onKong, onHu, onPass,
  canSelfHu, onSelfHu,
  anKongOptions, jiaGangOptions, onAnKong, onJiaGang,
  animatingTile,
  currentPlayerIndex,
  drawDuration,
  discardDuration,
  reactionDuration,
  lastDrawnTile,
}: GameTableProps) {
  const { players, phase, fortuneTile, wall, pendingReactions } = gameState;

  const isAwaitingReactions = phase === 'awaiting_reactions';
  const humanHasPendingReaction = pendingReactions.some((r) => r.playerIndex === 0);

  // Animation props for each player
  const getAnimProps = (playerIndex: number) => {
    if (!animatingTile) return null;
    
    if (animatingTile.playerId !== playerIndex) return null;

    if (animatingTile.type === 'draw') {
      return { drawAnimTileId: animatingTile.tileId, drawAnimDuration: drawDuration };
    } else if (animatingTile.type === 'discard') {
      return { discardAnimTileId: animatingTile.tileId, discardAnimDuration: discardDuration };
    } else if (animatingTile.type === 'reaction') {
      return { reactionAnimTileIds: [animatingTile.tileId], reactionAnimDuration: reactionDuration };
    } else if (animatingTile.type === 'win') {
      return { winAnimTileId: animatingTile.tileId };
    }
    
    return null;
  };

  // Determine if player should breathe
  const isBreathing = (playerIndex: number) => currentPlayerIndex === playerIndex && phase !== 'idle' && phase !== 'declaring_win' && phase !== 'round_over';

  return (
    <div className="w-full h-full flex flex-col relative"
      style={{ background: 'radial-gradient(ellipse at center, #1e7e3e 0%, #165a2e 45%, #0f3d1e 100%)', overflow: 'hidden' }}>

      {/* Top player (AI 2) */}
      <div className="flex justify-center" style={{ minHeight: '15%', overflow: 'visible' }}>
        <PlayerArea 
          player={players[2]} 
          position="top"
          isCurrentTurn={currentPlayerIndex === 2} 
          isHuman={false}
          isBreathing={isBreathing(2)}
          {...getAnimProps(2)}
        />
      </div>

      {/* Middle: Left | Center | Right */}
      <div className="flex-1 flex items-center" style={{ minHeight: 0 }}>
        <div className="flex justify-center" style={{ width: '15%', height: '100%', overflow: 'visible' }}>
          <PlayerArea 
            player={players[3]} 
            position="left"
            isCurrentTurn={currentPlayerIndex === 3} 
            isHuman={false}
            isBreathing={isBreathing(3)}
            {...getAnimProps(3)}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CenterInfo 
            fortuneTile={fortuneTile}
            wallRemaining={wall.length} 
            phase={phase}
            humanHasPendingReaction={humanHasPendingReaction}
          />
        </div>
        <div className="flex justify-center" style={{ width: '15%', height: '100%', overflow: 'visible' }}>
          <PlayerArea 
            player={players[1]} 
            position="right"
            isCurrentTurn={currentPlayerIndex === 1} 
            isHuman={false}
            isBreathing={isBreathing(1)}
            {...getAnimProps(1)}
          />
        </div>
      </div>

      {/* Bottom player (Human) */}
      <div className="flex flex-col items-center justify-end" style={{ minHeight: '30%', overflow: 'visible' }}>
        <PlayerArea
          player={players[0]} 
          position="bottom"
          isCurrentTurn={currentPlayerIndex === 0} 
          isHuman={true}
          selectedTileId={selectedTileId}
          onTileClick={(tile) => onTileClick(tile.id)}
          isBreathing={isBreathing(0)}
          drawnTileId={currentPlayerIndex === 0 ? lastDrawnTile?.id : undefined}
          {...getAnimProps(0)}
        />
      </div>

      {/* Reaction / self-turn action buttons — floating overlay at center-right of table */}
      {(isAwaitingReactions || canSelfHu || (anKongOptions && anKongOptions.length > 0) || (jiaGangOptions && jiaGangOptions.length > 0)) && (
        <div style={{
          position: 'absolute',
          bottom: '30%',
          right: '18%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          maxWidth: 320,
          zIndex: 40,
          pointerEvents: 'auto',
        }}>
          {isAwaitingReactions && (
            <ActionPanel 
              reactions={pendingReactions}
              hand={players[0].hand}
              lastDiscard={gameState.lastDiscard}
              onChi={onChi} 
              onPong={onPong} 
              onKong={onKong} 
              onHu={onHu} 
              onPass={onPass}
              disabled={!isAwaitingReactions} 
            />
          )}
          {canSelfHu && onSelfHu && (
            <button onClick={onSelfHu} style={{
              padding: '14px 26px', fontSize: '22px', fontWeight: 700, borderRadius: '8px',
              background: '#c41e3a', color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(196,30,58,0.5)',
              minWidth: 80,
            }}>自摸胡</button>
          )}
          {anKongOptions && anKongOptions.length > 0 && onAnKong && anKongOptions.map((t, i) => (
            <button key={`ak${i}`} onClick={() => onAnKong(t.id)} style={{
              padding: '14px 26px', fontSize: '22px', fontWeight: 700, borderRadius: '8px',
              background: '#b45309', color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              minWidth: 80,
            }}>暗杠</button>
          ))}
          {jiaGangOptions && jiaGangOptions.length > 0 && onJiaGang && jiaGangOptions.map((opt, i) => (
            <button key={`jg${i}`} onClick={() => onJiaGang(opt.tile.id)} style={{
              padding: '14px 26px', fontSize: '22px', fontWeight: 700, borderRadius: '8px',
              background: '#b45309', color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              minWidth: 80,
            }}>加杠</button>
          ))}
        </div>
      )}
    </div>
  );
}