export const TILE = 16;
export const VW = 480;
export const VH = 270;
export const STEP_MS = 1000 / 60;
export const HUD_H = 18;
export const AUD_H = 14;

// 물리 수치 (1타일 = 16px, 60Hz 고정 업데이트)
export const PHYS = {
  maxSpeed: 1.75,
  accelGround: 0.22,
  accelAir: 0.16,
  decelGround: 0.32,
  decelAir: 0.06,
  gravity: 0.22,
  maxFall: 4.5,
  jumpV: 4.95,
  jumpCut: 1.6,
  coyote: 6,
  buffer: 6,
  wallSlide: 1.0,
  wallJumpX: 2.3,
  wallJumpY: 4.5,
  padV: 6.6,
  stompBounce: 3.6,
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 시드 고정 난수 (mulberry32)
export function makeRng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (n) => Math.floor(f() * n);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.range = (a, b) => a + f() * (b - a);
  return f;
}

export const rand = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);
