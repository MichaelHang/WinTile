// ============================================================
// Game Statistics Store - Tracks historical game data
// ============================================================

const STATS_STORAGE_KEY = 'wintile_stats';
const LEADERBOARD_STORAGE_KEY = 'wintile_leaderboard';

// === Statistics Types ===

export interface GameRecord {
  timestamp: number;
  winnerIndex: number;
  winnerName: string;
  winForm: string; // 'standard' | 'sevenPairs'
  fanType: string; // e.g., '爆头', '财飘', '杠开', '清一色', etc.
  fanCount: number;
  isSelfDraw: boolean;
  isDealer: boolean;
  scores: [number, number, number, number];
  playerNames: [string, string, string, string];
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  selfDrawWins: number;
  discardWins: number;
  totalFan: number;
  maxFan: number;
  winForms: Record<string, number>; // win form distribution
  fanTypes: Record<string, number>; // fan type distribution
}

export interface LeaderboardEntry {
  playerName: string;
  highScore: number;
  timestamp: number;
}

// === Default Values ===

const DEFAULT_PLAYER_STATS: PlayerStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  selfDrawWins: 0,
  discardWins: 0,
  totalFan: 0,
  maxFan: 0,
  winForms: {},
  fanTypes: {},
};

// === Helper Functions ===

function getFanTypeName(result: import('../engine/types').WinResult): string {
  const types: string[] = [];
  
  if (result.isBaoTou) types.push('爆头');
  if (result.isCaiPiao) types.push(`财飘(${result.piaoCount})`);
  if (result.isGangKai) types.push('杠开');
  if (result.isGangBao) types.push('杠爆');
  if (result.isQingYiSe) types.push('清一色');
  if (result.isHunYiSe) types.push('混一色');
  if (result.isZiYiSe) types.push('字一色');
  if (result.isLuxury) types.push(`豪华(${result.luxuryCount})`);
  
  return types.length > 0 ? types.join('+') : '平胡';
}

function calculateFan(result: import('../engine/types').WinResult): number {
  let fan = 1;
  
  if (result.form === 'sevenPairs') fan *= 2;
  if (result.isBaoTou) fan *= 2;
  if (result.isCaiPiao) fan *= Math.pow(2, result.piaoCount + 1);
  if (result.isGangKai) fan *= Math.pow(2, result.gangCount);
  if (result.isQingYiSe) fan *= 2;
  if (result.isZiYiSe) fan *= 4;
  if (result.isLuxury) fan *= Math.pow(2, result.luxuryCount);
  
  return fan;
}

// === Load/Save Functions ===

function loadRecords(): GameRecord[] {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecords(records: GameRecord[]): void {
  try {
    // Keep last 1000 records
    const trimmed = records.slice(-1000);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

// === Public API ===

/** Record a game result */
export function recordGame(
  winnerIndex: number,
  winResult: import('../engine/types').WinResult,
  players: { name: string; score: number; isDealer: boolean }[],
  isSelfDraw: boolean
): void {
  const records = loadRecords();
  
  const record: GameRecord = {
    timestamp: Date.now(),
    winnerIndex,
    winnerName: players[winnerIndex].name,
    winForm: winResult.form,
    fanType: getFanTypeName(winResult),
    fanCount: calculateFan(winResult),
    isSelfDraw,
    isDealer: players[winnerIndex].isDealer,
    scores: players.map(p => p.score) as [number, number, number, number],
    playerNames: players.map(p => p.name) as [string, string, string, string],
  };
  
  records.push(record);
  saveRecords(records);
  
  // Update leaderboard
  updateLeaderboard(players);
}

/** Update leaderboard with current scores */
function updateLeaderboard(players: { name: string; score: number }[]): void {
  const leaderboard = loadLeaderboard();
  const timestamp = Date.now();
  
  for (const player of players) {
    const existing = leaderboard.find(e => e.playerName === player.name);
    if (!existing || player.score > existing.highScore) {
      if (existing) {
        existing.highScore = player.score;
        existing.timestamp = timestamp;
      } else {
        leaderboard.push({
          playerName: player.name,
          highScore: player.score,
          timestamp,
        });
      }
    }
  }
  
  // Sort by high score descending and keep top 10
  leaderboard.sort((a, b) => b.highScore - a.highScore);
  saveLeaderboard(leaderboard.slice(0, 10));
}

/** Get statistics for a specific player */
export function getPlayerStats(playerName: string): PlayerStats {
  const records = loadRecords();
  const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, winForms: {}, fanTypes: {} };
  
  for (const record of records) {
    const playerIndex = record.playerNames.indexOf(playerName);
    if (playerIndex === -1) continue;
    
    stats.totalGames++;
    
    if (record.winnerIndex === playerIndex) {
      stats.wins++;
      stats.totalFan += record.fanCount;
      stats.maxFan = Math.max(stats.maxFan, record.fanCount);
      
      if (record.isSelfDraw) {
        stats.selfDrawWins++;
      } else {
        stats.discardWins++;
      }
      
      // Track win form distribution
      stats.winForms[record.winForm] = (stats.winForms[record.winForm] || 0) + 1;
      
      // Track fan type distribution
      stats.fanTypes[record.fanType] = (stats.fanTypes[record.fanType] || 0) + 1;
    } else {
      stats.losses++;
    }
  }
  
  return stats;
}

/** Get overall statistics for all players */
export function getOverallStats(): {
  totalGames: number;
  playerStats: Record<string, PlayerStats>;
  recentGames: GameRecord[];
} {
  const records = loadRecords();
  const playerNames = new Set<string>();
  
  for (const record of records) {
    for (const name of record.playerNames) {
      playerNames.add(name);
    }
  }
  
  const playerStats: Record<string, PlayerStats> = {};
  for (const name of playerNames) {
    playerStats[name] = getPlayerStats(name);
  }
  
  return {
    totalGames: records.length,
    playerStats,
    recentGames: records.slice(-20).reverse(), // Last 20 games, newest first
  };
}

/** Get leaderboard */
export function getLeaderboard(): LeaderboardEntry[] {
  return loadLeaderboard();
}

/** Get win rate */
export function getWinRate(stats: PlayerStats): number {
  if (stats.totalGames === 0) return 0;
  return Math.round((stats.wins / stats.totalGames) * 100);
}

/** Get average fan for wins */
export function getAverageFan(stats: PlayerStats): number {
  if (stats.wins === 0) return 0;
  return Math.round(stats.totalFan / stats.wins * 10) / 10;
}

/** Clear all statistics */
export function clearAllStats(): void {
  try {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
  } catch { /* ignore */ }
}
