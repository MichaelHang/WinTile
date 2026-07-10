// ============================================================
// Hangzhou Mahjong (杭州麻将) - Win Detection
// ============================================================

import type { Tile, TileType, Meld, WinResult, WinForm } from './types';
import {
  tileTypeToCode,
  isSuitTile,
  isFortuneTile,
} from './tile';
import { handToCounts } from './hand';
import { TOTAL_TILE_TYPES } from './constants';

// Main win check entry point
export function checkWin(
  hand: Tile[],
  melds: Meld[],
  _lastTile: Tile,
  fortuneTileType: TileType | null,
  options: {
    fromDraw: boolean;
    fromDiscard: boolean;
    discardPlayer?: number;
    drewFromKong?: boolean;
  }
): WinResult | null {
  const totalTilesInHand = hand.length;
  const existingMeldCount = melds.reduce((sum) => {
    return sum + 1;
  }, 0);

  const remainingMeldsNeeded = 4 - existingMeldCount;

  if (totalTilesInHand < 2) return null;

  // Count fortune tiles in the full hand
  const fortuneCount = hand.filter(t => 'honor' in t.type && t.type.honor === 'bai').length;

  // If fortune tile type is null (before round start), use 白板
  const fortuneType = fortuneTileType || { honor: 'bai' as const };

  // Try standard form: check if hand + melds = 4 melds + 1 pair
  const standardResult = checkStandardForm(
    hand,
    melds,
    remainingMeldsNeeded,
    fortuneType,
    options,
    _lastTile
  );

  if (standardResult) return standardResult;

  // Try seven pairs form (only if no existing melds)
  if (existingMeldCount === 0 && hand.length === 14) {
    const sevenPairsResult = checkSevenPairsForm(
      hand,
      fortuneCount,
      fortuneType,
      options
    );
    if (sevenPairsResult) return sevenPairsResult;
  }

  return null;
}

// Count kongs in existing melds and determine gangKai
function countKongs(melds: Meld[]): number {
  const kongKinds = ['ankong', 'mingkong', 'jiagang' as const];
  return melds.filter((m) => kongKinds.includes(m.kind)).length;
}

