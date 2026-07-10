// ============================================================
// Hangzhou Mahjong (杭州麻将) - AI Strategy Engine
// ============================================================

import type { Tile, TileType, GameState, AIAction, Suit } from './types';
import { tileTypeToCode, isSameType, isSuitTile, isFortuneTile, createTile, codeToTileType } from './tile';
import { handToCounts, getChiOptions, canPong, canMingKong, getAnKongOptions } from './hand';
import { checkWin, hasMinimumTai, canCaiPiao } from './win';
import { TOTAL_TILE_TYPES } from './constants';
// === Shanten Cache ===
// Cache shanten calculations to avoid redundant computations
const shantenCache = new Map<string, number>();

function getShantenCacheKey(counts: number[], fortuneCount: number, meldCount: number): string {
  return `${counts.join(',')}_${fortuneCount}_${meldCount}`;
}

function calculateShantenCached(
  hand: Tile[],
  meldCount: number,
  fortuneType: TileType | null
): ShantenResult {
  const counts = handToCounts(hand);
  let fortuneCount = 0;

  if (fortuneType) {
    const fortuneCode = tileTypeToCode(fortuneType);
    fortuneCount = counts[fortuneCode] || 0;
    counts[fortuneCode] = 0;
  }

  const cacheKey = getShantenCacheKey(counts, fortuneCount, meldCount);
  const cached = shantenCache.get(cacheKey);
  if (cached !== undefined) {
    return { shanten: cached, form: cached <= calcSevenPairsShanten(counts, fortuneCount) ? 'standard' : 'sevenPairs' };
  }

  const result = calculateShanten(hand, meldCount, fortuneType);
  shantenCache.set(cacheKey, result.shanten);
  
  // Limit cache size
  if (shantenCache.size > 10000) {
    const firstKey = shantenCache.keys().next().value;
    if (firstKey) shantenCache.delete(firstKey);
  }
  
  return result;
}

// Clear cache when needed
export function clearShantenCache() {
  shantenCache.clear();
}





// === 性能优化：预计算查找表 ===

// 清除所有缓存
export function clearAllCaches() {
  shantenCache.clear();
}

// === 读牌功能：分析牌河推测对手手牌 ===

// 分析牌河中已打出的牌
function analyzeDiscardCounts(
  currentRoundDiscards: { tile: TileType; playerIndex: number }[]
): number[] {
  const counts = new Array(TOTAL_TILE_TYPES).fill(0);
  for (const d of currentRoundDiscards) {
    const code = tileTypeToCode(d.tile);
    counts[code]++;
  }
  return counts;
}

// 判断一张牌是否安全（打出后不容易被别人胡）
function getTileSafetyScore(
  tile: Tile,
  currentRoundDiscards: { tile: TileType; playerIndex: number }[]
): number {
  const code = tileTypeToCode(tile.type);
  const discardCounts = analyzeDiscardCounts(currentRoundDiscards);
  
  let safety = 0;
  
  // 已经被打出3张的牌非常安全（不可能有人需要）
  if (discardCounts[code] >= 3) safety += 10;
  // 已经被打出2张的牌较安全
  else if (discardCounts[code] >= 2) safety += 5;
  // 已经被打出1张的牌相对安全
  else if (discardCounts[code] >= 1) safety += 2;
  
  // 字牌通常更安全（边张效应）
  if ('honor' in tile.type) {
    safety += 3;
  }
  
  // 边张牌（1、9）相对安全
  if (isSuitTile(tile.type) && (tile.type.rank === 1 || tile.type.rank === 9)) {
    safety += 1;
  }
  
  return safety;
}

// === 听牌选择：计算每种打法的进张数 ===

// 计算打出某张牌后的听牌进张数
function countTenpaiWaitingTiles(
  hand: Tile[],
  discardTileId: string,
  meldCount: number,
  fortuneType: TileType | null
): number {
  const handWithout = hand.filter(t => t.id !== discardTileId);
  if (handWithout.length === 0) return 0;
  
  const shanten = calculateShantenCached(handWithout, meldCount, fortuneType).shanten;
  if (shanten !== 0) return 0; // 不是听牌状态
  
  let waitingCount = 0;
  const counts = handToCounts(handWithout);
  
  // 检查每种可能的牌是否能胡
  for (let code = 0; code < TOTAL_TILE_TYPES; code++) {
    if (fortuneType && code === tileTypeToCode(fortuneType)) continue;
    if (counts[code] >= 4) continue;
    
    const tile = codeToTileType(code);
    const newTile = createTile(tile);
    const newHand = [...handWithout, newTile];
    
    const winResult = checkWin(newHand, [], newTile, fortuneType, {
      fromDraw: true,
      fromDiscard: false
    });
    
    if (winResult) {
      waitingCount += 4 - counts[code];
    }
  }
  
  return waitingCount;
}

