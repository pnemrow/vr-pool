import * as THREE from 'three';
import { HL, HW, L, W, A, B, R, POCKETS, HOLE_R, CUSHION_D, MOUTH_S } from './config.js';
import { SEGMENTS } from './physics.js';
import { woodTex, feltTex } from './textures.js';

// Outline of the cloth: a rectangle with a round bulge at each pocket. Returned as [x, z] points.
function outline() {
  const pts = [];
  const o = 0.035, rc = 0.07;
  const cornerArc = [];
  const a0 = Math.atan2(-Math.sqrt(rc * rc - o * o), o), a1 = Math.atan2(o, -Math.sqrt(rc * rc - o * o));
  for (let i = 0; i <= 14; i++) {
    const t = a0 + ((a1 - a0) * i) / 14;
    cornerArc.push([A - o + Math.cos(t) * rc, B - o + Math.sin(t) * rc]);
  }
  const so = 0.015;
  const s0 = Math.atan2(so, Math.sqrt(rc * rc - so * so)), s1 = Math.PI - s0;
  const sideArc = [];
  for (let i = 0; i <= 14; i++) {
    const t = s0 + ((s1 - s0) * i) / 14;
    sideArc.push([Math.cos(t) * rc, B - so + Math.sin(t) * rc]);
  }
  const rev = arr => arr.slice().reverse();
  pts.push(...cornerArc);
  pts.push(...sideArc);
  pts.push(...rev(cornerArc).map(p => [-p[0], p[1]]));
  pts.push(...cornerArc.map(p => [-p[0], -p[1]]));
  pts.push(...rev(sideArc).map(p => [p[0], -p[1]]));
  pts.push(...rev(cornerArc).map(p => [p[0], -p[1]]));
  return pts;
}

// Shapes are drawn in (x, -z) so that rotating them flat (rotateX(-90deg)) lands them on (x, z).
const v2 = p => new THREE.Vector2(p[0], -p[1]);

