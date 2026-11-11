import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { HL, HW, R, groupOf } from './config.js';
import * as physics from './physics.js';
import { EightBall } from './rules.js';
import { chooseShot, choosePlacement, validSpot, listShots } from './ai.js';
import { buildTable } from './table.js';
import { buildRoom } from './room.js';
import { createBalls, rack, syncBalls, ballsSettled } from './balls.js';
import { buildCue, poseCue } from './cue.js';
import { Menu, Scoreboard } from './ui.js';
import { Sound } from './audio.js';

// ---------------------------------------------------------------- settings
const SKILLS = ['Easy', 'Medium', 'Hard'];
const settings = Object.assign({ assist: true, move: 'stay', hand: 'right', skill: 1, tableY: 0.8 },
  JSON.parse(localStorage.getItem('vrpool.settings') || '{}'));
const save = () => localStorage.setItem('vrpool.settings', JSON.stringify(settings));
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer and scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(1.15);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050302');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.03, 60);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const room = buildRoom();
scene.add(room);
const table = buildTable();
scene.add(table);
const top = table.userData.top;
table.userData.setHeight(settings.tableY);

const balls = createBalls(top);
const cueBall = balls[0];
rack(balls);

const playerCue = buildCue();
const aiCue = buildCue({ butt: '#101820', wrap: '#3a0d10' });
aiCue.visible = false;
scene.add(playerCue, aiCue);

const sound = new Sound();
const menu = new Menu();
scene.add(menu.mesh);
const board = new Scoreboard();
for (const s of room.userData.boardSpots) {
  const m = board.makeMesh(); m.position.fromArray(s.pos); m.rotation.y = s.ry; scene.add(m);
}

// ---------------------------------------------------------------- cue assist lines
const assist = new THREE.Group();
top.add(assist);
const assistMat = op => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: op, depthWrite: false });
const mkSeg = (w, op) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), assistMat(op));
  m.userData.w = w; m.renderOrder = 2; assist.add(m); return m;
};
const aMain = mkSeg(0.005, 0.8), aObj = mkSeg(0.005, 0.8), aDefl = mkSeg(0.0035, 0.42);
const aGhost = new THREE.Mesh(new THREE.RingGeometry(R * 0.84, R, 36).rotateX(-Math.PI / 2), assistMat(0.85));
aGhost.renderOrder = 2; assist.add(aGhost);
assist.visible = false;
function setSeg(m, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  m.visible = len > 1e-3;
  m.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2);
  m.scale.set(len, 1, m.userData.w);
  m.rotation.y = -Math.atan2(dz, dx);
}
function showAssist(dx, dz) {
  if (!settings.assist) { assist.visible = false; return; }
  const p = physics.predict(balls, cueBall, dx, dz);
  assist.visible = true;
  setSeg(aMain, cueBall.x + dx * R, cueBall.z + dz * R, p.x, p.z);
  aGhost.position.set(p.x, 0.0025, p.z);
  if (p.type === 'ball') {
    const len = 0.12 + 0.34 * p.fullness;
    setSeg(aObj, p.ball.x + p.ox * R, p.ball.z + p.oz * R, p.ball.x + p.ox * (R + len), p.ball.z + p.oz * (R + len));
    const dl = 0.3 * Math.sqrt(Math.max(0, 1 - p.fullness * p.fullness));
    setSeg(aDefl, p.x, p.z, p.x + p.cx * dl, p.z + p.cz * dl);
  } else {
    setSeg(aObj, p.x, p.z, p.x + p.rx * 0.3, p.z + p.rz * 0.3);
    aDefl.visible = false;
  }
}

// ---------------------------------------------------------------- game state
const game = { state: 'menu', mode: null, rules: null, ai: [false, false], practice: false, behindLine: false, settle: 0, aiT: 0, aiShot: null, overT: 0 };
const humanTurn = () => game.practice || (game.rules && !game.ai[game.rules.cur]);
const fake = { vr: false };   // test hook: drive the VR code path without a headset
const inVR = () => renderer.xr.isPresenting || fake.vr;

