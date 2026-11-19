// 모든 그래픽은 코드로 직접 그린 오리지널 픽셀아트입니다.
export const PAL = {
  ink: '#1a1c2c', white: '#f4f4f4', gray: '#94b0c2', dgray: '#566c86', slate: '#333c57',
  red: '#e43b44', dred: '#a22633', orange: '#f77622', yellow: '#feae34', lyellow: '#fee761',
  green: '#63c74d', dgreen: '#3e8948', teal: '#2ce8f5', blue: '#0099db', dblue: '#124e89', navy: '#1b2a4a',
  purple: '#b55088', dpurple: '#68386c', pink: '#f6757a', lpink: '#ffb4c8', brown: '#733e39', lbrown: '#b86f50',
  cream: '#ead4aa', tan: '#e4a672', gold: '#ffd23f', dgold: '#c98a1b', silver: '#c0cbdc', neonp: '#ff4fa3',
  neonc: '#3ff7d9', mint: '#a8e6cf', black: '#0b0b14', tomato: '#ff5a3c',
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// 문자열 도트 데이터 → 캔버스
export function fromArt(rows, map, flip = false) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const [c, g] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const col = map[r[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  return c;
}

export function flipCanvas(src) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

/* ───────────── 캐릭터 꾸미기 옵션 ───────────── */
export const SKINS = ['#ffd9b8', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#3b2a20', '#1a1c2c', '#733e39', '#c98a1b', '#ffd23f', '#e43b44', '#f6757a', '#b55088', '#0099db', '#63c74d', '#f4f4f4', '#94b0c2'];
export const OUTFIT_COLORS = ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#f77622', '#2ce8f5', '#f6757a', '#333c57', '#f4f4f4', '#3e8948', '#124e89'];
export const HAIRS = [
  { id: 'bowl', name: '바가지' }, { id: 'spiky', name: '삐죽' }, { id: 'pigtails', name: '양갈래' }, { id: 'curly', name: '곱슬' },
  { id: 'buzz', name: '민머리', star: 3 }, { id: 'ponytail', name: '포니테일', star: 6 }, { id: 'afro', name: '뽀글', star: 12 }, { id: 'mohawk', name: '모히칸', star: 18 },
];
export const HATS = [
  { id: 'none', name: '없음' }, { id: 'cap', name: '야구모자' }, { id: 'headset', name: '헤드셋' }, { id: 'catears', name: '고양이 귀' }, { id: 'antenna', name: '안테나' },
  { id: 'crown', name: '왕관', star: 30 }, { id: 'silk', name: '실크햇', star: 21 }, { id: 'helmet', name: '헬멧', star: 9 },
  { id: 'chef', name: '셰프 모자', boss: 1 }, { id: 'goggles', name: '퀴즈 안경', boss: 2 },
];
export const OUTFITS = [
  { id: 'tee', name: '티셔츠' }, { id: 'suit', name: '정장' }, { id: 'overall', name: '멜빵' }, { id: 'sport', name: '운동복' },
  { id: 'apron', name: '앞치마', star: 15 }, { id: 'pajama', name: '잠옷', star: 24 }, { id: 'cape', name: '망토', star: 36 },
  { id: 'sparkle', name: '디스코 재킷', boss: 3 },
];
export const FACES = [
  { id: 'normal', name: '기본' }, { id: 'smile', name: '웃음' }, { id: 'angry', name: '화남' },
  { id: 'sleepy', name: '졸림', star: 27 }, { id: 'shades', name: '선글라스', star: 33 }, { id: 'bandage', name: '반창고', star: 40 },
];

export function defaultLook() {
  return { skin: 0, hair: 0, hairColor: 0, hat: 0, outfit: 0, outfitColor: 0, face: 0 };
}
export function sanitizeLook(l) {
  const d = defaultLook();
  const lim = { skin: SKINS.length, hair: HAIRS.length, hairColor: HAIR_COLORS.length, hat: HATS.length, outfit: OUTFITS.length, outfitColor: OUTFIT_COLORS.length, face: FACES.length };
  const o = {};
  for (const k in d) {
    const v = l && Number.isInteger(l[k]) ? l[k] : d[k];
    o[k] = v >= 0 && v < lim[k] ? v : d[k];
  }
  return o;
}

/* ───────────── 캐릭터 프레임 (20×22, 오른쪽 방향) ───────────── */
export const CF_W = 20, CF_H = 22;
const POSES = {
  idle0: { L: [7, 0], R: [11, 0], arms: 'down', bob: 0 },
  idle1: { L: [7, 0], R: [11, 0], arms: 'down', bob: 1 },
  run0: { L: [6, 0], R: [12, 0], arms: 'swingA', bob: 0 },
  run1: { L: [8, -1], R: [10, 0], arms: 'down', bob: 1 },
  run2: { L: [6, 0], R: [12, 0], arms: 'swingB', bob: 0 },
  run3: { L: [8, 0], R: [10, -1], arms: 'down', bob: 1 },
  jump: { L: [7, -1], R: [11, -1], arms: 'up', bob: 0 },
  fall: { L: [6, 0], R: [12, 0], arms: 'out', bob: 0 },
  punch0: { L: [6, 0], R: [12, 0], arms: 'wind', bob: 0 },
  punch1: { L: [6, 0], R: [12, 0], arms: 'punch', bob: 0 },
  hurt: { L: [6, 0], R: [12, 0], arms: 'up', bob: 0, expr: 'hurt' },
  slide: { L: [7, 0], R: [11, -1], arms: 'wall', bob: 0 },
  win0: { L: [7, 0], R: [11, 0], arms: 'up', bob: 0, expr: 'win' },
  win1: { L: [7, -1], R: [11, -1], arms: 'up', bob: -1, expr: 'win' },
  scared: { L: [7, 0], R: [11, 0], arms: 'out', bob: 0, expr: 'hurt' },
  throw: { L: [6, 0], R: [12, 0], arms: 'throw', bob: 0 },
};
export const FRAME_NAMES = Object.keys(POSES);
export const FRAME = Object.fromEntries(FRAME_NAMES.map((n, i) => [n, i]));

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export { shade };

export function drawCharacter(g, ox, oy, look, poseName) {
  const pose = POSES[poseName] || POSES.idle0;
  const k = PAL.ink;
  const skin = SKINS[look.skin] || SKINS[0];
  const hc = HAIR_COLORS[look.hairColor] || HAIR_COLORS[0];
  const oc = OUTFIT_COLORS[look.outfitColor] || OUTFIT_COLORS[0];
  const hair = HAIRS[look.hair]?.id || 'bowl';
  const hat = HATS[look.hat]?.id || 'none';
  const outfit = OUTFITS[look.outfit]?.id || 'tee';
  const face = FACES[look.face]?.id || 'normal';
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); };
  const b = pose.bob;
  const hy = b; // 머리 y 오프셋

  // 망토 (몸 뒤)
  if (outfit === 'cape') { P(2, 15 + hy, 4, 6, k); P(3, 15 + hy, 2, 5, PAL.red); }
  // 다리
  const pants = outfit === 'suit' ? PAL.slate : outfit === 'sport' ? oc : outfit === 'pajama' ? shade(oc, 1.1) : shade(oc, 0.55);
  for (const [lx, ly] of [pose.L, pose.R]) {
    P(lx, 19 + ly, 2, 2, pants);
    P(lx, 21 + ly, 2, 1, k);
  }
  // 팔 (뒤쪽)
  const sleeve = outfit === 'suit' ? PAL.slate : outfit === 'apron' ? PAL.white : outfit === 'sparkle' ? PAL.gold : oc;
  const arm = (x, y, horiz) => {
    if (horiz) { P(x, y, 3, 2, k); P(x, y, 2, 2, sleeve); P(x + 2, y, 1, 2, skin); }
    else { P(x, y, 2, 3, k); P(x, y, 2, 2, sleeve); P(x, y + 2, 2, 1, skin); }
  };
  const A = pose.arms;
  if (A === 'down') arm(4, 16 + hy, false);
  else if (A === 'swingA') arm(4, 15 + hy, false);
  else if (A === 'swingB') arm(5, 16 + hy, false);
  else if (A === 'up' || A === 'wall') { P(3, 12 + hy, 2, 4, sleeve); P(3, 11 + hy, 2, 1, skin); }
  else if (A === 'out') { P(2, 15 + hy, 3, 2, sleeve); P(1, 15 + hy, 1, 2, skin); }
  else if (A === 'wind' || A === 'punch' || A === 'throw') arm(4, 16 + hy, false);

  // 몸통
  P(5, 15 + hy, 10, 5, k);
  let body = oc;
  if (outfit === 'suit') body = PAL.slate;
  if (outfit === 'apron') body = PAL.white;
  if (outfit === 'sparkle') body = PAL.gold;
  if (outfit === 'pajama') body = shade(oc, 1.25);
  P(6, 15 + hy, 8, 4, body);
  if (outfit === 'suit') { P(9, 15 + hy, 2, 2, PAL.white); P(9, 16 + hy, 1, 3, PAL.red); }
  if (outfit === 'overall') { P(6, 15 + hy, 8, 2, PAL.white); P(7, 15 + hy, 1, 2, shade(oc, 0.8)); P(12, 15 + hy, 1, 2, shade(oc, 0.8)); P(6, 17 + hy, 8, 2, shade(oc, 0.8)); }
  if (outfit === 'sport') { P(6, 17 + hy, 8, 1, PAL.white); }
  if (outfit === 'apron') { P(6, 15 + hy, 1, 4, oc); P(13, 15 + hy, 1, 4, oc); P(8, 17 + hy, 4, 1, oc); }
  if (outfit === 'sparkle') { P(7, 16 + hy, 1, 1, PAL.white); P(11, 15 + hy, 1, 1, PAL.white); P(12, 18 + hy, 1, 1, PAL.white); P(9, 18 + hy, 1, 1, oc); P(6, 15 + hy, 1, 4, oc); }
  if (outfit === 'pajama') { P(7, 16 + hy, 1, 1, PAL.white); P(10, 17 + hy, 1, 1, PAL.white); P(12, 15 + hy, 1, 1, PAL.white); }
  if (outfit === 'cape') { P(6, 15 + hy, 8, 1, PAL.dred); }

  // 머리
  const hdY = 5 + hy;
  P(4, hdY + 1, 12, 9, k); P(5, hdY, 10, 11, k);
  P(5, hdY + 1, 10, 9, skin); P(6, hdY + 1, 8, 1, skin);
  P(14, hdY + 6, 1, 3, shade(skin, 0.88));

  // 머리카락
  const H = (x, y, w, h) => P(x, hdY + y, w, h, hc);
  const HK = (x, y, w, h) => P(x, hdY + y, w, h, k);
  if (hair === 'bowl') { HK(4, -1, 12, 4); HK(3, 0, 1, 6); H(4, 0, 12, 3); H(4, 3, 3, 4); HK(5, 7, 2, 1); H(13, 3, 2, 1); }
  else if (hair === 'spiky') { HK(4, -1, 12, 3); H(4, 0, 12, 2); H(4, 2, 2, 3); HK(5, -3, 2, 2); H(6, -3, 1, 2); HK(8, -4, 3, 3); H(9, -4, 1, 3); HK(12, -3, 2, 2); H(12, -3, 1, 2); H(13, 2, 1, 1); }
  else if (hair === 'pigtails') { HK(4, -1, 12, 4); H(4, 0, 12, 2); H(4, 2, 2, 3); HK(1, 4, 4, 4); H(2, 5, 2, 2); HK(15, 4, 4, 4); H(16, 5, 2, 2); }
  else if (hair === 'curly') { HK(3, -2, 14, 5); H(4, -1, 12, 3); H(3, 1, 3, 4); H(5, -2, 2, 1); H(9, -2, 2, 1); H(13, -2, 2, 1); HK(2, 2, 1, 3); P(7, hdY + 2, 1, 1, shade(hc, 0.7)); P(11, hdY + 1, 1, 1, shade(hc, 0.7)); }
  else if (hair === 'buzz') { H(5, 0, 10, 1); P(6, hdY + 1, 6, 1, shade(skin, 0.92)); }
  else if (hair === 'ponytail') { HK(4, -1, 12, 4); H(4, 0, 12, 2); H(4, 2, 2, 3); HK(0, 1, 5, 6); H(1, 2, 3, 4); H(0, 5, 2, 2); }
  else if (hair === 'afro') { HK(1, -5, 18, 9); HK(2, -6, 16, 11); H(2, -5, 16, 8); H(3, -6, 14, 1); H(2, 3, 3, 3); P(6, hdY - 4, 1, 1, shade(hc, 0.7)); P(12, hdY - 3, 1, 1, shade(hc, 0.7)); P(9, hdY - 1, 1, 1, shade(hc, 0.7)); }
  else if (hair === 'mohawk') { HK(7, -5, 6, 6); H(8, -5, 4, 6); P(9, hdY - 4, 1, 4, shade(hc, 1.3)); }

  // 얼굴 (오른쪽 방향)
  const E = (x, y, w, h, c = k) => P(x, hdY + y, w, h, c);
  let expr = pose.expr || face;
  if (expr === 'hurt') { E(9, 4, 2, 2); E(13, 4, 2, 2); E(10, 4, 1, 1, PAL.white); E(14, 4, 1, 1, PAL.white); E(11, 7, 2, 2); }
  else if (expr === 'win') { E(9, 5, 1, 1); E(10, 4, 1, 1); E(11, 5, 1, 1); E(13, 5, 1, 1); E(14, 4, 1, 1); E(10, 7, 4, 1); E(11, 8, 2, 1, PAL.red); }
  else {
    if (face === 'sleepy') { E(9, 5, 2, 1); E(13, 5, 2, 1); }
    else if (face === 'shades') { E(8, 4, 8, 2); E(9, 4, 1, 1, PAL.teal); E(13, 4, 1, 1, PAL.teal); }
    else { E(10, 4, 1, 2); E(13, 4, 1, 2); }
    if (face === 'angry') { E(9, 3, 2, 1); E(13, 3, 2, 1); E(11, 8, 2, 1); E(10, 9 - 1, 1, 1); }
    else if (face === 'smile') { E(10, 7, 4, 1); E(9, 6, 1, 1); E(14, 6, 1, 1); }
    else if (face === 'sleepy') { E(11, 8, 1, 1); }
    else { E(11, 7, 2, 1); }
    if (face === 'bandage') { E(13, 6, 2, 2, PAL.cream); E(13, 6, 1, 1, PAL.tan); }
  }
  if (face !== 'shades') { E(8, 6, 1, 1, PAL.lpink); E(15, 6, 1, 1, PAL.lpink); }

  // 모자
  const T = (x, y, w, h, c) => P(x, hdY + y, w, h, c);
  if (hat === 'cap') { T(4, -2, 11, 4, k); T(5, -1, 9, 3, oc === PAL.red ? PAL.blue : PAL.red); T(13, 1, 6, 2, k); T(14, 1, 4, 1, oc === PAL.red ? PAL.blue : PAL.red); T(8, -1, 2, 1, PAL.white); }
  else if (hat === 'crown') { T(5, -3, 10, 4, k); T(6, -2, 8, 2, PAL.gold); T(5, -5, 2, 2, k); T(9, -6, 2, 3, k); T(13, -5, 2, 2, k); T(6, -4, 1, 2, PAL.gold); T(10, -5, 1, 3, PAL.gold); T(13, -4, 1, 2, PAL.gold); T(9, -1, 2, 1, PAL.red); }
  else if (hat === 'chef') { T(4, -7, 12, 9, k); T(5, -6, 10, 6, PAL.white); T(4, -5, 1, 3, k); T(5, 0, 10, 1, PAL.gray); T(7, -4, 1, 1, PAL.silver); T(11, -5, 1, 1, PAL.silver); }
  else if (hat === 'headset') { T(5, -2, 10, 1, k); T(4, -1, 1, 4, k); T(15, -1, 1, 4, k); T(3, 3, 3, 4, k); T(4, 4, 1, 2, PAL.red); T(15, 6, 1, 1, k); T(14, 8, 1, 1, k); T(13, 9, 2, 1, PAL.dgray); }
  else if (hat === 'goggles') { T(8, 3, 4, 4, k); T(12, 3, 4, 4, k); T(9, 4, 2, 2, PAL.teal); T(13, 4, 2, 2, PAL.teal); T(9, 4, 1, 1, PAL.white); T(13, 4, 1, 1, PAL.white); T(4, 4, 4, 1, k); }
  else if (hat === 'silk') { T(6, -8, 9, 8, k); T(7, -7, 7, 6, PAL.slate); T(7, -3, 7, 1, PAL.red); T(3, -1, 14, 2, k); T(4, -1, 12, 1, PAL.slate); }
  else if (hat === 'catears') { T(4, -4, 4, 4, k); T(5, -3, 2, 3, hc); T(5, -2, 1, 2, PAL.lpink); T(12, -4, 4, 4, k); T(13, -3, 2, 3, hc); T(14, -2, 1, 2, PAL.lpink); }
  else if (hat === 'helmet') { T(4, -2, 12, 6, k); T(5, -1, 10, 4, oc); T(5, 3, 10, 1, k); T(6, -1, 2, 1, PAL.white); T(5, 1, 10, 1, PAL.white); }
  else if (hat === 'antenna') { T(10, -5, 1, 5, k); T(9, -7, 3, 3, k); T(10, -6, 1, 1, PAL.red); }

  // 앞쪽 팔
  if (A === 'down') arm(14, 16 + hy, false);
  else if (A === 'swingA') arm(14, 16 + hy, false);
  else if (A === 'swingB') arm(13, 15 + hy, false);
  else if (A === 'up') { P(15, 12 + hy, 2, 4, sleeve); P(15, 11 + hy, 2, 1, skin); }
  else if (A === 'wall') { P(15, 13 + hy, 3, 2, sleeve); P(18, 13 + hy, 1, 2, skin); }
  else if (A === 'out') { P(15, 15 + hy, 3, 2, sleeve); P(18, 15 + hy, 1, 2, skin); }
  else if (A === 'wind') { P(12, 16 + hy, 2, 2, sleeve); P(11, 16 + hy, 1, 2, skin); }
  else if (A === 'punch') { P(14, 16 + hy, 4, 2, sleeve); P(17, 15 + hy, 3, 3, k); P(18, 16 + hy, 2, 1, skin); }
  else if (A === 'throw') { P(14, 12 + hy, 2, 4, sleeve); P(15, 11 + hy, 2, 2, skin); }
}

const charCache = new Map();
export function charAtlas(look) {
  const key = JSON.stringify(look);
  let a = charCache.get(key);
  if (a) return a;
  const n = FRAME_NAMES.length;
  const [c, g] = makeCanvas(CF_W * n, CF_H + 8);
  FRAME_NAMES.forEach((name, i) => drawCharacter(g, i * CF_W, 8, look, name));
  a = { right: c, left: flipCanvas(c), n };
  if (charCache.size > 24) charCache.clear();
  charCache.set(key, a);
  return a;
}
export function charPreview(look, scale = 4, pose = 'idle0') {
  const [c, g] = makeCanvas(CF_W * scale, (CF_H + 8) * scale);
  const [s, sg] = makeCanvas(CF_W, CF_H + 8);
  drawCharacter(sg, 0, 8, look, pose);
  g.drawImage(s, 0, 0, c.width, c.height);
  return c;
}

/* ───────────── 적 ───────────── */
const EK = { k: PAL.ink, w: PAL.white, g: PAL.gray, p: PAL.lpink, r: PAL.red, d: PAL.dred, o: PAL.orange, y: PAL.yellow, Y: PAL.lyellow,
  G: PAL.green, D: PAL.dgreen, b: PAL.blue, B: PAL.dblue, t: PAL.teal, u: PAL.purple, U: PAL.dpurple, n: PAL.brown, N: PAL.lbrown,
  c: PAL.cream, s: PAL.silver, S: PAL.slate, P: PAL.pink, m: PAL.neonp, x: PAL.tan, T: PAL.tomato };

const ENEMY_ART = {
  marsh: [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwwwwwwwk..',
    '..kwwwwwwwwwgk..',
    '.kwwwkwwwkwwwgk.',
    '.kwwwkwwwkwwwgk.',
    '.kwpwwwwwwwpwgk.',
    '.kwwwwkkkwwwwgk.',
    '.kwwwwwwwwwwwgk.',
    '.kgwwwwwwwwwggk.',
    '..kggwwwwwwggk..',
    '...kkkkkkkkkk...',
    '....kk....kk....',
    '................',
  ],
  sauce: [
    '......kkkk......',
    '.....kDGGDk.....',
    '....kDGGGGDk....',
    '...kkkkkkkkkk...',
    '.....kwwwwk.....',
    '....krrrrrrk....',
    '...krrrrrrrrk...',
    '...krwkrrwkrk...',
    '...krkkrrkkrk...',
    '...krrrrrrrrk...',
    '...krcccccccrk..',
    '...krcrrrrrcrk..',
    '...krcccccccrk..',
    '...kdrrrrrrrdk..',
    '....kkkkkkkkk...',
    '....kk....kk....',
  ],
  shroom: [
    '................',
    '.....kkkkkk.....',
    '...kkooooookk...',
    '..koowwoooowwok.',
    '.kooowwooooowwok',
    '.koooooowwooook.',
    'kkkkkkkkkkkkkkkk',
    '...kccccccccck..',
    '...kckcccckccck.',
    '...kcccckkccck..',
    '....kccccccck...',
    '.....kkkkkkk....',
    '......kgk.......',
    '.....kgsgk......',
    '......kgk.......',
    '.....kkkkk......',
  ],
  qbot: [
    '.......kk.......',
    '....kkkSSkkk....',
    '.......kk.......',
    '...kkkkkkkkkk...',
    '..kSSSSSSSSSSk..',
    '..kSkkkkkkkkSk..',
    '..kSktttttbkSk..',
    '..kSktkkkttkSk..',
    '..kSkttttkbkSk..',
    '..kSkttbktbkSk..',
    '..kSkttttttkSk..',
    '..kSkttbktbkSk..',
    '..kSkkkkkkkkSk..',
    '..kSSSSSSrSSSk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  mole: [
    '......kkkk......',
    '.....krrrrk.....',
    '....krwrrrrk....',
    '....kkkkkkkk....',
    '....kssssssk....',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnnk..',
    '.knnnnnnnnnnnnk.',
    '.knnkknnnnkknnk.',
    '.knnnnnPPnnnnnk.',
    '.knNNnPkkPnNNnk.',
    '.knNNNNNNNNNNnk.',
    '.knnNNwwwwNNnnk.',
    '.knnnnNNNNnnnnk.',
    'kxxkknnnnnnkkxxk',
    'kkk..kkkkkk..kkk',
  ],
  dancer: [
    '....kkkkkkk.....',
    '...kUUUUUUUk....',
    '..kUUUUUUUUUk...',
    '..kUUUUUUUUUk...',
    '..kUkxxxxxxkk...',
    '...kxxkxxkxk....',
    '...kxxxxxxxk....',
    '....kxxkkxk.....',
    '..kkkuuuuukkk...',
    '.kxkummwmmukxk..',
    '.kk.kuuuuuk.kk..',
    '....kuuuuuk.....',
    '....kSSkSSk.....',
    '....kSSkSSk.....',
    '...kSSk.kSSk....',
    '...kkk...kkk....',
  ],
  drone: [
    'kkkkkk....kkkkkk',
    '...kk......kk...',
    '..kkkkkkkkkkkk..',
    '..kSSSSSSSSSSk..',
    '.kkSSSSSSSSSSkk.',
    '.kSSkkkkkkSSSSk.',
    '.kSkbbbbbbkSrSk.',
    '.kSkbBttBbkSSSk.',
    '.kSkbtwtBbkSSSk.',
    '.kSkbBttBbkSSSk.',
    '.kSkbbbbbbkSSSk.',
    '.kSSkkkkkkSSSSk.',
    '..kkkkkkkkkkkk..',
    '.....k....k.....',
    '....kk....kk....',
    '................',
  ],
  tomato: [
    '.....kGk.',
    '...kkGGkk',
    '..kTTTTTk',
    '.kTTwTTTTk',
    '.kTTTTTTTk',
    '.kTTTTTTdk',
    '..kTTTTdk.',
    '...kkkkk..',
  ],
};

const enemyCache = {};
export function enemySprite(type) {
  if (enemyCache[type]) return enemyCache[type];
  const art = ENEMY_ART[type];
  const base = fromArt(art, EK);
  const w = base.width, h = base.height;
  // 2프레임: 0=기본, 1=눌린 모습(걷기 애니)
  const [c, g] = makeCanvas(w * 2, h);
  g.drawImage(base, 0, 0);
  g.drawImage(base, 0, 0, w, h - 1, w, 1, w, h - 1);
  const r = { right: c, left: flipCanvas(c), w, h };
  enemyCache[type] = r;
  return r;
}

/* ───────────── 아이템 아이콘 (12×12) ───────────── */
const ITEM_ART = {
  pie: [
    '............',
    '....kkkk....',
    '..kkwwwwkk..',
    '.kwwwwpwwwk.',
    '.kwpwwwwwwk.',
    'kkkkkkkkkkkk',
    'kyyyyyyyyyyk',
    'kxyxyxyxyxyk',
    '.kyyyyyyyyk.',
    '..kkkkkkkk..',
    '............',
    '............',
  ],
  bomb: [
    '........Y...',
    '.......YoY..',
    '......kk....',
    '.....kk.....',
    '...kkkkkk...',
    '..krrwrrrk..',
    '.krrwrrrrrk.',
    '.krrrrrrrrk.',
    '.kYYYYYYYYk.',
    '.krrrrrrrrk.',
    '..krrrrrrk..',
    '...kkkkkk...',
  ],
  mic: [
    '.....kkkk...',
    '....ksssgk..',
    '...ksgsgsgk.',
    '...kgsgsgsk.',
    '...ksgsgsgk.',
    '....kgsgsk..',
    '.....kkkk...',
    '....kSkk....',
    '...kSk......',
    '..kSk.......',
    '.kSk........',
    '.kk.........',
  ],
  magnet: [
    '............',
    '..kkkkkkkk..',
    '.krrrrrrrrk.',
    '.krrkkkkrrk.',
    '.krrk..krrk.',
    '.krrk..krrk.',
    '.krrk..krrk.',
    '.kssk..kssk.',
    '.kssk..kssk.',
    '.kkkk..kkkk.',
    '............',
    '............',
  ],
  cloak: [
    '....kkkk....',
    '...kuuuuk...',
    '..kuuUUuuk..',
    '..kuUkkUuk..',
    '.kuuUUUUuuk.',
    '.kuuuuuuuuk.',
    'kuuuuuuuuuuk',
    'kuuUuuuuUuuk',
    'kuUuuuuuuUuk',
    'kuuuuuuuuuuk',
    '.kkkkkkkkkk.',
    '............',
  ],
  spring: [
    '............',
    '..kkkkkkkk..',
    '..krrrrrrk..',
    '..kkkkkkkk..',
    '...ksssk....',
    '....ksssk...',
    '...ksssk....',
    '....ksssk...',
    '..kkkkkkkk..',
    '.kbbbbbbbbk.',
    '.kkkkkkkkkk.',
    '............',
  ],
};
export const ITEMS = ['pie', 'bomb', 'mic', 'magnet', 'cloak', 'spring'];
export const ITEM_NAMES = { pie: '파이 투척기', bomb: '폭죽 폭탄', mic: '마이크 부메랑', magnet: '자석 장갑', cloak: '변신 망토', spring: '스프링 신발' };
const itemCache = {};
export function itemIcon(type) {
  if (!itemCache[type]) itemCache[type] = fromArt(ITEM_ART[type], EK);
  return itemCache[type];
}
export function tomatoSprite() { return enemySprite('tomato'); }

/* ───────────── MC · 핑크 초상 ───────────── */
const PORTRAITS = {
  mc: [
    '................',
    '.....kkkkkk.....',
    '...kkgsgsgskk...',
    '..kgsgsgsgsgsk..',
    '..ksgsgsgsgsgk..',
    '..kxxxxxxxxxxk..',
    '.kxxkkxxxxkkxxk.',
    '.kxxwkxxxxwkxxk.',
    '.kxxxxxxxxxxxxk.',
    '.kxxxkwwwwkxxxk.',
    '..kxxkwwwwkxxk..',
    '...kxxkkkkxxk...',
    '..kkkkkkkkkkkk..',
    '.kSSSwwrrwwSSSk.',
    '.kSSSSwrrwSSSSk.',
    '.kSSSSSrrSSSSSk.',
  ],
  pink: [
    '...kkkkkkkkk....',
    '..kPPPPPPPPPk...',
    '.kPPPPPPPPPPPk..',
    '.kPPkkkkkkkPPk..',
    'kkPkxxxxxxxkPkk.',
    'ksskxkxxxkxkssk.',
    'ksskxkxxxkxkssk.',
    'kkPkxxxxxxxkPkk.',
    '.kPkxpxxxpxkPk..',
    '.kPkxxkkkxxkPkkk',
    '..kkxxxxxxxkk.kk',
    '...kkkkkkkkk..k.',
    '..kkPPPPPPPkk.k.',
    '.kPPPPwwwPPPPkk.',
    '.kPPPPwwwPPPPk..',
    '.kPPPPPPPPPPPk..',
  ],
};
const portraitCache = {};
export function portrait(who) {
  if (!portraitCache[who]) portraitCache[who] = fromArt(PORTRAITS[who], EK);
  return portraitCache[who];
}
