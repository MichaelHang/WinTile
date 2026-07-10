import type { GameState } from '../../engine/types';

interface DrawScreenProps {
  gameState: GameState;
  onNextRound: () => void;
  onNewGame: () => void;
}

export function DrawScreen({ gameState, onNextRound, onNewGame }: DrawScreenProps) {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, #1a2744 0%, #0f1a2e 50%, #0a101f 100%)',
      }}
    >
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="text-5xl mb-2">🤝</div>
          <h1
            className="text-4xl font-bold mb-1"
            style={{ color: '#e0d5c1', fontFamily: "'Noto Serif SC', serif" }}
          >
            流局
          </h1>
          <p className="text-sm" style={{ color: 'rgba(224,213,193,0.5)' }}>
            牌墙不足，本局结束
          </p>
        </div>
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

        <button
          onClick={onNextRound}
          style={{
            padding: '14px 56px',
            fontSize: '22px',
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
          onClick={onNewGame}
          style={{
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '6px',
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
  );
}
