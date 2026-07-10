import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playForEvent, setSoundEnabled, __setAudioContextForTests, getCtx } from '../../audio/soundManager';

// Minimal Web Audio mock so the synth runs in jsdom without a real device.
// NOTE: must be a plain class (not vi.fn().mockImplementation) because
// vitest mocks cannot be invoked with `new`.
function installMockAudio() {
  const created: any[] = [];
  const mk = () => {
    const n: any = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      frequency: { value: 0, setValueAtTime: vi.fn() },
      Q: { value: 0 },
      type: '',
    };
    created.push(n);
    return n;
  };
  class FakeAC {
    currentTime = 0;
    sampleRate = 44100;
    state = 'running';
    destination = {};
    resume = () => Promise.resolve();
    createGain = mk;
    createOscillator = mk;
    createBiquadFilter = mk;
    createBufferSource = mk;
    createBuffer = (_c: number, l: number) => ({
      getChannelData: () => new Float32Array(l),
    });
  }
  return { FakeAC, created };
}

describe('soundManager', () => {
  let created: any[];
  beforeEach(() => {
    const { FakeAC, created: c } = installMockAudio();
    created = c;
    __setAudioContextForTests(FakeAC as unknown as typeof AudioContext);
    setSoundEnabled(true);
    // Initialize audio context and master gain node
    getCtx();
  });

  it('routes all kong variants (kong/mingkong/ankong/jiagang) to the kong sound', () => {
    for (const k of ['kong', 'mingkong', 'ankong', 'jiagang']) {
      created.length = 0;
      playForEvent(k);
      expect(created.length, `${k} should produce audio nodes`).toBeGreaterThan(0);
    }
  });

  it('plays every known event without throwing', () => {
    for (const k of ['draw', 'discard', 'chi', 'pong', 'hu', 'pass']) {
      expect(() => playForEvent(k)).not.toThrow();
    }
  });

  it('hu celebration is richer (more nodes) than a quiet draw', () => {
    created.length = 0;
    playForEvent('draw');
    const drawNodes = created.length;
    created.length = 0;
    playForEvent('hu');
    const huNodes = created.length;
    expect(huNodes).toBeGreaterThan(drawNodes);
  });

  it('chi produces multiple clacks (more than a single discard)', () => {
    created.length = 0;
    playForEvent('discard');
    const discardNodes = created.length;
    created.length = 0;
    playForEvent('chi');
    const chiNodes = created.length;
    expect(chiNodes).toBeGreaterThan(discardNodes);
  });

  it('routes round_start / round_end / caiPiao to their sounds', () => {
    for (const k of ['round_start', 'round_end', 'caiPiao']) {
      created.length = 0;
      playForEvent(k);
      expect(created.length, `${k} should produce audio nodes`).toBeGreaterThan(0);
    }
  });

  it('caiPiao celebration is richer (more nodes) than a quiet round_end', () => {
    created.length = 0;
    playForEvent('round_end');
    const endNodes = created.length;
    created.length = 0;
    playForEvent('caiPiao');
    const caiPiaoNodes = created.length;
    expect(caiPiaoNodes).toBeGreaterThan(endNodes);
  });
});
