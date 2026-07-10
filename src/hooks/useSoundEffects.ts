import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { bindUnlockOnGesture, getCtx, playForEvent, setSoundEnabled } from '../audio/soundManager';

/**
 * useSoundEffects — listens to the game event log and plays a matching
 * synthesized sound for each event. Gated by the `soundEnabled` setting.
 *
 * Uses a ref (no state) so it never triggers re-renders, and tracks the
 * last-played index so toggling sound on/off never replays old events.
 */
export function useSoundEffects() {
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const soundEnabled = useSettingsStore((s) => s.settings.soundEnabled);
  const lastIndexRef = useRef(-1);

  // Unlock audio on first user gesture + keep master gain synced with mute.
  useEffect(() => {
    bindUnlockOnGesture();
    setSoundEnabled(soundEnabled);
    // Create + resume the AudioContext while we're inside the toggle gesture.
    if (soundEnabled) getCtx();
  }, [soundEnabled]);

  useEffect(() => {
    const idx = eventLog.length - 1;
    if (idx <= lastIndexRef.current) {
      // Game restarted → event log shrank; reset the cursor.
      if (eventLog.length < lastIndexRef.current) lastIndexRef.current = -1;
      return;
    }
    lastIndexRef.current = idx;
    if (!soundEnabled) return;
    const ev = eventLog[idx];
    if (ev) playForEvent(ev.kind);
  }, [eventLog, soundEnabled]);
}
