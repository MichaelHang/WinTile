/**
 * 实机走查 — 引擎端到端 fuzz
 *
 * 模拟一个"全 AI 自动对局"驱动器，严格复刻 useGameLoop 的状态机
 * （人类玩家 index 0 也用 AI 决策代替），跑大量随机对局，每步校验：
 *   1. 牌数守恒：wall + deadWall + 各家 hand/melds/discards 恒等于 136
 *   2. 胡牌合法性：declaring_win 时赢家手牌确实能胡且有最少台数
 *   3. 计分守恒：每次胡牌 payout 总额加和为 0
 *   4. 无死锁：单局步数有上限
 *
 * 注意：反应处理只执行引擎声明的合法反应类型（pendingReactions 给出的类型），
 * 以贴合真实 UI 行为，避免漏碰/漏胡/连庄规则造成的假阳性死锁。
 */
import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startRound,
  executeDraw,
  executeDiscard,
  executeChi,
  executePong,
  executeMingKong,
  executeAnKong,
  executeHu,
  executePassAll,
  executePlayerPass,
  advanceDealer,
} from '../../engine/state';
import { computeAIAction, decideReaction, clearShantenCache } from '../../engine/ai';
import { checkWin, hasMinimumTai } from '../../engine/win';
import type { GameSettings, GameState, AIAction, AIDifficulty } from '../../engine/types';

function makeSettings(diff: AIDifficulty): GameSettings {
  return {
    humanPlayerIndex: 0,
    aiDifficulty: diff,
    animationSpeed: 'fast',
    baseScore: 10,
    initialScore: 1000,
    soundEnabled: false,
  };
}

const TOTAL_TILES = 136;

function countTiles(state: GameState): number {
  let n = state.wall.length + state.deadWall.length;
  for (const p of state.players) {
    n += p.hand.length;
    for (const m of p.melds) n += m.tiles.length;
    n += p.discards.length;
  }
  return n;
}

type Decision = { pi: number; type: 'hu' | 'kong' | 'pong' | 'chi'; chiOptionIndex?: number };

/**
 * 执行胡牌并对计分做严格校验：
 *   1. 引擎实际施加的分差 == 由 payouts 推导的净分（每笔一收一付）
 *   2. 全局净分之和必须为 0（分数守恒，不凭空增减）
 */
function doHu(state: GameState, pi: number): GameState {
  const before = state.players.map((p) => p.score);
  const after = executeHu(state, pi);
  if (after !== state) {
    const payouts = after.lastPayouts ?? [];
    const net = [0, 0, 0, 0];
    for (const e of payouts) {
      net[e.toPlayer] += e.amount;
      net[e.fromPlayer] -= e.amount;
    }
    const actual = after.players.map((p) => p.score);
    for (let i = 0; i < 4; i++) {
      if (actual[i] - before[i] !== net[i]) {
        throw new Error(
          `分数应用不一致 玩家${i}: 实际delta=${actual[i] - before[i]} 期望net=${net[i]} payouts=${JSON.stringify(payouts)}`
        );
      }
    }
    const globalSum = net.reduce((a, b) => a + b, 0);
    if (globalSum !== 0) {
      throw new Error(`全局分数不守恒: ${globalSum} payouts=${JSON.stringify(payouts)}`);
    }
  }
  return after;
}

/** 处理 awaiting_reactions：只执行引擎声明的合法反应类型，按 hu>kong>pong>chi 优先级取最高。 */
function processReactions(state: GameState, diff: AIDifficulty): GameState {
  const reactions = state.pendingReactions;
  if (reactions.length === 0) return executePassAll(state);

  const prio: Record<string, number> = { hu: 0, kong: 1, pong: 2, chi: 3 };
  const decisions: Decision[] = [];

  for (const r of reactions) {
    if (r.kind === 'hu') {
      decisions.push({ pi: r.playerIndex, type: 'hu' });
      continue;
    }
    // 对非 hu 反应，用 decideReaction 判断是否值得，但只采纳与声明类型匹配的
    const action = decideReaction(state, r.playerIndex, diff);
    if (action.kind === r.kind) {
      const d: Decision = { pi: r.playerIndex, type: r.kind as Decision['type'] };
      if (r.kind === 'chi') d.chiOptionIndex = (action as Extract<AIAction, { kind: 'chi' }>).chiOptionIndex;
      decisions.push(d);
    }
  }

  if (decisions.length === 0) return executePassAll(state);
  decisions.sort((a, b) => prio[a.type] - prio[b.type]);
  const d = decisions[0];

  let res: GameState;
  if (d.type === 'hu') res = doHu(state, d.pi);
  else if (d.type === 'kong') res = executeMingKong(state, d.pi);
  else if (d.type === 'pong') res = executePong(state, d.pi);
  else if (d.type === 'chi') res = executeChi(state, d.pi, d.chiOptionIndex ?? 0);
  else res = executePassAll(state);
  if (res === state) {
    // 该决策无效(如杠后摸牌堆耗尽 / 胡牌台数不足) —— 该玩家放弃此反应后重试其余
    return processReactions(executePlayerPass(state, d.pi), diff);
  }
  return res;
}

interface Ctx {
  wins: number;
  draws: number;
  steps: number;
}