// 选择最佳听牌（进张最多的打法）
function findBestTenpaiDiscard(
  hand: Tile[],
  meldCount: number,
  fortuneType: TileType | null
): { tileId: string; waitingCount: number } | null {
  const nonFortuneTiles = hand.filter(t => !isFortuneTile(t.type));
  if (nonFortuneTiles.length === 0) return null;
  
  let bestTile = nonFortuneTiles[0];
  let bestWaiting = 0;
  
  for (const tile of nonFortuneTiles) {
    const waiting = countTenpaiWaitingTiles(hand, tile.id, meldCount, fortuneType);
    if (waiting > bestWaiting) {
      bestWaiting = waiting;
      bestTile = tile;
    }
  }
  
  return bestWaiting > 0 ? { tileId: bestTile.id, waitingCount: bestWaiting } : null;
}



// === Tile Efficiency Analysis ===

// === Shanten Calculator ===

interface ShantenResult {
  shanten: number; // -1 = complete, 0 = tenpai, 1 = iishanten, etc.
  form: 'standard' | 'sevenPairs';
}

// Calculate shanten number for both forms, return the better one
export function calculateShanten(
  hand: Tile[],
  meldCount: number,
  fortuneType: TileType | null
): ShantenResult {
  const counts = handToCounts(hand);
  let fortuneCount = 0;

  if (fortuneType) {
    const fortuneCode = tileTypeToCode(fortuneType);
    fortuneCount = counts[fortuneCode] || 0;
    counts[fortuneCode] = 0; // Remove fortune tiles from counts for standard analysis
  }

  const remainingMelds = 4 - meldCount;

  // Standard form shanten
  const standardShanten = calcStandardShanten(counts, fortuneCount, remainingMelds);

  // Seven pairs shanten (only if no melds)
  const sevenShanten = meldCount === 0
    ? calcSevenPairsShanten(counts, fortuneCount)
    : 99;

  const bestShanten = Math.min(standardShanten, sevenShanten);

  return {
    shanten: bestShanten,
    form: sevenShanten <= standardShanten ? 'sevenPairs' : 'standard',
  };
}

// Standard form shanten calculation
function calcStandardShanten(
  counts: number[],
  fortuneCount: number,
  targetMelds: number
): number {
  let bestShanten = 8; // Worst case

  // Try each possible pair
  for (let pairCode = 0; pairCode < TOTAL_TILE_TYPES; pairCode++) {
    if (counts[pairCode] >= 2) {
      const tempCounts = [...counts];
      tempCounts[pairCode] -= 2;
      const { melds, partials } = countMeldsAndPartials(tempCounts);

      const needMelds = Math.max(0, targetMelds - melds);
      const canFormWithFortune = Math.min(needMelds, Math.floor((partials * 2 + fortuneCount * 3) / 3));
      const actualMelds = melds + canFormWithFortune;
      const missingMelds = Math.max(0, targetMelds - actualMelds);

      const shantenSimp = missingMelds * 2 - Math.min(1, Math.floor((partials + fortuneCount - canFormWithFortune * 2) / 2));
      bestShanten = Math.min(bestShanten, Math.max(0, shantenSimp));
    }

    // Use 1 tile + 1 fortune as pair
    if (counts[pairCode] >= 1 && fortuneCount >= 1) {
      const tempCounts = [...counts];
      tempCounts[pairCode] -= 1;
      const { melds, partials } = countMeldsAndPartials(tempCounts);
      const fRemaining = fortuneCount - 1;

      const needMelds = Math.max(0, targetMelds - melds);
      const canFormWithFortune = Math.min(needMelds, Math.floor((partials * 2 + fRemaining * 3) / 3));
      const actualMelds = melds + canFormWithFortune;
      const missingMelds = Math.max(0, targetMelds - actualMelds);

      const shantenSimp = missingMelds * 2 - Math.min(1, Math.floor((partials + fRemaining - canFormWithFortune * 2) / 2));
      bestShanten = Math.min(bestShanten, Math.max(0, shantenSimp));
    }
  }

  // Also try using 2 fortunes as pair
  if (fortuneCount >= 2) {
    const { melds, partials } = countMeldsAndPartials(counts);
    const fRemaining = fortuneCount - 2;

    const needMelds = Math.max(0, targetMelds - melds);
    const canFormWithFortune = Math.min(needMelds, Math.floor((partials * 2 + fRemaining * 3) / 3));
    const actualMelds = melds + canFormWithFortune;
    const missingMelds = Math.max(0, targetMelds - actualMelds);

    const shantenSimp = missingMelds * 2;
    bestShanten = Math.min(bestShanten, Math.max(0, shantenSimp));
  }

  return bestShanten;
}