// Check standard form: 4 melds + 1 pair
function checkStandardForm(
  hand: Tile[],
  existingMelds: Meld[],
  remainingMeldsNeeded: number,
  fortuneType: TileType,
  options: { fromDraw: boolean; fromDiscard: boolean; discardPlayer?: number; drewFromKong?: boolean },
  _lastTile: Tile
): WinResult | null {
  const counts = handToCounts(hand);

  // Count kongs for gangKai determination
  // 杠开 only applies if the current draw was from a kong replacement
  const gangCount = countKongs(existingMelds);
  const isGangKai = options.fromDraw && options.drewFromKong === true;

  // Remove fortune tiles from counts (they're handled separately)
  const fortuneCode = tileTypeToCode(fortuneType);
  const actualFortuneCount = counts[fortuneCode];
  counts[fortuneCode] = 0;

  // Try each possible pair
  for (let pairCode = 0; pairCode < TOTAL_TILE_TYPES; pairCode++) {
    // Skip the fortune tile type itself (it was removed)
    if (pairCode === fortuneCode) continue;

    // Try with 2 of the same tile as pair
    if (counts[pairCode] >= 2) {
      counts[pairCode] -= 2;
      const decomposition = tryDecomposeStandard(
        counts,
        actualFortuneCount,
        remainingMeldsNeeded
      );
      counts[pairCode] += 2;

      if (decomposition) {
        // With 2+ fortune tiles, also check if using 1 fortune as pair wildcard gives 爆头
        let isBaoTou = false;
        if (actualFortuneCount >= 2) {
          // Try: pair = 1 tile (pairCode) + 1 fortune, remaining fortunes for melds
          counts[pairCode] -= 1;
          const baoTouDecomposition = tryDecomposeStandard(
            counts,
            actualFortuneCount - 1,
            remainingMeldsNeeded
          );
          counts[pairCode] += 1;

          if (baoTouDecomposition) {
            // Check if the extra fortune was actually needed (i.e., used as wildcard in a meld)
            const testCounts = [...counts];
            const withoutExtraFortune = tryDecomposeStandard(
              testCounts,
              actualFortuneCount - 2,
              remainingMeldsNeeded
            );
            if (!withoutExtraFortune) {
              // Extra fortune was essential → it's used as wildcard in a meld → 爆头
              isBaoTou = true;
            }
          }

          // Also check: non-fortune tiles form exactly 4 groups → 爆头 (self-draw only)
          // This covers the case where you have 4 groups + 2 fortune tiles,
          // meaning before drawing you had 4 groups + 1 fortune (爆头 state)
          if (!isBaoTou && options.fromDraw) {
            const noFortuneCounts = [...counts];
            const noFortuneDecomposition = tryDecomposeStandard(
              noFortuneCounts,
              0,
              remainingMeldsNeeded
            );
            if (noFortuneDecomposition) {
              isBaoTou = true;
            }
          }
          // Most general check for 2+ fortunes: was the player in 爆头 state BEFORE drawing?
          // If so, any draw is 爆头.
          if (!isBaoTou && options.fromDraw) {
            const prevHand = hand.filter((t) => t.id !== _lastTile.id);
            if (isBaoTouState(prevHand, existingMelds, fortuneType)) {
              isBaoTou = true;
            }
          }
        }

        // 1 fortune case: was the player in 爆头 state BEFORE drawing?
        // (This path was previously missed — only 2+ fortunes had the check above.)
        if (!isBaoTou && options.fromDraw && actualFortuneCount === 1) {
          const prevHand = hand.filter((t) => t.id !== _lastTile.id);
          if (isBaoTouState(prevHand, existingMelds, fortuneType)) {
            isBaoTou = true;
          }
        }

        const colorPatterns = detectColorPatterns(hand, existingMelds, fortuneType);
        return buildWinResult(
          hand,
          existingMelds,
          'standard',
          options,
          fortuneType,
          isBaoTou,
          false,
          0,
          isGangKai,
          gangCount,
          actualFortuneCount > 0,
          false,
          false,
          0,
          colorPatterns.isQingYiSe,
          colorPatterns.isHunYiSe,
          colorPatterns.isZiYiSe
        );
      }
    }

    // Try with 1 tile + 1 fortune as pair
    if (counts[pairCode] >= 1 && actualFortuneCount >= 1) {
      counts[pairCode] -= 1;
      const decomposition = tryDecomposeStandard(
        counts,
        actualFortuneCount - 1,
        remainingMeldsNeeded
      );
      counts[pairCode] += 1;

      if (decomposition) {
        // 爆头: exactly 1 fortune tile forms the pair with a regular tile,
        // and all other tiles form 4 melds.
        let isBaoTou = actualFortuneCount === 1;
        // Also check: was in 爆头 state before drawing (for 2+ fortune tiles)
        if (!isBaoTou && options.fromDraw) {
          const prevHand = hand.filter((t) => t.id !== _lastTile.id);
          if (isBaoTouState(prevHand, existingMelds, fortuneType)) {
            isBaoTou = true;
          }
        }
        const colorPatterns = detectColorPatterns(hand, existingMelds, fortuneType);
        return buildWinResult(
          hand,
          existingMelds,
          'standard',
          options,
          fortuneType,
          isBaoTou,
          false,
          0,
          isGangKai,
          gangCount,
          actualFortuneCount > 0,
          false,
          false,
          0,
          colorPatterns.isQingYiSe,
          colorPatterns.isHunYiSe,
          colorPatterns.isZiYiSe
        );
      }
    }

    // Try with 2 fortunes as pair
    if (actualFortuneCount >= 2) {
      const decomposition = tryDecomposeStandard(
        counts,
        actualFortuneCount - 2,
        remainingMeldsNeeded
      );
      if (decomposition) {
        // 爆头 check: was the player in 爆头 state BEFORE drawing?
        let isBaoTou = false;
        if (options.fromDraw) {
          // Method 1: non-fortune tiles form exactly 4 groups
          const noFortuneCounts = [...counts];
          const noFortuneDecomposition = tryDecomposeStandard(
            noFortuneCounts,
            0,
            remainingMeldsNeeded
          );
          if (noFortuneDecomposition) {
            isBaoTou = true;
          }
          // Method 2: was in 爆头 state before drawing
          if (!isBaoTou) {
            const prevHand = hand.filter((t) => t.id !== _lastTile.id);
            if (isBaoTouState(prevHand, existingMelds, fortuneType)) {
              isBaoTou = true;
            }
          }
        }
        return buildWinResult(
          hand,
          existingMelds,
          'standard',
          options,
          fortuneType,
          isBaoTou,
          false,
          0,
          isGangKai,
          gangCount,
          actualFortuneCount > 0
        );
      }
    }
  }

  return null;
}

