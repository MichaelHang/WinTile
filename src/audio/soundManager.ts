// ============================================================
// Sound Manager — Web Audio API synthesis (no asset files).
// All sounds are generated procedurally so the app stays
// offline-capable (PWA) and ships zero audio bytes.
// ============================================================

type AC = typeof AudioContext;

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let masterEnabled = true;
let gestureBound = false;
// Test-only injection point for the AudioContext constructor. When set, it
// takes precedence over window.AudioContext (which is awkward to mock in jsdom).
let injectedACtor: AC | null = null;

/** Test-only: drop the cached AudioContext so each test starts fresh. */
export function __resetAudioContextForTests() {
  audioCtx = null;
  master = null;
  gestureBound = false;
}

/** Test-only: inject an AudioContext constructor, bypassing window.AudioContext. */
export function __setAudioContextForTests(ctor: AC | null) {
  injectedACtor = ctor;
  audioCtx = null;
  master = null;
  gestureBound = false;
}

const MASTER_VOLUME = 0.5;

export function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const ACtor: AC | undefined =
    injectedACtor ??
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
  if (!ACtor) return null;

  if (!audioCtx) {
    try {
      audioCtx = new ACtor();
      master = audioCtx.createGain();
      master.gain.value = masterEnabled ? MASTER_VOLUME : 0;
      master.connect(audioCtx.destination);
    } catch {
      return null;
    }
  }
  // Browsers block audio until a user gesture; resume opportunistically.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Bind a one-time-ish global listener that unlocks audio on first interaction. */
export function bindUnlockOnGesture() {
  if (gestureBound || typeof window === 'undefined') return;
  gestureBound = true;
  const handler = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler);
}

/** Keep the master gain in sync with the mute setting. */
export function setSoundEnabled(enabled: boolean) {
  masterEnabled = enabled;
  if (master && audioCtx) {
    master.gain.setTargetAtTime(
      enabled ? MASTER_VOLUME : 0,
      audioCtx.currentTime,
      0.01
    );
  }
}

// ── low-level voices ──────────────────────────────────────

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number
) {
  const ctx = audioCtx!;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(master!);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function toneWithVibrato(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  vibratoRate: number = 5,
  vibratoDepth: number = 10
) {
  const ctx = audioCtx!;
  const osc = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  const g = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  
  vibrato.type = 'sine';
  vibrato.frequency.setValueAtTime(vibratoRate, start);
  vibratoGain.gain.setValueAtTime(vibratoDepth, start);
  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc.frequency);
  
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  
  osc.connect(g);
  g.connect(master!);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  vibrato.start(start);
  vibrato.stop(start + dur + 0.02);
}

function noiseBuffer(dur: number): AudioBuffer {
  const ctx = audioCtx!;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** A short filtered-noise burst — the "tile on the table" clack. */
function clack(
  start: number,
  dur: number,
  filterFreq: number,
  peak: number,
  q = 1
) {
  const ctx = audioCtx!;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = filterFreq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master!);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** A soft whoosh sound for tile sliding. */
function whoosh(start: number, dur: number) {
  const ctx = audioCtx!;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2000, start);
  lp.frequency.exponentialRampToValueAtTime(500, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.08, start + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(lp);
  lp.connect(g);
  g.connect(master!);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** A rising chime for positive events. */
function chime(start: number, freq1: number, freq2: number) {
  const ctx = audioCtx!;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq1, start);
  osc.frequency.exponentialRampToValueAtTime(freq2, start + 0.15);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.15, start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
  osc.connect(g);
  g.connect(master!);
  osc.start(start);
  osc.stop(start + 0.22);
}

// ── game sounds ───────────────────────────────────────────

export function playDiscard() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const f = 1900 + Math.random() * 400; // slight pitch variety
  clack(t, 0.09, f, 0.28, 1.2);
  tone(170, t, 0.07, 'sine', 0.12);
}

export function playDraw() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  whoosh(t, 0.08);
  clack(t + 0.03, 0.05, 2600 + Math.random() * 300, 0.07, 1);
}

export function playPong() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  clack(t, 0.1, 1700, 0.32, 1.2);
  clack(t + 0.06, 0.1, 1500, 0.28, 1.2);
  tone(200, t, 0.1, 'sine', 0.15);
  chime(t + 0.1, 800, 1200); // Rising chime for pong
}

export function playChi() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    clack(t + i * 0.045, 0.06, 2300 - i * 200, 0.22, 1);
  }
  chime(t + 0.15, 600, 900); // Rising chime for chi
}

export function playKong() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  clack(t, 0.14, 850, 0.4, 0.9);
  tone(120, t, 0.16, 'sine', 0.25);
  tone(240, t + 0.02, 0.12, 'triangle', 0.12);
  // Dramatic descending tone for kong
  tone(400, t + 0.05, 0.2, 'sine', 0.15);
  tone(300, t + 0.1, 0.15, 'sine', 0.1);
}