// Count complete melds and partial sets from a count array
// IMPORTANT: Try sequences BEFORE triplets to avoid greedy decomposition issues
// Example: 1筒2筒3筒3筒3筒 should be 1 sequence + 1 pair, not 1 triplet + 1 partial
function countMeldsAndPartials(counts: number[]): { melds: number; partials: number } {
  let melds = 0;
  let partials = 0;
  const temp = [...counts];

  // First pass: extract sequences (only for suit tiles)
  // Try sequences before triplets to find optimal decomposition
  for (let i = 0; i < 27; i++) {
    const posInSuit = i % 9;
    if (posInSuit > 6) continue;

    while (temp[i] >= 1 && temp[i + 1] >= 1 && temp[i + 2] >= 1) {
      temp[i]--;
      temp[i + 1]--;
      temp[i + 2]--;
      melds++;
    }
  }

  // Second pass: extract complete triplets
  for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
    while (temp[i] >= 3) {
      temp[i] -= 3;
      melds++;
    }
  }

  // Count partial sets (pairs and near-sequences)
  let pairs = 0;
  for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
    if (temp[i] >= 2) {
      pairs++;
      temp[i] -= 2;
    }
  }

  let nearSeq = 0;
  for (let i = 0; i < 27; i++) {
    const posInSuit = i % 9;
    if (posInSuit > 6) continue;

    const count = (temp[i] > 0 ? 1 : 0) + (temp[i + 1] > 0 ? 1 : 0) + (temp[i + 2] > 0 ? 1 : 0);
    if (count >= 2) {
      nearSeq++;
      const toRemove = 2;
      let removed = 0;
      if (temp[i] > 0 && removed < toRemove) { temp[i]--; removed++; }
      if (temp[i + 1] > 0 && removed < toRemove) { temp[i + 1]--; removed++; }
      if (temp[i + 2] > 0 && removed < toRemove) { temp[i + 2]--; removed++; }
    }
  }

  partials = pairs + nearSeq;

  return { melds, partials };
}

// Seven pairs shanten calculation
function calcSevenPairsShanten(counts: number[], fortuneCount: number): number {
  let pairsFound = 0;
  let singles = 0;
  const temp = [...counts];

  for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
    if (temp[i] >= 2) {
      const p = Math.floor(temp[i] / 2);
      pairsFound += p;
      temp[i] -= p * 2;
    }
    if (temp[i] >= 1) {
      singles++;
    }
  }

  const fortunePairs = Math.min(singles, fortuneCount);
  pairsFound += fortunePairs;
  singles -= fortunePairs;
  const remainingFortune = fortuneCount - fortunePairs;
  pairsFound += Math.floor(remainingFortune / 2);

  return Math.max(0, 7 - pairsFound);
}

// === Discard Selection ===