// Recursive decomposition of remaining tiles into melds
function tryDecomposeStandard(
  counts: number[],
  fortuneCount: number,
  meldsNeeded: number
): boolean {
  // Base case: all melds formed
  if (meldsNeeded === 0) {
    // Check if all non-fortune tiles are used
    return counts.every((c) => c === 0);
  }

  // Find first non-zero position
  let startPos = -1;
  for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
    if (counts[i] > 0) {
      startPos = i;
      break;
    }
  }

  if (startPos === -1) {
    // No more tiles but still need melds → use fortunes only
    // 3 fortunes can form a triplet
    if (fortuneCount >= 3) {
      return tryDecomposeStandard(counts, fortuneCount - 3, meldsNeeded - 1);
    }
    return false;
  }

  const i = startPos;

  // === TRY SEQUENCE FIRST (only for suit tiles) ===
  // Sequences are tried first because greedy triplet extraction can miss valid decompositions
  // Example: 1筒2筒3筒3筒3筒白板白板东 with pair=3筒3筒
  //   Greedy: 3筒3筒3筒(triplet) -> 1筒2筒 left, can't form meld
  //   Correct: 1筒2筒白板(seq, 白板=3筒) -> 3筒白板东 -> 白板白板东(triplet, 白板=东)
  if (canStartSequence(i)) {
    // Sequence without fortune
    if (counts[i] >= 1 && counts[i + 1] >= 1 && counts[i + 2] >= 1) {
      counts[i]--;
      counts[i + 1]--;
      counts[i + 2]--;
      if (tryDecomposeStandard(counts, fortuneCount, meldsNeeded - 1)) {
        counts[i]++;
        counts[i + 1]++;
        counts[i + 2]++;
        return true;
      }
      counts[i]++;
      counts[i + 1]++;
      counts[i + 2]++;
    }

    // Sequence with 1 fortune: fortune fills one of the 3 positions
    // Count how many of the 3 sequence tiles we have
    const seqCount = (counts[i] > 0 ? 1 : 0) + (counts[i + 1] > 0 ? 1 : 0) + (counts[i + 2] > 0 ? 1 : 0);
    if (seqCount >= 2 && fortuneCount >= 1) {
      // We need exactly 2 real tiles + 1 fortune to form the sequence
      // Try all 3 possibilities for which position the fortune fills
      for (let pos = 0; pos < 3; pos++) {
        const idx = i + pos;
        if (counts[idx] === 0) {
          // Fortune fills this position, the other 2 must be real
          const other1 = i + ((pos + 1) % 3);
          const other2 = i + ((pos + 2) % 3);
          if (counts[other1] >= 1 && counts[other2] >= 1) {
            counts[other1]--;
            counts[other2]--;
            if (tryDecomposeStandard(counts, fortuneCount - 1, meldsNeeded - 1)) {
              counts[other1]++;
              counts[other2]++;
              return true;
            }
            counts[other1]++;
            counts[other2]++;
          }
        }
      }
    }

    // Sequence with 2 fortunes: 1 real + 2 fortunes
    if (seqCount >= 1 && fortuneCount >= 2) {
      // The one real tile can be at any of the 3 positions
      for (let pos = 0; pos < 3; pos++) {
        const idx = i + pos;
        if (counts[idx] >= 1) {
          counts[idx]--;
          if (tryDecomposeStandard(counts, fortuneCount - 2, meldsNeeded - 1)) {
            counts[idx]++;
            return true;
          }
          counts[idx]++;
          break; // Only need to try once since positions are symmetric with fortunes
        }
      }
    }
  }

  // === TRY TRIPLET (without fortune) ===
  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (tryDecomposeStandard(counts, fortuneCount, meldsNeeded - 1)) {
      counts[i] += 3;
      return true;
    }
    counts[i] += 3;
  }

  // === TRY TRIPLET WITH 1 FORTUNE (2 real + 1 fortune) ===
  if (counts[i] >= 2 && fortuneCount >= 1) {
    counts[i] -= 2;
    if (tryDecomposeStandard(counts, fortuneCount - 1, meldsNeeded - 1)) {
      counts[i] += 2;
      return true;
    }
    counts[i] += 2;
  }

  // === TRY TRIPLET WITH 2 FORTUNES (1 real + 2 fortunes) ===
  if (counts[i] >= 1 && fortuneCount >= 2) {
    counts[i] -= 1;
    if (tryDecomposeStandard(counts, fortuneCount - 2, meldsNeeded - 1)) {
      counts[i] += 1;
      return true;
    }
    counts[i] += 1;
  }

  return false;
}

