// Pool physics. Balls move in the table plane (x, z) and carry a full 3D spin (wx, wy, wz),
// so follow, draw, stun and side spin all come out of the sliding and rolling friction model.
import { HL, HW, R, POCKETS, MOUTH_C, MOUTH_S } from './config.js';

const G = 9.81;
const MU_SLIDE = 0.2;      // ball on cloth while sliding
const MU_ROLL = 0.015;     // rolling resistance
const SPIN_DECEL = 11;     // rad/s^2 decay of side spin
const E_BALL = 0.95;       // ball to ball restitution
const E_CUSHION = 0.85;    // cushion restitution
const CUSHION_GRIP = 0.14; // how much the cushion grabs side spin and sliding speed

// Cushion noses as line segments with inward normals.
export const SEGMENTS = [];
for (const s of [-1, 1]) {
  SEGMENTS.push({ ax: -HL + MOUTH_C, az: s * HW, bx: -MOUTH_S, bz: s * HW, nx: 0, nz: -s });
  SEGMENTS.push({ ax: MOUTH_S, az: s * HW, bx: HL - MOUTH_C, bz: s * HW, nx: 0, nz: -s });
  SEGMENTS.push({ ax: s * HL, az: -HW + MOUTH_C, bx: s * HL, bz: HW - MOUTH_C, nx: -s, nz: 0 });
}

export function makeBall(n) {
  return { n, x: 0, z: 0, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, potted: false, sink: 0, pocket: null };
}

export function isMoving(b) {
  return !b.potted && (b.vx !== 0 || b.vz !== 0 || b.wy !== 0 || Math.abs(b.wx) + Math.abs(b.wz) > 0.01);
}

export function anyMoving(balls) {
  for (const b of balls) if (isMoving(b)) return true;
  return false;
}

// Strike the cue ball: direction (dx, dz), speed V, tip offset a (right) and b (up) in metres.
export function strike(cue, dx, dz, V, a = 0, b = 0) {
  const k = (2.5 * V) / (R * R);
  cue.vx = dx * V; cue.vz = dz * V;
  cue.wy = a * k;
  cue.wx = b * k * dz;
  cue.wz = -b * k * dx;
}

function motion(b, h) {
  const ux = b.vx + R * b.wz, uz = b.vz - R * b.wx;
  const u = Math.hypot(ux, uz);
  if (u > 3.5 * MU_SLIDE * G * h) {
    // Sliding: friction opposes the slip at the contact point and torques the ball.
    const ax = (-MU_SLIDE * G * ux) / u, az = (-MU_SLIDE * G * uz) / u;
    b.vx += ax * h; b.vz += az * h;
    b.wx -= (2.5 / R) * az * h;
    b.wz += (2.5 / R) * ax * h;
  } else {
    // Rolling.
    const sp = Math.hypot(b.vx, b.vz);
    const dec = MU_ROLL * G * h;
    if (sp <= dec + 0.004) { b.vx = 0; b.vz = 0; }
    else { const k = (sp - dec) / sp; b.vx *= k; b.vz *= k; }
    b.wx = b.vz / R; b.wz = -b.vx / R;
  }
  const d = SPIN_DECEL * h;
  if (Math.abs(b.wy) <= d) b.wy = 0; else b.wy -= Math.sign(b.wy) * d;
  b.x += b.vx * h; b.z += b.vz * h;
}

function bounce(b, nx, nz, ev) {
  const vn = b.vx * nx + b.vz * nz;
  if (vn >= 0) return;
  const tx = -nz, tz = nx;
  let vt = b.vx * tx + b.vz * tz;
  const slip = vt + R * b.wy;
  const lim = 0.3 * -vn * (1 + E_CUSHION);
  const dv = Math.max(-lim, Math.min(lim, -CUSHION_GRIP * slip));
  vt += dv;
  b.wy += (2.5 * dv) / R;
  // Softer rebound on hard hits, like real rubber.
  const e = E_CUSHION * (1 - Math.min(0.15, -vn * 0.02));
  const out = -e * vn;
  b.vx = vt * tx + out * nx; b.vz = vt * tz + out * nz;
  // The cushion nose sits above the ball's centre, so it kills most of the roll into the rail
  // and leaves a little in the new direction. Without this a rolling ball dies on every rail.
  const rx = -R * b.wz, rz = R * b.wx;
  const rn = rx * nx + rz * nz, rt = rx * tx + rz * tz;
  const rn2 = -0.15 * rn;
  const qx = rt * tx + rn2 * nx, qz = rt * tz + rn2 * nz;
  b.wz = -qx / R; b.wx = qz / R;
  if (ev && ev.cushion) ev.cushion(b, -vn);
}