function findFree(x, z) {
  for (let r = 0; r < 0.6; r += 0.012) {
    for (let a = 0; a < 6.28; a += 0.5) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) > HL - R || Math.abs(pz) > HW - R) continue;
      let ok = true;
      for (const b of balls) if (!b.potted && Math.hypot(b.x - px, b.z - pz) < 2 * R + 0.001) { ok = false; break; }
      if (ok) return { x: px, z: pz };
    }
  }
  return { x, z };
}
function respot(b, x, z) {
  b.potted = false; b.sink = 0; b.pocket = null; b.x = 9; b.z = 9;
  const p = findFree(x, z);
  b.x = p.x; b.z = p.z; b.vx = b.vz = b.wx = b.wy = b.wz = 0;
  b.mesh.visible = true; b.shadow.visible = true;
}

function startGame(mode) {
  game.mode = mode; game.practice = mode === 'practice';
  game.ai = mode === 'ai' ? [false, true] : mode === 'demo' ? [true, true] : [false, false];
  const names = mode === 'ai' ? ['You', 'The House'] : mode === 'demo' ? ['Fats', 'The House'] : ['Player 1', 'Player 2'];
  game.rules = game.practice ? null : new EightBall(names);
  rack(balls);
  game.state = 'aim'; game.aiT = 0; game.aiShot = null; aiCue.visible = false;
  closeMenu();
  refreshBoard();
  if (inVR()) lineUp();
}

function shoot(dx, dz, V, a = 0, b = 0) {
  if (game.rules) game.rules.beginShot(balls);
  physics.strike(cueBall, dx, dz, V, a, b);
  game.state = 'moving'; game.settle = 0;
  assist.visible = false;
  sound.cue(V);
}

const events = {
  hit(p, q, s) { sound.ball(s); if (game.rules) game.rules.onHit(p, q); },
  cushion(b, s) { sound.cushion(s); if (game.rules) game.rules.onCushion(); },
  pocket(b) { sound.pocket(); if (game.rules) game.rules.onPocket(b); pulse(hand('cue'), 0.4, 60); },
};

function endShot() {
  game.aiT = 0; game.aiShot = null;
  if (game.practice) {
    if (cueBall.potted) respot(cueBall, -HL / 2, 0);
    if (balls.every(b => b.n === 0 || b.potted)) rack(balls);
    game.state = 'aim';
    refreshBoard();
    return;
  }
  const rules = game.rules;
  const res = rules.endShot();
  if (res.over) {
    game.state = 'over'; game.overT = 0;
    if (cueBall.potted) respot(cueBall, -HL / 2, 0);
    const humanWon = game.mode === 'ai' ? rules.winner === 0 : true;
    humanWon ? sound.win() : sound.lose();
    refreshBoard();
    return;
  }
  if (res.respot8) respot(balls[8], HL / 2, 0);
  if (cueBall.potted) respot(cueBall, -HL / 2, 0);
  if (res.ballInHand) {
    if (game.ai[rules.cur]) {
      const p = choosePlacement(balls, rules.legalTargets(balls), false);
      cueBall.x = p.x; cueBall.z = p.z;
      game.state = 'aim';
    } else { game.state = 'place'; game.behindLine = false; }
  } else game.state = 'aim';
  refreshBoard();
}

function refreshBoard() {
  const vr = inVR();
  let hint = vr ? 'Grip with your bridge hand to steady the cue.  B lines you up.  A opens the menu.'
    : 'Mouse aims.  Hold click for power.  W A S D for spin.  Right drag to look.  M for menu.';
  if (game.state === 'place') hint = vr ? 'Ball in hand: point at the table and pull the trigger.' : 'Ball in hand: click the table to place the cue ball.';
  if (game.practice || !game.rules) {
    board.draw({ title: 'PRACTICE TABLE', players: [], cur: -1, msg: game.practice ? 'Shoot freely. The balls re-rack when the table is clear.' : 'Welcome to the club', hint });
    return;
  }
  const r = game.rules;
  const players = [0, 1].map(p => ({
    name: r.names[p], group: r.groups[p],
    balls: r.groups[p] ? balls.filter(b => b.n > 0 && !b.potted && groupOf(b.n) === r.groups[p]).map(b => b.n).concat(balls[8].potted ? [] : (r.remaining(balls, p) === 0 ? [8] : [])) : [],
  }));
  board.draw({ title: 'EIGHT BALL', players, cur: r.winner != null ? r.winner : r.cur, open: !r.groups[0], msg: r.msg, hint });
}

