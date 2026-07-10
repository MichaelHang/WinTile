// ============================================================
// Hangzhou Mahjong (杭州麻将) - Rules & Move Validation
// ============================================================

import type {
  GameState,
  Reaction,
  Tile,
  ChiOption,
} from './types';
import {
  canPong,
  canMingKong,
  getChiOptions,
  getAnKongOptions,
  getJiaGangOptions,
} from './hand';
import { checkWin, hasMinimumTai } from './win';
import { tileTypeToCode } from './tile';

// Get all available reactions for each non-current player after a discard
export function getAvailableReactions(
  state: GameState,
  lastDiscard: { tile: Tile; playerIndex: number }
): Reaction[] {
  const reactions: Reaction[] = [];
  const discardPlayer = lastDiscard.playerIndex;
  const discardTileCode = tileTypeToCode(lastDiscard.tile.type);

  for (let i = 0; i < 4; i++) {
    if (i === discardPlayer) continue;

    const player = state.players[i];
    const hand = player.hand;
    const melds = player.melds;
    const discard = lastDiscard.tile;

    // Check if player has passed on this tile type (漏胡/漏碰)
    const hasPassed = state.passedReactions[i]?.has(discardTileCode) ?? false;

    // Check Hu (highest priority)
    const winResult = checkWin(
      [...hand, discard],
      melds,
      discard,
      state.fortuneTile,
      { fromDraw: false, fromDiscard: true, discardPlayer }
    );

    if (winResult) {
      // Check if discard win is allowed based on lao count
      // And check 漏胡: if player passed on this tile type, cannot hu
      if (
        canWinOnDiscard(state, i, discardPlayer) &&
        !hasPassed &&
        hasMinimumTai(winResult, [...hand, discard], melds)
      ) {
        reactions.push({
          kind: 'hu',
          playerIndex: i,
        });
      }
    }

    // Check Kong (ming kong from discard) — only if there's a replacement tile available
    if (canMingKong(hand, discard) && state.deadWall.length > 0) {
      reactions.push({
        kind: 'kong',
        playerIndex: i,
        kongType: 'mingkong',
      });
    }

    // Check Pong (漏碰: if player passed on this tile type, cannot pong)
    if (canPong(hand, discard) && !hasPassed) {
      reactions.push({
        kind: 'pong',
        playerIndex: i,
      });
    }

    // Check Chi (only from the player to the left, and only for human players)
    // In Hangzhou, chi can only be from the player whose turn precedes yours
    if (isNextPlayer(discardPlayer, i)) {
      const chiOptions = getChiOptions(hand, discard);
      if (chiOptions.length > 0) {
        reactions.push({
          kind: 'chi',
          playerIndex: i,
          chiOptions: chiOptions.map((tiles): ChiOption => ({ tiles })),
        });
      }
    }
  }

  return reactions;
}

// Resolve reaction priority: Hu > Pong/Kong > Chi
// Returns the highest-priority reaction, or null if none
export function resolveReactionPriority(reactions: Reaction[]): Reaction | null {
  if (reactions.length === 0) return null;

  // Priority 1: Hu
  const huReactions = reactions.filter((r) => r.kind === 'hu');
  if (huReactions.length > 0) {
    // If multiple can hu, the first in turn order from discard player wins
    return huReactions[0];
  }

  // Priority 2: Pong / Kong (these share priority, first claimant wins)
  const pongKongReactions = reactions.filter(
    (r) => r.kind === 'pong' || r.kind === 'kong'
  );
  if (pongKongReactions.length > 0) {
    return pongKongReactions[0];
  }

  // Priority 3: Chi
  const chiReactions = reactions.filter((r) => r.kind === 'chi');
  if (chiReactions.length > 0) {
    return chiReactions[0];
  }

  return null;
}

// Check if a player can win on a discard (based on lao rules)
function canWinOnDiscard(
  state: GameState,
  winnerIndex: number,
  discardPlayerIndex: number
): boolean {
  const laoCount = state.laoCount;

  // At 3+ lao: dealer can win off anyone, non-dealers can win off dealer
  if (laoCount >= 3) {
    const winnerIsDealer = state.players[winnerIndex].isDealer;
    const discarderIsDealer = state.players[discardPlayerIndex].isDealer;

    // Non-dealers cannot win off other non-dealers
    if (!winnerIsDealer && !discarderIsDealer) return false;

    return true;
  }

  // At 1-2 lao: only self-draw wins are allowed (杭州麻将规则)
  return false;
}

// Check if chi claim is valid (must be from the player to the left)
export function isValidChiClaim(
  discardPlayerIndex: number,
  claimantIndex: number
): boolean {
  return isNextPlayer(discardPlayerIndex, claimantIndex);
}

// Check if player i is next after player j (in counter-clockwise order)
function isNextPlayer(from: number, to: number): boolean {
  // In mahjong, players go counter-clockwise: 0→1→2→3→0
  // Actually, in our layout: bottom(0)→right(1)→top(2)→left(3)→bottom(0)
  return (from + 1) % 4 === to;
}

// Get the next player index (counter-clockwise)
export function getNextPlayerIndex(current: number): number {
  return (current + 1) % 4;
}

// Check if a self-draw kong (暗杠) action is valid
export function canConcealedKong(
  hand: Tile[],
  meldCount: number,
  _wallRemaining: number
): boolean {
  // Must have 4 identical tiles in hand
  // Must have enough tiles remaining (4 melds total max)
  if (meldCount >= 4) return false;

  const anKongOptions = getAnKongOptions(hand);
  return anKongOptions.length > 0;
}

// Check if jia gang (加杠) is valid
export function canJiaGang(hand: Tile[], melds: { kind: string; tiles: Tile[] }[]): boolean {
  const options = getJiaGangOptions(hand, melds as Meld[]);
  return options.length > 0;
}

// Check for 漏胡 (missed hu): if player passed on a hu-able tile,
// they cannot hu on the same tile again in the same round
export function isLouHu(
  tile: Tile,
  playerIndex: number,
  passedReactions: Record<number, Set<number>>
): boolean {
  const tileCode = tileTypeToCode(tile.type);
  return passedReactions[playerIndex]?.has(tileCode) ?? false;
}

// Check for 漏碰 (missed pong): same logic as 漏胡 but for pong
export function isLouPong(
  tile: Tile,
  playerIndex: number,
  passedReactions: Record<number, Set<number>>
): boolean {
  return isLouHu(tile, playerIndex, passedReactions);
}

// Check if wall is exhausted (流局)
export function isWallExhausted(wallRemaining: number, threshold: number = 20): boolean {
  return wallRemaining <= threshold;
}

// Check for 十风 (10 consecutive wind/honor discards)
export function isTenWinds(discards: Tile[]): boolean {
  if (discards.length < 10) return false;
  const last10 = discards.slice(-10);
  return last10.every((t) => 'honor' in t.type);
}

// Update exposure counts for 三摊承包 tracking
export function updateExposureCounts(
  exposureCounts: Record<string, number>,
  fromPlayer: number,
  toPlayer: number
): Record<string, number> {
  const key = `${fromPlayer}->${toPlayer}`;
  const updated = { ...exposureCounts };
  updated[key] = (updated[key] || 0) + 1;
  return updated;
}
