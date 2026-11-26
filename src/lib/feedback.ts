const SOUND_STORAGE_KEY = "commonline:sound-enabled";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

export function triggerHaptic(pattern: number | number[] = 12): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore unsupported environments
  }
}

function playTone(
  freq: number,
  durationMs: number,
  options: {
    type?: OscillatorType;
    gain?: number;
    delayMs?: number;
    endFreq?: number;
  } = {},
) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime + (options.delayMs ?? 0) / 1000;
    const duration = durationMs / 1000;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(freq, now);
    if (options.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(options.endFreq, now + duration);
    }
    const peak = options.gain ?? 0.055;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // ignore audio playback errors
  }
}

// Pentatonic notes for escalating combo pitch (C5, D5, E5, G5, A5, C6, D6, E6)
const COMBO_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export function playLikeSound(combo = 1): void {
  const note = COMBO_SCALE[Math.min(Math.max(0, combo - 1), COMBO_SCALE.length - 1)];
  playTone(note * 0.75, 90, { type: "triangle", gain: 0.048, endFreq: note });
  if (combo >= 3) {
    playTone(note * 1.5, 130, { type: "sine", gain: 0.035, delayMs: 42 });
  }
  triggerHaptic(combo >= 3 ? [10, 24, 14] : 10);
}

export function playUnlikeSound(): void {
  playTone(340, 75, { type: "sine", gain: 0.03, endFreq: 240 });
}

export function playSaveSound(saved: boolean): void {
  if (saved) {
    playTone(440, 70, { type: "triangle", gain: 0.042, endFreq: 660 });
    triggerHaptic(10);
  } else {
    playTone(420, 65, { type: "sine", gain: 0.028, endFreq: 320 });
  }
}

export function playReplySound(): void {
  playTone(493.88, 75, { type: "triangle", gain: 0.045 });
  playTone(659.25, 110, { type: "sine", gain: 0.04, delayMs: 55 });
  triggerHaptic(12);
}

export function playFollowSound(followed: boolean): void {
  if (followed) {
    playTone(523.25, 85, { type: "sine", gain: 0.045 });
    playTone(783.99, 135, { type: "triangle", gain: 0.042, delayMs: 65 });
    triggerHaptic([10, 20, 12]);
  } else {
    playTone(392, 80, { type: "sine", gain: 0.028, endFreq: 311 });
  }
}

export function playPublishSound(): void {
  playTone(523.25, 100, { type: "triangle", gain: 0.05 });
  playTone(659.25, 110, { type: "triangle", gain: 0.046, delayMs: 65 });
  playTone(783.99, 175, { type: "sine", gain: 0.048, delayMs: 130 });
  triggerHaptic([14, 30, 18]);
}

export function playMilestoneSound(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, idx) => {
    playTone(n, 190, { type: idx === 3 ? "sine" : "triangle", gain: 0.05, delayMs: idx * 72 });
  });
  triggerHaptic([15, 30, 15, 30, 25]);
}

export function playTabSound(): void {
  playTone(620, 32, { type: "sine", gain: 0.018, endFreq: 700 });
}