// ---------------------------------------------------------------- menu
function buildMenu() {
  const inGame = game.state !== 'menu' && game.state !== 'over';
  let title = 'CORNER POCKET', sub = 'A private billiards club';
  if (game.state === 'over' && game.rules) { title = game.rules.winner === 0 && game.mode === 'ai' ? 'YOU WIN' : `${game.rules.names[game.rules.winner].toUpperCase()} WINS`; sub = 'Rack them up again?'; }
  const items = [];
  if (inGame) items.push({ label: 'Back to the table', onClick: closeMenu });
  items.push({ label: 'Play the House', onClick: () => startGame('ai') });
  items.push({ label: 'House skill', value: SKILLS[settings.skill], onClick: () => { settings.skill = (settings.skill + 1) % 3; } });
  items.push({ label: 'Pass and play', onClick: () => startGame('pass') });
  items.push({ label: 'Practice table', onClick: () => startGame('practice') });
  items.push({ label: 'Cue assist', value: settings.assist ? 'On' : 'Off', onClick: () => { settings.assist = !settings.assist; } });
  items.push({ label: 'Movement', value: settings.move === 'stay' ? 'Stay put' : 'Walk', onClick: () => { settings.move = settings.move === 'stay' ? 'walk' : 'stay'; } });
  items.push({ label: 'Cue hand', value: settings.hand === 'right' ? 'Right' : 'Left', onClick: () => { settings.hand = settings.hand === 'right' ? 'left' : 'right'; } });
  items.push({ label: 'Table height', value: `${Math.round(settings.tableY * 100)} cm  (tap to raise)`, onClick: () => { settings.tableY = settings.tableY >= 0.95 ? 0.65 : settings.tableY + 0.05; table.userData.setHeight(settings.tableY); } });
  menu.set(title, sub, items);
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
function openMenu() {
  buildMenu();
  menu.mesh.visible = true;
  if (inVR()) {
    camera.getWorldPosition(_v1); camera.getWorldDirection(_v2);
    _v2.y = 0; _v2.normalize();
    menu.mesh.position.copy(_v1).addScaledVector(_v2, 1.25); menu.mesh.position.y = _v1.y - 0.08;
    menu.mesh.rotation.set(0, Math.atan2(-_v2.x, -_v2.z), 0);
  }
}
function closeMenu() { menu.mesh.visible = false; if (game.state === 'menu') game.state = game.rules || game.practice ? 'aim' : 'menu'; }
function clickMenu(i) {
  if (i < 0) return;
  sound.ui();
  const it = menu.items[i];
  it.onClick(); save();
  if (menu.mesh.visible) { buildMenu(); }
  refreshBoard();
}

// ---------------------------------------------------------------- pointer (menu and ball in hand)
const raycaster = new THREE.Raycaster();
const pointer = { ok: false, origin: new THREE.Vector3(), dir: new THREE.Vector3() };
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pointerOnTable(height = 0) {
  if (!pointer.ok) return null;
  tablePlane.constant = -(settings.tableY + height);
  raycaster.ray.origin.copy(pointer.origin); raycaster.ray.direction.copy(pointer.dir);
  const hit = raycaster.ray.intersectPlane(tablePlane, _v3);
  return hit ? { x: hit.x, z: hit.z } : null;
}
function pointerOnMenu() {
  if (!pointer.ok || !menu.mesh.visible) return -1;
  raycaster.ray.origin.copy(pointer.origin); raycaster.ray.direction.copy(pointer.dir);
  const h = raycaster.intersectObject(menu.mesh, false)[0];
  return h ? menu.pick(h.uv) : -1;
}
function tryPlace() {
  const p = pointerOnTable(R);
  if (!p) return false;
  const x = Math.max(-HL + R + 0.003, Math.min(HL - R - 0.003, p.x)), z = Math.max(-HW + R + 0.003, Math.min(HW - R - 0.003, p.z));
  if (validSpot(balls, x, z, game.behindLine)) { cueBall.x = x; cueBall.z = z; return true; }
  return false;
}

// ---------------------------------------------------------------- VR controllers
const ctrls = [0, 1].map(i => {
  const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i);
  rig.add(ray, grip);
  const o = { ray, grip, src: null, hand: null, down: [], edge: [], snap: false };
  ray.addEventListener('connected', e => { o.src = e.data; o.hand = e.data.handedness; });
  ray.addEventListener('disconnected', () => { o.src = null; o.hand = null; });
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), new THREE.MeshStandardMaterial({ color: '#1a1412', roughness: 0.6 }));
  glove.scale.set(1, 0.8, 1.25); grip.add(glove);
  o.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: '#e8c987', transparent: true, opacity: 0.7 }));
  o.line.scale.z = 3; o.line.visible = false; ray.add(o.line);
  return o;
});
function hand(which) {
  const want = which === 'cue' ? settings.hand : settings.hand === 'right' ? 'left' : 'right';
  return ctrls.find(c => c.src && c.hand === want) || null;
}
function pollControllers() {
  for (const c of ctrls) {
    const gp = c.src && c.src.gamepad;
    for (let i = 0; i < 6; i++) {
      const now = !!(gp && gp.buttons[i] && gp.buttons[i].pressed);
      c.edge[i] = now && !c.down[i]; c.down[i] = now;
    }
    c.ax = gp && gp.axes.length >= 4 ? gp.axes[2] : 0; c.ay = gp && gp.axes.length >= 4 ? gp.axes[3] : 0;
  }
}
function pulse(c, strength, ms) {
  const gp = c && c.src && c.src.gamepad;
  const act = gp && gp.hapticActuators && gp.hapticActuators[0];
  if (act && act.pulse) act.pulse(Math.min(1, strength), ms).catch(() => {});
}

