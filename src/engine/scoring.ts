// ============================================================
// Hangzhou Mahjong (杭州麻将) - Scoring & Settlement
// ============================================================

import type { WinResult, PlayerState, PayoutEntry } from './types';
import { getLaoMultiplier } from './constants';

// Calculate the pattern multiplier from the winning hand composition
export function calculatePatternMultiplier(winResult: WinResult): number {
  let multiplier = 1;

  // Start with the base form
  if (winResult.form === 'sevenPairs') {
    multiplier = 2; // 七对 base ×2
  }

  // 财飘: ×4 for 1 piao, ×8 for 2 piao, ×16 for 3 piao
  // 财飘 inherently includes 爆头, so the multiplier is 2^(piaoCount+1)
  if (winResult.isCaiPiao) {
    multiplier *= Math.pow(2, winResult.piaoCount + 1);
  } else if (winResult.isBaoTou) {
    // 爆头 standalone (no 财飘): ×2
    multiplier *= 2;
  }

  // 杠开: each gang doubles
  if (winResult.isGangKai) {
    multiplier *= Math.pow(2, winResult.gangCount);
  }

  // 杠爆: the combination is handled by the multiplication above
  // (gangKai × baoTou = 杠爆)

  // 七对 variations
  if (winResult.form === 'sevenPairs') {
    // 清七对 (pure, no fortune): ×2 on top of 七对 base
    if (winResult.isPure) {
      multiplier *= 2; // 清七对 = 4 total (2×2)
    }

    // 豪华七对 (luxury): each 4-of-a-kind doubles the multiplier
    if (winResult.isLuxury) {
      multiplier *= Math.pow(2, winResult.luxuryCount);
    }

    // 七客 = 七对 + 爆头: ×2
    if (winResult.isBaoTou) {
      multiplier *= 2;
    }
  }
  
  // 清一色系列 (applies to both standard and seven pairs)
  if (winResult.isZiYiSe) {
    multiplier *= 2; // 字一色: ×2 (in addition to other multipliers)
  } else if (winResult.isQingYiSe) {
    multiplier *= 2; // 清一色: ×2
  } else if (winResult.isHunYiSe) {
    // 混一色: no additional multiplier (already counted in base)
  }

  return multiplier;
}

// Calculate the lao multiplier for payment between two specific players
export function calculateLaoMultiplier(
  laoCount: number,
  isWinnerDealer: boolean,
  isLoserDealer: boolean
): number {
  return getLaoMultiplier(laoCount, isWinnerDealer, isLoserDealer);
}

// Calculate the full payout for a win
export function calculatePayouts(
  winnerIndex: number,
  discarderIndex: number | null,
  players: PlayerState[],
  winResult: WinResult,
  laoCount: number,
  baseScore: number,
  exposureCounts: Record<string, number>
): PayoutEntry[] {
  const payouts: PayoutEntry[] = [];
  const patternMultiplier = calculatePatternMultiplier(winResult);
  const isWinnerDealer = players[winnerIndex].isDealer;

  // Guard against NaN: ensure baseScore is a valid number
  const safeBaseScore = (typeof baseScore === 'number' && !isNaN(baseScore))
    ? baseScore
    : 1;

  if (winResult.fromWall) {
    // Self-draw win: all 3 other players pay
    for (let i = 0; i < 4; i++) {
      if (i === winnerIndex) continue;

      const isLoserDealer = players[i].isDealer;
      const laoMult = calculateLaoMultiplier(laoCount, isWinnerDealer, isLoserDealer);
      const amount = safeBaseScore * patternMultiplier * laoMult;

      payouts.push({
        fromPlayer: i,
        toPlayer: winnerIndex,
        amount,
        reason: `自摸 ×${patternMultiplier} (老庄×${laoMult})`,
      });
    }
  } else {
    // Discard win: only the discarder pays
    if (discarderIndex === null) return payouts;

    const isLoserDealer = players[discarderIndex]?.isDealer ?? false;
    const laoMult = calculateLaoMultiplier(laoCount, isWinnerDealer, isLoserDealer);
    const amount = safeBaseScore * patternMultiplier * laoMult;

    payouts.push({
      fromPlayer: discarderIndex,
      toPlayer: winnerIndex,
      amount,
      reason: `放铳 ×${patternMultiplier} (老庄×${laoMult})`,
    });
  }

  // Apply 三摊承包 (three-exposure responsibility)
  applyExposureResponsibility(payouts, exposureCounts, winnerIndex);

  return payouts;
}

