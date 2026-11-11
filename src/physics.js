// Pool physics. Balls move in the table plane (x, z) and carry a full 3D spin (wx, wy, wz),
// so follow, draw, stun and side spin all come out of the sliding and rolling friction model.
import { HL, HW, R, POCKETS, MOUTH_C, MOUTH_S } from './config.js';

const G = 9.81;
const MU_SLIDE = 0.2;      // ball on cloth while sliding
const MU_ROLL = 0.014;     // rolling resistance
const SPIN_DECEL = 11;     // rad/s^2 decay of side spin
const E_BALL = 0.94;       // ball to ball restitution
const MU_BALL = 0.06;      // ball to ball friction (throw and spin transfer)
const E_SLATE = 0.5;       // bounce of a ball landing on the slate
const RAIL_CLEAR = 0.03;   // a ball this high clears the cushion nose
const E_CUSHION = 0.8;     // cushion restitution at low speed
const CUSHION_GRIP = 0.14; // how much the cushion grabs side spin and sliding speed

// Cushion noses as line segments with inward normals.
export const SEGMENTS = [];
for (const s of [-1, 1]) {
  SEGMENTS.push({ ax: -HL + MOUTH_C, az: s * HW, bx: -MOUTH_S, bz: s * HW, nx: 0, nz: -s });
  SEGMENTS.push({ ax: MOUTH_S, az: s * HW, bx: HL - MOUTH_C, bz: s * HW, nx: 0, nz: -s });
  SEGMENTS.push({ ax: s * HL, az: -HW + MOUTH_C, bx: s * HL, bz: HW - MOUTH_C, nx: -s, nz: 0 });
}

export function makeBall(n) {
  return { n, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, wx: 0, wy: 0, wz: 0, potted: false, sink: 0, pocket: null, off: false };
}

export function isMoving(b) {
  return !b.potted && (b.vx !== 0 || b.vz !== 0 || b.wy !== 0 || b.y > 0 || b.vy !== 0 || Math.abs(b.wx) + Math.abs(b.wz) > 0.01);
}

export function anyMoving(balls) {
  for (const b of balls) if (isMoving(b)) return true;
  return false;
}

// Strike the cue ball: direction (dx, dz), speed V, tip offset a (right) and b (up) in metres,
// and an optional upward launch speed for jump shots.
export function strike(cue, dx, dz, V, a = 0, b = 0, vy = 0) {
  const k = (2.5 * V) / (R * R);
  cue.vx = dx * V; cue.vz = dz * V;
  cue.wy = a * k;
  cue.wx = b * k * dz;
  cue.wz = -b * k * dx;
  cue.vy = vy > 0 ? vy : 0;
}

// A ball in the air: gravity only, then a bounce on the slate that grips the spin.
function flight(b, h, ev) {
  b.vy -= G * h;
  b.y += b.vy * h;
  b.x += b.vx * h; b.z += b.vz * h;
  if (b.y > 0) return;
  b.y = 0;
  const down = -b.vy;
  if (Math.abs(b.x) > HL + 0.012 || Math.abs(b.z) > HW + 0.012) {
    // Came down beyond the cushions: it has left the table.
    b.potted = true; b.off = true; b.sink = 0; b.vy = 0;
    const speed = Math.hypot(b.vx, b.vz);
    b.vx = b.vz = b.wx = b.wy = b.wz = 0;
    if (ev && ev.off) ev.off(b, speed);
    return;
  }
  if (down > 0.3) {
    // Landing grips the cloth: the slip at the contact point is partly killed in one hit.
    const ux = b.vx + R * b.wz, uz = b.vz - R * b.wx, u = Math.hypot(ux, uz);
    if (u > 1e-4) {
      const J = Math.min(MU_SLIDE * (1 + E_SLATE) * down, u / 3.5);
      const ax = (-J * ux) / u, az = (-J * uz) / u;
      b.vx += ax; b.vz += az;
      b.wx -= (2.5 / R) * az; b.wz += (2.5 / R) * ax;
    }
    b.vy = down * E_SLATE;
    if (ev && ev.land) ev.land(b, down);
  } else b.vy = 0;
}