function orbitRig(px, pz, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = rig.position.x - px, dz = rig.position.z - pz;
  rig.position.x = px + dx * c + dz * s; rig.position.z = pz - dx * s + dz * c;
  rig.rotation.y += ang;
}
// Stand the player behind the cue ball, facing down the most promising shot.
function lineUp() {
  let dx = -cueBall.x, dz = -cueBall.z;
  if (game.rules && game.rules.phase !== 'break') {
    const shots = listShots(balls, cueBall.x, cueBall.z, game.rules.legalTargets(balls));
    if (shots.length) { dx = shots[0].dx; dz = shots[0].dz; }
  } else if (game.rules || game.practice) { dx = 1; dz = 0; }
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  camera.getWorldPosition(_v1); camera.getWorldDirection(_v2);
  const cur = Math.atan2(-_v2.x, -_v2.z), want = Math.atan2(-dx, -dz);
  orbitRig(_v1.x, _v1.z, want - cur);
  camera.getWorldPosition(_v1);
  // Stand a stride behind the ball and slightly to the side of the cue line, like a real stance.
  const side = settings.hand === 'right' ? -0.12 : 0.12;
  const tx = cueBall.x - dx * 0.95 + -dz * side, tz = cueBall.z - dz * 0.95 + dx * side;
  rig.position.x += tx - _v1.x; rig.position.z += tz - _v1.z;
  rig.updateMatrixWorld(true);
}

const TIP_DIST = 1.08;      // tip sits this far ahead of the back hand
const vr = { axis: new THREE.Vector3(0, 0, -1), tip: new THREE.Vector3(), lock: false, lockAxis: new THREE.Vector3(), lockPoint: new THREE.Vector3(), hist: [] };
const pR = new THREE.Vector3(), pL = new THREE.Vector3(), tmpAxis = new THREE.Vector3(), prevTip = new THREE.Vector3();

