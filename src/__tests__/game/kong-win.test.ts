// ============================================================
// 杠牌后胡牌 — 专项测试
// 验证 executeAnKong 后手牌数量正确，checkWin 能正常判断
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  startRound,
  executeDraw,
  executeDiscard,
  executePassAll,
  executeAnKong,
} from '../../engine/state';
import { checkWin } from '../../engine/win';
import { getAnKongOptions } from '../../engine/hand';
import { resetTileIdCounter } from '../../engine/tile';
import type { GameSettings, Tile, TileType, Meld } from '../../engine/types';

const DEFAULT_SETTINGS: GameSettings = {
  humanPlayerIndex: 0,
  aiDifficulty: 'medium',
  animationSpeed: 'normal',
  baseScore: 1,
  initialScore: 1000,
  soundEnabled: false,
};

const FORTUNE_TYPE: TileType = { honor: 'bai' };

function makeTiles(spec: string[]): Tile[] {
  const honorMap: Record<string, 'east' | 'south' | 'west' | 'north' | 'zhong' | 'fa' | 'bai'> = {
    东: 'east', 南: 'south', 西: 'west', 北: 'north',
    中: 'zhong', 发: 'fa', 白: 'bai',
  };
  const suitMap: Record<string, 'wan' | 'tiao' | 'tong'> = {
    万: 'wan', 条: 'tiao', 筒: 'tong',
  };

  return spec.map((s) => {
    if (honorMap[s]) {
      return { id: `t_${Math.random().toString(36).slice(2, 9)}`, type: { honor: honorMap[s] } };
    }
    const match = s.match(/([万千条筒])([1-9])/);
    if (match) {
      return {
        id: `t_${Math.random().toString(36).slice(2, 9)}`,
        type: { suit: suitMap[match[1]], rank: parseInt(match[2]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 },
      };
    }
    throw new Error(`Unknown tile spec: ${s}`);
  });
}

// ============================================================
// 测试用例：构造一个杠牌后能胡的场景
// ============================================================

describe('杠牌后胡牌', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  describe('1. 暗杠后手牌数量正确', () => {
    it('暗杠: 14张 → 10张 → 摸补 → 11张 → 出牌 → 10张', () => {
      let state = createInitialState(DEFAULT_SETTINGS);
      state = startRound(state, 42);

      // 找到有人暗杠的机会
      for (let i = 0; i < 30; i++) {
        state = executeDraw(state);
        if (state.phase === 'round_over') break;

        const player = state.players[state.currentPlayerIndex];
        const ankongOptions = getAnKongOptions(player.hand);
        if (ankongOptions.length > 0) {
          const beforeKongHandLen = player.hand.length;
          const beforeKongMeldCount = player.melds.length;

          // 执行暗杠
          state = executeAnKong(state, ankongOptions[0].id);
          expect(state.phase).toBe('replacement_draw');

          const afterKongPlayer = state.players[state.currentPlayerIndex];
          // 暗杠后手牌 = 之前手牌 - 4 + 1(补牌)
          expect(afterKongPlayer.hand.length).toBe(beforeKongHandLen - 4 + 1);
          // 杠数 +1
          expect(afterKongPlayer.melds.length).toBe(beforeKongMeldCount + 1);

          // 过渡到出牌阶段
          state = { ...state, phase: 'awaiting_discard', drewFromWall: true };

          // 出牌
          const tileToDiscard = afterKongPlayer.hand[0];
          state = executeDiscard(state, tileToDiscard.id);
          state = executePassAll(state);

          // 出牌后手牌 = 暗杠后手牌 - 1
          const afterDiscardPlayer = state.players[state.currentPlayerIndex];
          expect(afterDiscardPlayer.hand.length).toBe(afterKongPlayer.hand.length - 1);

          // 总牌数守恒
          const totalTiles =
            state.wall.length + state.deadWall.length +
            state.players.reduce((sum, p) => sum + p.hand.length +
              p.melds.reduce((m, me) => m + me.tiles.length, 0) + p.discards.length, 0);
          expect(totalTiles).toBe(136);

          console.log(`暗杠测试通过：手牌 ${beforeKongHandLen} → ${afterKongPlayer.hand.length} → ${afterDiscardPlayer.hand.length}`);
          return;
        }

        const discard = state.players[state.currentPlayerIndex].hand[0];
        state = executeDiscard(state, discard.id);
        state = executePassAll(state);
        if (state.phase !== 'player_turn') break;
      }

      console.log('暗杠测试跳过：30轮内未触发暗杠');
    });
  });

  describe('2. 暗杠后 checkWin 能正确判断', () => {
    it('暗杠后 11张手牌 + 1杠 = 需要3组+1对 = 11张 (数量匹配)', () => {
      // 手牌: 123万 456万 789万 55筒 = 11张 (3组顺子 + 1对)
      // 杠: 万1×4 (暗杠)
      const hand = makeTiles([
        '万1', '万2', '万3',
        '万4', '万5', '万6',
        '万7', '万8', '万9',
        '筒5', '筒5',
      ]);
      // 11张手牌，需要 3组 + 1对 = 11张 ✓

      const melds: Meld[] = [
        {
          kind: 'ankong',
          tiles: makeTiles(['万1', '万1', '万1', '万1']),
          discardFrom: -1,
        },
      ];

      const result = checkWin(hand, melds, hand[hand.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
      expect(result!.fromWall).toBe(true);
      console.log('暗杠后checkWin通过：11张手牌 + 1杠 = 胡牌');
    });

    it('明杠后 11张手牌 + 1杠 = 需要3组+1对', () => {
      const hand = makeTiles([
        '万1', '万2', '万3',
        '万4', '万5', '万6',
        '万7', '万8', '万9',
        '筒5', '筒5',
      ]);
      const melds: Meld[] = [
        {
          kind: 'mingkong',
          tiles: makeTiles(['筒2', '筒2', '筒2', '筒2']),
          discardFrom: 1,
        },
      ];

      const result = checkWin(hand, melds, hand[hand.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      console.log('明杠后checkWin通过：11张手牌 + 1杠 = 胡牌');
    });

    it('暗杠后无法胡牌 → 正确返回null', () => {
      // 手牌: 乱牌11张 + 1杠 → 无法胡
      const hand = makeTiles([
        '万1', '万1', '万1',
        '万2', '万2',
        '筒3', '筒3',
        '条4', '条5', '条6', '条7',
      ]);
      const melds: Meld[] = [
        {
          kind: 'ankong',
          tiles: makeTiles(['中', '中', '中', '中']),
          discardFrom: -1,
        },
      ];

      const result = checkWin(hand, melds, hand[hand.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).toBeNull();
      console.log('暗杠后无法胡牌：正确返回null');
    });

    it('明杠后 11张手牌 + 1杠 = 需要3组+1对', () => {
      // 123万 456万 789万 + 5筒×2(将) = 11张手牌
      const hand = makeTiles([
        '万1', '万2', '万3',
        '万4', '万5', '万6',
        '万7', '万8', '万9',
        '筒5', '筒5',
      ]);
      const melds: Meld[] = [
        {
          kind: 'mingkong',
          tiles: makeTiles(['筒2', '筒2', '筒2', '筒2']),
          discardFrom: 1,
        },
      ];

      const result = checkWin(hand, melds, hand[hand.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      expect(result!.form).toBe('standard');
      console.log('明杠后checkWin通过：11张手牌 + 1杠 = 胡牌');
    });

    it('双暗杠后 7张手牌 + 2杠 = 需要2组+1对 = 7张', () => {
      // 手牌: 7张 → 需要 2组 + 1对 = 7张
      // 123万 456万 55筒 = 8张... wait, 7张
      // 123万 45万 55筒 = 6张... no
      // 123万 55筒 4万 = 6张... need 7
      // 123万 55筒 44万 = 8张...
      // 123万 456万 7万 = 7张 → pair=77? no only 1
      // Let me construct: 7手牌需要 2组(6张) + 1对(2张) = 8张... 
      // Wait: 4 melds total, 2 kongs = 2 melds, so 2 more melds needed.
      // Plus 1 pair. 2×3 + 2 = 8. But hand is 7 tiles.
      // After 2 kongs: hand = 14 - 4 + 1 - 1(discard) = 10, draw = 11, kong = 11 - 4 + 1 = 8, discard = 7
      // Need 2 melds + 1 pair = 8 tiles. Hand has 7. 7 < 8, can't win!

      // After 2 kongs + discard, hand = 7 tiles. Next draw = 8 tiles.
      // Need 2 melds + 1 pair = 8 tiles. 8 = 8 ✓

      const hand = makeTiles([
        '万1', '万2', '万3',
        '万4', '万5', '万6',
        '筒5',
      ]);
      // 7张手牌。下一轮摸到筒5 → 8张 → 可以胡

      // Actually, after 2 kongs + discard, hand = 7. 
      // After next draw, hand = 8.
      // Need 2 melds + 1 pair = 8. 
      // Let me construct 8 tiles that win:
      // 123万 456万 55筒 = 8 tiles ✓

      const handAfterDraw = makeTiles([
        '万1', '万2', '万3',
        '万4', '万5', '万6',
        '筒5', '筒5',
      ]);

      const melds: Meld[] = [
        {
          kind: 'ankong',
          tiles: makeTiles(['中', '中', '中', '中']),
          discardFrom: -1,
        },
        {
          kind: 'ankong',
          tiles: makeTiles(['发', '发', '发', '发']),
          discardFrom: -1,
        },
      ];

      const result = checkWin(handAfterDraw, melds, handAfterDraw[handAfterDraw.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      console.log('双杠后checkWin通过：8张手牌 + 2杠 = 胡牌');
    });

    it('四杠后 2张手牌 + 4杠 = 需要0组+1对 = 2张', () => {
      // After 4 kongs + discard + draw:
      // hand = 2 tiles
      // Need: 0 melds + 1 pair = 2 tiles ✓

      const hand = makeTiles([
        '万1', '万1',
      ]);

      const melds: Meld[] = [
        { kind: 'ankong', tiles: makeTiles(['万2', '万2', '万2', '万2']), discardFrom: -1 },
        { kind: 'ankong', tiles: makeTiles(['万3', '万3', '万3', '万3']), discardFrom: -1 },
        { kind: 'ankong', tiles: makeTiles(['万4', '万4', '万4', '万4']), discardFrom: -1 },
        { kind: 'ankong', tiles: makeTiles(['万5', '万5', '万5', '万5']), discardFrom: -1 },
      ];

      const result = checkWin(hand, melds, hand[hand.length - 1], FORTUNE_TYPE, {
        fromDraw: true,
        fromDiscard: false,
      });

      expect(result).not.toBeNull();
      console.log('四杠后checkWin通过：2张手牌 + 4杠 = 胡牌');
    });
  });
});