import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// A Web Audio stand-in that counts what gets scheduled, so the gating rules in
// sound.ts can be checked without a browser.
let started = 0;
let initialState: AudioContextState = "running";

class FakeParam {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  type = "";
  buffer: unknown = null;
  connect(next: FakeNode) {
    return next;
  }
  start() {
    started++;
  }
  stop() {}
}
class FakeAudioContext {
  state: AudioContextState = initialState;
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  createGain() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBuffer(_c: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  // Like a browser, resume() settles asynchronously.
  resume() {
    return Promise.resolve().then(() => {
      this.state = "running";
    });
  }
}

const store = new Map<string, string>();

async function load() {
  vi.resetModules();
  return import("./sound");
}

beforeEach(() => {
  started = 0;
  initialState = "running";
  store.clear();
  vi.stubGlobal("window", {
    AudioContext: FakeAudioContext,
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
  vi.stubGlobal("document", { visibilityState: "visible" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playSound", () => {
  it("is silent outside the team workspace (no SoundRuntime registered)", async () => {
    const s = await load();
    s.unlockSound();
    s.playSound("tap");
    expect(started).toBe(0);
  });

  it("plays once a runtime is registered and audio is unlocked", async () => {
    const s = await load();
    const unregister = s.registerSoundRuntime();
    s.unlockSound();
    s.playSound("tap");
    expect(started).toBeGreaterThan(0);
    unregister();
    started = 0;
    s.playSound("press");
    expect(started).toBe(0);
  });

  it("drops a sound asked for before audio is unlocked instead of queueing it", async () => {
    const s = await load();
    s.registerSoundRuntime();
    s.playSound("notify");
    expect(started).toBe(0);
  });

  it("drops sounds while the context is still suspended, then plays once it runs", async () => {
    initialState = "suspended";
    const s = await load();
    s.registerSoundRuntime();
    s.unlockSound(); // created suspended; resume() is in flight
    s.playSound("tap");
    expect(started).toBe(0);
    await Promise.resolve();
    s.playSound("tap");
    expect(started).toBeGreaterThan(0);
  });

  it("respects the Sounds switch and a hidden tab, except for alerts", async () => {
    const s = await load();
    s.registerSoundRuntime();
    s.unlockSound();

    s.setSoundEnabled(false);
    s.playSound("notify");
    expect(started).toBe(0);
    s.playSound("notify", { alert: true });
    expect(started).toBeGreaterThan(0);

    s.setSoundEnabled(true);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    started = 0;
    s.playSound("success");
    expect(started).toBe(0);
    s.playSound("error", { alert: true });
    expect(started).toBeGreaterThan(0);
  });

  it("remembers the switch and volume per browser", async () => {
    const s = await load();
    s.setSoundEnabled(false);
    s.setSoundVolume(0.85);
    expect(store.get("vg:sound:on")).toBe("0");
    expect(store.get("vg:sound:volume")).toBe("0.85");
    const again = await load();
    expect(again.getSoundPrefs()).toEqual({ enabled: false, volume: 0.85 });
  });
});
