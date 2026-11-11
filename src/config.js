// Table geometry (metres). Long axis is X, short axis is Z, felt surface is y = 0 in table space.
export const L = 2.24, W = 1.12;           // 8 ft playing surface
export const HL = L / 2, HW = W / 2;
export const R = 0.028575;                 // ball radius
export const CUSHION_D = 0.05;             // cushion depth, nose to wooden rail
export const A = HL + CUSHION_D, B = HW + CUSHION_D;
export const MOUTH_C = 0.082;              // corner pocket: cushion nose ends this far from the corner
export const MOUTH_S = 0.065;              // side pocket: half width of the opening
export const HOLE_R = 0.066;               // visual pocket hole radius
export const CUE_LEN = 1.47;

export const POCKETS = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1])
  POCKETS.push({ x: sx * (HL + 0.015), z: sz * (HW + 0.015), r: 0.066, corner: true, ax: sx * (HL - 0.022), az: sz * (HW - 0.022) });
for (const sz of [-1, 1])
  POCKETS.push({ x: 0, z: sz * (HW + 0.035), r: 0.06, corner: false, ax: 0, az: sz * (HW + 0.005) });

export const BALL_COLORS = {
  1: '#f0b90f', 2: '#1b3fa6', 3: '#c4201c', 4: '#4a2a84', 5: '#e8641a', 6: '#126b3a', 7: '#6e1420', 8: '#101010',
};
export const groupOf = n => (n === 8 ? 'eight' : n < 8 ? 'solids' : 'stripes');

// Small seeded random generator so procedural textures look the same on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