export function buildTable(style = {}) {
  const felt = style.felt || '#0f5a3c';
  const wood = style.wood || ['#4b2613', '#1f0d05', '#8a4f27'];
  const g = new THREE.Group();
  const top = new THREE.Group();   // everything that moves with the table height
  g.add(top);

  const feltMap = feltTex(felt);
  const feltMat = new THREE.MeshStandardMaterial({ map: feltMap, roughness: 0.96, metalness: 0 });
  const cushionMat = new THREE.MeshStandardMaterial({ map: feltMap, roughness: 0.92, color: '#e6f2ea' });
  const woodMap = woodTex(wood[0], wood[1], wood[2], 11, [1.2, 1.2]);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.34, metalness: 0.05, envMapIntensity: 0.7 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ map: woodMap, color: '#8c8078', roughness: 0.42, envMapIntensity: 0.5 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#b8923e', roughness: 0.28, metalness: 1.0 });

  const pts = outline();

  // Cloth with real holes at the pockets.
  const feltShape = new THREE.Shape(pts.map(v2));
  for (const p of POCKETS) {
    const h = new THREE.Path();
    h.absarc(p.x, -p.z, HOLE_R, 0, Math.PI * 2, true);
    feltShape.holes.push(h);
  }
  const feltMesh = new THREE.Mesh(new THREE.ShapeGeometry(feltShape, 20).rotateX(-Math.PI / 2), feltMat);
  top.add(feltMesh);

  // Pocket cups.
  const cupMat = new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 0.9, side: THREE.BackSide });
  const cupGeo = new THREE.CylinderGeometry(HOLE_R, HOLE_R * 0.94, 0.054, 24, 1, true);
  const cupBottom = new THREE.CircleGeometry(HOLE_R, 20).rotateX(-Math.PI / 2);
  const blackMat = new THREE.MeshBasicMaterial({ color: '#030302' });
  for (const p of POCKETS) {
    const cup = new THREE.Mesh(cupGeo, cupMat); cup.position.set(p.x, -0.027, p.z);
    const bot = new THREE.Mesh(cupBottom, blackMat); bot.position.set(p.x, -0.0525, p.z);
    top.add(cup, bot);
  }

  // Wooden rail frame with the pocket outline cut out of it.
  const EDGE = 0.135, RAD = 0.1;
  const ox = A + EDGE, oz = B + EDGE;
  const frame = new THREE.Shape();
  frame.moveTo(-ox + RAD, -oz);
  frame.lineTo(ox - RAD, -oz); frame.absarc(ox - RAD, -oz + RAD, RAD, -Math.PI / 2, 0, false);
  frame.lineTo(ox, oz - RAD); frame.absarc(ox - RAD, oz - RAD, RAD, 0, Math.PI / 2, false);
  frame.lineTo(-ox + RAD, oz); frame.absarc(-ox + RAD, oz - RAD, RAD, Math.PI / 2, Math.PI, false);
  frame.lineTo(-ox, -oz + RAD); frame.absarc(-ox + RAD, -oz + RAD, RAD, Math.PI, Math.PI * 1.5, false);
  frame.holes.push(new THREE.Path(pts.map(v2)));
  const RAIL_H = 0.094, BEV = 0.004;
  const frameGeo = new THREE.ExtrudeGeometry(frame, { depth: RAIL_H - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 10 }).rotateX(-Math.PI / 2);
  const railTop = 0.04;
  const frameMesh = new THREE.Mesh(frameGeo, woodMat);
  frameMesh.position.y = railTop - RAIL_H + BEV;
  top.add(frameMesh);

  // Cushions: trapezoids whose nose is exactly the physics segment.
  for (const s of SEGMENTS) {
    const tx = s.bx - s.ax, tz = s.bz - s.az, len = Math.hypot(tx, tz);
    const ux = tx / len, uz = tz / len;
    const extA = Math.abs(s.nz) > 0 && Math.abs(s.ax) < MOUTH_S + 0.001 ? 0.004 : 0.03;
    const extB = Math.abs(s.nz) > 0 && Math.abs(s.bx) < MOUTH_S + 0.001 ? 0.004 : 0.03;
    const bx0 = s.ax - s.nx * CUSHION_D - ux * extA, bz0 = s.az - s.nz * CUSHION_D - uz * extA;
    const bx1 = s.bx - s.nx * CUSHION_D + ux * extB, bz1 = s.bz - s.nz * CUSHION_D + uz * extB;
    const sh = new THREE.Shape([v2([s.ax, s.az]), v2([s.bx, s.bz]), v2([bx1, bz1]), v2([bx0, bz0])]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.0355, bevelEnabled: false }).rotateX(-Math.PI / 2);
    top.add(new THREE.Mesh(geo, cushionMat));
  }

  // Diamond sights.
  const sightGeo = new THREE.CircleGeometry(0.0075, 4).rotateX(-Math.PI / 2);
  const sightMat = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.3, metalness: 0.1 });
  const addSight = (x, z) => { const m = new THREE.Mesh(sightGeo, sightMat); m.position.set(x, railTop + 0.0006, z); top.add(m); };
  for (let i = 1; i < 8; i++) if (i !== 4) for (const s of [-1, 1]) addSight(-HL + (i * L) / 8, s * (B + 0.07));
  for (let i = 1; i < 4; i++) for (const s of [-1, 1]) addSight(s * (A + 0.07), -HW + (i * W) / 4);

  // Foot spot and head string, drawn faintly like chalk marks on real cloth.
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a2c1e' }));
  spot.position.set(HL / 2, 0.0006, 0); top.add(spot);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, W).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1 }));
  line.position.set(-HL / 2, 0.0006, 0); top.add(line);

  // Apron and a brass trim line.
  const apron = new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.05, 0.2, 2 * oz - 0.05), darkWoodMat);
  apron.position.y = railTop - RAIL_H - 0.1; top.add(apron);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.04, 0.008, 2 * oz - 0.04), brassMat);
  trim.position.y = railTop - RAIL_H - 0.012; top.add(trim);

  // Turned legs that stretch with the table height.
  const prof = [[0.0, 0], [0.075, 0], [0.085, 0.03], [0.06, 0.07], [0.05, 0.3], [0.07, 0.5], [0.095, 0.72], [0.1, 0.86], [0.08, 0.9], [0.11, 0.94], [0.11, 1]];
  const legGeo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 20);
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, darkWoodMat);
    leg.position.set(sx * (ox - 0.2), 0, sz * (oz - 0.17));
    g.add(leg); legs.push(leg);
  }

  g.userData.top = top;
  g.userData.setHeight = y => {
    top.position.y = y;
    const h = y + railTop - RAIL_H - 0.2;
    for (const leg of legs) leg.scale.y = Math.max(0.2, h);
  };
  g.userData.setHeight(0.8);
  return g;
}
