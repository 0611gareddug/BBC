import { VW, VH } from '../core/constants.js';
import { PAL } from '../gfx/sprites.js';
import { curtainPattern } from '../gfx/tilegfx.js';
import { textOutline } from '../game/show.js';
import { Sound } from '../core/audio.js';

// 시작 연출: 커튼 열림 → 3, 2, 1, 생방송!
export class Countdown {
  constructor(opts = {}) { this.t = 0; this.done = false; this.label = opts.label || '생방송!'; this.curtain = opts.curtain !== false; this.total = (this.curtain ? 50 : 0) + 36 * 4; }
  update() {
    if (this.done) return;
    this.t++;
    const c = this.curtain ? 50 : 0;
    const k = this.t - c;
    if (k > 0 && k % 36 === 1) { const n = Math.floor(k / 36); if (n < 3) Sound.play('count'); else Sound.play('go'); }
    if (this.t >= this.total) this.done = true;
  }
  get playing() { return this.t >= this.total - 36; }
  draw(g) {
    if (this.t > this.total + 8) return;
    const c = this.curtain ? 50 : 0;
    if (this.curtain && this.t < c + 10) {
      const open = Math.min(1, this.t / c);
      const w = Math.round((VW / 2) * (1 - easeOut(open)));
      drawCurtains(g, w);
    }
    const k = this.t - c;
    if (k > 0 && this.t < this.total + 8) {
      const n = Math.floor(k / 36);
      const f = (k % 36) / 36;
      const s = n < 3 ? String(3 - n) : this.label;
      const scale = 1 + (1 - Math.min(1, f * 3)) * 0.6;
      g.save(); g.translate(VW / 2, VH / 2 - 10); g.scale(scale, scale);
      g.font = n < 3 ? '28px Galmuri11-Bold, Galmuri11' : '22px Galmuri11-Bold, Galmuri11';
      textOutline(g, s, 0, 10, n < 3 ? PAL.white : PAL.yellow, PAL.ink, 'center');
      g.restore();
    }
  }
}

export function drawCurtains(g, w) {
  if (w <= 0) return;
  const pat = g.createPattern(curtainPattern(), 'repeat');
  g.fillStyle = pat; g.fillRect(0, 0, w, VH); g.fillRect(VW - w, 0, w, VH);
  g.fillStyle = PAL.ink; g.fillRect(w - 2, 0, 2, VH); g.fillRect(VW - w, 0, 2, VH);
  g.fillStyle = PAL.gold; g.fillRect(0, 0, VW, 10); g.fillStyle = PAL.dgold; g.fillRect(0, 9, VW, 2);
}

export function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
