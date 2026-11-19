import { VW, HUD_H } from '../core/constants.js';
import { PAL, itemIcon } from '../gfx/sprites.js';
import { drawLed } from '../gfx/tilegfx.js';
import { textOutline } from './show.js';

function heart(g, x, y, full) {
  g.fillStyle = PAL.ink; g.fillRect(x, y + 1, 9, 5); g.fillRect(x + 1, y, 3, 8); g.fillRect(x + 5, y, 3, 8); g.fillRect(x + 2, y + 6, 5, 2); g.fillRect(x + 3, y + 8, 3, 1);
  g.fillStyle = full ? PAL.red : PAL.slate; g.fillRect(x + 1, y + 1, 3, 5); g.fillRect(x + 5, y + 1, 3, 5); g.fillRect(x + 2, y + 5, 5, 2); g.fillRect(x + 3, y + 7, 3, 1); g.fillRect(x + 4, y + 2, 1, 4);
  if (full) { g.fillStyle = PAL.pink; g.fillRect(x + 2, y + 2, 1, 1); }
}
export function gemIcon(g, x, y, col = PAL.teal) {
  g.fillStyle = PAL.ink; g.fillRect(x, y + 1, 8, 6); g.fillRect(x + 1, y, 6, 8);
  g.fillStyle = col; g.fillRect(x + 1, y + 1, 6, 6); g.fillStyle = PAL.white; g.fillRect(x + 2, y + 2, 2, 2);
}

function frame(g) {
  g.fillStyle = PAL.ink; g.fillRect(0, 0, VW, HUD_H);
  g.fillStyle = '#20263f'; g.fillRect(0, 0, VW, HUD_H - 2);
  g.fillStyle = '#343c63'; g.fillRect(0, 0, VW, 1);
  for (let x = 4; x < VW; x += 8) { g.fillStyle = '#272e4c'; g.fillRect(x, HUD_H - 4, 4, 1); }
}

function onAir(g, x, time) {
  const on = (time >> 5) % 2 === 0 || true;
  g.fillStyle = PAL.ink; g.fillRect(x, 3, 36, 12);
  g.fillStyle = on ? PAL.red : PAL.dred; g.fillRect(x + 1, 4, 34, 10);
  g.font = '8px Galmuri9'; g.fillStyle = PAL.white; g.fillText('ON AIR', x + 4, 12);
  if ((time >> 4) & 1) { g.fillStyle = PAL.pink; g.fillRect(x + 1, 4, 34, 1); }
}

export function drawStoryHud(g, s) {
  frame(g);
  const t = s.time;
  // 보석
  gemIcon(g, 6, 5);
  const gcol = s.gems >= s.need && s.need > 0 ? PAL.green : PAL.teal;
  g.font = '12px Galmuri11';
  g.fillStyle = gcol; g.fillText(String(s.gems), 17, 14);
  const gw = g.measureText(String(s.gems)).width;
  g.fillStyle = PAL.gray; g.fillText('/' + s.need, 17 + gw, 14);
  if (s.gold) gemIcon(g, 50, 5, PAL.gold);
  // 목숨
  for (let i = 0; i < 3; i++) heart(g, 64 + i * 11, 4, i < s.lives);
  // 시간
  const sec = Math.floor(s.frames / 60);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  const tcol = s.target && sec > s.target ? PAL.orange : PAL.lyellow;
  drawLed(g, mm + ':' + ss, VW / 2 - 13, 4, tcol);
  // 아이템
  const ix = 300;
  g.fillStyle = PAL.ink; g.fillRect(ix, 2, 16, 14); g.fillStyle = '#11152a'; g.fillRect(ix + 1, 3, 14, 12);
  if (s.item) { g.drawImage(itemIcon(s.item), ix + 2, 3); if (s.itemUses > 1 && s.itemUses < 50) { g.font = '8px Galmuri9'; g.fillStyle = PAL.white; g.fillText(String(s.itemUses), ix + 17, 14); } }
  // 점수
  drawLed(g, String(Math.min(999999, s.score | 0)).padStart(6, '0'), 330, 4, PAL.white);
  // 열기 게이지
  if (s.show) s.show.drawHype(g, 372, 6);
  onAir(g, VW - 40, t);
}

