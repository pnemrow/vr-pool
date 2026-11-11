import * as THREE from 'three';
import { HL, R, BALL_COLORS } from './config.js';
import { makeBall } from './physics.js';

function ballTexture(n) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const ivory = '#f3ead6';
  if (n === 0) {
    g.fillStyle = ivory; g.fillRect(0, 0, 512, 256);
    // Small red spots so you can read the spin on the cue ball.
    g.fillStyle = '#b3241f';
    for (const [u, v] of [[0.25, 0.5], [0.75, 0.5], [0, 0.5], [0.5, 0.5], [1, 0.5]]) {
      g.beginPath(); g.arc(u * 512, v * 256, 9, 0, Math.PI * 2); g.fill();
    }
    g.fillRect(0, 0, 512, 7); g.fillRect(0, 249, 512, 7);
  } else {
    const col = BALL_COLORS[n > 8 ? n - 8 : n];
    if (n > 8) {
      g.fillStyle = ivory; g.fillRect(0, 0, 512, 256);
      g.fillStyle = col; g.fillRect(0, 74, 512, 108);
    } else {
      g.fillStyle = col; g.fillRect(0, 0, 512, 256);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${n > 9 ? 40 : 46}px Georgia, "Times New Roman", serif`;
    for (const u of [0.25, 0.75]) {
      g.fillStyle = ivory;
      g.beginPath(); g.arc(u * 512, 128, 33, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#141414';
      g.fillText(String(n), u * 512, 131);
      if (n === 6 || n === 9) g.fillRect(u * 512 - 12, 152, 24, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createBalls(parent) {
  const geo = new THREE.SphereGeometry(R, 40, 28);
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const shadowGeo = new THREE.PlaneGeometry(R * 3.3, R * 3.3).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const balls = [];
  for (let n = 0; n < 16; n++) {
    const b = makeBall(n);
    b.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ballTexture(n), roughness: 0.12, metalness: 0.0, envMapIntensity: 1.1 }));
    b.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    b.shadow.renderOrder = 1;
    parent.add(b.mesh, b.shadow);
    balls.push(b);
  }
  return balls;
}

export function rack(balls) {
  for (const b of balls) {
    b.potted = false; b.sink = 0; b.pocket = null; b.off = false;
    b.y = 0; b.vy = 0;
    b.vx = b.vz = b.wx = b.wy = b.wz = 0;
    b.mesh.visible = true; b.shadow.visible = true;
    b.mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
  }
  const cue = balls[0];
  cue.x = -HL / 2; cue.z = 0;
  cue.mesh.quaternion.identity();
  // Triangle with the apex on the foot spot, 8 in the middle, one solid and one stripe in the back corners.
  const solids = [1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
  const stripes = [9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
  const cornerA = solids.pop(), cornerB = stripes.pop();
  const rest = [...solids, ...stripes].sort(() => Math.random() - 0.5);
  const gap = 2 * R + 0.0006;
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      let n;
      if (row === 2 && i === 1) n = 8;
      else if (row === 4 && i === 0) n = cornerA;
      else if (row === 4 && i === 4) n = cornerB;
      else n = rest[k++];
      const b = balls[n];
      b.x = HL / 2 + row * gap * 0.8660254;
      b.z = (i - row / 2) * gap;
    }
  }
}

const _axis = new THREE.Vector3(), _q = new THREE.Quaternion();
export function syncBalls(balls, dt) {
  for (const b of balls) {
    if (b.potted) {
      if (b.off && b.mesh.visible) { b.mesh.visible = false; b.shadow.visible = false; }
      if (b.sink > 0 && b.mesh.visible) {
        // Drop into the pocket.
        b.sink += dt;
        const t = Math.min(1, b.sink / 0.28);
        b.x += (b.pocket.x - b.x) * Math.min(1, dt * 14);
        b.z += (b.pocket.z - b.z) * Math.min(1, dt * 14);
        b.mesh.position.set(b.x, R - t * t * 0.11, b.z);
        b.shadow.visible = false;
        if (t >= 1) { b.mesh.visible = false; b.sink = 0; }
      }
      continue;
    }
    b.mesh.position.set(b.x, R + b.y, b.z);
    b.shadow.position.set(b.x, 0.0012, b.z);
    const sh = 1 + b.y * 6;
    b.shadow.scale.set(sh, 1, sh);
    b.shadow.visible = b.y < 0.25;
    const w = Math.hypot(b.wx, b.wy, b.wz);
    if (w > 1e-4) {
      _axis.set(b.wx / w, b.wy / w, b.wz / w);
      _q.setFromAxisAngle(_axis, w * dt);
      b.mesh.quaternion.premultiply(_q);
    }
  }
}

export function ballsSettled(balls) {
  for (const b of balls) if (b.potted && b.sink > 0 && b.mesh.visible) return false;
  return true;
}
