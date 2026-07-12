// ============================================================
// Animation duration look-up table.
// ============================================================

// Animation durations (ms) based on speed setting — tuned ~30% slower than before
const DURATION_MAP = {
  slow: { draw: 500, discard: 400, reaction: 300, hu: 800, transition: 200, breathe: 1000 },
  normal: { draw: 400, discard: 300, reaction: 200, hu: 600, transition: 150, breathe: 800 },
  fast: { draw: 280, discard: 220, reaction: 150, hu: 450, transition: 120, breathe: 600 },
} as const;

// Get duration for animation type and speed
export function getAnimationDuration(
  type: keyof typeof DURATION_MAP.normal,
  speed: 'slow' | 'normal' | 'fast'
): number {
  return DURATION_MAP[speed][type];
}