function updateVR(dt, time) {
  pollControllers();
  const ch = hand('cue') || ctrls.find(c => c.src) || null;
  const bh = hand('bridge');
  for (const c of ctrls) c.line.visible = false;
  pointer.ok = false;
  if (!ch) { playerCue.visible = false; return; }

  // Pointer ray from the cue hand.
  ch.ray.getWorldPosition(pointer.origin);
  pointer.dir.set(0, 0, -1).applyQuaternion(ch.ray.getWorldQuaternion(_q1)).normalize();
  pointer.ok = true;

  if (ch.edge[4]) { menu.mesh.visible ? closeMenu() : openMenu(); sound.ui(menu.mesh.visible); }
  if (ch.edge[5] && !menu.mesh.visible) { lineUp(); sound.ui(); }

  // Turning and moving.
  if (Math.abs(ch.ax) > 0.6) {
    if (!ch.snap) { camera.getWorldPosition(_v1); orbitRig(_v1.x, _v1.z, -Math.sign(ch.ax) * Math.PI / 6); ch.snap = true; }
  } else if (Math.abs(ch.ax) < 0.3) ch.snap = false;
  if (bh && (Math.abs(bh.ax) > 0.15 || Math.abs(bh.ay) > 0.15)) {
    camera.getWorldPosition(_v1);
    if (settings.move === 'walk') {
      camera.getWorldDirection(_v2); _v2.y = 0; _v2.normalize();
      const sp = 1.4 * dt;
      rig.position.x += (_v2.x * -bh.ay + -_v2.z * bh.ax) * sp;
      rig.position.z += (_v2.z * -bh.ay + _v2.x * bh.ax) * sp;
    } else {
      // Stay put: glide around the cue ball instead of walking around the table.
      const px = cueBall.potted ? 0 : cueBall.x, pz = cueBall.potted ? 0 : cueBall.z;
      orbitRig(px, pz, -bh.ax * 1.3 * dt);
      const ox = rig.position.x, oz = rig.position.z;
      camera.getWorldPosition(_v1);
      const rx = _v1.x - px, rz = _v1.z - pz, rl = Math.hypot(rx, rz) || 1;
      const mv = bh.ay * 0.9 * dt;
      if (rl + mv > 0.25) { rig.position.x = ox + (rx / rl) * mv; rig.position.z = oz + (rz / rl) * mv; }
    }
    const bnd = room.userData.bounds;
    camera.getWorldPosition(_v1);
    rig.position.x += Math.max(-bnd.x, Math.min(bnd.x, _v1.x)) - _v1.x;
    rig.position.z += Math.max(-bnd.z, Math.min(bnd.z, _v1.z)) - _v1.z;
  }

  // Menu and ball in hand use the laser.
  if (menu.mesh.visible) {
    ch.line.visible = true; playerCue.visible = false; assist.visible = false;
    const i = pointerOnMenu();
    if (menu.setHover(i) && i >= 0) pulse(ch, 0.2, 15);
    if (ch.edge[0]) clickMenu(i);
    return;
  }
  if (game.state === 'place' && humanTurn()) {
    ch.line.visible = true; playerCue.visible = false; assist.visible = false;
    tryPlace();
    if (ch.edge[0]) { game.state = 'aim'; sound.ui(); refreshBoard(); }
    return;
  }

  // Cue pose. The back hand holds the cue; gripping with the other hand makes it the bridge.
  playerCue.visible = true;
  ch.grip.getWorldPosition(pR);
  const bridging = bh && bh.down[1];
  const locking = bh && bh.down[0];
  if (!(locking && vr.lock)) {
    if (bridging) {
      bh.grip.getWorldPosition(pL);
      tmpAxis.copy(pL).sub(pR);
      if (tmpAxis.length() < 0.18) tmpAxis.copy(pointer.dir); else tmpAxis.normalize();
    } else tmpAxis.copy(pointer.dir);
    vr.axis.lerp(tmpAxis, 1 - Math.exp(-dt * (bridging ? 40 : 22))).normalize();
    if (locking) { vr.lock = true; vr.lockAxis.copy(vr.axis); vr.lockPoint.copy(pR); pulse(bh, 0.3, 20); } else vr.lock = false;
  }
  prevTip.copy(vr.tip);
  if (vr.lock) {
    const s = _v1.copy(pR).sub(vr.lockPoint).dot(vr.lockAxis);
    vr.axis.copy(vr.lockAxis);
    vr.tip.copy(vr.lockPoint).addScaledVector(vr.lockAxis, s + TIP_DIST);
  } else vr.tip.copy(pR).addScaledVector(vr.axis, TIP_DIST);
  poseCue(playerCue, vr.tip, vr.axis);

  // Speed of the tip along the cue, averaged over the last few frames.
  vr.hist.push({ t: time, p: vr.tip.clone() });
  while (vr.hist.length > 5) vr.hist.shift();
  const h0 = vr.hist[0];
  const span = time - h0.t;
  const speed = span > 0.005 ? _v1.copy(vr.tip).sub(h0.p).dot(vr.axis) / span : 0;

  if (game.state !== 'aim' || !humanTurn()) { assist.visible = false; return; }

  // Everything below is in table space.
  const ty = settings.tableY;
  const cx = cueBall.x, cy = ty + R, cz = cueBall.z;
  const hl = Math.hypot(vr.axis.x, vr.axis.z);
  if (hl < 0.3) { assist.visible = false; return; }
  const dx = vr.axis.x / hl, dz = vr.axis.z / hl;
  // Where the cue line passes the ball centre: that offset is the english.
  _v1.set(vr.tip.x - cx, vr.tip.y - cy, vr.tip.z - cz);
  const along = _v1.dot(vr.axis);
  _v2.copy(_v1).addScaledVector(vr.axis, -along);     // perpendicular offset of the line from the centre
  const off = _v2.length();
  const tipDist = _v1.length();
  if (off < R * 2.4 && along < 0.05 && tipDist < 0.75) showAssist(dx, dz); else assist.visible = false;

  // Did the tip pass through the cue ball this frame?
  _v3.copy(vr.tip).sub(prevTip);
  const segLen2 = _v3.lengthSq();
  let t = segLen2 > 1e-10 ? -(_v1.copy(prevTip).sub(_v2.set(cx, cy, cz)).dot(_v3)) / segLen2 : 1;
  t = Math.max(0, Math.min(1, t));
  _v1.copy(prevTip).addScaledVector(_v3, t);
  const hitDist = Math.hypot(_v1.x - cx, _v1.y - cy, _v1.z - cz);
  if (hitDist < R + 0.007 && speed > 0.14) {
    // Recompute the offset at the contact point.
    _v1.set(vr.tip.x - cx, vr.tip.y - cy, vr.tip.z - cz);
    _v2.copy(_v1).addScaledVector(vr.axis, -_v1.dot(vr.axis));
    let a = _v2.x * -dz + _v2.z * dx, b = _v2.y;
    const o = Math.hypot(a, b);
    let V = Math.min(9.5, speed * 1.3);
    let sx = dx, sz = dz;
    if (o > R * 0.9) {           // miscue
      V *= 0.35; const k = (Math.random() - 0.5) * 0.5; sx = dx * Math.cos(k) - dz * Math.sin(k); sz = dx * Math.sin(k) + dz * Math.cos(k); a = b = 0;
    } else if (o > R * 0.55) { a *= (R * 0.55) / o; b *= (R * 0.55) / o; }
    shoot(sx, sz, V, a, b);
    pulse(ch, 0.25 + V / 8, 45 + V * 8);
    vr.hist.length = 0;
  }
}

