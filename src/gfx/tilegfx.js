import { PAL, makeCanvas, shade } from './sprites.js';
import { T } from '../game/tiledefs.js';
import { TILE, VW, VH } from '../core/constants.js';

export const THEMES = [
  { name: '요리쇼', base: '#ead4aa', light: '#fff3d6', dark: '#b88f62', grout: '#8a5a44', top: '#f6757a', wallA: '#7fd6c2', wallB: '#6cc3b0', wallLine: '#5aa596', sky: '#3e2b3a', accent: PAL.red },
  { name: '퀴즈쇼', base: '#2a64b8', light: '#5fa8ff', dark: '#163e7a', grout: '#0e2650', top: '#feae34', wallA: '#13234a', wallB: '#182c5a', wallLine: '#2c4a8a', sky: '#0a1028', accent: PAL.yellow },
  { name: '디스코 쇼', base: '#6b3a8f', light: '#c47bff', dark: '#3e1f58', grout: '#26113a', top: '#ff4fa3', wallA: '#1a0f2e', wallB: '#21143a', wallLine: '#3a2066', sky: '#0b0716', accent: PAL.neonp },
];

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// 단단한 블록 (자동 타일: 위가 비었으면 윗면 장식)
export function drawSolid(g, x, y, th, topOpen, variant) {
  px(g, x, y, 16, 16, th.base);
  px(g, x, y, 16, 1, th.light);
  px(g, x, y, 1, 16, th.light);
  px(g, x, y + 15, 16, 1, th.dark);
  px(g, x + 15, y, 1, 16, th.dark);
  // 줄눈 (테마별 무늬)
  if (th === THEMES[0]) {
    px(g, x, y + 7, 16, 1, th.grout); px(g, x + 7, y, 1, 7, th.grout); px(g, x + (variant & 1 ? 3 : 11), y + 8, 1, 7, th.grout);
  } else if (th === THEMES[1]) {
    px(g, x + 2, y + 2, 12, 12, th.dark); px(g, x + 3, y + 3, 10, 10, th.base); px(g, x + 3, y + 3, 10, 1, th.light);
  } else {
    px(g, x + 1, y + 1, 14, 14, th.dark); px(g, x + 2, y + 2, 12, 12, th.base);
    if (variant % 3 === 0) px(g, x + 4, y + 4, 2, 2, th.light);
  }
  if (topOpen) {
    px(g, x, y, 16, 3, th.top); px(g, x, y + 3, 16, 1, shade(th.top, 0.7));
    px(g, x + 2 + (variant % 5) * 2, y + 3, 2, 2, th.top);
  }
}

export function drawOneway(g, x, y, th) {
  px(g, x, y, 16, 5, PAL.ink); px(g, x, y + 1, 16, 3, th.top); px(g, x, y + 1, 16, 1, shade(th.top, 1.3));
  px(g, x + 2, y + 5, 2, 3, PAL.ink); px(g, x + 12, y + 5, 2, 3, PAL.ink);
}

export function drawSpikes(g, x, y, down) {
  for (let i = 0; i < 4; i++) {
    const sx = x + i * 4;
    for (let r = 0; r < 7; r++) {
      const w = Math.max(1, Math.round((r + 1) * 4 / 7));
      const yy = down ? y + r : y + 15 - r;
      px(g, sx + Math.floor((4 - w) / 2), yy, w, 1, r < 1 ? PAL.dgray : PAL.silver);
    }
    px(g, sx + 1, down ? y + 6 : y + 9, 1, 1, PAL.white);
  }
  px(g, x, down ? y : y + 15, 16, 1, PAL.dgray);
}

export function drawButter(g, x, y, th) {
  px(g, x, y, 16, 16, th.base); px(g, x, y + 15, 16, 1, th.dark);
  px(g, x, y, 16, 5, '#ffe9a0'); px(g, x, y, 16, 1, '#fff8d8'); px(g, x + 3, y + 5, 3, 2, '#ffe9a0'); px(g, x + 11, y + 5, 2, 3, '#ffe9a0');
  px(g, x + 5, y + 1, 4, 1, PAL.white);
}

