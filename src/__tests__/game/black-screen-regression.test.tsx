import React from 'react';
// ============================================================
// 回归测试：修复「对家(或任意 AI)摸牌后整页变黑」的崩溃
//
// 根因：GameTable 无条件把 lastDrawnTile?.id 传给底部(人类) PlayerHand。
// 但 lastDrawnTile 保存的是「刚刚摸牌的人」的牌——可能是 AI。
// 当 AI 摸牌后，人类 PlayerHand 在手中找不到该牌，
// tiles.find(...) 返回 undefined，TileComponent 读 tile.type 抛异常，
// 由于没有 ErrorBoundary，整棵 React 树卸载 → 页面变黑。
// ============================================================

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerHand } from '../../components/Game/PlayerHand';
import { GameTable } from '../../components/Game/GameTable';
import { createInitialState, startRound } from '../../engine/state';
import { createTile } from '../../engine/tile';
import type { GameSettings } from '../../engine/types';

const SETTINGS: GameSettings = {
  humanPlayerIndex: 0,
  aiDifficulty: 'medium',
  animationSpeed: 'normal',
  baseScore: 1,
  initialScore: 500,
  soundEnabled: false,
  playerNames: {
    human: '测试玩家',
    ai1: 'AI东',
    ai2: 'AI南',
    ai3: 'AI西',
  },
};;

describe('drawn-tile crash regression', () => {
  it('PlayerHand 不崩溃：drawnTileId 不在手牌中时应安全跳过', () => {
    const humanTiles = [
      createTile({ suit: 'wan', rank: 1 }),
      createTile({ suit: 'wan', rank: 2 }),
      createTile({ suit: 'wan', rank: 3 }),
    ];
    // drawnTileId 指向一张根本不在手牌里的牌（模拟 AI 的摸牌）
    const aiDrawnTile = createTile({ suit: 'tong', rank: 9 });

    expect(() => {
      render(
        <PlayerHand
          tiles={humanTiles}
          faceUp
          position="bottom"
          drawnTileId={aiDrawnTile.id}
        />
      );
    }).not.toThrow();
  });

  it('GameTable 不把 AI 的摸牌显示到人类手牌上（currentPlayer 为 AI 时不传 drawnTileId）', () => {
    // 固定对家(玩家 2)为庄家
    let state = createInitialState(SETTINGS);
    state = startRound(state, Date.now());
    // 模拟对家刚刚摸了一张牌：lastDrawnTile 是对家的牌，当前回合也是对家
    const aiTile = createTile({ suit: 'tiao', rank: 5 });
    state = {
      ...state,
      currentPlayerIndex: 2,
      lastDrawnTile: aiTile,
      phase: 'awaiting_discard',
      players: state.players.map((p, i) =>
        i === 2 ? { ...p, hand: [...p.hand, aiTile] } : p
      ) as typeof state.players,
    };

    const noop = () => {};
    expect(() => {
      render(
        <GameTable
          gameState={state}
          selectedTileId={null}
          onTileClick={noop}
          onChi={noop}
          onPong={noop}
          onKong={noop}
          onHu={noop}
          onPass={noop}
          canSelfHu={false}
          onSelfHu={noop}
          anKongOptions={[]}
          jiaGangOptions={[]}
          onAnKong={noop}
          onJiaGang={noop}
          animatingTile={null}
          currentPlayerIndex={2}
          drawDuration={400}
          discardDuration={300}
          reactionDuration={300}
          lastDrawnTile={aiTile}
        />
      );
    }).not.toThrow();
  });
});