// Check if position i can be the start of a valid sequence
// Sequences can only be within the same suit (0-8: wan, 9-17: tiao, 18-26: tong)
function canStartSequence(i: number): boolean {
  // i must be a suit tile and i+2 must be in the same suit block
  if (i >= 27) return false; // Honors can't form sequences
  const posInSuit = i % 9;
  return posInSuit <= 6; // Need i, i+1, i+2 all within same 9-tile suit block
}

// Check seven pairs form
function checkSevenPairsForm(
  hand: Tile[],
  _fortuneCount: number,
  fortuneType: TileType,
  options: { fromDraw: boolean; fromDiscard: boolean; discardPlayer?: number; drewFromKong?: boolean }
): WinResult | null {
  const counts = handToCounts(hand);
  const fortuneCode = tileTypeToCode(fortuneType);
  const actualFortuneCount = counts[fortuneCode];
  counts[fortuneCode] = 0;

  let pairsFound = 0;
  let remainingFortune = actualFortuneCount;
  let luxuryCount = 0;
  let hasFortuneInHand = actualFortuneCount > 0;

  for (let code = 0; code < TOTAL_TILE_TYPES; code++) {
    if (code === fortuneCode) continue;

    if (counts[code] >= 4) {
      // 4 identical tiles = 2 pairs
      pairsFound += 2;
      luxuryCount++;
      counts[code] -= 4;
    }

    if (counts[code] >= 2) {
      const pairs = Math.floor(counts[code] / 2);
      pairsFound += pairs;
      counts[code] -= pairs * 2;
    }

    // Remaining single tile needs a fortune to pair with
    if (counts[code] >= 1) {
      if (remainingFortune > 0) {
        pairsFound++;
        remainingFortune--;
        counts[code]--;
      }
    }
  }

  // Remaining fortunes pair with each other (2 fortunes = 1 pair)
  while (remainingFortune >= 2) {
    pairsFound++;
    remainingFortune -= 2;
  }

  // If 1 fortune remains and there are other unpaired tiles, it could pair
  // But this case is handled above in the single-tile + fortune loop

  if (pairsFound >= 7) {
    const isPure = actualFortuneCount === 0;

    const colorPatterns = detectColorPatterns(hand, [], fortuneType);
    return buildWinResult(
      hand,
      [],
      'sevenPairs',
      options,
      fortuneType,
      false, // isBaoTou
      false, // isCaiPiao
      0,
      false, // isGangKai
      0,
      hasFortuneInHand,
      isPure,
      luxuryCount > 0,
      luxuryCount,
      colorPatterns.isQingYiSe,
      colorPatterns.isHunYiSe,
      colorPatterns.isZiYiSe
    );
  }

  return null;
}



