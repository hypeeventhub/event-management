import assert from "node:assert/strict";
import test from "node:test";

import { createRaffleSpinSound } from "../lib/raffle-spin-sound.mjs";

test("starts ticking and releases every audio resource when stopped", async () => {
  const observations = { oscillators: 0, intervals: [], cleared: [], closed: 0 };
  class AudioContextFake {
    constructor() { this.currentTime = 1; this.destination = {}; }
    createOscillator() {
      observations.oscillators += 1;
      return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    close() { observations.closed += 1; return Promise.resolve(); }
  }

  const sound = createRaffleSpinSound({
    AudioContextClass: AudioContextFake,
    setIntervalFn(callback, delay) { observations.intervals.push(delay); callback(); return 17; },
    clearIntervalFn(id) { observations.cleared.push(id); },
  });

  assert.equal(sound.start(), true);
  assert.equal(observations.oscillators, 2);
  assert.deepEqual(observations.intervals, [75]);
  await sound.stop();
  assert.deepEqual(observations.cleared, [17]);
  assert.equal(observations.closed, 1);
});

test("silently stays disabled when Web Audio is unavailable", async () => {
  const sound = createRaffleSpinSound({ AudioContextClass: undefined });

  assert.equal(sound.start(), false);
  await assert.doesNotReject(sound.stop());
});