function cushions(b, ev) {
  for (const s of SEGMENTS) {
    const rx = b.x - s.ax, rz = b.z - s.az;
    const d = rx * s.nx + rz * s.nz;
    if (d >= R || d <= -R) continue;
    const tx = s.bx - s.ax, tz = s.bz - s.az;
    const t = (rx * tx + rz * tz) / (tx * tx + tz * tz);
    if (t >= 0 && t <= 1) {
      b.x += (R - d) * s.nx; b.z += (R - d) * s.nz;
      bounce(b, s.nx, s.nz, ev);
    } else {
      // Pocket knuckle: the end of the cushion acts as a point.
      const px = t < 0 ? s.ax : s.bx, pz = t < 0 ? s.az : s.bz;
      const ex = b.x - px, ez = b.z - pz;
      const dist = Math.hypot(ex, ez);
      if (dist < R && dist > 1e-6) {
        const nx = ex / dist, nz = ez / dist;
        b.x += (R - dist) * nx; b.z += (R - dist) * nz;
        bounce(b, nx, nz, ev);
      }
    }
  }
}

function pockets(b, ev) {
  let hit = null;
  for (const p of POCKETS) {
    const dx = b.x - p.x, dz = b.z - p.z;
    if (dx * dx + dz * dz < p.r * p.r) { hit = p; break; }
  }
  if (!hit && (Math.abs(b.x) > HL + R * 0.6 || Math.abs(b.z) > HW + R * 0.6)) {
    let best = Infinity;
    for (const p of POCKETS) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < best) { best = d; hit = p; } }
  }
  if (hit) {
    const speed = Math.hypot(b.vx, b.vz);
    b.potted = true; b.pocket = hit; b.sink = 0.0001;
    b.vx = b.vz = b.wx = b.wy = b.wz = 0;
    if (ev && ev.pocket) ev.pocket(b, hit, speed);
  }
}

function substep(balls, h, ev) {
  const n = balls.length;
  for (let i = 0; i < n; i++) { const b = balls[i]; if (!b.potted) motion(b, h); }
  for (let i = 0; i < n; i++) {
    const p = balls[i]; if (p.potted) continue;
    for (let j = i + 1; j < n; j++) {
      const q = balls[j]; if (q.potted) continue;
      const dx = q.x - p.x, dz = q.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= 4 * R * R || d2 < 1e-12) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      const push = (2 * R - d) / 2;
      p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
      const vn = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
      if (vn < 0) {
        const j2 = (-(1 + E_BALL) * vn) / 2;
        p.vx -= j2 * nx; p.vz -= j2 * nz; q.vx += j2 * nx; q.vz += j2 * nz;
        if (ev && ev.hit) ev.hit(p, q, -vn);
      }
    }
  }
  for (let i = 0; i < n; i++) { const b = balls[i]; if (!b.potted) { cushions(b, ev); pockets(b, ev); } }
}

export function step(balls, dt, ev) {
  let vmax = 0;
  for (const b of balls) if (!b.potted) vmax = Math.max(vmax, Math.hypot(b.vx, b.vz));
  const n = Math.max(2, Math.min(60, Math.ceil((vmax * dt) / (R * 0.3))));
  const h = dt / n;
  for (let i = 0; i < n; i++) substep(balls, h, ev);
}

// Geometric preview used by the cue assist: where the cue ball first lands and what it does there.
export function predict(balls, cue, dx, dz) {
  let best = Infinity, hit = null;
  for (const b of balls) {
    if (b === cue || b.potted) continue;
    const ox = b.x - cue.x, oz = b.z - cue.z;
    const proj = ox * dx + oz * dz;
    if (proj <= 0) continue;
    const perp2 = ox * ox + oz * oz - proj * proj;
    if (perp2 < 4 * R * R) {
      const t = proj - Math.sqrt(4 * R * R - perp2);
      if (t < best) { best = t; hit = b; }
    }
  }
  let tc = Infinity, nx = 0, nz = 0;
  if (dx > 1e-6) { const t = (HL - R - cue.x) / dx; if (t < tc) { tc = t; nx = -1; nz = 0; } }
  if (dx < -1e-6) { const t = (-HL + R - cue.x) / dx; if (t < tc) { tc = t; nx = 1; nz = 0; } }
  if (dz > 1e-6) { const t = (HW - R - cue.z) / dz; if (t < tc) { tc = t; nx = 0; nz = -1; } }
  if (dz < -1e-6) { const t = (-HW + R - cue.z) / dz; if (t < tc) { tc = t; nx = 0; nz = 1; } }
  if (hit && best < tc) {
    const gx = cue.x + dx * best, gz = cue.z + dz * best;
    const ox = (hit.x - gx) / (2 * R), oz = (hit.z - gz) / (2 * R);
    const dot = dx * ox + dz * oz;
    let cx = dx - dot * ox, cz = dz - dot * oz;
    const cl = Math.hypot(cx, cz);
    if (cl > 1e-4) { cx /= cl; cz /= cl; } else { cx = 0; cz = 0; }
    return { type: 'ball', t: best, x: gx, z: gz, ball: hit, ox, oz, cx, cz, fullness: dot };
  }
  const d = dx * nx + dz * nz;
  return { type: 'cushion', t: tc, x: cue.x + dx * tc, z: cue.z + dz * tc, rx: dx - 2 * d * nx, rz: dz - 2 * d * nz };
}