// Pick the best tile to discard
export function pickDiscard(
  hand: Tile[],
  fortuneType: TileType | null,
  meldCount: number,
  difficulty: 'easy' | 'medium' | 'hard',
  discardHistory?: { tile: TileType; playerIndex: number }[]
): string {
  if (hand.length === 0) return '';

  // Never discard fortune tiles if we have alternatives
  const nonFortuneTiles = hand.filter((t) => !isFortuneTile(t.type));
  if (nonFortuneTiles.length === 0) {
    return hand[hand.length - 1].id;
  }

  // === EASY AI: Basic strategy with shanten awareness ===
  if (difficulty === 'easy') {
    let bestTile = nonFortuneTiles[0];
    let bestScore = Infinity;

    const currentShanten = calculateShantenCached(hand, meldCount, fortuneType).shanten;

    for (const tile of nonFortuneTiles) {
      const handWithout = hand.filter((t) => t.id !== tile.id);
      const newShanten = calculateShantenCached(handWithout, meldCount, fortuneType).shanten;
      
      // Base score: prefer discarding tiles that don't increase shanten
      let score = newShanten * 5;
      
      if (newShanten <= currentShanten) {
        score -= 3;
      }
      
      // Prefer discarding isolated tiles
      if ('honor' in tile.type) {
        const sameCount = hand.filter((t) => isSameType(t.type, tile.type)).length;
        if (sameCount === 1) score -= 2;
      }
      
      // Prefer discarding edge tiles (1, 9) that don't have neighbors
      if (isSuitTile(tile.type)) {
        const suitTile = tile.type as { suit: string; rank: number };
        const rank = suitTile.rank;
        if (rank === 1 || rank === 9) {
          const hasNeighbor = hand.some(t => 
            isSameType(t.type, { suit: suitTile.suit, rank: rank === 1 ? 2 : 8 } as TileType)
          );
          if (!hasNeighbor) score -= 1;
        }
      }
      
      // Add randomness for variety
      score += Math.random() * 2;
      
      if (score < bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }
    return bestTile.id;
  }

  // === MEDIUM AI: Score tiles by shanten impact + tile efficiency ===
  if (difficulty === 'medium') {
    let bestTile = nonFortuneTiles[0];
    let bestScore = Infinity; // Lower = better to discard

    const currentShanten = calculateShantenCached(hand, meldCount, fortuneType).shanten;

    for (const tile of nonFortuneTiles) {
      const handWithout = hand.filter((t) => t.id !== tile.id);
      const newShanten = calculateShantenCached(handWithout, meldCount, fortuneType).shanten;
      
      // Base score: shanten impact (higher shanten = worse)
      let score = newShanten * 10;
      
      // Bonus for tiles that don't increase shanten
      if (newShanten <= currentShanten) {
        score -= 5;
      }
      
      // Penalty for discarding useful tiles (middle tiles, connected tiles)
      if (isSuitTile(tile.type)) {
        const suitTile = tile.type as { suit: Suit; rank: number };
        const rank = suitTile.rank;
        // Middle tiles (3-7) are more valuable
        if (rank >= 3 && rank <= 7) score += 2;
        // Check if tile has neighbors in hand
        const hasLeft = hand.some(t => isSameType(t.type, { suit: suitTile.suit, rank: Math.max(1, rank - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }));
        const hasRight = hand.some(t => isSameType(t.type, { suit: suitTile.suit, rank: Math.min(9, rank + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }));
        if (hasLeft && hasRight) score += 3; // Part of a sequence, keep it
        else if (hasLeft || hasRight) score += 1; // Has one neighbor
      }
      
      // Prefer discarding isolated honor tiles
      if ('honor' in tile.type) {
        const sameCount = hand.filter((t) => isSameType(t.type, tile.type)).length;
        if (sameCount === 1) score -= 2; // Isolated, good to discard
      }
      
      // Add small randomness to avoid predictable play
      score += Math.random() * 0.5;
      
      if (score < bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }
    return bestTile.id;
  }

  // === HARD AI: Expert strategy with read tiles and tenpai selection ===
  {
    let bestTile = nonFortuneTiles[0];
    let bestScore = Infinity; // Lower = better to discard

    const currentShanten = calculateShantenCached(hand, meldCount, fortuneType).shanten;
    
    // If tenpai, use tenpai selection to find best waiting tiles
    if (currentShanten === 0) {
      const bestTenpai = findBestTenpaiDiscard(hand, meldCount, fortuneType);
      if (bestTenpai) {
        return bestTenpai.tileId;
      }
    }

    for (const tile of nonFortuneTiles) {
      const handWithout = hand.filter((t) => t.id !== tile.id);
      const newShanten = calculateShantenCached(handWithout, meldCount, fortuneType).shanten;
      
      // Base score: shanten impact
      let score = newShanten * 10;
      
      // Very strong bonus for tiles that improve shanten
      if (newShanten < currentShanten) {
        score -= 15; // Keep tiles that improve hand
      } else if (newShanten === currentShanten) {
        score -= 5; // Keep tiles that don't hurt
      }
      
      // Advanced tile value analysis
      if (isSuitTile(tile.type)) {
        const rank = tile.type.rank;
        const suit = tile.type.suit;
        
        // Count tiles of same suit in hand
        const suitCount = hand.filter(t => isSuitTile(t.type) && t.type.suit === suit).length;
        
        // Middle tiles (3-7) are more valuable
        if (rank >= 3 && rank <= 7) score += 2;
        
        // Check for adjacent tiles (potential sequences)
        const hasLeft = hand.some(t => isSameType(t.type, { suit, rank: Math.max(1, rank - 1) as any }));
        const hasRight = hand.some(t => isSameType(t.type, { suit, rank: Math.min(9, rank + 1) as any }));
        const hasLeft2 = hand.some(t => isSameType(t.type, { suit, rank: Math.max(1, rank - 2) as any }));
        const hasRight2 = hand.some(t => isSameType(t.type, { suit, rank: Math.min(9, rank + 2) as any }));
        
        // Part of a sequence (both neighbors) - keep very strongly
        if (hasLeft && hasRight) score += 5;
        // Has one neighbor - keep strongly
        else if (hasLeft || hasRight) score += 3;
        // Has gap connection (e.g., 1_3) - keep moderately
        else if (hasLeft2 || hasRight2) score += 1.5;
        
        // Keep tiles in suits where we have many tiles (better chances for sequences)
        if (suitCount >= 5) score += 2;
        else if (suitCount >= 4) score += 1;
      }
      
      // Prefer discarding isolated honor tiles
      if ('honor' in tile.type) {
        const sameCount = hand.filter((t) => isSameType(t.type, tile.type)).length;
        if (sameCount === 1) score -= 2; // Isolated, good to discard
        else if (sameCount === 2) score += 1; // Pair, keep if possible
      }
      
      // Read tiles: prefer discarding safe tiles when close to tenpai
      if (discardHistory && currentShanten <= 1) {
        const safety = getTileSafetyScore(tile, discardHistory);
        score -= safety * 0.5; // Bonus for safe tiles
      }
      
      // Prefer discarding tiles that are already discarded (safer)
      if (discardHistory) {
        const discarded = discardHistory.filter(d => isSameType(d.tile, tile.type)).length;
        if (discarded >= 2) score -= 1; // Very safe to discard
      }
      
      // Minimal randomness for variety
      score += Math.random() * 0.1;
      
      if (score < bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }
    return bestTile.id;
  }
}

// === Reaction Decisions ===

// Decide whether to chi, pong, kong, or hu when a discard is available
export function decideReaction(
  state: GameState,
  playerIndex: number,
  difficulty: 'easy' | 'medium' | 'hard'
): AIAction {
  const player = state.players[playerIndex];
  const lastDiscard = state.lastDiscard;
  if (!lastDiscard) return { kind: 'pass' };

  const hand = player.hand;
  const melds = player.melds;
  const discard = lastDiscard.tile;
  const fortuneType = state.fortuneTile;

  // Check hu - ALL difficulties should hu if possible
  // IMPORTANT: for discard wins, checkWin needs the full hand INCLUDING the winning tile
  const winHand = [...hand, discard];
  const winShanten = calculateShanten(winHand, melds.length, fortuneType).shanten;
  if (winShanten === -1) {
    const winResult = checkWin(winHand, melds, discard, fortuneType, { fromDraw: false, fromDiscard: true });
    if (winResult && hasMinimumTai(winResult, winHand, melds)) {
      return { kind: 'hu' };
    }
  }

  const currentShanten = calculateShanten(hand, melds.length, fortuneType).shanten;

  // === EASY AI: basic reactions with shanten awareness ===
  if (difficulty === 'easy') {
    const currentShanten = calculateShantenCached(hand, melds.length, fortuneType).shanten;
    
    // Kong: 70% chance if doesn't hurt
    if (canMingKong(hand, discard) && state.deadWall.length > 0) {
      const afterKongHand = hand.filter((t) => !isSameType(t.type, discard.type)).slice(0, hand.length - 3);
      const afterKongShanten = calculateShantenCached(afterKongHand, melds.length + 1, fortuneType).shanten;
      if (afterKongShanten <= currentShanten && Math.random() < 0.7) {
        return { kind: 'kong', kongType: 'mingkong' };
      }
    }
    
    // Pong: 80% chance if doesn't hurt
    if (canPong(hand, discard)) {
      const matchingTiles = hand.filter((t) => isSameType(t.type, discard.type));
      const afterPongHand = hand.filter((t) => !matchingTiles.slice(0, 2).some((mt) => mt.id === t.id));
      const afterPongShanten = calculateShantenCached(afterPongHand, melds.length + 1, fortuneType).shanten;
      if (afterPongShanten <= currentShanten && Math.random() < 0.8) {
        return { kind: 'pong' };
      }
    }
    
    // Chi: 60% chance if doesn't hurt
    const chiOptions = getChiOptions(hand, discard);
    if (chiOptions.length > 0) {
      const afterChiHand = hand.filter((t) => !chiOptions[0].some((ct) => ct.id === t.id));
      const afterChiShanten = calculateShantenCached(afterChiHand, melds.length + 1, fortuneType).shanten;
      if (afterChiShanten <= currentShanten && Math.random() < 0.6) {
        return { kind: 'chi', chiOptionIndex: 0 };
      }
    }
    
    return { kind: 'pass' };
  }

  // === MEDIUM AI: conservative reactions ===
  // === HARD AI: aggressive, almost always react ===

  // Kong (明杠) decision
  if (canMingKong(hand, discard)) {
    const afterKongHand = hand.filter((t) => !isSameType(t.type, discard.type)).slice(0, hand.length - 3);
    const afterKongShanten = calculateShanten(afterKongHand, melds.length + 1, fortuneType).shanten;
    if (afterKongShanten <= currentShanten) {
      if (difficulty === 'hard') {
        // Hard AI: 90% chance to kong when beneficial
        if (Math.random() < 0.9) return { kind: 'kong', kongType: 'mingkong' };
      } else {
        // Medium AI: very conservative (20% chance)
        if (Math.random() < 0.2) return { kind: 'kong', kongType: 'mingkong' };
      }
    }
  }

  // Pong decision
  if (canPong(hand, discard)) {
    const matchingTiles = hand.filter((t) => isSameType(t.type, discard.type));
    const afterPongHand = hand.filter((t) => !matchingTiles.slice(0, 2).some((mt) => mt.id === t.id));
    const afterPongShanten = calculateShanten(afterPongHand, melds.length + 1, fortuneType).shanten;

    if (difficulty === 'hard') {
      // Hard AI: expert pong strategy
      // Always pong if it improves shanten
      if (afterPongShanten < currentShanten) {
        return { kind: 'pong' };
      }
      // Pong if tenpai and doesn't hurt
      if (currentShanten <= 0 && afterPongShanten <= currentShanten) {
        return { kind: 'pong' };
      }
      // Pong if shanten stays the same (free meld, very valuable)
      if (afterPongShanten === currentShanten) {
        return { kind: 'pong' };
      }
      // Always pong fortune tiles (wildcards are always useful)
      if (fortuneType && isSameType(discard.type, fortuneType)) {
        return { kind: 'pong' };
      }
      // Pong if we have few melds and it doesn't hurt much
      if (melds.length < 3 && afterPongShanten <= currentShanten + 1) {
        return { kind: 'pong' };
      }
    } else {
      // Medium AI: more aggressive pong strategy
      // Pong if it improves shanten
      if (afterPongShanten < currentShanten) {
        return { kind: 'pong' };
      }
      // Pong if tenpai and doesn't hurt
      if (currentShanten <= 0 && afterPongShanten <= currentShanten) {
        return { kind: 'pong' };
      }
      // Pong if shanten stays the same and we have few melds (early game)
      if (afterPongShanten === currentShanten && melds.length < 2) {
        return { kind: 'pong' };
      }
      // Pong fortune tiles (always useful)
      if (fortuneType && isSameType(discard.type, fortuneType)) {
        return { kind: 'pong' };
      }
    }
  }

  // Chi decision
  const chiOptions = getChiOptions(hand, discard);
  if (chiOptions.length > 0) {
    let bestChiIndex = -1;
    let bestChiShanten = Infinity;
    for (let i = 0; i < chiOptions.length; i++) {
      const afterChiHand = hand.filter((t) => !chiOptions[i].some((ct) => ct.id === t.id));
      const afterChiShanten = calculateShanten(afterChiHand, melds.length + 1, fortuneType).shanten;
      if (afterChiShanten < bestChiShanten) {
        bestChiShanten = afterChiShanten;
        bestChiIndex = i;
      }
    }

    if (difficulty === 'hard') {
      // Hard AI: expert chi strategy
      const hasFortuneChi = chiOptions.some((opt) => opt.some((t) => fortuneType && isSameType(t.type, fortuneType)));
      // Always chi if it improves shanten
      if (bestChiIndex >= 0 && bestChiShanten < currentShanten) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi if tenpai and doesn't hurt
      if (bestChiIndex >= 0 && currentShanten <= 0 && bestChiShanten <= currentShanten) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi if shanten stays the same (free meld, very valuable)
      if (bestChiIndex >= 0 && bestChiShanten === currentShanten) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Always chi fortune tiles
      if (bestChiIndex >= 0 && hasFortuneChi) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi if we have few melds and it doesn't hurt much
      if (bestChiIndex >= 0 && melds.length < 3 && bestChiShanten <= currentShanten + 1) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
    } else {
      // Medium AI: more aggressive chi strategy
      // Chi if it improves shanten
      if (bestChiIndex >= 0 && bestChiShanten < currentShanten) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi if tenpai and doesn't hurt
      if (bestChiIndex >= 0 && currentShanten <= 0 && bestChiShanten <= currentShanten) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi if shanten stays the same and we have few melds (early game)
      if (bestChiIndex >= 0 && bestChiShanten === currentShanten && melds.length < 2) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
      // Chi fortune tiles (always useful)
      const hasFortuneChi = chiOptions.some((opt) => opt.some((t) => fortuneType && isSameType(t.type, fortuneType)));
      if (bestChiIndex >= 0 && hasFortuneChi) {
        return { kind: 'chi', chiOptionIndex: bestChiIndex };
      }
    }
  }

  return { kind: 'pass' };
}

// === Main AI Entry Point ===

export function computeAIAction(
  state: GameState,
  playerIndex: number,
  difficulty: 'easy' | 'medium' | 'hard'
): AIAction {
  const player = state.players[playerIndex];

  if (state.phase === 'awaiting_reactions') {
    return decideReaction(state, playerIndex, difficulty);
  }

  if (state.phase === 'player_turn' || state.phase === 'awaiting_discard') {
    // Check for self-draw win (including 爆头) — only if drew from wall
    if (player.hand.length >= 2 && state.fortuneTile && state.drewFromWall) {
      const lastTile = state.lastDrawnTile ?? player.hand[player.hand.length - 1];
      const winResult = checkWin(player.hand, player.melds, lastTile, state.fortuneTile, {
        fromDraw: true,
        fromDiscard: false,
        drewFromKong: state.drewFromKong,
      });
      if (winResult && hasMinimumTai(winResult, player.hand, player.melds)) {
        return { kind: 'hu' };
      }
    }
    
    // Check for 财飘 opportunity (hard AI only)
    if (difficulty === 'hard' && state.fortuneTile && canCaiPiao(player.hand, player.melds, state.fortuneTile)) {
      // Find a fortune tile to discard
      const fortuneTile = player.hand.find(t => isFortuneTile(t.type));
      if (fortuneTile) {
        return { kind: 'caiPiao', tileId: fortuneTile.id };
      }
    }

    // === Concealed Kong (暗杠) decisions ===
    const anKongOptions = getAnKongOptions(player.hand);
    if (anKongOptions.length > 0 && state.phase === 'player_turn') {
      const currentShanten = calculateShanten(player.hand, player.melds.length, state.fortuneTile).shanten;

      if (difficulty === 'hard') {
        // Hard AI: smart ankong strategy
        // Always ankong if very close to winning
        if (currentShanten <= 1) {
          return { kind: 'kong', kongType: 'ankong', tileId: anKongOptions[0].id };
        }
        // Ankong with 60% chance if moderately close
        if (currentShanten <= 2 && Math.random() < 0.6) {
          return { kind: 'kong', kongType: 'ankong', tileId: anKongOptions[0].id };
        }
      } else if (difficulty === 'medium') {
        // Medium AI: ankong with 30% chance only if very close (shanten <= 1)
        if (currentShanten <= 1 && Math.random() < 0.3) {
          return { kind: 'kong', kongType: 'ankong', tileId: anKongOptions[0].id };
        }
      }
      // Easy AI: never ankong
    }

    // Pick a tile to discard
    const tileId = pickDiscard(
      player.hand,
      state.fortuneTile,
      player.melds.length,
      difficulty,
      state.currentRoundDiscards
    );
    return { kind: 'discard', tileId };
  }

  return { kind: 'pass' };
}