// Check if the hand is清一色 (Pure One Suit - all tiles from same suit)
export function isQingYiSe(
  hand: Tile[],
  melds: Meld[],
  fortuneType: TileType | null
): boolean {
  // Get all tiles (hand + melds)
  const allTiles: Tile[] = [...hand];
  for (const meld of melds) {
    allTiles.push(...meld.tiles);
  }
  
  // Filter out fortune tiles
  const nonFortuneTiles = allTiles.filter(t => 
    fortuneType ? !isFortuneTile(t.type) : true
  );
  
  if (nonFortuneTiles.length === 0) return false;
  
  // Check if all non-fortune tiles are suit tiles from the same suit
  let targetSuit: string | null = null;
  
  for (const tile of nonFortuneTiles) {
    if (!isSuitTile(tile.type)) {
      // Honor tile found - not清一色
      return false;
    }
    
    if (targetSuit === null) {
      targetSuit = tile.type.suit;
    } else if (tile.type.suit !== targetSuit) {
      // Different suit found - not清一色
      return false;
    }
  }
  
  return true;
}

// Check if the hand is混一色 (Half Flush - one suit + honors)
export function isHunYiSe(
  hand: Tile[],
  melds: Meld[],
  fortuneType: TileType | null
): boolean {
  // Get all tiles (hand + melds)
  const allTiles: Tile[] = [...hand];
  for (const meld of melds) {
    allTiles.push(...meld.tiles);
  }
  
  // Filter out fortune tiles
  const nonFortuneTiles = allTiles.filter(t => 
    fortuneType ? !isFortuneTile(t.type) : true
  );
  
  if (nonFortuneTiles.length === 0) return false;
  
  // Check if all non-fortune tiles are from one suit + honors
  let targetSuit: string | null = null;
  let hasHonor = false;
  let hasSuit = false;
  
  for (const tile of nonFortuneTiles) {
    if (isSuitTile(tile.type)) {
      hasSuit = true;
      if (targetSuit === null) {
        targetSuit = tile.type.suit;
      } else if (tile.type.suit !== targetSuit) {
        // Different suit found
        return false;
      }
    } else {
      hasHonor = true;
    }
  }
  
  // Must have both suit tiles and honor tiles for混一色
  return hasSuit && hasHonor;
}

// Check if the hand is字一色 (All Honors)
export function isZiYiSe(
  hand: Tile[],
  melds: Meld[],
  fortuneType: TileType | null
): boolean {
  // Get all tiles (hand + melds)
  const allTiles: Tile[] = [...hand];
  for (const meld of melds) {
    allTiles.push(...meld.tiles);
  }
  
  // Filter out fortune tiles
  const nonFortuneTiles = allTiles.filter(t => 
    fortuneType ? !isFortuneTile(t.type) : true
  );
  
  if (nonFortuneTiles.length === 0) return false;
  
  // Check if all non-fortune tiles are honor tiles
  return nonFortuneTiles.every(t => !isSuitTile(t.type));
}

// Check if the hand is in 爆头 (Bao Tou) state
// Player has 4 complete melds + 1 fortune tile → any drawn tile wins
export function isBaoTouState(
  hand: Tile[],
  melds: Meld[],
  fortuneType: TileType | null
): boolean {
  if (!fortuneType) return false;

  const existingMeldCount = melds.length;
  const remainingMeldsNeeded = 4 - existingMeldCount;
  if (remainingMeldsNeeded < 0) return false;

  const counts = handToCounts(hand);
  const fortuneCode = tileTypeToCode(fortuneType);
  const fortuneCount = counts[fortuneCode] || 0;

  // Need at least 1 fortune tile in hand (for the pair)
  if (fortuneCount < 1) return false;

  // Remove 1 fortune tile for the pair, keep the rest for meld wildcards
  counts[fortuneCode] = 0;
  const remainingFortunes = fortuneCount - 1;

  // Check that remaining hand can form 4 melds using available fortune tiles as wildcards
  return tryDecomposeStandard(counts, remainingFortunes, remainingMeldsNeeded);
}

