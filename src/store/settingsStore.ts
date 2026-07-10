import { create } from 'zustand';
import type { AIDifficulty } from '../engine/types';

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
}

const STORAGE_KEY = 'wintile_app_settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        aiDifficulty: parsed.aiDifficulty || 'medium',
        soundEnabled: parsed.soundEnabled ?? false,
        animationSpeed: parsed.animationSpeed || 'normal',
        baseScore: parsed.baseScore ?? 10,
        initialScore: parsed.initialScore ?? 1000,
      };
    }
  } catch {
    // ignore
  }
  return {
    aiDifficulty: 'medium',
    soundEnabled: false,
    animationSpeed: 'normal',
    baseScore: 10,
    initialScore: 1000,
  };
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