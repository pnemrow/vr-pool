// Computer opponent: finds the most makeable pot using ghost ball aiming, then adds human error.
import { HL, HW, R, POCKETS } from './config.js';

function clear(x0, z0, x1, z1, balls, skipA, skipB, width = 2 * R * 0.98) {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return true;
  for (const b of balls) {
    if (b.potted || b === skipA || b === skipB) continue;
    let t = ((b.x - x0) * dx + (b.z - z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const ex = b.x - (x0 + dx * t), ez = b.z - (z0 + dz * t);
    if (ex * ex + ez * ez < width * width) return false;
  }
  return true;
}

// Every candidate pot for the cue ball at (cx, cz), best first.
export function listShots(balls, cx, cz, targets) {
  const cue = balls[0];
  const out = [];
  for (const b of targets) {
    for (const p of POCKETS) {
      let px = p.ax - b.x, pz = p.az - b.z;
      const d2 = Math.hypot(px, pz);
      if (d2 < 1e-4) continue;
      px /= d2; pz /= d2;
      // Side pockets only accept reasonably straight approaches.
      if (!p.corner && Math.abs(pz) < 0.55) continue;
      if (p.corner && (px * Math.sign(p.x) < 0.12 || pz * Math.sign(p.z) < 0.12)) continue;
      const gx = b.x - px * 2 * R, gz = b.z - pz * 2 * R;
      if (Math.abs(gx) > HL - R || Math.abs(gz) > HW - R) continue;
      let ax = gx - cx, az = gz - cz;
      const d1 = Math.hypot(ax, az);
      if (d1 < 1e-4) continue;
      ax /= d1; az /= d1;
      const cut = ax * px + az * pz;
      if (cut < 0.3) continue;
      if (!clear(cx, cz, gx, gz, balls, cue, b)) continue;
      if (!clear(b.x, b.z, p.ax, p.az, balls, cue, b)) continue;
      const score = (cut * cut * cut) / (1 + 0.9 * d1 + 1.4 * d2 + 0.8 * d1 * d2);
      out.push({ dx: ax, dz: az, d1, d2, cut, score, ball: b, pocket: p });
    }
  }
  out.sort((u, v) => v.score - u.score);
  return out;
}

function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.87; }

// skill 0 (easy) to 2 (hard). Returns { dx, dz, speed, a, b }.
export function chooseShot(balls, targets, skill, isBreak) {
  const cue = balls[0];
  if (isBreak) {
    const head = balls.filter(b => b.n > 0 && !b.potted).sort((u, v) => u.x - v.x)[0];
    const dx = head.x - cue.x, dz = head.z - cue.z, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx) + gauss() * 0.006;
    return { dx: Math.cos(ang), dz: Math.sin(ang), speed: 7.5 + Math.random() * 1.2 + (d > 0 ? 0 : 0), a: 0, b: 0.004 };
  }
  const shots = listShots(balls, cue.x, cue.z, targets);
  const sigma = [0.022, 0.011, 0.0045][skill];
  let s;
  if (shots.length) {
    // Weaker players do not always see the best shot.
    const pick = skill === 0 ? Math.floor(Math.random() * Math.min(3, shots.length)) : 0;
    const c = shots[pick];
    const speed = Math.min(6, Math.max(1.3, (0.9 + 1.25 * c.d1 + 1.9 * c.d2) / Math.max(0.45, c.cut)));
    s = { dx: c.dx, dz: c.dz, speed, a: 0, b: skill === 2 ? -0.003 : 0 };
  } else {
    // No pot on: just make a legal hit on the nearest reachable target.
    let best = null, bd = Infinity;
    for (const b of targets) {
      const d = Math.hypot(b.x - cue.x, b.z - cue.z);
      const open = clear(cue.x, cue.z, b.x, b.z, balls, cue, b);
      const cost = d + (open ? 0 : 10);
      if (cost < bd) { bd = cost; best = b; }
    }
    if (!best) return { dx: 1, dz: 0, speed: 2, a: 0, b: 0 };
    const dx = best.x - cue.x, dz = best.z - cue.z, d = Math.hypot(dx, dz);
    s = { dx: dx / d, dz: dz / d, speed: 2.2 + d, a: 0, b: 0 };
  }
  const ang = Math.atan2(s.dz, s.dx) + gauss() * sigma;
  s.dx = Math.cos(ang); s.dz = Math.sin(ang);
  s.speed *= 1 + gauss() * 0.06;
  return s;
}

export function validSpot(balls, x, z, behindLine) {
  if (Math.abs(x) > HL - R - 0.002 || Math.abs(z) > HW - R - 0.002) return false;
  if (behindLine && x > -HL / 2) return false;
  for (const b of balls) {
    if (b.n === 0 || b.potted) continue;
    if (Math.hypot(b.x - x, b.z - z) < 2 * R + 0.002) return false;
  }
  return true;
}

// Ball in hand: sample spots and keep the one that leaves the best pot.
export function choosePlacement(balls, targets, behindLine) {
  let best = null, bs = -1;
  for (let i = 0; i < 90; i++) {
    const x = behindLine ? -HL + R + Math.random() * (HL / 2 - R) : (Math.random() * 2 - 1) * (HL - 2 * R);
    const z = (Math.random() * 2 - 1) * (HW - 2 * R);
    if (!validSpot(balls, x, z, behindLine)) continue;
    const shots = listShots(balls, x, z, targets);
    const sc = shots.length ? shots[0].score : 0;
    if (sc > bs) { bs = sc; best = { x, z }; }
  }
  return best || { x: -HL / 2, z: 0 };
}