// 정적 레이어 (단단한 블록·일방 발판·가시·버터)
export function buildStatic(level, th) {
  const [c, g] = makeCanvas(level.w * TILE, level.h * TILE);
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      const t = level.tiles[ty * level.w + tx];
      const x = tx * TILE, y = ty * TILE;
      if (t === T.SOLID) {
        const above = ty > 0 ? level.tiles[(ty - 1) * level.w + tx] : T.EMPTY;
        const open = !(above === T.SOLID || above === T.BUTTER || above === T.HOT || above === T.CONV_L || above === T.CONV_R || above === T.JUMP || above === T.SWITCH || above === T.BUZZER || above === T.LASER);
        drawSolid(g, x, y, th, open && ty > 0, (tx * 7 + ty * 13) & 15);
      } else if (t === T.ONEWAY) drawOneway(g, x, y, th);
      else if (t === T.SPIKE) drawSpikes(g, x, y, false);
      else if (t === T.SPIKE_D) drawSpikes(g, x, y, true);
      else if (t === T.BUTTER) drawButter(g, x, y, th);
      else if (t === T.DECO) { px(g, x + 6, y, 4, 16, PAL.slate); px(g, x + 7, y, 1, 16, PAL.dgray); }
    }
  }
  return c;
}

/* ───── 동적 타일 그리기 ───── */
export function drawDynamicTile(g, code, x, y, th, st, time) {
  switch (code) {
    case T.JUMP: { // 튀어오르는 식빵
      const sq = st.anim > 0 ? 3 : 0;
      px(g, x, y + 8, 16, 8, PAL.slate); px(g, x + 1, y + 9, 14, 6, PAL.dgray);
      px(g, x + 1, y + 2 + sq, 14, 7 - sq, PAL.ink); px(g, x + 2, y + 3 + sq, 12, 5 - sq, PAL.tan);
      px(g, x + 3, y + 3 + sq, 10, 1, '#f9d39b'); px(g, x + 1, y + 1 + sq, 3, 2, PAL.ink); px(g, x + 12, y + 1 + sq, 3, 2, PAL.ink);
      px(g, x + 2, y + 2 + sq, 1, 1, PAL.tan); px(g, x + 13, y + 2 + sq, 1, 1, PAL.tan);
      if (sq === 0) { px(g, x + 3, y + 9, 2, 1, PAL.silver); px(g, x + 11, y + 9, 2, 1, PAL.silver); }
      break;
    }
    case T.HOT: {
      const hot = st.hot, warn = st.warn;
      px(g, x, y, 16, 16, PAL.slate); px(g, x, y, 16, 4, hot ? PAL.orange : warn && (time >> 3) & 1 ? PAL.yellow : PAL.dgray);
      px(g, x, y, 16, 1, hot ? PAL.lyellow : PAL.gray);
      for (let i = 0; i < 3; i++) px(g, x + 2 + i * 5, y + 6, 3, 1, hot ? PAL.red : PAL.ink);
      px(g, x, y + 15, 16, 1, PAL.ink);
      if (hot && ((time + x) >> 2) % 4 === 0) { px(g, x + 4 + ((time >> 1) % 8), y - 3, 1, 2, PAL.orange); }
      break;
    }
    case T.CONV_L: case T.CONV_R: {
      px(g, x, y, 16, 16, PAL.slate); px(g, x, y, 16, 5, PAL.ink); px(g, x, y + 1, 16, 3, PAL.dgray);
      const dir = code === T.CONV_R ? 1 : -1;
      const o = ((time >> 2) * dir % 4 + 4) % 4;
      for (let i = -1; i < 5; i++) px(g, x + i * 4 + o, y + 1, 2, 3, PAL.gray);
      px(g, x, y + 6, 16, 1, PAL.ink);
      px(g, x + 3, y + 9, 4, 4, PAL.dgray); px(g, x + 9, y + 9, 4, 4, PAL.dgray);
      px(g, x + 4 + (o & 1), y + 10, 1, 1, PAL.white); px(g, x + 10 + (o & 1), y + 10, 1, 1, PAL.white);
      break;
    }
    case T.CRUMBLE: {
      if (st.gone) return;
      const shake = st.timer > 0 ? ((time >> 1) & 1) : 0;
      px(g, x + shake, y, 16, 16, PAL.ink); px(g, x + 1 + shake, y + 1, 14, 14, '#d9a066');
      px(g, x + 1 + shake, y + 1, 14, 2, '#f2c58a');
      px(g, x + 4 + shake, y + 4, 1, 5, PAL.brown); px(g, x + 5 + shake, y + 8, 4, 1, PAL.brown); px(g, x + 10 + shake, y + 5, 1, 6, PAL.brown);
      px(g, x + 3 + shake, y + 11, 2, 1, '#f2c58a'); px(g, x + 11 + shake, y + 3, 2, 1, '#f2c58a');
      break;
    }
    case T.SWITCH: {
      px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, st.on ? PAL.green : PAL.red);
      px(g, x + 1, y + 1, 14, 2, shade(st.on ? PAL.green : PAL.red, 1.3));
      px(g, x + 5, y + 4, 6, 8, PAL.white); px(g, x + 6, st.on ? y + 5 : y + 8, 4, 3, PAL.ink);
      break;
    }
    case T.BUZZER: {
      const down = st.anim > 0 ? 2 : 0;
      px(g, x, y + 6, 16, 10, PAL.ink); px(g, x + 1, y + 7, 14, 8, PAL.silver); px(g, x + 1, y + 13, 14, 2, PAL.dgray);
      px(g, x + 3, y + 1 + down, 10, 6 - down, PAL.ink); px(g, x + 4, y + 2 + down, 8, 4 - down, st.on ? PAL.green : PAL.red);
      px(g, x + 5, y + 2 + down, 3, 1, PAL.white);
      break;
    }
    case T.DOOR: case T.DOOR_OPEN: {
      const solid = st.solid;
      if (solid) {
        px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, PAL.red); px(g, x + 3, y + 3, 10, 10, PAL.dred);
        px(g, x + 6, y + 6, 4, 4, PAL.white); px(g, x + 1, y + 1, 14, 1, PAL.pink);
      } else {
        g.globalAlpha = 0.35; px(g, x + 1, y + 1, 14, 14, PAL.red); g.globalAlpha = 1;
        for (let i = 0; i < 4; i++) { px(g, x + i * 4, y, 2, 1, PAL.red); px(g, x + i * 4 + 2, y + 15, 2, 1, PAL.red); }
      }
      break;
    }
    case T.QSIGN: {
      px(g, x + 7, y + 8, 2, 8, PAL.ink); px(g, x + 1, y, 14, 10, PAL.ink); px(g, x + 2, y + 1, 12, 8, PAL.lyellow);
      px(g, x + 6, y + 2, 4, 1, PAL.ink); px(g, x + 9, y + 3, 1, 2, PAL.ink); px(g, x + 7, y + 5, 2, 1, PAL.ink); px(g, x + 7, y + 7, 2, 1, PAL.ink);
      break;
    }
    case T.HINT: {
      const b = Math.sin(time / 12 + x) > 0 ? 1 : 0;
      px(g, x + 7, y + 9, 2, 7, PAL.ink); px(g, x + 2, y + 1 + b, 12, 9, PAL.ink); px(g, x + 3, y + 2 + b, 10, 7, PAL.lpink);
      px(g, x + 7, y + 3 + b, 2, 3, PAL.ink); px(g, x + 7, y + 7 + b, 2, 1, PAL.ink);
      break;
    }
    case T.PANEL_O: case T.PANEL_X: {
      if (st.gone) return;
      const isO = code === T.PANEL_O;
      const col = isO ? PAL.blue : PAL.red;
      const shake = st.timer > 0 ? ((time >> 1) & 1) : 0;
      px(g, x + shake, y, 16, 16, PAL.ink); px(g, x + 1 + shake, y + 1, 14, 14, col); px(g, x + 1 + shake, y + 1, 14, 2, shade(col, 1.35));
      if (isO) { px(g, x + 4 + shake, y + 5, 8, 7, PAL.white); px(g, x + 6 + shake, y + 7, 4, 3, col); }
      else { for (let i = 0; i < 6; i++) { px(g, x + 5 + i + shake, y + 5 + i, 2, 1, PAL.white); px(g, x + 10 - i + shake, y + 5 + i, 2, 1, PAL.white); } }
      break;
    }
    case T.TIMER: {
      if (st.gone) {
        g.globalAlpha = 0.25; px(g, x + 1, y + 1, 14, 14, PAL.white); g.globalAlpha = 1; return;
      }
      px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, st.timer > 0 ? PAL.yellow : PAL.lyellow);
      px(g, x + 1, y + 1, 14, 2, PAL.white);
      const n = st.timer > 0 ? Math.ceil(st.timer / 60) : 3;
      drawDigit(g, n, x + 6, y + 4, PAL.ink);
      break;
    }
    case T.WARP_A: case T.WARP_A2: case T.WARP_B: case T.WARP_B2: {
      const col = code <= T.WARP_A2 ? PAL.teal : PAL.neonp;
      px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, shade(col, 0.5));
      const r = (time >> 2) % 6;
      px(g, x + 2 + r / 2, y + 2 + r / 2, 12 - r, 12 - r, col); px(g, x + 4 + r / 2, y + 4 + r / 2, 8 - r, 8 - r, shade(col, 0.5));
      px(g, x + 6, y + 6, 4, 4, PAL.white);
      break;
    }
    case T.RHY_A: case T.RHY_B: {
      const on = st.on, soon = st.soon;
      const col = code === T.RHY_A ? PAL.neonp : PAL.neonc;
      if (on) {
        px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, col); px(g, x + 1, y + 1, 14, 3, PAL.white);
        if (soon && (time >> 2) & 1) px(g, x + 1, y + 1, 14, 14, PAL.white);
        px(g, x + 4, y + 6, 8, 2, shade(col, 0.6)); px(g, x + 4, y + 10, 8, 2, shade(col, 0.6));
      } else {
        g.globalAlpha = soon ? 0.6 : 0.25;
        px(g, x, y, 16, 1, col); px(g, x, y + 15, 16, 1, col); px(g, x, y, 1, 16, col); px(g, x + 15, y, 1, 16, col);
        g.globalAlpha = 1;
      }
      break;
    }
    case T.GHOST: {
      if (st.alpha <= 0.02) return;
      g.globalAlpha = st.alpha;
      px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, PAL.lyellow); px(g, x + 1, y + 1, 14, 2, PAL.white);
      px(g, x + 3, y + 5, 10, 1, PAL.gold);
      g.globalAlpha = 1;
      break;
    }
    case T.SPOT: {
      px(g, x + 3, y, 10, 4, PAL.ink); px(g, x + 2, y + 4, 12, 8, PAL.ink); px(g, x + 3, y + 5, 10, 6, PAL.slate);
      px(g, x + 4, y + 11, 8, 3, PAL.lyellow); px(g, x + 5, y + 6, 2, 2, PAL.gray);
      break;
    }
    case T.LASER: {
      px(g, x, y, 16, 16, PAL.ink); px(g, x + 1, y + 1, 14, 14, PAL.slate);
      px(g, x + 5, y + 10, 6, 6, PAL.ink); px(g, x + 6, y + 11, 4, 5, st.on ? PAL.red : st.warn ? PAL.orange : PAL.dred);
      px(g, x + 3, y + 3, 10, 2, PAL.dgray);
      break;
    }
  }
}

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
export function drawDigit(g, n, x, y, col) {
  const d = DIGITS[Math.max(0, Math.min(9, n | 0))];
  g.fillStyle = col;
  for (let i = 0; i < 15; i++) if (d[i] === '1') g.fillRect(x + (i % 3) * 1, y + ((i / 3) | 0) * 2, 1, 2);
}

