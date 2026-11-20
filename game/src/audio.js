// Procedural sound with the Web Audio API: every effect is synthesised, so the game
// needs no audio files and stays silent until the player's first key or click (the
// browser's autoplay rule). One tiny engine hum follows the player's car speed, and
// a two-tone siren sounds while police are close and the player is wanted. While
// dusk mode is on, a quiet cricket bed chirps underneath everything.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let duskOn = false;
  let duskTimer = 0;

  function ensure() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.02);
  }

  function noise(seconds, volume, lowpass) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  /** One cricket: three short, very quiet high pulses. Synthesised, like everything else. */
  function chirp() {
    if (!ensure()) return;
    const base = 4100 + Math.random() * 400;
    for (let i = 0; i < 3; i += 1) {
      setTimeout(() => blip(base, base - 250, 0.035, 'sine', 0.026), i * 72);
    }
  }

  return {
    unlock() { ensure(); },
    /** Dusk ambience on/off, driven by the game's dusk toggle. Chirps already
     *  scheduled are one-shots under a quarter-second, so switching off stops clean. */
    setDusk(on) {
      duskOn = on;
      if (on) duskTimer = 0.3;
    },
    shot() { noise(0.09, 0.5, 2600); blip(220, 60, 0.08, 'square', 0.18); },
    punch() { noise(0.07, 0.35, 700); },
    hit() { blip(160, 70, 0.12, 'square', 0.25); },
    crash(intensity) { noise(0.22, Math.min(0.7, 0.2 + intensity * 0.4), 900); },
    pickup() { blip(660, 990, 0.12, 'sine', 0.3); },
    cash() { blip(880, 1320, 0.16, 'sine', 0.3); blip(1320, 1760, 0.2, 'sine', 0.18); },
    mission() { blip(523, 523, 0.12, 'sine', 0.3); setTimeout(() => blip(784, 784, 0.2, 'sine', 0.3), 110); },
    busted() { blip(392, 130, 0.6, 'sawtooth', 0.3); },
    wasted() { blip(220, 55, 0.9, 'sawtooth', 0.3); },
    door() { blip(180, 120, 0.07, 'square', 0.15); },
    /** Called every frame: engine note from the driven car's speed, siren from police distance. */
    update(dt, engineSpeed01, siren01) {
      if (ctx === null) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(engineSpeed01 > 0.01 ? 0.05 + engineSpeed01 * 0.05 : 0, t, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + engineSpeed01 * 165, t, 0.08);
      sirenPhase += dt * 2.4;
      const tone = Math.sin(sirenPhase * Math.PI) > 0 ? 740 : 988;
      sirenOsc.frequency.setTargetAtTime(tone, t, 0.03);
      sirenGain.gain.setTargetAtTime(siren01 * 0.045, t, 0.1);
      // Dusk bed: a cricket chirps every second or two while dusk mode is on.
      if (duskOn) {
        duskTimer -= dt;
        if (duskTimer <= 0) {
          duskTimer = 0.9 + Math.random() * 1.6;
          chirp();
        }
      }
    },
  };
}
