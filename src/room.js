// The Gentleman's Club: walnut panelling, deep green walls, oxblood leather, brass and low light.
import * as THREE from 'three';
import { canvasTex, drawWood, woodTex } from './textures.js';
import { rng } from './config.js';

const RX = 5.2, RZ = 4.2, H = 3.3;

function wallTex() {
  return canvasTex(512, 1024, (g, w, h) => {
    // Upper wall: dark green with a fine gold pinstripe.
    g.fillStyle = '#12261f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = 'rgba(190,150,70,0.16)'; g.fillRect(x + 15, 0, 2, h);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 10, h);
    }
    // Crown moulding.
    drawWood(g, w, 46, '#2a140a', '#120703', '#5a3018', 21, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 46, w, 5);
    g.fillStyle = 'rgba(200,160,90,0.25)'; g.fillRect(0, 40, w, 2);
    // Wainscot.
    const y0 = h * 0.62;
    drawWood(g, w, h - y0, '#3a1c0e', '#160904', '#74401f', 22, 0, y0);
    g.fillStyle = 'rgba(210,170,100,0.3)'; g.fillRect(0, y0, w, 3);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, y0 + 14, w, 5);
    for (const px of [28, 284]) {
      const pw = 200, py = y0 + 48, ph = h - y0 - 110;
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 5; g.strokeRect(px, py, pw, ph);
      g.strokeStyle = 'rgba(190,130,70,0.28)'; g.lineWidth = 2; g.strokeRect(px + 5, py + 5, pw - 10, ph - 10);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(px + 18, py + 18, pw - 36, ph - 36);
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, h - 44, w, 4);
  });
}

function carpetTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#35090f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(190,140,60,0.2)'; g.lineWidth = 2;
    for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) {
      const cx = i * 128 + (j % 2 ? 64 : 0) + 64, cy = j * 64 + 32;
      g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 40, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 40, cy); g.closePath(); g.stroke();
      g.fillStyle = 'rgba(190,140,60,0.22)'; g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill();
    }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }, { repeat: [RX * 2 / 1.1, RZ * 2 / 1.1] });
}

function booksTex() {
  return canvasTex(1024, 768, (g, w, h) => {
    const r = rng(42);
    drawWood(g, w, h, '#24110a', '#0c0502', '#4a2814', 9);
    const cols = ['#5a1a1a', '#1d3a2c', '#1c2a4a', '#3a2a14', '#4a3a1a', '#2a1a2e', '#6a4a22', '#182018', '#401818'];
    const shelves = 4, sh = h / shelves;
    for (let s = 0; s < shelves; s++) {
      const y1 = (s + 1) * sh - 16;
      g.fillStyle = '#0a0503'; g.fillRect(14, s * sh + 12, w - 28, sh - 28);
      let x = 22;
      while (x < w - 60) {
        const bw = 16 + r() * 26, bh = sh * (0.5 + r() * 0.32);
        if (r() < 0.07) { x += bw * 1.5; continue; }
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.fillRect(x, y1 - bh, bw - 2, bh);
        g.fillStyle = 'rgba(200,160,80,0.55)';
        g.fillRect(x + 2, y1 - bh + 10, bw - 6, 2); g.fillRect(x + 2, y1 - bh + 16, bw - 6, 1); g.fillRect(x + 2, y1 - 18, bw - 6, 2);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y1 - bh, 3, bh);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + bw - 5, y1 - bh, 3, bh);
        x += bw;
      }
      drawWood(g, w, 16, '#3a1c0e', '#160904', '#74401f', 30 + s, 0, y1);
    }
  }, {});
}

function paintingTex(seed) {
  return canvasTex(512, 384, (g, w, h) => {
    const r = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    const skies = [['#2a3140', '#b98a4e'], ['#1d2a2e', '#8f9a7a'], ['#3a2420', '#d0a060']][seed % 3];
    sky.addColorStop(0, skies[0]); sky.addColorStop(0.7, skies[1]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 4; layer++) {
      const base = h * (0.5 + layer * 0.13);
      const shade = 60 - layer * 14;
      g.fillStyle = `rgb(${shade + 8},${shade + 14},${shade})`;
      g.beginPath(); g.moveTo(0, h);
      const ph = r() * 6, amp = 34 - layer * 6;
      for (let x = 0; x <= w; x += 8) g.lineTo(x, base + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.041 + ph * 2) * amp * 0.3);
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(20,10,0,0.25)'; g.fillRect(0, 0, w, h);
  }, {});
}

