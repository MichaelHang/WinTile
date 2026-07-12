import { create } from 'zustand';
import type { GameState, GameSettings } from '../engine/types';
import { DEFAULT_SETTINGS, useSettingsStore } from './settingsStore';
import { loadGameData, saveScoresAndWins, clearGameData } from './persistStore';
import {
  createInitialState,
  startRound,
  executeDraw,
  executeDiscard,
  executeChi,
  executePong,
  executeMingKong,
  executeAnKong,
  executeJiaGang,
  executeCaiPiao,
  executeHu,
  executePlayerPass,
  advanceDealer,
} from '../engine/state';

// Convert AppSettings to GameSettings
function toGameSettings(settings: typeof DEFAULT_SETTINGS): GameSettings {
  return {
    humanPlayerIndex: 0,
    aiDifficulty: settings.aiDifficulty,
    animationSpeed: settings.animationSpeed,
    baseScore: settings.baseScore,
    initialScore: settings.initialScore,
    soundEnabled: settings.soundEnabled,
    playerNames: settings.playerNames,
  };
}

// Helper to save current game state
function saveGameState(state: GameState) {
  const scores = state.players.map(p => p.score) as [number, number, number, number];
  saveScoresAndWins(scores, state.winCounts, state.dealerIndex, state.laoCount);
}

interface GameStore {
  gameState: GameState;
  selectedTileId: string | null;
  isAutoPlay: boolean;
  hasSavedGame: boolean;
  setState: (partial: { gameState: GameState }) => void;
  newGame: (settings?: Partial<typeof DEFAULT_SETTINGS>) => void;
  continueGame: () => void;
  resetGame: () => void;
  clearSave: () => void;
  nextRound: () => void;
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  claimChi: (optionIndex: number) => void;
  claimPong: () => void;
  claimKong: () => void;
  claimAnKong: (tileId: string) => void;
  claimJiaGang: (tileId: string) => void;
  claimHu: () => void;
  claimCaiPiao: (tileId: string) => void;
  passReaction: () => void;
  setSelectedTile: (tileId: string | null) => void;
  toggleAutoPlay: () => void;
  syncPlayerNames: () => void;
}

