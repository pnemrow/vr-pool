import * as THREE from 'three';
import { CUE_LEN } from './config.js';
import { woodTex } from './textures.js';

// A cue modelled along +Z: the tip is at the origin and the butt is at z = CUE_LEN.
export function buildCue(style = {}) {
  const g = new THREE.Group();
  const seg = (z0, z1, r0, r1, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, z1 - z0, 14).rotateX(-Math.PI / 2), mat);
    m.position.z = (z0 + z1) / 2; g.add(m); return m;
  };
  const std = (color, rough = 0.4, metal = 0, map = null) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map });
  const maple = std('#e3c890', 0.35, 0, woodTex('#e6cc96', '#b89455', '#f6e6bd', 31, [1, 3]));
  const dark = std(style.butt || '#2a120a', 0.3, 0.05, woodTex('#6a3a20', '#1a0a05', '#a05a30', 32, [1, 2]));
  const brass = std('#c09a48', 0.25, 1);
  const wrap = std(style.wrap || '#0d0d0f', 0.85);
  // CylinderGeometry(radiusTop, radiusBottom): after the rotation "top" faces -Z, i.e. toward the tip.
  seg(0, 0.006, 0.0058, 0.0062, std('#2d5f9a', 0.95));          // chalked leather tip
  seg(0.006, 0.03, 0.0062, 0.0064, std('#f4efe2', 0.3));        // ferrule
  seg(0.03, 0.74, 0.0064, 0.0105, maple);                       // shaft
  seg(0.74, 0.755, 0.0108, 0.0108, brass);                      // joint collar
  seg(0.755, 1.08, 0.0108, 0.0135, dark);                       // forearm
  seg(1.08, 1.088, 0.0138, 0.0138, brass);
  seg(1.088, 1.36, 0.0135, 0.0148, wrap);                       // grip
  seg(1.36, 1.368, 0.015, 0.015, brass);
  seg(1.368, CUE_LEN - 0.02, 0.0148, 0.0155, dark);             // butt sleeve
  seg(CUE_LEN - 0.02, CUE_LEN, 0.0155, 0.0145, std('#101010', 0.6)); // bumper
  return g;
}

const _z = new THREE.Vector3(0, 0, 1), _v = new THREE.Vector3();
// Place a cue so its tip sits at `tip` and it points along `axis` (unit, butt to tip).
export function poseCue(cue, tip, axis) {
  cue.position.copy(tip);
  cue.quaternion.setFromUnitVectors(_z, _v.copy(axis).negate());
}