// ---------------------------------------------------------------- desktop controls
const desk = { az: -Math.PI / 2, pol: 1.02, dist: 3.5, mx: 0, my: 0, dragging: false, charging: false, power: 0, chargeT: 0, a: 0, b: 0, dx: 1, dz: 0 };
const powerEl = document.getElementById('power'), powerFill = document.getElementById('powerFill'), spinDot = document.getElementById('spinDot');
const canvas = renderer.domElement;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousemove', e => {
  if (desk.dragging) { desk.az -= e.movementX * 0.005; desk.pol = Math.max(0.15, Math.min(1.5, desk.pol - e.movementY * 0.005)); }
  desk.mx = (e.clientX / window.innerWidth) * 2 - 1; desk.my = -(e.clientY / window.innerHeight) * 2 + 1;
});
canvas.addEventListener('mousedown', e => {
  sound.resume();
  if (e.button === 2) { desk.dragging = true; return; }
  if (e.button !== 0 || inVR()) return;
  if (menu.mesh.visible) { clickMenu(pointerOnMenu()); return; }
  if (game.state === 'place' && humanTurn()) { if (tryPlace()) { game.state = 'aim'; refreshBoard(); } return; }
  if (game.state === 'aim' && humanTurn()) { desk.charging = true; desk.chargeT = 0; desk.power = 0; }
});
window.addEventListener('mouseup', e => {
  if (e.button === 2) desk.dragging = false;
  if (e.button === 0 && desk.charging) {
    desk.charging = false;
    if (game.state === 'aim') shoot(desk.dx, desk.dz, 0.5 + desk.power * 8, desk.a, desk.b);
    desk.a = desk.b = 0;
  }
});
canvas.addEventListener('wheel', e => { desk.dist = Math.max(1.2, Math.min(6, desk.dist + e.deltaY * 0.002)); });
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), s = R * 0.1, lim = R * 0.5;
  if (k === 'm' || k === 'escape') { menu.mesh.visible ? closeMenu() : openMenu(); }
  if (k === 'w') desk.b = Math.min(lim, desk.b + s);
  if (k === 's') desk.b = Math.max(-lim, desk.b - s);
  if (k === 'd') desk.a = Math.min(lim, desk.a + s);
  if (k === 'a') desk.a = Math.max(-lim, desk.a - s);
});

