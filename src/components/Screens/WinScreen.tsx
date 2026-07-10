import { TileComponent } from '../Game/TileComponent';
import {
  getPatternName,
  calculatePatternMultiplier,
} from '../../engine/scoring';
import type { GameState, Tile, PayoutEntry } from '../../engine/types';
import { playClick } from '../../audio/soundManager';

interface WinScreenProps {
  gameState: GameState;
  onNextRound: () => void;
  onNewGame: () => void;
}

export function WinScreen({ gameState, onNextRound, onNewGame }: WinScreenProps) {
  const winnerIdx = gameState.lastWinnerIndex ?? 0;
  const winner = gameState.players[winnerIdx];
  const winResult = gameState.lastWinResult;
  const patternName = winResult ? getPatternName(winResult) : '胡牌';
  const patternMult = winResult ? calculatePatternMultiplier(winResult) : 1;
  const baseScore = gameState.settings.baseScore;
  const isSelfDraw = winResult?.fromWall ?? true;
  const discarderName =
    !isSelfDraw && gameState.lastDiscarderIndex !== null
      ? gameState.players[gameState.lastDiscarderIndex]?.name
      : null;

  const payouts = gameState.lastPayouts ?? [];

  // Calculate net change per player from this round's payouts
  const netChange = [0, 0, 0, 0];
  for (const p of payouts) {
    netChange[p.fromPlayer] -= p.amount;
    netChange[p.toPlayer] += p.amount;
  }

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center overflow-y-auto py-8"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, #1a2744 0%, #0f1a2e 50%, #0a101f 100%)',
      }}
    >
      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-2xl px-6">
        {/* Title */}
        <div className="text-center">
          <div
            className="text-5xl mb-2"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            {winner.isHuman ? '🎉' : '😢'}
          </div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{
              color: winner.isHuman ? '#c9a94e' : '#e0d5c1',
              fontFamily: "'Noto Serif SC', serif",
            }}
          >
            {winner.name} 胡了!
          </h1>
          <p className="text-lg" style={{ color: '#e8d48b' }}>
            {patternName}
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(224,213,193,0.5)' }}>
            {isSelfDraw ? '自摸' : `${discarderName} 放铳`}
          </p>
        </div>

        {/* Scoring summary card */}
        <div
          className="w-full rounded-xl p-4"
          style={{
            background: 'rgba(10,22,40,0.6)',
            border: '1px solid rgba(201,169,78,0.15)',
          }}
        >
          {/* Multiplier breakdown */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gold/10">
            <span style={{ fontSize: '13px', color: 'rgba(224,213,193,0.6)' }}>
              底分
            </span>
            <span style={{ fontSize: '13px', color: '#c9a94e', fontWeight: 600 }}>
              {baseScore}
            </span>
          </div>
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gold/10">
            <span style={{ fontSize: '13px', color: 'rgba(224,213,193,0.6)' }}>
              番数
            </span>
            <span style={{ fontSize: '13px', color: '#c9a94e', fontWeight: 600 }}>
              ×{patternMult}
            </span>
          </div>

          {/* Per-player payout details */}
          <div className="space-y-2">
            {gameState.players.map((p, i) => {
              const change = netChange[i];
              const isWinner = i === winnerIdx;
              const playerPayouts = payouts.filter(
                (pa) => pa.fromPlayer === i && pa.toPlayer === winnerIdx
              );

              return (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-2 rounded"
                  style={{
                    background: isWinner
                      ? 'rgba(201,169,78,0.08)'
                      : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: p.isHuman ? '#c9a94e' : 'rgba(224,213,193,0.8)',
                      }}
                    >
                      {p.name}
                      {p.isDealer && ' (庄)'}
                    </span>
                    {playerPayouts.length > 0 && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'rgba(224,213,193,0.4)',
                        }}
                      >
                        {playerPayouts[0].reason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color:
                          change > 0
                            ? '#e8d48b'
                            : change < 0
                              ? '#e07a7a'
                              : 'rgba(224,213,193,0.4)',
                      }}
                    >
                      {change > 0 ? '+' : ''}
                      {change}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'rgba(224,213,193,0.4)',
                        minWidth: '40px',
                        textAlign: 'right',
                      }}
                    >
                      累计 {p.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Winner's hand */}
        {winner.hand.length > 0 && (
          <div
            className="win-glow flex gap-1 p-3 rounded-xl flex-wrap justify-center max-w-md"
            style={{
              background: 'rgba(10,22,40,0.6)',
              border: '1px solid rgba(201,169,78,0.1)',
            }}
          >
            {[
              ...winner.melds.flatMap((m) => m.tiles),
              ...winner.hand,
            ].map((t: Tile, i: number) => (
              <TileComponent key={t.id || i} tile={t} faceUp size="small" />
            ))}
          </div>
        )}

        {/* Win Statistics */}
        <div
          className="w-full max-w-md p-4 rounded-xl"
          style={{
            background: 'rgba(10,22,40,0.6)',
            border: '1px solid rgba(201,169,78,0.1)',
          }}
        >
          <div className="text-center mb-3" style={{ fontSize: '14px', color: 'rgba(224,213,193,0.6)' }}>
            获胜统计
          </div>
          <div className="grid grid-cols-4 gap-2">
            {gameState.players.map((p, i) => (
              <div key={i} className="text-center">
                <div style={{ fontSize: '12px', color: 'rgba(224,213,193,0.5)', marginBottom: 4 }}>
                  {p.name}
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  color: i === 0 ? '#e8d48b' : 'rgba(224,213,193,0.8)',
                }}>
                  {gameState.winCounts[i]}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(224,213,193,0.4)' }}>
                  胜
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => { playClick(); onNextRound(); }}
            style={{
              padding: '12px 48px',
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
            下一局
          </button>
          <button
            onClick={() => { playClick(); onNewGame(); }}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              background: 'rgba(201,169,78,0.2)',
              color: '#c9a94e',
              border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer',
            }}
          >
            重新开始
          </button>
        </div>
      </div>
    </div>
  );
}