export function drawBossBar(g, boss, time) {
  if (!boss) return;
  const w = 200, x = (VW - w) / 2, y = HUD_H + 3;
  g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, w + 2, 9);
  g.fillStyle = PAL.dred; g.fillRect(x, y, w, 7);
  g.fillStyle = boss.flash > 0 ? PAL.white : PAL.red; g.fillRect(x, y, Math.max(0, w * boss.hp / boss.maxHp), 7);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x, y, Math.max(0, w * boss.hp / boss.maxHp), 2);
  g.font = '10px Galmuri9';
  const ph = boss.phase ? ` (${boss.phase}/3)` : '';
  textOutline(g, boss.name + ph, VW / 2, y + 18, PAL.lyellow, PAL.ink, 'center');
}

// 대전 HUD: view = { tl, rule, players:[{name,color,val,wins,lives,elim,item}], winsNeed }
export function drawVersusHud(g, v, time) {
  frame(g);
  const n = v.players.length;
  const slotW = Math.min(110, (VW - 90) / n);
  v.players.forEach((p, i) => {
    const x = i < Math.ceil(n / 2) ? 4 + i * slotW : VW - 4 - (n - i) * slotW;
    g.fillStyle = PAL.ink; g.fillRect(x, 2, slotW - 4, 14);
    g.fillStyle = p.elim ? PAL.slate : p.color; g.fillRect(x + 1, 3, 3, 12);
    g.fillStyle = '#141a30'; g.fillRect(x + 4, 3, slotW - 9, 12);
    g.font = '8px Galmuri9'; g.fillStyle = p.elim ? PAL.dgray : PAL.white;
    g.fillText(p.name.slice(0, 6), x + 7, 12);
    // 승리 점
    for (let k = 0; k < v.winsNeed; k++) { g.fillStyle = k < p.wins ? PAL.gold : PAL.slate; g.fillRect(x + 7 + k * 4, 14, 3, 1); }
    // 값
    const vx = x + slotW - 30;
    if (v.rule === 'gems') { gemIcon(g, vx - 9, 5); drawLed(g, String(p.val).padStart(2, '0'), vx + 1, 4, PAL.teal); }
    else if (v.rule === 'zone') { drawLed(g, String(p.val).padStart(2, '0'), vx + 1, 4, PAL.lyellow); }
    else { for (let k = 0; k < 3; k++) heart(g, vx - 8 + k * 9, 4, k < p.lives); }
    if (p.item) g.drawImage(itemIcon(p.item), x + slotW - 44, 3, 10, 10);
  });
  const sec = Math.max(0, Math.ceil(v.tl / 60));
  const mm = String(Math.floor(sec / 60)), ss = String(sec % 60).padStart(2, '0');
  const col = sec <= 10 && (time >> 4) & 1 ? PAL.red : sec <= 30 ? PAL.orange : PAL.lyellow;
  g.fillStyle = PAL.ink; g.fillRect(VW / 2 - 22, 1, 44, 16);
  drawLed(g, mm + ':' + ss, VW / 2 - 12, 4, col);
}

export function drawBanner(g, text, sub, time, col = PAL.lyellow) {
  g.fillStyle = 'rgba(11,11,20,0.75)'; g.fillRect(0, 100, VW, 56);
  g.fillStyle = col; g.fillRect(0, 100, VW, 2); g.fillRect(0, 154, VW, 2);
  g.font = '14px Galmuri11-Bold, Galmuri11';
  textOutline(g, text, VW / 2, 128, col, PAL.ink, 'center');
  if (sub) { g.font = '10px Galmuri9'; textOutline(g, sub, VW / 2, 146, PAL.white, PAL.ink, 'center'); }
}
