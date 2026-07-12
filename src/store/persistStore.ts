// ============================================================
// Game persistence using localStorage
// Saves player scores, win counts, and game progress
// ============================================================

const STORAGE_KEY = 'wintile_game_save';

export interface SavedGameData {
  playerScores: [number, number, number, number];
  winCounts: [number, number, number, number];
  dealerIndex: number;
  laoCount: number;
  lastSaved: number; // timestamp
}

const DEFAULT_SAVE: SavedGameData = {
  playerScores: [1000, 1000, 1000, 1000],
  winCounts: [0, 0, 0, 0],
  dealerIndex: 0,
  laoCount: 1,
  lastSaved: 0,
};

export function loadGameData(): SavedGameData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        playerScores: parsed.playerScores || DEFAULT_SAVE.playerScores,
        winCounts: parsed.winCounts || DEFAULT_SAVE.winCounts,
        dealerIndex: parsed.dealerIndex ?? DEFAULT_SAVE.dealerIndex,
        laoCount: parsed.laoCount ?? DEFAULT_SAVE.laoCount,
        lastSaved: parsed.lastSaved ?? 0,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SAVE };
}

export function saveGameData(data: SavedGameData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      lastSaved: Date.now(),
    }));
  } catch {
    // ignore
  }
}

// Quick save - just update scores and win counts
export function saveScoresAndWins(
  scores: [number, number, number, number],
  winCounts: [number, number, number, number],
  dealerIndex: number,
  laoCount: number
): void {
  const existing = loadGameData();
  saveGameData({
    ...existing,
    playerScores: scores,
    winCounts,
    dealerIndex,
    laoCount,
  });
}

// Clear saved game data
export function clearGameData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