export function buildRoom() {
  const g = new THREE.Group();
  const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: carpetTex() }));
  g.add(floor);
  const ceilTex = woodTex('#1c0f08', '#090402', '#3a2012', 15, [4, 4]);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ map: ceilTex }));
  ceil.position.y = H; g.add(ceil);
  // Coffer beams.
  const beamMat = new THREE.MeshLambertMaterial({ map: woodTex('#22110a', '#0a0402', '#48281a', 16) });
  for (let i = -2; i <= 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, RZ * 2), beamMat); b.position.set(i * 2.1, H - 0.08, 0); g.add(b);
  }
  for (const z of [-2.1, 0, 2.1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(RX * 2, 0.14, 0.2), beamMat); b.position.set(0, H - 0.07, z); g.add(b);
  }

  const wt = wallTex();
  const mkWall = (len, x, z, ry) => {
    const t = wt.clone(); t.needsUpdate = true; t.repeat.set(len / 1.3, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, H / 2, z); m.rotation.y = ry; g.add(m);
  };
  mkWall(RX * 2, 0, -RZ, 0);
  mkWall(RX * 2, 0, RZ, Math.PI);
  mkWall(RZ * 2, -RX, 0, Math.PI / 2);
  mkWall(RZ * 2, RX, 0, -Math.PI / 2);

  const brass = new THREE.MeshStandardMaterial({ color: '#b08a3c', roughness: 0.3, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#8f6f2c', roughness: 0.45, metalness: 0.9 });

  // Pendant lamp over the table: brass bar, three green enamel shades.
  const lamp = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.7, 12).rotateZ(Math.PI / 2), brass);
  bar.position.y = 2.42; lamp.add(bar);
  const shadeGeo = new THREE.CylinderGeometry(0.05, 0.21, 0.17, 28, 1, true);
  const shadeOut = new THREE.MeshStandardMaterial({ color: '#0d3a27', roughness: 0.25, metalness: 0.2 });
  const shadeIn = new THREE.MeshBasicMaterial({ color: '#ffe9b8', side: THREE.BackSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff4d8' });
  for (const x of [-0.68, 0, 0.68]) {
    const o = new THREE.Mesh(shadeGeo, shadeOut), i = new THREE.Mesh(shadeGeo, shadeIn);
    o.position.set(x, 2.26, 0); i.position.copy(o.position); i.scale.setScalar(0.985);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.052, 0.05, 16), brass); cap.position.set(x, 2.37, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), bulbMat); bulb.position.set(x, 2.25, 0);
    lamp.add(o, i, cap, bulb);
  }
  for (const x of [-0.5, 0.5]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, H - 2.42, 8), brass);
    rod.position.set(x, (H + 2.42) / 2, 0); lamp.add(rod);
  }
  g.add(lamp);

  // Lighting: one warm pool of light on the table, the rest of the room kept low.
  const spot = new THREE.SpotLight('#ffe2b0', 17, 9, 1.0, 0.9, 1.6);
  spot.position.set(0, 2.3, 0); spot.target.position.set(0, 0, 0);
  g.add(spot, spot.target);
  g.add(new THREE.HemisphereLight('#ffd9a8', '#3a1a0c', 1.5));
  const sconceGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.16, 12, 1, true);
  const sconceMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a', side: THREE.DoubleSide });
  const sconce = (x, z, light) => {
    const s = new THREE.Mesh(sconceGeo, sconceMat); s.position.set(x, 2.0, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), brass); arm.position.set(x, 1.88, z);
    g.add(s, arm);
    if (light) { const p = new THREE.PointLight('#ffb866', 22, 9, 1.7); p.position.set(x * 0.94, 2.05, z * 0.94); g.add(p); }
  };
  sconce(-3, -RZ + 0.09, true); sconce(3, -RZ + 0.09, false); sconce(-3, RZ - 0.09, false); sconce(3, RZ - 0.09, true);
  sconce(-RX + 0.09, -2.2, false); sconce(-RX + 0.09, 2.2, false);
  const fill = new THREE.PointLight('#ffc27a', 16, 9, 1.7); fill.position.set(RX - 1.2, 2.3, 0); g.add(fill);

  // Bookcase on the far wall.
  const books = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.5), new THREE.MeshLambertMaterial({ map: booksTex() }));
  books.position.set(RX - 0.02, 1.3, 0); books.rotation.y = -Math.PI / 2; g.add(books);
  const caseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.62, 3.52), beamMat); caseFrame.position.set(RX + 0.035, 1.3, 0); g.add(caseFrame);

  // Paintings in gilt frames.
  const painting = (seed, x, z, ry, w = 1.1, h = 0.8) => {
    const grp = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.05), gold);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: paintingTex(seed) }));
    pic.position.z = 0.027; grp.add(fr, pic);
    grp.position.set(x, 2.02, z); grp.rotation.y = ry; g.add(grp);
  };
  painting(1, -2.05, -RZ + 0.04, 0); painting(2, 2.05, RZ - 0.04, Math.PI); painting(3, -RX + 0.04, 0, Math.PI / 2, 1.5, 0.95);

  // Leather club chairs and a side table with a decanter.
  const leather = new THREE.MeshStandardMaterial({ color: '#4a1014', roughness: 0.42, metalness: 0.05 });
  const chair = (x, z, ry) => {
    const c = new THREE.Group();
    const box = (w, h, d, px, py, pz, r = 0.04) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), leather); m.position.set(px, py, pz); c.add(m); return m;
    };
    box(0.72, 0.26, 0.74, 0, 0.3, 0);
    box(0.62, 0.12, 0.6, 0, 0.47, 0.04);
    box(0.84, 0.62, 0.2, 0, 0.62, -0.36);
    box(0.18, 0.4, 0.78, -0.42, 0.48, 0);
    box(0.18, 0.4, 0.78, 0.42, 0.48, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.17, 8), beamMat); leg.position.set(sx * 0.36, 0.085, sz * 0.32); c.add(leg);
    }
    c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  };
  chair(-4.3, -3.1, Math.PI / 4 + 0.2); chair(-4.3, 3.1, Math.PI * 0.75 - 0.2);
  chair(4.2, -3.2, -Math.PI / 4);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 24), beamMat); tableTop.position.set(-4.5, 0.55, 0);
  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, 0.54, 12), beamMat); tableLeg.position.set(-4.5, 0.27, 0);
  const glass = new THREE.MeshStandardMaterial({ color: '#a8601a', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 });
  const decanter = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.055, 0], [0.06, 0.1], [0.02, 0.16], [0.02, 0.21], [0.03, 0.22], [0, 0.22]].map(p => new THREE.Vector2(p[0], p[1])), 14), glass);
  decanter.position.set(-4.55, 0.57, 0.05);
  const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12), glass); tumbler.position.set(-4.4, 0.61, -0.1);
  g.add(tableTop, tableLeg, decanter, tumbler);

  // Wall cue rack.
  const rack = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.04), beamMat); rack.add(board);
  const shaft = new THREE.MeshLambertMaterial({ color: '#c9a36a' }), butt = new THREE.MeshLambertMaterial({ color: '#1a0d08' });
  for (let i = 0; i < 5; i++) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.8, 8), shaft); a.position.set(-0.3 + i * 0.15, 0.36, 0.05);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.7, 8), butt); b.position.set(-0.3 + i * 0.15, -0.39, 0.05);
    rack.add(a, b);
  }
  rack.position.set(2.9, 1.25, -RZ + 0.03); g.add(rack);

  // A rug under the table to anchor it.
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: canvasTex(512, 368, (c, w, h) => {
    c.fillStyle = '#10221c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8f6f2c'; c.lineWidth = 6; c.strokeRect(16, 16, w - 32, h - 32);
    c.lineWidth = 2; c.strokeRect(30, 30, w - 60, h - 60);
    c.strokeStyle = 'rgba(143,111,44,0.35)';
    c.strokeStyle = 'rgba(143,111,44,0.5)'; c.lineWidth = 1.5; c.strokeRect(44, 44, w - 88, h - 88);
  }) }));
  rug.position.y = 0.004; g.add(rug);

  g.userData.bounds = { x: RX - 0.4, z: RZ - 0.4 };
  g.userData.boardSpots = [
    { pos: [0, 2.0, -RZ + 0.05], ry: 0 },
    { pos: [0, 2.0, RZ - 0.05], ry: Math.PI },
  ];
  return g;
}
