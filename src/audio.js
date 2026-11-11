// All sound is synthesised, so there are no audio files to download.
export class Sound {
  constructor() { this.ctx = null; this.last = {}; }
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  limit(key, ms) {
    const now = performance.now();
    if (now - (this.last[key] || 0) < ms) return true;
    this.last[key] = now; return false;
  }
  tone(freq, dur, vol, type = 'sine', slide = 1) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.3, dur + 0.02);
  }
  ball(speed) {
    if (!this.ctx || this.limit('ball', 18)) return;
    const v = Math.min(1, 0.08 + speed / 5);
    this.tone(2300 + Math.random() * 500, 0.03, 0.5 * v, 'triangle');
    this.burst(0.022, 0.7 * v, 3800, 0.8);
  }
  cushion(speed) {
    if (!this.ctx || this.limit('cushion', 40)) return;
    const v = Math.min(1, 0.1 + speed / 5);
    this.tone(150, 0.11, 0.55 * v, 'sine', 0.5);
    this.burst(0.05, 0.25 * v, 500, 0.7, 'lowpass');
  }
  pocket() {
    if (!this.ctx) return;
    this.tone(95, 0.22, 0.7, 'sine', 0.6);
    this.burst(0.09, 0.4, 420, 0.8, 'lowpass');
    for (let i = 1; i <= 3; i++) this.burst(0.03, 0.22 / i, 1500, 1.2, 'bandpass', 0.11 * i + Math.random() * 0.03);
  }
  cue(speed) {
    if (!this.ctx) return;
    const v = Math.min(1, 0.15 + speed / 7);
    this.tone(820, 0.045, 0.6 * v, 'triangle', 0.7);
    this.burst(0.03, 0.6 * v, 1900, 0.7);
  }
  ui(up = true) { if (this.ctx) this.tone(up ? 660 : 440, 0.06, 0.12, 'sine'); }
  win() { if (this.ctx) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 0.18, 'triangle'), i * 130)); }
  lose() { if (this.ctx) [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 0.16, 'triangle'), i * 170)); }
}
