import { describe, it, expect } from 'vitest';
import { aiThinkDelay } from '../../hooks/useGameLoop';
import { getAnimationDuration } from '../../hooks/useAnimations';

/**
 * Regression locks for:
 *  1. AI no longer acts instantly — think delay is human-like (>= 800ms) and varies.
 *  2. Animation durations slowed per level (slow > normal > fast), all above old fast baseline.
 */
describe('AI think time & animation pacing', () => {
  it('AI think delay is human-like (>=800ms) and randomized', () => {
    const samples = Array.from({ length: 200 }, () => aiThinkDelay());
    // every sample within bounds
    for (const d of samples) {
      expect(d).toBeGreaterThanOrEqual(800);
      expect(d).toBeLessThanOrEqual(1700);
    }
    // variety: should span both halves of the range, not a fixed value
    const low = samples.filter((d) => d < 1000).length;
    const high = samples.filter((d) => d >= 1400).length;
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });

  it('animation durations are slower than the old baseline and ordered slow>normal>fast', () => {
    const types = ['draw', 'discard', 'reaction', 'hu'] as const;

    // slowest >= normal >= fast for every type
    for (const t of types) {
      expect(getAnimationDuration(t, 'slow')).toBeGreaterThanOrEqual(
        getAnimationDuration(t, 'normal')
      );
      expect(getAnimationDuration(t, 'normal')).toBeGreaterThanOrEqual(
        getAnimationDuration(t, 'fast')
      );
    }

    // each level is slower than the previous fast baseline (200/150/100/300)
    // i.e. even "fast" today is at least as slow as the old "fast"
    expect(getAnimationDuration('draw', 'fast')).toBeGreaterThanOrEqual(280);
    expect(getAnimationDuration('discard', 'fast')).toBeGreaterThanOrEqual(220);
    expect(getAnimationDuration('reaction', 'fast')).toBeGreaterThanOrEqual(150);
    expect(getAnimationDuration('hu', 'fast')).toBeGreaterThanOrEqual(450);

    // normal clearly slower than old normal (300/200/100/400)
    expect(getAnimationDuration('draw', 'normal')).toBeGreaterThanOrEqual(400);
    expect(getAnimationDuration('hu', 'normal')).toBeGreaterThanOrEqual(600);
  });
});