// Check if there's saved game data
const savedData = loadGameData();
const hasSaved = savedData.lastSaved > 0;

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialState(toGameSettings(DEFAULT_SETTINGS)),
  selectedTileId: null,
  isAutoPlay: false,
  hasSavedGame: hasSaved,

  setState: (partial) => set(partial),

  newGame: (partialSettings?: Partial<typeof DEFAULT_SETTINGS>) => {
    const settings = { ...DEFAULT_SETTINGS, ...partialSettings };
    // Guard against NaN: ensure baseScore is always a valid number
    if (typeof settings.baseScore !== 'number' || isNaN(settings.baseScore)) {
      settings.baseScore = DEFAULT_SETTINGS.baseScore;
    }
    if (typeof settings.initialScore !== 'number' || isNaN(settings.initialScore)) {
      settings.initialScore = DEFAULT_SETTINGS.initialScore;
    }
    const gameSettings = toGameSettings(settings);
    const initial = createInitialState(gameSettings);
    let state = startRound(initial, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null, isAutoPlay: false, hasSavedGame: true });
    saveGameState(state);
  },

  // Continue from saved game
  continueGame: () => {
    const saved = loadGameData();
    if (saved.lastSaved === 0) return;
    
    const { settings } = useSettingsStore.getState();
    const gameSettings = toGameSettings(settings);
    const initial = createInitialState(gameSettings);
    
    // Restore saved scores and win counts
    const players = initial.players.map((p, i) => ({
      ...p,
      score: saved.playerScores[i],
    })) as GameState['players'];
    
    const baseState: GameState = {
      ...initial,
      players,
      winCounts: saved.winCounts,
      dealerIndex: saved.dealerIndex,
      laoCount: saved.laoCount,
    };
    
    let state = startRound(baseState, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null, isAutoPlay: false });
  },

  // Reset with confirmation (preserves win counts)
  resetGame: () => {
    const cur = get().gameState;
    const settings = cur.settings;
    const initial = createInitialState(settings);
    // Preserve win counts
    initial.winCounts = cur.winCounts;
    let state = startRound(initial, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null, isAutoPlay: false });
    saveGameState(state);
  },

  // Clear saved game
  clearSave: () => {
    clearGameData();
    set({ hasSavedGame: false });
  },

  nextRound: () => {
    const cur = get().gameState;
    
    // Check if any player has negative score
    const playerScore = cur.players[0].score;
    const aiScores = cur.players.slice(1).map(p => p.score);
    const hasNegativeAI = aiScores.some(s => s < 0);
    const hasNegativePlayer = playerScore < 0;
    
    // If player has negative score, reset everything
    if (hasNegativePlayer) {
      const settings = cur.settings;
      const initial = createInitialState(settings);
      let state = startRound(initial, Date.now());
      if (state.players[state.currentPlayerIndex].isHuman) {
        state = executeDraw(state);
      }
      set({ gameState: state, selectedTileId: null, isAutoPlay: false });
      saveGameState(state);
      return;
    }
    
    // If any AI has negative score, keep player score but reset AI scores
    if (hasNegativeAI) {
      const settings = cur.settings;
      const initial = createInitialState(settings);
      
      // Preserve player's score and win count
      const players = initial.players.map((p, i) => ({
        ...p,
        score: i === 0 ? playerScore : settings.initialScore,
        isDealer: i === initial.dealerIndex,
      })) as GameState['players'];
      
      const baseState: GameState = {
        ...initial,
        players,
        winCounts: cur.winCounts, // Preserve win counts
      };
      
      let state = startRound(baseState, Date.now());
      if (state.players[state.currentPlayerIndex].isHuman) {
        state = executeDraw(state);
      }
      set({ gameState: state, selectedTileId: null, isAutoPlay: false });
      saveGameState(state);
      return;
    }
    
    // Normal case: continue to next round
    const baseState = advanceDealer(cur, cur.lastWinnerIndex ?? null);

    let state = startRound(baseState, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null, isAutoPlay: false });
    saveGameState(state);
  },

  // Sync player names from settings to current game state
  syncPlayerNames: () => {
    const { gameState } = get();
    const { settings } = useSettingsStore.getState();
    const names = settings.playerNames;
    
    const players = gameState.players.map((p, i) => ({
      ...p,
      name: i === 0 ? names.human : i === 1 ? names.ai1 : i === 2 ? names.ai2 : names.ai3,
    })) as GameState['players'];
    
    set({ gameState: { ...gameState, players } });
  },

  drawTile: () => {
    set({ gameState: executeDraw(get().gameState) });
  },

  discardTile: (tileId: string) => {
    set({ gameState: executeDiscard(get().gameState, tileId) });
  },

  claimChi: (optionIndex: number) => {
    const state = executeChi(get().gameState, 0, optionIndex);
    set({ gameState: state, selectedTileId: null, isAutoPlay: false });
  },

  claimPong: () => {
    set({ gameState: executePong(get().gameState, 0), selectedTileId: null });
  },

  claimKong: () => {
    const { gameState } = get();
    const kongReaction = gameState.pendingReactions.find(
      (r) => r.kind === 'kong' && r.playerIndex === 0
    );
    if (kongReaction?.kongType === 'mingkong') {
      const next = executeMingKong(gameState, 0);
      set({ gameState: next === gameState ? executePlayerPass(gameState, 0) : next, selectedTileId: null });
    }
  },

  claimAnKong: (tileId: string) => {
    set({ gameState: executeAnKong(get().gameState, tileId), selectedTileId: null });
  },

  claimJiaGang: (tileId: string) => {
    set({ gameState: executeJiaGang(get().gameState, tileId), selectedTileId: null });
  },

  claimHu: () => {
    const state = executeHu(get().gameState, 0);
    set({ gameState: state });
    saveGameState(state);
  },

  claimCaiPiao: (tileId: string) => {
    set({ gameState: executeCaiPiao(get().gameState, tileId) });
  },

  passReaction: () => {
    set({ gameState: executePlayerPass(get().gameState, 0) });
  },

  setSelectedTile: (tileId: string | null) => {
    set({ selectedTileId: tileId });
  },

  toggleAutoPlay: () => {
    set({ isAutoPlay: !get().isAutoPlay });
  },
}));
