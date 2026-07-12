import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useGameStore } from '../store/gameStore';

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

export function SettingsPanel() {
  const { settings, update } = useSettingsStore();
  const syncPlayerNames = useGameStore((s) => s.syncPlayerNames);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (key: string, value: string) => {
    setEditingName(key);
    setEditValue(value);
  };

  const confirmEdit = () => {
    if (editingName && editValue.trim()) {
      update({
        playerNames: {
          ...settings.playerNames,
          [editingName]: editValue.trim().slice(0, 8), // 最长8字符
        },
      });
      // 同步更新当前游戏的玩家名字
      syncPlayerNames();
    }
    setEditingName(null);
  };

  const nameFields = [
    { key: 'human', label: '你的名字', color: '#c9a94e' },
    { key: 'ai1', label: 'AI 东', color: '#7eb8da' },
    { key: 'ai2', label: 'AI 南', color: '#7eb8da' },
    { key: 'ai3', label: 'AI 西', color: '#7eb8da' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px 24px',
    }}>
      {/* AI Difficulty */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>AI 难度</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ aiDifficulty: opt.value })}
              style={{
                flex: 1,
                padding: '4px 4px',
                fontSize: '11px',
                borderRadius: '4px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>动画速度</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {ANIM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ animationSpeed: opt.value })}
              style={{
                flex: 1,
                padding: '4px 4px',
                fontSize: '11px',
                borderRadius: '4px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>音效</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => update({ soundEnabled: !settings.soundEnabled })}
            style={{
              width: 36,
              height: 20,
              borderRadius: '10px',
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
              top: 1,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              left: settings.soundEnabled ? 20 : 1,
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '11px', color: settings.soundEnabled ? '#c9a94e' : 'rgba(255,255,255,0.3)' }}>
            {settings.soundEnabled ? '开' : '关'}
          </span>
        </div>
      </div>

      {/* Base score */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>底分</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => update({ baseScore: Math.max(1, settings.baseScore - 1) })}
            style={{
              width: 24, height: 24, borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{settings.baseScore}</span>
          <button
            onClick={() => update({ baseScore: Math.min(20, settings.baseScore + 1) })}
            style={{
              width: 24, height: 24, borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
      </div>

      {/* Initial score */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>初始积分</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => update({ initialScore: Math.max(500, settings.initialScore - 500) })}
            style={{
              width: 24, height: 24, borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{settings.initialScore}</span>
          <button
            onClick={() => update({ initialScore: Math.min(10000, settings.initialScore + 500) })}
            style={{
              width: 24, height: 24, borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: '#c9a94e', border: '1px solid rgba(201,169,78,0.3)',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
      </div>

      {/* Player Names - spans full width */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: '10px', color: '#c9a94e', letterSpacing: '0.08em' }}>玩家昵称</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {nameFields.map(({ key, label, color }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10px', color: 'rgba(224,213,193,0.5)' }}>{label}</span>
              {editingName === key ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={confirmEdit}
                  onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                  maxLength={8}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: `1px solid ${color}`,
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  onClick={() => startEdit(key, settings.playerNames[key as keyof typeof settings.playerNames])}
                  style={{
                    padding: '4px 6px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    color: color,
                    border: '1px solid rgba(201,169,78,0.15)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title="点击编辑"
                >
                  {settings.playerNames[key as keyof typeof settings.playerNames]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