export function playHu() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  // Grand arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((n, i) => {
    tone(n, t + i * 0.08, 0.6, 'sine', 0.22);
    tone(n * 2, t + i * 0.08, 0.3, 'triangle', 0.05);
  });
  // Shimmer effect
  for (let i = 0; i < 4; i++) {
    clack(t + 0.32 + i * 0.05, 0.15, 5000 + i * 500, 0.08, 0.5);
  }
  // Final chord
  tone(523.25, t + 0.5, 0.8, 'sine', 0.18);
  tone(659.25, t + 0.5, 0.8, 'sine', 0.18);
  tone(783.99, t + 0.5, 0.8, 'sine', 0.18);
}

export function playHuLuxury() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  // Even grander arpeggio for luxury win
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5 to G6
  notes.forEach((n, i) => {
    toneWithVibrato(n, t + i * 0.06, 0.8, 'sine', 0.25, 6, 15);
    tone(n * 2, t + i * 0.06, 0.4, 'triangle', 0.06);
  });
  // Extra sparkles
  for (let i = 0; i < 6; i++) {
    clack(t + 0.4 + i * 0.04, 0.2, 6000 + i * 300, 0.1, 0.4);
  }
  // Final chord with sustain
  tone(523.25, t + 0.65, 1.2, 'sine', 0.2);
  tone(659.25, t + 0.65, 1.2, 'sine', 0.2);
  tone(783.99, t + 0.65, 1.2, 'sine', 0.2);
  tone(1046.5, t + 0.65, 1.2, 'sine', 0.15);
}

export function playPass() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  tone(300, t, 0.05, 'sine', 0.04);
}

export function playClick() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  clack(t, 0.03, 3200, 0.15, 1);
}

/** Round start: a short rising two-note "ready" cue. */
export function playRoundStart() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  tone(392, t, 0.16, 'sine', 0.16); // G4
  tone(587.33, t + 0.12, 0.22, 'sine', 0.18); // D5
  clack(t + 0.12, 0.05, 3000, 0.06, 1);
}

/** Round end / draw: a soft, neutral low tone. */
export function playRoundEnd() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  tone(330, t, 0.35, 'sine', 0.14);
  tone(247, t + 0.04, 0.4, 'triangle', 0.07);
}

/** 财飘 (fortune float) — an exciting bright arpeggio + sparkle. */
export function playCaiPiao() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const notes = [659.25, 880, 1108.73, 1318.51]; // E5 A5 C#6 E6
  notes.forEach((n, i) => {
    toneWithVibrato(n, t + i * 0.06, 0.5, 'sine', 0.22, 7, 12);
    tone(n * 2, t + i * 0.06, 0.25, 'triangle', 0.05);
  });
  // Extra sparkle
  for (let i = 0; i < 3; i++) {
    clack(t + 0.3 + i * 0.04, 0.2, 6000 + i * 500, 0.12, 0.5);
  }
}

/** 杠爆 (kong + bao tou) — dramatic double hit. */
export function playGangBao() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  // Kong part
  clack(t, 0.14, 850, 0.4, 0.9);
  tone(120, t, 0.16, 'sine', 0.25);
  // Bao tou part
  clack(t + 0.2, 0.1, 1700, 0.35, 1.2);
  tone(200, t + 0.2, 0.12, 'sine', 0.18);
  // Rising excitement
  tone(400, t + 0.35, 0.2, 'sine', 0.15);
  tone(600, t + 0.4, 0.25, 'sine', 0.12);
}

/** 清一色 (pure one suit) — elegant ascending scale. */
export function playQingYiSe() {
  const ctx = getCtx();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C5 to C6
  scale.forEach((n, i) => {
    tone(n, t + i * 0.08, 0.4, 'sine', 0.2);
  });
  // Final chord
  tone(523.25, t + 0.5, 0.6, 'sine', 0.18);
  tone(659.25, t + 0.5, 0.6, 'sine', 0.18);
  tone(1046.5, t + 0.5, 0.6, 'sine', 0.15);
}

/** Map a game event kind to its sound. */
export function playForEvent(kind: string) {
  switch (kind) {
    case 'discard':
      playDiscard();
      break;
    case 'draw':
      playDraw();
      break;
    case 'chi':
      playChi();
      break;
    case 'pong':
      playPong();
      break;
    case 'hu':
      playHu();
      break;
    case 'pass':
      playPass();
      break;
    case 'round_start':
      playRoundStart();
      break;
    case 'round_end':
      playRoundEnd();
      break;
    case 'caiPiao':
      playCaiPiao();
      break;
    case 'gangBao':
      playGangBao();
      break;
    case 'qingYiSe':
      playQingYiSe();
      break;
    case 'huLuxury':
      playHuLuxury();
      break;
    default:
      // kong / mingkong / ankong / jiagang (加杠 contains "gang", not "kong")
      if (kind === 'jiagang' || kind.includes('kong')) playKong();
  }
}

/** Play sound for specific win types. */
export function playForWinType(winResult: import('../engine/types').WinResult) {
  if (winResult.isLuxury) {
    playHuLuxury();
  } else if (winResult.isQingYiSe) {
    playQingYiSe();
  } else if (winResult.isGangBao) {
    playGangBao();
  } else if (winResult.isCaiPiao) {
    playCaiPiao();
  } else {
    playHu();
  }
}