// Check if player has 财飘 opportunity (can voluntarily discard fortune for multiplier)
export function canCaiPiao(
  hand: Tile[],
  melds: Meld[],
  fortuneType: TileType | null
): boolean {
  if (!fortuneType) return false;

  const counts = handToCounts(hand);
  const fortuneCode = tileTypeToCode(fortuneType);
  const fortuneCount = counts[fortuneCode] || 0;

  // Need at least 2 fortune tiles (discard 1, keep 1 for 爆头)
  if (fortuneCount < 2) return false;

  // After discarding one fortune, check if remaining hand is in 爆头 state
  const newCounts = [...counts];
  newCounts[fortuneCode] -= 1; // Discard one fortune

  // Check if remaining tiles + 1 fortune can form 爆头
  // This means: 4 melds from non-fortune tiles + 1 fortune remaining
  const remainingFortune = newCounts[fortuneCode];
  newCounts[fortuneCode] = 0;

  // We need: 4 melds from remaining tiles, and exactly 1 fortune left
  return remainingFortune >= 1 && tryDecomposeStandard(newCounts, 0, 4 - melds.length);
}



// Helper to detect color patterns (清一色,混一色,字一色)
function detectColorPatterns(
  hand: Tile[],
  existingMelds: Meld[],
  fortuneType: TileType
): { isQingYiSe: boolean; isHunYiSe: boolean; isZiYiSe: boolean } {
  return {
    isQingYiSe: isQingYiSe(hand, existingMelds, fortuneType),
    isHunYiSe: isHunYiSe(hand, existingMelds, fortuneType),
    isZiYiSe: isZiYiSe(hand, existingMelds, fortuneType),
  };
}

// Build a WinResult from detected win patterns
function buildWinResult(
  _hand: Tile[],
  existingMelds: Meld[],
  form: WinForm,
  options: { fromDraw: boolean; fromDiscard: boolean; discardPlayer?: number; drewFromKong?: boolean },
  fortuneType: TileType,
  isBaoTou: boolean,
  isCaiPiao: boolean,
  piaoCount: number,
  isGangKai: boolean,
  gangCount: number,
  hasFortune: boolean,
  isPure: boolean = false,
  isLuxury: boolean = false,
  luxuryCount: number = 0,
  isQingYiSe: boolean = false,
  isHunYiSe: boolean = false,
  isZiYiSe: boolean = false
): WinResult {
  return {
    winner: -1, // Filled in by caller
    form,
    fromWall: options.fromDraw,
    isBaoTou,
    isCaiPiao,
    piaoCount,
    isGangKai,
    gangCount,
    isGangBao: isBaoTou && isGangKai,
    hasFortune,
    isPure,
    isLuxury,
    luxuryCount,
    melds: existingMelds,
    pair: [
      { id: '', type: fortuneType },
      { id: '', type: fortuneType },
    ], // Placeholder, filled by caller if needed
    isQingYiSe,
    isHunYiSe,
    isZiYiSe,
  };
}

// Check minimum tai requirement (至少有1台才能胡)
export function hasMinimumTai(
  winResult: WinResult,
  _hand: Tile[],
  _melds: Meld[]
): boolean {
  // In Hangzhou mahjong, any winning hand with a fortune tile has at least 1台
  if (winResult.hasFortune) return true;
  // 爆头 gives at least 2台
  if (winResult.isBaoTou) return true;
  // 七对 gives at least 2台
  if (winResult.form === 'sevenPairs') return true;
  // 杠开 gives at least 2台
  if (winResult.isGangKai) return true;
  // Standard form without fortune: in traditional rules, this can be 平胡 (1台) if self-drawn
  // For simplicity, we allow all self-draw wins
  if (winResult.fromWall) return true;

  return false;
}
