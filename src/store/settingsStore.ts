import { create } from 'zustand';
import type { AIDifficulty, PlayerNames } from '../engine/types';

// ============================================================
// Persistent settings stored in localStorage.
// Survives across sessions so users don't have to reconfigure.
// ============================================================

export interface AppSettings {
  aiDifficulty: AIDifficulty;
  soundEnabled: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  baseScore: number;
  initialScore: number;
  playerNames: PlayerNames;
}

// Canonical default settings — single source of truth.
// Import this wherever you need defaults (e.g. gameStore, server).
export const DEFAULT_SETTINGS: AppSettings = {
  aiDifficulty: 'medium',
  soundEnabled: false,
  animationSpeed: 'normal',
  baseScore: 10,
  initialScore: 1000,
  playerNames: {
    human: '你',
    ai1: 'AI 东',
    ai2: 'AI 南',
    ai3: 'AI 西',
  },
};

const STORAGE_KEY = 'wintile_app_settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        aiDifficulty: parsed.aiDifficulty || DEFAULT_SETTINGS.aiDifficulty,
        soundEnabled: parsed.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
        animationSpeed: parsed.animationSpeed || DEFAULT_SETTINGS.animationSpeed,
        baseScore: parsed.baseScore ?? DEFAULT_SETTINGS.baseScore,
        initialScore: parsed.initialScore ?? DEFAULT_SETTINGS.initialScore,
        playerNames: {
          human: parsed.playerNames?.human || DEFAULT_SETTINGS.playerNames.human,
          ai1: parsed.playerNames?.ai1 || DEFAULT_SETTINGS.playerNames.ai1,
          ai2: parsed.playerNames?.ai2 || DEFAULT_SETTINGS.playerNames.ai2,
          ai3: parsed.playerNames?.ai3 || DEFAULT_SETTINGS.playerNames.ai3,
        },
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface SettingsStore {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadSettings(),
  update: (partial) => {
    const newSettings = { ...useSettingsStore.getState().settings, ...partial };
    set({ settings: newSettings });
    saveSettings(newSettings);
  },
}));
