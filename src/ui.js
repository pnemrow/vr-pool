// In-world panels drawn on canvases: the menu you point at and the scoreboards on the walls.
import * as THREE from 'three';
import { BALL_COLORS } from './config.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const BRASS = '#c9a45a', INK = '#120d09', CREAM = '#efe4cc';

export class Menu {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 768; this.c.height = 1024;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.04), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
    this.items = []; this.hover = -1; this.title = ''; this.sub = '';
  }
  set(title, sub, items) { this.title = title; this.sub = sub; this.items = items; this.hover = -1; this.draw(); }
  layout() {
    const n = this.items.length, bh = Math.min(74, (1024 - 250) / n - 12);
    return this.items.map((it, i) => ({ x: 70, y: 210 + i * (bh + 12), w: 628, h: bh }));
  }
  draw() {
    const g = this.g, W = 768, H = 1024;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(16,11,8,0.95)'; rr(g, 8, 8, W - 16, H - 16, 26); g.fill();
    g.strokeStyle = BRASS; g.lineWidth = 3; rr(g, 20, 20, W - 40, H - 40, 18); g.stroke();
    g.lineWidth = 1; rr(g, 30, 30, W - 60, H - 60, 12); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = BRASS; g.font = `600 58px ${SERIF}`; g.fillText(this.title, W / 2, 100);
    g.fillStyle = CREAM; g.globalAlpha = 0.75; g.font = `italic 26px ${SERIF}`; g.fillText(this.sub, W / 2, 158); g.globalAlpha = 1;
    const boxes = this.layout();
    this.items.forEach((it, i) => {
      const b = boxes[i], hot = i === this.hover;
      rr(g, b.x, b.y, b.w, b.h, 10);
      if (hot) { g.fillStyle = BRASS; g.fill(); } else { g.fillStyle = 'rgba(201,164,90,0.08)'; g.fill(); g.strokeStyle = 'rgba(201,164,90,0.6)'; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = hot ? INK : CREAM;
      g.font = `${Math.min(32, b.h * 0.46)}px ${SERIF}`;
      if (it.value != null) {
        g.textAlign = 'left'; g.fillText(it.label, b.x + 26, b.y + b.h / 2 + 2);
        g.textAlign = 'right'; g.fillStyle = hot ? INK : BRASS; g.fillText(it.value, b.x + b.w - 26, b.y + b.h / 2 + 2);
        g.textAlign = 'center';
      } else g.fillText(it.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
    });
    this.tex.needsUpdate = true;
  }
  // uv from a raycast hit; returns the item index or -1.
  pick(uv) {
    if (!uv) return -1;
    const x = uv.x * 768, y = (1 - uv.y) * 1024;
    const boxes = this.layout();
    for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i; }
    return -1;
  }
  setHover(i) { if (i !== this.hover) { this.hover = i; this.draw(); return true; } return false; }
}

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export class Scoreboard {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 1024; this.c.height = 512;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex });
    this.geo = new THREE.PlaneGeometry(2.2, 1.1);
  }
  makeMesh() { return new THREE.Mesh(this.geo, this.mat); }
  // info: { title, players: [{name, group, left, balls:[n...]}], cur, msg, hint }
  draw(info) {
    const g = this.g, W = 1024, H = 512;
    g.fillStyle = '#0f1512'; g.fillRect(0, 0, W, H);
    g.strokeStyle = BRASS; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = BRASS; g.font = `600 44px ${SERIF}`; g.fillText(info.title, W / 2, 70);
    g.fillRect(W / 2 - 150, 104, 300, 2);
    info.players.forEach((p, i) => {
      const cx = i === 0 ? W * 0.27 : W * 0.73, active = info.cur === i;
      g.fillStyle = active ? CREAM : 'rgba(239,228,204,0.45)';
      g.font = `${active ? '600 ' : ''}46px ${SERIF}`; g.fillText(p.name, cx, 170);
      if (active) { g.fillStyle = BRASS; g.fillRect(cx - 90, 204, 180, 4); }
      g.fillStyle = 'rgba(239,228,204,0.7)'; g.font = `italic 28px ${SERIF}`;
      g.fillText(p.group ? p.group : (info.open ? 'open table' : ''), cx, 240);
      (p.balls || []).forEach((n, k) => {
        const bx = cx - (p.balls.length - 1) * 23 + k * 46, by = 300;
        const col = BALL_COLORS[n > 8 ? n - 8 : n];
        g.beginPath(); g.arc(bx, by, 19, 0, 6.3); g.fillStyle = n > 8 ? '#efe4cc' : col; g.fill();
        if (n > 8) { g.save(); g.clip(); g.fillStyle = col; g.fillRect(bx - 20, by - 10, 40, 20); g.restore(); }
      });
    });
    g.fillStyle = CREAM; g.font = `34px ${SERIF}`; g.fillText(info.msg || '', W / 2, 392);
    g.fillStyle = 'rgba(201,164,90,0.75)'; g.font = `italic 24px ${SERIF}`; g.fillText(info.hint || '', W / 2, 452);
    this.tex.needsUpdate = true;
  }
}
