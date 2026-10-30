"use client";

// ============================================================
// Interface sounds.
// ------------------------------------------------------------
// Synthesised with Web Audio, so there are no files to download and nothing to
// cache. Every sound is short (35–900ms), soft, and tuned around one key so
// they sit together. On for everyone by default (owner's decision,
// 2026-10-29); each person can switch them off or turn them down from the menu
// under their initials. The choice is per browser (localStorage).
//
// Rules the runtime follows (src/components/motion/sound-runtime.tsx):
// - Only pointer presses make a click sound. Typing never does.
// - Outcome sounds (success, error, notify, win) come from what happened, not
//   from the click that caused it.
// - Browsers refuse audio until the first gesture, so the AudioContext is made
//   lazily on the first play, which is always inside a gesture.
// ============================================================

export type SoundName =
  | "tap"
  | "press"
  | "nav"
  | "on"
  | "off"
  | "open"
  | "close"
  | "pick"
  | "drop"
  | "success"
  | "error"
  | "notify"
  | "win";

const ENABLED_KEY = "vg:sound:on";
const VOLUME_KEY = "vg:sound:volume";
const DEFAULT_VOLUME = 0.55;
// The same sound twice inside this window is one sound (a double-fired
// pointerdown, two toasts landing together).
const REPEAT_MS = 45;

type Prefs = { enabled: boolean; volume: number };

function readPrefs(): Prefs {
  try {
    const on = window.localStorage.getItem(ENABLED_KEY);
    const vol = Number(window.localStorage.getItem(VOLUME_KEY));
    return {
      enabled: on !== "0",
      volume: Number.isFinite(vol) && vol > 0 && vol <= 1 ? vol : DEFAULT_VOLUME,
    };
  } catch {
    return { enabled: true, volume: DEFAULT_VOLUME };
  }
}

let prefs: Prefs | null = null;
const listeners = new Set<() => void>();

function getPrefs(): Prefs {
  if (!prefs) prefs = typeof window === "undefined" ? { enabled: true, volume: DEFAULT_VOLUME } : readPrefs();
  return prefs;
}

function setPrefs(next: Prefs) {
  prefs = next;
  try {
    window.localStorage.setItem(ENABLED_KEY, next.enabled ? "1" : "0");
    window.localStorage.setItem(VOLUME_KEY, String(next.volume));
  } catch {
    /* private mode: the choice lasts for this tab only */
  }
  if (master) master.gain.value = next.volume * 0.5;
  listeners.forEach((l) => l());
}

export function setSoundEnabled(enabled: boolean) {
  setPrefs({ ...getPrefs(), enabled });
}

export function setSoundVolume(volume: number) {
  setPrefs({ ...getPrefs(), volume: Math.min(1, Math.max(0.05, volume)) });
}

/** For useSyncExternalStore. */
export function subscribeSoundPrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getSoundPrefs = getPrefs;
const SERVER_PREFS: Prefs = { enabled: true, volume: DEFAULT_VOLUME };
export const getServerSoundPrefs = () => SERVER_PREFS;

// ---------------------------------------------------------------- engine

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = getPrefs().volume * 0.5;
    // A gentle compressor keeps the chords from clipping when two sounds overlap.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = { f: number; f2?: number; type?: OscillatorType; t?: number; dur?: number; gain?: number; attack?: number };

function tone({ f, f2, type = "sine", t = 0, dur = 0.08, gain = 0.2, attack = 0.004 }: ToneOpts) {
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const now = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(master);
  o.start(now);
  o.stop(now + dur + 0.03);
}

// A struck bell: the fundamental plus two quieter, faster-decaying partials.
function bell(f: number, t = 0, dur = 0.6, gain = 0.12) {
  tone({ f, t, dur, gain, attack: 0.003 });
  tone({ f: f * 2.756, t, dur: dur * 0.45, gain: gain * 0.22, attack: 0.002 });
  tone({ f: f * 5.404, t, dur: dur * 0.2, gain: gain * 0.07, attack: 0.001 });
}

type NoiseOpts = { t?: number; dur?: number; gain?: number; freq?: number; to?: number; q?: number };

function noise({ t = 0, dur = 0.05, gain = 0.06, freq = 3000, to, q = 0.8 }: NoiseOpts) {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const s = c.createBufferSource();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  const now = c.currentTime + t;
  s.buffer = noiseBuf;
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(freq, now);
  if (to) bp.frequency.exponentialRampToValueAtTime(to, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  s.connect(bp).connect(g).connect(master);
  s.start(now);
  s.stop(now + dur + 0.02);
}

const LIBRARY: Record<SoundName, () => void> = {
  tap() { tone({ f: 1900, f2: 1250, dur: 0.035, gain: 0.05 }); noise({ dur: 0.014, gain: 0.02, freq: 5200 }); },
  press() { tone({ f: 523, f2: 784, dur: 0.075, gain: 0.09, type: "triangle" }); noise({ dur: 0.012, gain: 0.018, freq: 4000 }); },
  nav() { tone({ f: 1568, f2: 1760, dur: 0.03, gain: 0.03 }); },
  on() { tone({ f: 880, dur: 0.05, gain: 0.06 }); tone({ f: 1318.5, t: 0.045, dur: 0.07, gain: 0.06 }); },
  off() { tone({ f: 1318.5, dur: 0.05, gain: 0.05 }); tone({ f: 880, t: 0.045, dur: 0.07, gain: 0.05 }); },
  open() { noise({ dur: 0.17, gain: 0.03, freq: 900, to: 3800, q: 0.7 }); tone({ f: 659, f2: 988, dur: 0.12, gain: 0.03 }); },
  close() { noise({ dur: 0.12, gain: 0.025, freq: 3400, to: 800, q: 0.7 }); },
  pick() { tone({ f: 440, f2: 587, dur: 0.06, gain: 0.07, type: "triangle" }); },
  drop() { tone({ f: 330, f2: 196, dur: 0.1, gain: 0.11 }); noise({ dur: 0.02, gain: 0.03, freq: 1800 }); },
  success() { bell(1318.5, 0, 0.5, 0.09); bell(1975.5, 0.09, 0.75, 0.08); },
  error() {
    tone({ f: 233, f2: 196, dur: 0.12, gain: 0.1, type: "triangle" });
    tone({ f: 208, f2: 175, t: 0.13, dur: 0.15, gain: 0.09, type: "triangle" });
  },
  notify() { bell(1046.5, 0, 0.45, 0.07); bell(1568, 0.08, 0.45, 0.07); bell(2093, 0.16, 0.7, 0.06); },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, i * 0.075, 0.9, 0.075));
    noise({ t: 0.3, dur: 0.9, gain: 0.025, freq: 7000, to: 9000, q: 1.5 });
  },
};

export const SOUND_NAMES = Object.keys(LIBRARY) as SoundName[];

const lastPlayed: Partial<Record<SoundName, number>> = {};

/**
 * Play one interface sound. Silent when the person has switched sounds off,
 * when the tab is in the background, or when the browser has no Web Audio.
 * Never throws.
 */
export function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  if (!getPrefs().enabled || document.visibilityState === "hidden") return;
  const now = performance.now();
  const last = lastPlayed[name];
  if (last && now - last < REPEAT_MS) return;
  lastPlayed[name] = now;
  try {
    LIBRARY[name]();
  } catch {
    /* audio unavailable */
  }
}
