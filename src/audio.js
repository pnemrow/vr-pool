// All sound is synthesised, so there are no audio files to download.
// The aim is weight: a dense phenolic clack with a short low knock under it, a dull cushion thud,
// a soft leather tip, and a faint rumble while balls roll. A small room reverb glues it together.
export class Sound {
  constructor() { this.ctx = null; this.last = {}; }
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.master = c.createGain(); this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
      this.master.connect(comp); comp.connect(c.destination);

      // Room: a short decaying noise impulse, like a panelled room with carpet.
      const rl = Math.floor(c.sampleRate * 0.5);
      const ir = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const r = ir.getChannelData(ch);
        for (let i = 0; i < rl; i++) r[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2);
      }
      const conv = c.createConvolver(); conv.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.16;
      const damp = c.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
      this.master.connect(conv); conv.connect(damp); damp.connect(wet); wet.connect(c.destination);

      // Rolling rumble, driven by how fast the balls are moving.
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 210; f.Q.value = 0.6;
      this.rollGain = c.createGain(); this.rollGain.gain.value = 0;
      src.connect(f); f.connect(this.rollGain); this.rollGain.connect(this.master); src.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  limit(key, ms) {
    const now = performance.now();
    if (now - (this.last[key] || 0) < ms) return true;
    this.last[key] = now; return false;
  }
  tone(freq, dur, vol, type = 'sine', slide = 1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.8, dur + 0.02);
  }
  // Two solid balls: a hard bright crack that dies in a few milliseconds, with a low knock for mass.
  ball(speed) {
    if (!this.ctx || this.limit('ball', 14)) return;
    const v = Math.min(1, Math.pow(speed / 4.5, 0.75));
    if (v < 0.015) return;
    const j = 0.92 + Math.random() * 0.16;
    this.burst(0.006, 1.5 * v, 4200 * j, 0.5, 'highpass');       // contact tick
    this.burst(0.014, 1.3 * v, 2100 * j, 0.9);                   // crack
    this.burst(0.03, 1.1 * v, 520, 0.8, 'lowpass');              // knock
    if (v > 0.25) this.tone(165 * j, 0.06, 0.55 * v * v, 'sine', 0.6);   // weight on hard hits
  }
  cushion(speed) {
    if (!this.ctx || this.limit('cushion', 40)) return;
    const v = Math.min(1, Math.pow(speed / 4.5, 0.7));
    if (v < 0.02) return;
    this.tone(105, 0.1, 0.8 * v, 'sine', 0.55);
    this.burst(0.05, 0.6 * v, 300, 0.7, 'lowpass');
  }
  land(speed) {
    if (!this.ctx || this.limit('land', 30)) return;
    const v = Math.min(1, speed / 2.5);
    this.tone(130, 0.09, 0.9 * v, 'sine', 0.55);
    this.burst(0.03, 0.8 * v, 700, 0.8, 'lowpass');
    this.burst(0.006, 0.5 * v, 2600, 0.7);
  }
  pocket() {
    if (!this.ctx) return;
    this.burst(0.02, 0.6, 900, 0.8, 'lowpass');                  // lip of the pocket
    this.tone(82, 0.2, 0.9, 'sine', 0.55, 0.06);                 // drop
    this.burst(0.1, 0.5, 260, 0.7, 'lowpass', 0.06);
    for (let i = 1; i <= 3; i++) this.burst(0.02, 0.3 / i, 1500, 1.0, 'bandpass', 0.07 + 0.09 * i + Math.random() * 0.03);
  }
  offTable() {
    if (!this.ctx) return;
    this.tone(70, 0.25, 0.8, 'sine', 0.6, 0.25);
    this.burst(0.12, 0.5, 240, 0.7, 'lowpass', 0.25);
  }
  // Leather tip on the cue ball: soft, short, lower than the ball crack.
  cue(speed) {
    if (!this.ctx) return;
    const v = Math.min(1, 0.2 + speed / 7);
    this.burst(0.022, 1.0 * v, 950, 0.8, 'lowpass');
    this.burst(0.008, 0.5 * v, 2400, 0.8);
    this.tone(310, 0.045, 0.5 * v, 'sine', 0.6);
  }
  // Call once a frame with the summed speed of the balls on the cloth.
  rolling(total) {
    if (!this.ctx) return;
    const target = Math.min(0.2, total * 0.022);
    this.rollGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }
  ui(up = true) { if (this.ctx) this.tone(up ? 620 : 440, 0.05, 0.1, 'sine'); }
  win() { if (this.ctx) [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 0.16, 'triangle', 1, i * 0.13)); }
  lose() { if (this.ctx) [392, 330, 262].forEach((f, i) => this.tone(f, 0.45, 0.14, 'triangle', 1, i * 0.17)); }
}