function motion(b, h, ev) {
  if (b.y > 0 || b.vy > 0) { flight(b, h, ev); return; }
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
  const e = Math.max(0.55, E_CUSHION - 0.035 * -vn);
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
  if (b.y > RAIL_CLEAR) return;
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
  if (b.y > 0.02) return;
  let hit = null;
  for (const p of POCKETS) {
    const dx = b.x - p.x, dz = b.z - p.z;
    if (dx * dx + dz * dz < p.r * p.r) { hit = p; break; }
  }
  if (!hit && b.y <= 0 && (Math.abs(b.x) > HL + R * 0.6 || Math.abs(b.z) > HW + R * 0.6)) {
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

function collide(p, q, ev) {
  const dx = q.x - p.x, dz = q.z - p.z, dy = q.y - p.y;
  const d2 = dx * dx + dz * dz + dy * dy;
  if (d2 >= 4 * R * R || d2 < 1e-12) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
  const push = (2 * R - d) / 2;
  p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
  if (ny !== 0) { p.y = Math.max(0, p.y - ny * push); q.y = Math.max(0, q.y + ny * push); }
  const rvx = q.vx - p.vx, rvy = q.vy - p.vy, rvz = q.vz - p.vz;
  const vn = rvx * nx + rvy * ny + rvz * nz;
  if (vn >= 0) return;
  const jn = (-(1 + E_BALL) * vn) / 2;
  // Surface slip at the contact point, spins included. Friction here is what throws the object
  // ball slightly off line and passes a little spin across.
  const sx = p.wx + q.wx, sy = p.wy + q.wy, sz = p.wz + q.wz;
  let tx = rvx - R * (sy * nz - sz * ny), ty = rvy - R * (sz * nx - sx * nz), tz = rvz - R * (sx * ny - sy * nx);
  const tn = tx * nx + ty * ny + tz * nz;
  tx -= tn * nx; ty -= tn * ny; tz -= tn * nz;
  const tl = Math.hypot(tx, ty, tz);
  let fx = 0, fy = 0, fz = 0;
  if (tl > 1e-5) {
    const jt = Math.min(MU_BALL * jn, tl / 7);
    fx = (-jt * tx) / tl; fy = (-jt * ty) / tl; fz = (-jt * tz) / tl;
  }
  const air = p.y > 0 || q.y > 0 || p.vy !== 0 || q.vy !== 0;
  p.vx -= jn * nx + fx; p.vz -= jn * nz + fz;
  q.vx += jn * nx + fx; q.vz += jn * nz + fz;
  if (air) { p.vy -= jn * ny + fy; q.vy += jn * ny + fy; if (p.y <= 0 && p.vy < 0) p.vy = 0; if (q.y <= 0 && q.vy < 0) q.vy = 0; }
  // Both balls feel the same torque from the friction impulse.
  const k = 2.5 / R;
  const cx = ny * fz - nz * fy, cy = nz * fx - nx * fz, cz = nx * fy - ny * fx;
  p.wx -= k * cx; p.wy -= k * cy; p.wz -= k * cz;
  q.wx -= k * cx; q.wy -= k * cy; q.wz -= k * cz;
  if (ev && ev.hit) ev.hit(p, q, -vn);
}

function substep(balls, h, ev) {
  const n = balls.length;
  for (let i = 0; i < n; i++) { const b = balls[i]; if (!b.potted) motion(b, h, ev); }
  for (let i = 0; i < n; i++) {
    const p = balls[i]; if (p.potted) continue;
    for (let j = i + 1; j < n; j++) { const q = balls[j]; if (!q.potted) collide(p, q, ev); }
  }
  for (let i = 0; i < n; i++) { const b = balls[i]; if (!b.potted) { cushions(b, ev); pockets(b, ev); } }
}

export function step(balls, dt, ev) {
  let vmax = 0;
  for (const b of balls) if (!b.potted) vmax = Math.max(vmax, Math.hypot(b.vx, b.vz), Math.abs(b.vy));
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