// LED 숫자 (전광판)
const LED = ['1110111', '0010010', '1011101', '1011011', '0111010', '1101011', '1101111', '1010010', '1111111', '1111011'];
export function drawLed(g, str, x, y, col, dim = 'rgba(255,255,255,0.08)') {
  let cx = x;
  for (const ch of String(str)) {
    if (ch === ':') { g.fillStyle = col; g.fillRect(cx, y + 2, 1, 1); g.fillRect(cx, y + 6, 1, 1); cx += 3; continue; }
    if (ch === ' ') { cx += 6; continue; }
    const s = LED[+ch] || '0000000';
    const seg = (on, sx, sy, w, h) => { g.fillStyle = on === '1' ? col : dim; g.fillRect(cx + sx, y + sy, w, h); };
    seg(s[0], 1, 0, 3, 1); seg(s[1], 0, 1, 1, 3); seg(s[2], 4, 1, 1, 3); seg(s[3], 1, 4, 3, 1);
    seg(s[4], 0, 5, 1, 3); seg(s[5], 4, 5, 1, 3); seg(s[6], 1, 8, 3, 1);
    cx += 6;
  }
  return cx - x;
}

/* ───── 배경 (스튜디오 무대) ───── */
const bgCache = {};
export function backdrop(themeIdx) {
  if (bgCache[themeIdx]) return bgCache[themeIdx];
  const th = THEMES[themeIdx];
  const W = 480, H = 270;
  const [c, g] = makeCanvas(W, H);
  px(g, 0, 0, W, H, th.wallA);
  if (themeIdx === 0) {
    // 주방 타일 벽
    for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) {
      px(g, x, y, 12, 12, ((x + y) / 12) % 2 ? th.wallA : th.wallB);
      px(g, x, y, 12, 1, th.wallLine); px(g, x, y, 1, 12, th.wallLine);
    }
    // 선반·냄비 실루엣
    for (let i = 0; i < 4; i++) {
      const sx = 30 + i * 120;
      px(g, sx, 90, 80, 4, '#5a3d33'); px(g, sx + 6, 94, 3, 10, '#5a3d33'); px(g, sx + 70, 94, 3, 10, '#5a3d33');
      px(g, sx + 10, 74, 18, 16, '#4b8f84'); px(g, sx + 8, 76, 2, 4, '#4b8f84'); px(g, sx + 34, 80, 12, 10, '#e9b8a0'); px(g, sx + 52, 70, 8, 20, '#c46a5a');
    }
    // 창문 형광등
    for (let i = 0; i < 3; i++) { px(g, 60 + i * 160, 20, 90, 30, '#1f3b45'); px(g, 62 + i * 160, 22, 86, 26, '#b9f1e6'); px(g, 104 + i * 160, 22, 2, 26, '#1f3b45'); }
  } else if (themeIdx === 1) {
    // 퀴즈 패널 벽
    for (let y = 10; y < H - 40; y += 34) for (let x = 6; x < W; x += 50) {
      px(g, x, y, 44, 28, '#0c1838'); px(g, x + 2, y + 2, 40, 24, (x / 50 + y / 34) % 3 === 0 ? '#2a4f9e' : '#1d3a7a');
      px(g, x + 2, y + 2, 40, 2, '#3e6fd0');
    }
    for (let i = 0; i < 12; i++) { px(g, 20 + i * 40, 4, 4, 4, i % 2 ? PAL.yellow : PAL.white); }
    // 큰 물음표 네온
    g.globalAlpha = 0.25; g.fillStyle = PAL.yellow;
    g.font = '64px Galmuri11'; g.fillText('?', 210, 140); g.globalAlpha = 1;
  } else {
    // 디스코: 빛줄기와 별
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0b0716'); grd.addColorStop(1, '#3a1450');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = (i * 53) % (H - 80); px(g, x, y, 1, 1, i % 3 ? '#6c4c9a' : PAL.white); }
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.1; g.fillStyle = i % 2 ? PAL.neonp : PAL.neonc;
      g.beginPath(); g.moveTo(40 + i * 80, 0); g.lineTo(i * 80 - 20, H); g.lineTo(i * 80 + 60, H); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    // 스피커
    for (const sx of [10, 430]) { px(g, sx, 120, 40, 100, '#140a22'); px(g, sx + 8, 132, 24, 24, '#2a1840'); px(g, sx + 14, 138, 12, 12, '#140a22'); px(g, sx + 6, 166, 28, 28, '#2a1840'); px(g, sx + 13, 173, 14, 14, '#140a22'); }
  }
  // 무대 트러스 + 조명
  px(g, 0, 0, W, 6, PAL.ink);
  for (let x = 0; x < W; x += 10) { px(g, x, 1, 6, 1, PAL.dgray); px(g, x + 2, 3, 6, 1, PAL.dgray); }
  bgCache[themeIdx] = c;
  return c;
}

// 무대 커튼 (양옆 여백 무늬 & 시작 연출용)
let curtainTile = null;
export function curtainPattern() {
  if (curtainTile) return curtainTile;
  const [c, g] = makeCanvas(16, 16);
  px(g, 0, 0, 16, 16, PAL.dred);
  px(g, 2, 0, 3, 16, PAL.red); px(g, 10, 0, 3, 16, PAL.red); px(g, 3, 0, 1, 16, PAL.pink); px(g, 11, 0, 1, 16, PAL.pink);
  px(g, 7, 0, 1, 16, '#7a1a26'); px(g, 15, 0, 1, 16, '#7a1a26');
  curtainTile = c;
  return c;
}

export { VW, VH };
