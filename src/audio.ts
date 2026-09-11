const STORAGE_KEY = 'neon-rush-sound';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      this.enabled = true;
    }
  }

  /** Must be called at least once from a user gesture. */
  ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.01);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    when = 0,
  ) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, gain: number, freq = 1200, when = 0) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  click() {
    this.tone(660, 0.08, 'triangle', 0.22, 880);
  }
  start() {
    this.tone(220, 0.28, 'sawtooth', 0.18, 440);
    this.tone(330, 0.28, 'square', 0.06, 660, 0.05);
  }
  collect(combo: number) {
    const base = 520 * Math.pow(1.06, combo);
    this.tone(base, 0.13, 'sine', 0.28, base * 1.5);
    this.tone(base * 2, 0.09, 'sine', 0.1, base * 2.4, 0.02);
  }
  collide() {
    this.noise(0.35, 0.5, 700);
    this.tone(160, 0.4, 'sawtooth', 0.32, 40);
  }
  gameOver() {
    this.tone(440, 0.5, 'sawtooth', 0.18, 110);
    this.tone(220, 0.65, 'triangle', 0.14, 55, 0.1);
  }
  newHigh() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.13, f, i * 0.09));
  }
  pause() {
    this.tone(520, 0.1, 'sine', 0.18, 260);
  }
}