function updateDesktop(dt) {
  const ty = settings.tableY;
  camera.position.set(Math.sin(desk.pol) * Math.sin(desk.az) * desk.dist, ty + Math.cos(desk.pol) * desk.dist, Math.sin(desk.pol) * Math.cos(desk.az) * desk.dist);
  camera.lookAt(0, ty, 0);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2(desk.mx, desk.my), camera);
  pointer.origin.copy(raycaster.ray.origin); pointer.dir.copy(raycaster.ray.direction); pointer.ok = true;

  if (menu.mesh.visible) {
    camera.getWorldDirection(_v2);
    menu.mesh.position.copy(camera.position).addScaledVector(_v2, 1.45);
    menu.mesh.quaternion.copy(camera.quaternion);
    menu.setHover(pointerOnMenu());
    playerCue.visible = false; assist.visible = false; powerEl.style.display = 'none';
    return;
  }
  const mine = humanTurn();
  if (game.state === 'place' && mine) { tryPlace(); playerCue.visible = false; assist.visible = false; return; }
  if (game.state === 'aim' && mine) {
    if (!desk.charging) {
      const p = pointerOnTable(R);
      if (p) { const dx = p.x - cueBall.x, dz = p.z - cueBall.z, l = Math.hypot(dx, dz); if (l > 0.02) { desk.dx = dx / l; desk.dz = dz / l; } }
    } else { desk.chargeT += dt; desk.power = 0.5 - 0.5 * Math.cos(desk.chargeT * 2.4); }
    showAssist(desk.dx, desk.dz);
    const el = 0.1, pull = 0.035 + (desk.charging ? desk.power * 0.28 : 0);
    _v2.set(desk.dx * Math.cos(el), -Math.sin(el), desk.dz * Math.cos(el));
    _v1.set(cueBall.x + -desk.dz * desk.a, ty + R + desk.b, cueBall.z + desk.dx * desk.a).addScaledVector(_v2, -(R + pull));
    poseCue(playerCue, _v1, _v2);
    playerCue.visible = true;
    powerEl.style.display = 'block';
    powerFill.style.width = `${desk.power * 100}%`;
    spinDot.style.left = `${50 + (desk.a / (R * 0.5)) * 36}%`; spinDot.style.top = `${50 - (desk.b / (R * 0.5)) * 36}%`;
  } else { playerCue.visible = false; powerEl.style.display = 'none'; if (game.state !== 'aim') assist.visible = false; }
}

