// Aurelia Heat — fully procedural Web Audio sound.
// There are no audio files in this game: every effect is synthesised from
// oscillators and filtered noise at the moment it is needed. The engine stays
// silent until the first user gesture unlocks the AudioContext, as browsers
// require, and it degrades to a harmless no-op where audio is unavailable
// (including the headless smoke tests, which inject a stub instead).

function makeNoiseBuffer(ctx, seconds) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.unlocked = false;
    this.duskAmbience = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlip = 0;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoiseBuffer(this.ctx, 1.2);
    } catch (err) {
      this.ctx = null;
    }
  }

  setDusk(on) {
    this.duskAmbience = !!on;
  }

  tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  burst(dur, vol = 0.3, freq = 1200, delay = 0) {
    if (!this.ctx || !this.master || !this.noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  gunshot() {
    this.burst(0.14, 0.5, 2600);
    this.tone(150, 0.1, 'square', 0.25, 60);
  }

  punch() {
    this.burst(0.08, 0.35, 700);
    this.tone(90, 0.09, 'sine', 0.3, 45);
  }

  crash(strength = 1) {
    this.burst(0.3, 0.4 * strength, 900);
    this.tone(70, 0.28, 'sawtooth', 0.2 * strength, 35);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.22);
    this.tone(990, 0.14, 'sine', 0.22, null, 0.08);
  }

  cashRegister() {
    this.tone(880, 0.08, 'triangle', 0.25);
    this.tone(1174, 0.1, 'triangle', 0.25, null, 0.07);
    this.tone(1568, 0.18, 'triangle', 0.25, null, 0.15);
  }

  missionSting(success = true) {
    if (success) {
      this.tone(523, 0.14, 'triangle', 0.28);
      this.tone(659, 0.14, 'triangle', 0.28, null, 0.12);
      this.tone(784, 0.26, 'triangle', 0.3, null, 0.24);
    } else {
      this.tone(392, 0.2, 'triangle', 0.28);
      this.tone(311, 0.34, 'triangle', 0.28, null, 0.16);
    }
  }

  bustedFall() {
    this.tone(440, 0.9, 'sawtooth', 0.25, 55);
    this.burst(0.5, 0.2, 500, 0.1);
  }

  wastedFall() {
    this.tone(330, 1.1, 'triangle', 0.3, 40);
    this.tone(165, 1.1, 'sine', 0.25, 30, 0.1);
  }

  doorSlam() {
    this.burst(0.07, 0.3, 500);
  }

  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.master) return;
    if (!driving) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const base = this.duskAmbience ? 52 : 58;
    this.engineOsc.frequency.value = base + Math.abs(speedRatio) * 130;
    this.engineGain.gain.value = 0.05 + Math.abs(speedRatio) * 0.07;
  }

  setSiren(nearestPoliceDist) {
    if (!this.ctx || !this.master) return;
    const audible = nearestPoliceDist !== null && nearestPoliceDist < 900;
    if (!audible) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    }
    this.sirenFlip += 1;
    const high = this.sirenFlip % 40 < 20;
    this.sirenOsc.frequency.value = high ? 880 : 660;
    const closeness = 1 - nearestPoliceDist / 900;
    this.sirenGain.gain.value = 0.02 + closeness * 0.06;
  }

  stopLoops() {
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }
}

export function createStubAudio() {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };
  return {
    calls,
    unlocked: true,
    duskAmbience: false,
    unlock: record('unlock'),
    setDusk(on) { this.duskAmbience = !!on; calls.push({ name: 'setDusk', args: [on] }); },
    gunshot: record('gunshot'),
    punch: record('punch'),
    crash: record('crash'),
    pickup: record('pickup'),
    cashRegister: record('cashRegister'),
    missionSting: record('missionSting'),
    bustedFall: record('bustedFall'),
    wastedFall: record('wastedFall'),
    doorSlam: record('doorSlam'),
    setEngine: record('setEngine'),
    setSiren: record('setSiren'),
    stopLoops: record('stopLoops'),
  };
}
