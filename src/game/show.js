import { VW, VH, AUD_H } from '../core/constants.js';
import { PAL, portrait } from '../gfx/sprites.js';
import { MC_LINES, pick } from '../data/lines.js';
import { Sound } from '../core/audio.js';

import { HUD_H } from '../core/constants.js';

export class Show {
  constructor(opts = {}) {
    this.sub = null;        // {who, text, t, shown}
    this.lastLineAt = -9999;
    this.lastByKey = {};
    this.time = 0;
    this.react = null; this.reactT = 0;
    this.hype = 0; this.boostT = 0;
    this.crowd = [];
    this.quiet = !!opts.quiet;
    this.disco = !!opts.disco;
    for (let i = 0; i < 52; i++) this.crowd.push({ x: i * 9.4 + (i % 3) * 2, h: 6 + ((i * 7) % 4), c: ['#141a2e', '#1c2440', '#22182e', '#181d33'][i % 4], ph: (i * 1.7) % 6.28, stick: i % 5 === 0 ? [PAL.neonp, PAL.neonc, PAL.yellow][i % 3] : null });
  }
  say(key, opts = {}) {
    const lines = MC_LINES[key];
    if (!lines) return;
    const gap = opts.force ? 0 : 360;
    if (!opts.force && this.time - this.lastLineAt < gap) return;
    let text = pick(lines);
    if (lines.length > 1 && text === this.lastByKey[key]) text = lines[(lines.indexOf(text) + 1) % lines.length];
    this.lastByKey[key] = text;
    this.line('mc', text, opts.dur || 170);
  }
  line(who, text, dur = 200) {
    this.sub = { who, text, t: dur, shown: 0, dur };
    this.lastLineAt = this.time;
  }
  tip(text, dur = 260) { this.line('pink', text, dur); }
  crowdReact(kind, sound = true) {
    this.react = kind; this.reactT = 70;
    if (sound) Sound.play(kind === 'cheer' ? 'cheer' : kind === 'boo' ? 'boo' : kind === 'oh' ? 'oh' : 'clap');
  }
  addHype(n) {
    if (this.boostT > 0) return;
    this.hype = Math.max(0, Math.min(100, this.hype + n));
    if (this.hype >= 100) { this.boostT = 600; this.hype = 100; this.crowdReact('cheer'); }
  }
  get mult() { return this.boostT > 0 ? 1.5 : 1; }
  update() {
    this.time++;
    if (this.sub) {
      this.sub.shown = Math.min(this.sub.text.length, this.sub.shown + 0.6);
      if (--this.sub.t <= 0) this.sub = null;
    }
    if (this.reactT > 0) this.reactT--; else this.react = null;
    if (this.boostT > 0) { this.boostT--; this.hype = this.boostT / 6; if (this.boostT === 0) this.hype = 0; }
  }

  drawAudience(g) {
    const y0 = VH - AUD_H;
    g.fillStyle = '#0a0c18'; g.fillRect(0, y0 + 4, VW, AUD_H);
    const t = this.time;
    const stand = this.boostT > 0;
    for (const p of this.crowd) {
      let bob = 0, arms = false;
      if (this.react === 'cheer' || stand) { bob = Math.abs(Math.sin(t / 6 + p.ph)) * 3; arms = true; }
      else if (this.react === 'clap') { bob = Math.sin(t / 3 + p.ph) > 0 ? 1 : 0; }
      else if (this.react === 'oh') { bob = 1; }
      else bob = Math.sin(t / 40 + p.ph) * 0.6;
      const x = Math.round(p.x), y = Math.round(y0 + 14 - p.h - bob - (stand ? 3 : 0));
      g.fillStyle = p.c;
      g.fillRect(x - 3, y + 4, 9, 12); g.fillRect(x - 1, y, 5, 5);
      if (arms) { g.fillRect(x - 4, y - 3, 2, 6); g.fillRect(x + 5, y - 3, 2, 6); }
      if (this.react === 'clap' && (t + p.x) % 6 < 3) { g.fillStyle = '#3a4466'; g.fillRect(x, y + 3, 3, 2); }
      if (p.stick && (this.disco || stand)) { g.fillStyle = p.stick; g.fillRect(x + 5, y - 4 - Math.round(Math.sin(t / 8 + p.ph) * 2), 1, 5); }
      if (this.react === 'boo' && p.ph > 3) { g.fillStyle = PAL.dred; g.fillRect(x, y - 6, 3, 1); g.fillRect(x + 1, y - 5, 1, 2); }
      if (this.react === 'oh' && p.ph < 2) { g.fillStyle = PAL.white; g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 3, y + 1, 1, 1); }
    }
  }

  drawSubtitle(g, topY = HUD_H + 4) {
    const s = this.sub;
    if (!s) return;
    g.font = '12px Galmuri11';
    const full = s.text;
    const lines = wrap(g, full, 330);
    const txt = full.slice(0, Math.floor(s.shown));
    const h = lines.length > 1 ? 36 : 22;
    const w = Math.min(380, Math.max(...lines.map(l => g.measureText(l).width)) + 40);
    const x = Math.round((VW - w) / 2), y = topY;
    const fade = Math.min(1, s.t / 15, (s.dur - s.t + 1) / 6);
    g.globalAlpha = fade;
    g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = s.who === 'pink' ? 'rgba(59,26,44,0.92)' : 'rgba(29,34,64,0.92)'; g.fillRect(x, y, w, h);
    g.fillStyle = s.who === 'pink' ? PAL.pink : PAL.yellow; g.fillRect(x, y, 3, h);
    g.drawImage(portrait(s.who), x + 6, y + Math.round((h - 16) / 2));
    g.fillStyle = PAL.white;
    let shown = txt.length, yy = y + 15;
    for (const ln of lines) {
      const part = ln.slice(0, Math.max(0, shown));
      g.fillText(part, x + 28, yy);
      shown -= ln.length;
      yy += 14;
    }
    g.globalAlpha = 1;
  }

  drawHype(g, x, y) {
    g.fillStyle = PAL.ink; g.fillRect(x, y, 44, 6);
    g.fillStyle = this.boostT > 0 ? ((this.time >> 2) & 1 ? PAL.yellow : PAL.neonp) : PAL.pink;
    g.fillRect(x + 1, y + 1, Math.round(42 * this.hype / 100), 4);
  }
}

export function wrap(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  // 띄어쓰기 없이 긴 줄은 글자 단위로 자름
  const out = [];
  for (const l of lines) {
    if (g.measureText(l).width <= maxW) { out.push(l); continue; }
    let c = '';
    for (const ch of l) { if (g.measureText(c + ch).width > maxW) { out.push(c); c = ch; } else c += ch; }
    if (c) out.push(c);
  }
  return out;
}

// 테두리 있는 텍스트
export function textOutline(g, s, x, y, col = PAL.white, out = PAL.ink, align = 'left') {
  g.textAlign = align;
  g.fillStyle = out;
  g.fillText(s, x - 1, y); g.fillText(s, x + 1, y); g.fillText(s, x, y - 1); g.fillText(s, x, y + 1);
  g.fillStyle = col; g.fillText(s, x, y);
  g.textAlign = 'left';
}