// ---------------------------------------------------------------- computer opponent
function updateAI(dt) {
  if (game.state !== 'aim' || !game.rules || !game.ai[game.rules.cur]) { aiCue.visible = false; return; }
  const fast = game.mode === 'demo' && params.has('fast');
  game.aiT += fast ? dt * 20 : dt;
  if (game.aiT > 0.9 && !game.aiShot) {
    const skill = game.mode === 'demo' ? 2 : settings.skill;
    game.aiShot = chooseShot(balls, game.rules.legalTargets(balls), skill, game.rules.phase === 'break');
  }
  if (game.aiShot) {
    const s = game.aiShot, k = Math.min(1, (game.aiT - 0.9) / 1.3);
    // Two practice strokes, then the delivery.
    const pull = 0.04 + 0.12 * Math.abs(Math.sin(k * Math.PI * 2.5)) * (0.4 + 0.6 * k);
    _v2.set(s.dx * Math.cos(0.1), -Math.sin(0.1), s.dz * Math.cos(0.1));
    _v1.set(cueBall.x, settings.tableY + R, cueBall.z).addScaledVector(_v2, -(R + pull));
    poseCue(aiCue, _v1, _v2);
    aiCue.visible = true;
    if (!humanTurn() && settings.assist && game.mode !== 'demo') assist.visible = false;
    if (k >= 1) { aiCue.visible = false; shoot(s.dx, s.dz, s.speed, s.a, s.b); }
  }
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let lastState = '';
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.033, clock.getDelta());
  const time = clock.elapsedTime;
  if (inVR()) updateVR(dt, time); else updateDesktop(dt);

  if (game.state === 'moving') {
    const steps = game.mode === 'demo' && params.has('fast') ? 12 : 1;
    for (let i = 0; i < steps; i++) physics.step(balls, dt, events);
    if (!physics.anyMoving(balls) && ballsSettled(balls)) { game.settle += dt; if (game.settle > 0.3) endShot(); } else game.settle = 0;
  }
  if (game.state === 'over') {
    game.overT += dt;
    if (game.overT > 2.2 && !menu.mesh.visible) { if (game.mode === 'demo') startGame('demo'); else openMenu(); }
  }
  updateAI(dt);
  syncBalls(balls, dt);
  if (game.state !== lastState) { lastState = game.state; refreshBoard(); }
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- entering VR
const landing = document.getElementById('landing'), vrBtn = document.getElementById('enterVR'), deskBtn = document.getElementById('playDesktop'), note = document.getElementById('note');
async function enterVR() {
  sound.resume();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    landing.style.display = 'none'; powerEl.style.display = 'none';
    rig.position.set(-HL - 1.1, 0, 0.0); rig.rotation.set(0, -Math.PI / 2, 0);
    camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    setTimeout(() => { if (game.state === 'menu' || game.state === 'over') openMenu(); refreshBoard(); }, 600);
    session.addEventListener('end', () => {
      rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
      landing.style.display = 'flex'; menu.mesh.visible = false; refreshBoard();
    });
  } catch (err) { note.textContent = `Could not start VR: ${err.message}`; }
}
vrBtn.addEventListener('click', enterVR);
deskBtn.addEventListener('click', () => { sound.resume(); landing.style.display = 'none'; if (game.state === 'menu') openMenu(); });
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    if (ok) { vrBtn.disabled = false; note.textContent = 'Clear a little space, pick up both controllers, and step in.'; }
    else note.textContent = 'No headset detected. Open this page in the Meta Quest browser for VR, or play here with the mouse.';
  }).catch(() => {});
} else note.textContent = 'This browser has no WebXR. Open this page in the Meta Quest browser for VR, or play here with the mouse.';

refreshBoard();
if (params.has('demo')) { landing.style.display = 'none'; startGame('demo'); }
if (params.has('mode')) { landing.style.display = 'none'; startGame(params.get('mode')); }
window.__game = { fake, ctrls, rig, vr, menu, lineUp, game, balls, settings, shoot, startGame, physics, desk, openMenu, closeMenu, camera, renderer, scene };