/** 自动跑完一局，返回结束态（declaring_win / round_over）。每步校验不变量。 */
function autoPlayRound(state: GameState, diff: AIDifficulty, ctx: Ctx): GameState {
  let steps = 0;
  while (state.phase !== 'round_over' && state.phase !== 'declaring_win' && state.phase !== 'game_over') {
    // 不变量 1：牌数守恒
    const tc = countTiles(state);
    if (tc !== TOTAL_TILES) {
      throw new Error(`牌数异常 ${tc} != ${TOTAL_TILES}，step=${steps}，phase=${state.phase}`);
    }

    switch (state.phase) {
      case 'player_turn':
        state = executeDraw(state);
        break;
      case 'replacement_draw':
        state = { ...state, phase: 'awaiting_discard', drewFromWall: true };
        break;
      case 'awaiting_discard': {
        const action = computeAIAction(state, state.currentPlayerIndex, diff);
        let next: GameState;
        if (action.kind === 'hu') {
          next = doHu(state, state.currentPlayerIndex);
        } else if (action.kind === 'kong' && action.kongType === 'ankong') {
          next = executeAnKong(state, action.tileId || '');
        } else if (action.kind === 'discard' || action.kind === 'caiPiao') {
          next = executeDiscard(state, action.tileId);
        } else {
          const p = state.players[state.currentPlayerIndex];
          if (p.hand.length === 0) throw new Error(`awaiting_discard 但手牌为空，step=${steps}`);
          next = executeDiscard(state, p.hand[p.hand.length - 1].id);
        }
        // 防死锁兜底：若引擎拒绝该操作（返回原引用），强制打出最后一张手牌
        if (next === state) {
          const p = state.players[state.currentPlayerIndex];
          if (p.hand.length === 0) throw new Error(`awaiting_discard 但手牌为空，step=${steps}`);
          next = executeDiscard(state, p.hand[p.hand.length - 1].id);
        }
        state = next;
        break;
      }
      case 'awaiting_reactions':
        state = processReactions(state, diff);
        break;
      default:
        throw new Error(`意外 phase=${state.phase}，step=${steps}`);
    }

    steps++;
    ctx.steps++;
    if (steps > 5000) throw new Error(`疑似死锁：单局超过 5000 步，最后 phase=${state.phase}`);
  }

  // 不变量 2 & 3：胡牌合法性与计分守恒
  if (state.phase === 'declaring_win') {
    ctx.wins++;
    const w = state.lastWinnerIndex!;
    const p = state.players[w];
    const fromDiscard = state.lastWinFromDiscard ?? false;
    const lastTile = fromDiscard ? state.lastDiscard!.tile : state.lastDrawnTile ?? p.hand[p.hand.length - 1];
    const winHand = fromDiscard ? [...p.hand, state.lastDiscard!.tile] : p.hand;
    const res = checkWin(winHand, p.melds, lastTile, state.fortuneTile, {
      fromDraw: !fromDiscard,
      fromDiscard,
    });
    if (!res) throw new Error(`宣告胡牌但 checkWin 返回 false（玩家 ${w}）`);
    if (!hasMinimumTai(res, winHand, p.melds)) throw new Error(`胡牌不满足最少台数（玩家 ${w}）`);
    // 计分守恒与分数应用正确性已由 doHu 校验，这里仅确认 payouts 存在
    if (!state.lastPayouts || state.lastPayouts.length === 0) {
      throw new Error(`胡牌但无 payouts 记录（玩家 ${w}）`);
    }
  } else {
    ctx.draws++;
  }

  return state;
}

/** 跑多局，复刻 gameStore.nextRound 的庄家轮转逻辑。 */
function simulateGame(rounds: number, seedBase: number, diff: AIDifficulty): { finalState: GameState; ctx: Ctx } {
  clearShantenCache();
  let state = createInitialState(makeSettings(diff));
  state = startRound(state, seedBase);
  if (state.players[state.currentPlayerIndex].isHuman) state = executeDraw(state);

  const ctx: Ctx = { wins: 0, draws: 0, steps: 0 };

  for (let r = 0; r < rounds; r++) {
    state = autoPlayRound(state, diff, ctx);
    const advanced = advanceDealer(state, state.lastWinnerIndex ?? null);
    const baseState: GameState = {
      ...advanced,
      players: advanced.players.map((p, i) => ({ ...p, isDealer: i === advanced.dealerIndex })) as GameState['players'],
    };
    state = startRound(baseState, seedBase + r + 1);
    if (state.players[state.currentPlayerIndex].isHuman) state = executeDraw(state);
  }

  return { finalState: state, ctx };
}

describe('实机走查：引擎端到端 fuzz', () => {
  it('medium：200 局不变量守恒、无死锁、无崩溃', () => {
    const { ctx } = simulateGame(200, 1, 'medium');
    console.log(`[medium] 胡=${ctx.wins} 流局=${ctx.draws} 总步数=${ctx.steps}`);
    expect(ctx.wins + ctx.draws).toBe(200);
  }, 120000);

  it('easy：100 局', () => {
    const { ctx } = simulateGame(100, 1000, 'easy');
    console.log(`[easy] 胡=${ctx.wins} 流局=${ctx.draws} 总步数=${ctx.steps}`);
    expect(ctx.wins + ctx.draws).toBe(100);
  }, 120000);

  it('hard：100 局', () => {
    const { ctx } = simulateGame(100, 2000, 'hard');
    console.log(`[hard] 胡=${ctx.wins} 流局=${ctx.draws} 总步数=${ctx.steps}`);
    expect(ctx.wins + ctx.draws).toBe(100);
  }, 120000);

  it('跨局计分守恒：hard 50 局后所有玩家累计分 - 初始分 之和为 0', () => {
    const { finalState } = simulateGame(50, 3000, 'hard');
    const sum = finalState.players.reduce((s, p) => s + (p.score - 1000), 0);
    expect(sum).toBe(0);
  }, 120000);
});
