import * as THREE from 'three';
import { rng } from './config.js';

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

export function drawWood(g, w, h, base, dark, light, seed = 7, x0 = 0, y0 = 0) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(x0, y0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = y0 + r() * h, a = 0.04 + r() * 0.16;
    g.strokeStyle = r() < 0.72 ? dark : light;
    g.globalAlpha = a; g.lineWidth = 0.5 + r() * 2.2;
    g.beginPath();
    const amp = 2 + r() * 5, ph = r() * 6.28, f = 0.004 + r() * 0.01;
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin(x * f + ph) * amp;
      if (x === 0) g.moveTo(x0 + x, yy); else g.lineTo(x0 + x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function woodTex(base = '#4b2613', dark = '#1f0d05', light = '#8a4f27', seed = 7, repeat = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => drawWood(g, w, h, base, dark, light, seed), { repeat });
}

export function feltTex(color = '#0f5a3c', seed = 3) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 18;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: [6, 6] });
}