// Apply 三摊承包 rules in-place:
// If player A has given 3 melds to player B:
// - If B wins by self-draw: A pays for all 3 losing players
// - If A wins by self-draw: B pays double
function applyExposureResponsibility(
  payouts: PayoutEntry[],
  exposureCounts: Record<string, number>,
  winnerIndex: number
): void {
  for (const [key, count] of Object.entries(exposureCounts)) {
    if (count < 3) continue;

    const [fromStr, toStr] = key.split('->');
    const fromPlayer = parseInt(fromStr);
    const toPlayer = parseInt(toStr);

    if (winnerIndex === toPlayer) {
      // B (winner) took 3 melds from A → A pays all
      const othersPayment = payouts
        .filter(
          (p) =>
            p.fromPlayer !== winnerIndex &&
            p.fromPlayer !== fromPlayer &&
            p.toPlayer === winnerIndex
        )
        .reduce((sum, p) => sum + p.amount, 0);

      if (othersPayment > 0) {
        // Remove the other players' payments and add them to A
        for (let i = payouts.length - 1; i >= 0; i--) {
          const p = payouts[i];
          if (p.fromPlayer !== winnerIndex &&
              p.fromPlayer !== fromPlayer &&
              p.toPlayer === winnerIndex) {
            payouts.splice(i, 1);
          }
        }
        payouts.push({
          fromPlayer,
          toPlayer: winnerIndex,
          amount: othersPayment,
          reason: '三摊承包: 承担全部',
        });
      }
    } else if (winnerIndex === fromPlayer) {
      // A (winner) gave 3 melds to B → B pays double
      const bPayout = payouts.find(
        (p) => p.fromPlayer === toPlayer && p.toPlayer === winnerIndex
      );
      if (bPayout) {
        payouts.push({
          fromPlayer: toPlayer,
          toPlayer: winnerIndex,
          amount: bPayout.amount,
          reason: '三摊承包: 反包双倍',
        });
      }
    }
  }
}

// Get human-readable name for a winning pattern
export function getPatternName(winResult: WinResult): string {
  const parts: string[] = [];

  if (winResult.form === 'sevenPairs') {
    if (winResult.isLuxury) {
      const luxuryPrefix =
        winResult.luxuryCount >= 3
          ? '三豪华'
          : winResult.luxuryCount >= 2
            ? '双豪华'
            : '豪华';
      parts.push(`${luxuryPrefix}七对`);
    } else if (winResult.isPure) {
      parts.push('清七对');
    } else {
      parts.push('七对');
    }
  }

  if (winResult.isCaiPiao) {
    const piaoPrefix =
      winResult.piaoCount >= 3
        ? '三财飘'
        : winResult.piaoCount >= 2
          ? '双财飘'
          : '财飘';
    parts.push(piaoPrefix);
  }

  if (winResult.isGangKai) {
    const gangPrefix =
      winResult.gangCount >= 3
        ? '三杠开'
        : winResult.gangCount >= 2
          ? '双杠开'
          : '杠开';
    parts.push(gangPrefix);
  }

  if (winResult.isGangBao) {
    const gbPrefix =
      winResult.gangCount >= 3
        ? '三杠爆'
        : winResult.gangCount >= 2
          ? '双杠爆'
          : '杠爆';
    // Replace gangKai + baoTou with combined name
    parts.push(gbPrefix);
  } else if (winResult.isBaoTou && !winResult.isCaiPiao) {
    parts.push('爆头');
  }

  if (winResult.form === 'sevenPairs' && winResult.isBaoTou) {
    parts.push('七客');
  }

  // Add color pattern names
  if (winResult.isZiYiSe) {
    parts.unshift('字一色');
  } else if (winResult.isQingYiSe) {
    parts.unshift('清一色');
  } else if (winResult.isHunYiSe) {
    parts.unshift('混一色');
  }

  if (parts.length === 0) {
    return winResult.fromWall ? '平胡(自摸)' : '平胡';
  }

  return parts.join('·');
}
