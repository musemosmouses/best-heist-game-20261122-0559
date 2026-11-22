// Sound, WebAudio only: short synthesized blips and chimes, no audio files. The context is
// created on the first user gesture (browsers block sound before one); every call is guarded,
// so a headless run or a blocked context never breaks the game.

export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context !== null) return context !== false;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) {
        context = false;
        return false;
      }
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      context = false;
      return false;
    }
    return true;
  }

  /** One tone: `frequency` in Hz, `seconds` long, `type` of oscillator, sliding to `slideTo`. */
  function tone(frequency, seconds, type, slideTo) {
    if (!ensure() || context.state === 'suspended') {
      if (context && context.state === 'suspended') context.resume().catch(() => {});
      if (!context || context.state !== 'running') return;
    }
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + seconds);
      gain.gain.setValueAtTime(0.9, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      oscillator.stop(context.currentTime + seconds);
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  return {
    /** Unlock sound on the first click or keypress. */
    unlock() {
      ensure();
    },
    clink() {
      tone(1900, 0.12, 'triangle', 1200);
    },
    pickup() {
      tone(660, 0.12, 'sine', 990);
      setTimeout(() => tone(990, 0.16, 'sine', 1320), 90);
    },
    diamond() {
      tone(523, 0.16, 'sine');
      setTimeout(() => tone(659, 0.16, 'sine'), 120);
      setTimeout(() => tone(784, 0.24, 'sine'), 240);
    },
    alarm() {
      tone(440, 0.18, 'square', 620);
    },
    /** The clock's last-seconds tick, quiet so it never drowns the alarm. */
    tick() {
      tone(1200, 0.05, 'square');
    },
    win() {
      [523, 659, 784, 1047].forEach((note, index) => {
        setTimeout(() => tone(note, 0.22, 'triangle'), index * 130);
      });
    },
    lose() {
      tone(220, 0.5, 'sawtooth', 110);
    },
  };
}
