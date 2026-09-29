export function createRaffleSpinSound({
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  let context = null;
  let intervalId = null;
  let tickIndex = 0;

  function tick() {
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.frequency.setValueAtTime(520 + (tickIndex++ % 5) * 35, now);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  return {
    start() {
      if (!AudioContextClass || context) return false;
      try {
        context = new AudioContextClass();
        context.resume?.().catch?.(() => {});
        tick();
        intervalId = setIntervalFn(tick, 75);
        return true;
      } catch {
        context = null;
        return false;
      }
    },
    async stop() {
      if (intervalId !== null) {
        clearIntervalFn(intervalId);
        intervalId = null;
      }
      const activeContext = context;
      context = null;
      if (activeContext) {
        try { await activeContext.close(); } catch { /* Audio cleanup must not interrupt the raffle. */ }
      }
    },
  };
}
