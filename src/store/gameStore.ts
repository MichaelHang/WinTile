import { create } from 'zustand';
import type { GameState, GameSettings, AIDifficulty } from '../engine/types';
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

interface GameStore {
  gameState: GameState;
  selectedTileId: string | null;
  setState: (partial: { gameState: GameState }) => void;
  newGame: (settings?: Partial<GameSettings>) => void;
  resetGame: () => void;
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
}

const defaultSettings: GameSettings = {
  humanPlayerIndex: 0,
  aiDifficulty: 'medium' as AIDifficulty,
  animationSpeed: 'normal',
  baseScore: 10,
  initialScore: 1000,
  soundEnabled: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialState(defaultSettings),
  selectedTileId: null,

  setState: (partial) => set(partial),

  newGame: (partialSettings?: Partial<GameSettings>) => {
    const settings = { ...defaultSettings, ...partialSettings };
    // Guard against NaN: ensure baseScore is always a valid number
    if (typeof settings.baseScore !== 'number' || isNaN(settings.baseScore)) {
      settings.baseScore = defaultSettings.baseScore;
    }
    if (typeof settings.initialScore !== 'number' || isNaN(settings.initialScore)) {
      settings.initialScore = defaultSettings.initialScore;
    }
    const initial = createInitialState(settings);
    let state = startRound(initial, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null });
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
    set({ gameState: state, selectedTileId: null });
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
      set({ gameState: state, selectedTileId: null });
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
      set({ gameState: state, selectedTileId: null });
      return;
    }
    
    // Normal case: continue to next round
    const baseState = advanceDealer(cur, cur.lastWinnerIndex ?? null);

    let state = startRound(baseState, Date.now());
    if (state.players[state.currentPlayerIndex].isHuman) {
      state = executeDraw(state);
    }
    set({ gameState: state, selectedTileId: null });
  },

  drawTile: () => {
    set({ gameState: executeDraw(get().gameState) });
  },

  discardTile: (tileId: string) => {
    set({ gameState: executeDiscard(get().gameState, tileId) });
  },

  claimChi: (optionIndex: number) => {
    const state = executeChi(get().gameState, 0, optionIndex);
    set({ gameState: state, selectedTileId: null });
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
      // 双保险：杠后摸牌堆耗尽时 executeMingKong 会返回原状态，此时自动转为「过」
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
    set({ gameState: executeHu(get().gameState, 0) });
  },

  claimCaiPiao: (tileId: string) => {
    set({ gameState: executeCaiPiao(get().gameState, tileId) });
  },

  passReaction: () => {
    // Only pass for the human player (index 0), not for AI
    set({ gameState: executePlayerPass(get().gameState, 0) });
  },

  setSelectedTile: (tileId: string | null) => {
    set({ selectedTileId: tileId });
  },
}));
