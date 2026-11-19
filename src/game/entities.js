import { TILE, PHYS, overlap, rand } from '../core/constants.js';
import { moveBody, groundBelow } from './level.js';
import { T } from './tiledefs.js';
import { PAL, enemySprite, itemIcon, makeCanvas, ITEMS } from '../gfx/sprites.js';
import { Sound } from '../core/audio.js';

/* ───── 파티클 · 효과 ───── */
export class FX {
  constructor() { this.parts = []; this.texts = []; this.rings = []; this.max = 260; this.low = false; }
  add(p) { if (this.parts.length < (this.low ? 120 : this.max)) this.parts.push(p); }
  dust(x, y, n = 3) { for (let i = 0; i < n; i++) this.add({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6, life: 18 + Math.random() * 8, col: '#d8d0c0', s: 2, g: 0.02 }); }
  burst(x, y, col, n = 12, sp = 2) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * sp + 0.5; this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, life: 22 + Math.random() * 14, col, s: 2, g: 0.08 }); } }
  sparkle(x, y, col = '#fee761') { for (let i = 0; i < 5; i++) this.add({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 0.6, vy: -Math.random() * 1.2, life: 20, col, s: 1, g: 0 }); }
  confetti(x0, x1, y, n = 80) {
    const cols = [PAL.red, PAL.yellow, PAL.teal, PAL.green, PAL.neonp, PAL.white];
    for (let i = 0; i < n; i++) this.add({ x: x0 + Math.random() * (x1 - x0), y: y - Math.random() * 60, vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 0.8 + 0.3, life: 140 + Math.random() * 60, col: cols[i % cols.length], s: 2, g: 0.005, flutter: Math.random() * 6 });
  }
  ring(x, y, col) { this.rings.push({ x, y, r: 2, life: 16, col }); }
  text(x, y, s, col = PAL.white) { this.texts.push({ x, y, s, col, life: 50 }); }
  update() {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vy += p.g; p.x += p.vx + (p.flutter ? Math.sin((p.life + p.flutter) / 8) * 0.4 : 0); p.y += p.vy;
      if (--p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.y -= 0.4; if (--t.life <= 0) this.texts.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.r += 1.2; if (--r.life <= 0) this.rings.splice(i, 1); }
  }
  draw(g, cam) {
    for (const p of this.parts) {
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.s, p.s);
    }
    for (const r of this.rings) {
      g.strokeStyle = r.col; g.globalAlpha = r.life / 16; g.lineWidth = 1;
      g.beginPath(); g.ellipse(Math.round(r.x - cam.x), Math.round(r.y - cam.y), r.r * 1.4, r.r * 0.5, 0, 0, 6.28); g.stroke();
      g.globalAlpha = 1;
    }
    g.font = '10px Galmuri9'; g.textAlign = 'center';
    for (const t of this.texts) {
      const x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y);
      g.globalAlpha = Math.min(1, t.life / 15);
      g.fillStyle = PAL.ink; g.fillText(t.s, x + 1, y + 1); g.fillStyle = t.col; g.fillText(t.s, x, y);
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
  }
}

/* ───── 보석 ───── */
let gemSprites = null;
function gemArt() {
  if (gemSprites) return gemSprites;
  const mk = (main, light, dark) => {
    const [c, g] = makeCanvas(40, 10);
    for (let f = 0; f < 4; f++) {
      const w = [8, 6, 2, 6][f], ox = f * 10 + (10 - w) / 2;
      g.fillStyle = PAL.ink; g.fillRect(ox, 1, w, 8); g.fillRect(ox + 1, 0, Math.max(1, w - 2), 10);
      if (w > 2) {
        g.fillStyle = main; g.fillRect(ox + 1, 1, w - 2, 8);
        g.fillStyle = light; g.fillRect(ox + 1, 1, Math.max(1, (w - 2) / 2), 3);
        g.fillStyle = dark; g.fillRect(ox + w / 2, 5, Math.max(1, (w - 2) / 2), 3);
      } else { g.fillStyle = light; g.fillRect(ox, 1, 2, 8); }
    }
    return c;
  };
  gemSprites = { gem: mk('#2ce8f5', '#d6fffb', '#0099db'), gold: mk('#ffd23f', '#fff6c2', '#c98a1b'), red: mk('#ff4fa3', '#ffd0e6', '#b55088') };
  return gemSprites;
}

export class Gem {
  constructor(x, y, kind = 'gem') {
    this.x = x; this.y = y; this.w = 10; this.h = 10; this.kind = kind;
    this.bob = Math.random() * 6.28; this.dead = false;
    this.phys = false; this.vx = 0; this.vy = 0; this.pickDelay = 0; this.life = -1; this.value = 1;
  }
  update(w) {
    this.bob += 0.07;
    if (this.pickDelay > 0) this.pickDelay--;
    if (this.phys) {
      this.vy += 0.18; if (this.vy > 3.5) this.vy = 3.5;
      const vy = this.vy;
      const r = moveBody(w.level, this, {});
      if (r.ground) { this.vy = vy > 1 ? -vy * 0.45 : 0; this.vx *= 0.8; }
      if (r.hitX) this.vx = -this.vx * 0.5;
      if (this.y > w.level.pxH + 20) this.dead = true;
    }
    if (this.life > 0 && --this.life <= 0) this.dead = true;
  }
  draw(g, cam, time) {
    const s = gemArt()[this.kind];
    const f = ((time >> 3) + (this.bob * 3 | 0)) & 3;
    const by = this.phys ? 0 : Math.round(Math.sin(this.bob) * 1.5);
    if (this.life > 0 && this.life < 90 && (this.life >> 2) & 1) return;
    g.drawImage(s, f * 10, 0, 10, 10, Math.round(this.x - cam.x), Math.round(this.y - cam.y + by), 10, 10);
  }
}

/* ───── 선물 상자 ───── */
export class ItemBox {
  constructor(x, y, type) { this.x = x; this.y = y; this.w = 14; this.h = 14; this.type = type; this.dead = false; this.t = Math.random() * 100; this.drop = 0; }
  update(w) { this.t++; if (this.drop > 0) { this.y += 1.5; this.drop -= 1.5; } }
  draw(g, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y + Math.sin(this.t / 15));
    g.fillStyle = PAL.ink; g.fillRect(x, y + 3, 14, 11); g.fillRect(x + 1, y + 2, 12, 1);
    g.fillStyle = PAL.neonp; g.fillRect(x + 1, y + 4, 12, 9);
    g.fillStyle = PAL.lyellow; g.fillRect(x + 6, y + 4, 2, 9); g.fillRect(x + 1, y + 7, 12, 2);
    g.fillStyle = PAL.ink; g.fillRect(x + 1, y + 3, 12, 1);
    g.fillStyle = PAL.lyellow; g.fillRect(x + 3, y, 3, 3); g.fillRect(x + 8, y, 3, 3);
    g.fillStyle = PAL.white; g.fillRect(x + 2, y + 5, 2, 1);
    if (((this.t / 20) | 0) % 4 === 0) { g.fillStyle = PAL.white; g.fillRect(x + 12, y - 2, 1, 1); }
  }
}

/* ───── 출구 커튼 ───── */
export class Exit {
  constructor(tx, ty) { this.x = tx * TILE - 8; this.y = (ty - 1) * TILE; this.w = 32; this.h = 32; this.open = false; this.anim = 0; }
  update() { if (this.open && this.anim < 16) this.anim++; }
  draw(g, cam, time) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    g.fillStyle = PAL.ink; g.fillRect(x, y, 32, 32);
    g.fillStyle = '#2a1a10'; g.fillRect(x + 2, y + 4, 28, 28);
    if (this.open) {
      g.fillStyle = PAL.lyellow; g.globalAlpha = 0.35 + Math.sin(time / 8) * 0.15; g.fillRect(x + 4, y + 6, 24, 26); g.globalAlpha = 1;
    }
    const cw = 14 - Math.round(this.anim * 0.7);
    for (const [cx, w] of [[x + 2, cw], [x + 30 - cw, cw]]) {
      g.fillStyle = PAL.dred; g.fillRect(cx, y + 4, w, 28);
      g.fillStyle = PAL.red; for (let i = 1; i < w; i += 4) g.fillRect(cx + i, y + 4, 2, 28);
    }
    g.fillStyle = PAL.gold; g.fillRect(x, y, 32, 4); g.fillStyle = PAL.dgold; g.fillRect(x, y + 3, 32, 1);
    // EXIT 간판
    g.fillStyle = this.open ? PAL.green : PAL.dred; g.fillRect(x + 7, y - 8, 18, 7);
    g.font = '8px Galmuri9'; g.fillStyle = PAL.white; g.textAlign = 'center'; g.fillText('출구', x + 16, y - 2); g.textAlign = 'left';
  }
}

/* ───── 체크포인트 (큐카드 스탠드) ───── */
export class Checkpoint {
  constructor(tx, ty) { this.x = tx * TILE; this.y = ty * TILE; this.w = 16; this.h = 16; this.active = false; this.t = 0; }
  draw(g, cam) {
    this.t++;
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    g.fillStyle = PAL.ink; g.fillRect(x + 7, y + 6, 2, 10); g.fillRect(x + 4, y + 15, 8, 1);
    const lift = this.active ? Math.round(Math.sin(this.t / 10)) : 0;
    g.fillRect(x + 1, y - 2 + lift, 14, 10);
    g.fillStyle = this.active ? PAL.lyellow : PAL.cream; g.fillRect(x + 2, y - 1 + lift, 12, 8);
    g.fillStyle = this.active ? PAL.red : PAL.dgray;
    g.fillRect(x + 4, y + 1 + lift, 8, 1); g.fillRect(x + 4, y + 3 + lift, 6, 1);
    if (this.active) { g.fillStyle = PAL.green; g.fillRect(x + 11, y + 2 + lift, 2, 2); }
  }
}

/* ───── 움직이는 발판 ───── */
export class Mover {
  constructor(tx, ty, axis) {
    this.x = tx * TILE; this.y = ty * TILE + 4; this.w = 32; this.h = 8; this.axis = axis;
    this.speed = 0.7; this.dir = 1; this.dx = 0; this.dy = 0;
  }
  update(w) {
    const lv = w.level;
    let dx = 0, dy = 0;
    if (this.axis === 'h') {
      const nx = this.x + this.dir * this.speed;
      const fx = this.dir > 0 ? nx + this.w : nx;
      const tx = Math.floor((this.dir > 0 ? fx - 0.01 : fx) / TILE), ty = Math.floor((this.y + 2) / TILE);
      const c = lv.tile(tx, ty);
      if (lv.solid(tx, ty) === 1 || c === T.STOP || tx < 0 || tx >= lv.w) this.dir = -this.dir; else dx = nx - this.x;
    } else {
      const ny = this.y + this.dir * this.speed;
      const fy = this.dir > 0 ? ny + this.h : ny;
      const tx = Math.floor((this.x + 8) / TILE), tx2 = Math.floor((this.x + this.w - 8) / TILE), ty = Math.floor((this.dir > 0 ? fy - 0.01 : fy) / TILE);
      const blocked = (t) => lv.solid(t, ty) === 1 || lv.tile(t, ty) === T.STOP;
      if (blocked(tx) || blocked(tx2) || ty < 0 || ty >= lv.h) this.dir = -this.dir; else dy = ny - this.y;
    }
    this.x += dx; this.y += dy; this.dx = dx; this.dy = dy;
    for (const p of w.players) {
      if (p.platform === this && !p.dead) {
        if (dx) { const vx = p.vx, vy = p.vy; p.vx = dx; p.vy = 0; moveBody(lv, p, {}); p.vx = vx; p.vy = vy; }
        if (dy) { if (dy < 0) { p.y += dy; } else p.y += dy; }
      }
    }
  }
  draw(g, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    g.fillStyle = PAL.ink; g.fillRect(x, y, 32, 8);
    g.fillStyle = PAL.yellow; g.fillRect(x + 1, y + 1, 30, 5);
    g.fillStyle = PAL.ink; for (let i = 0; i < 4; i++) g.fillRect(x + 3 + i * 8, y + 2, 4, 3);
    g.fillStyle = PAL.lyellow; g.fillRect(x + 1, y + 1, 30, 1);
  }
}

/* ───── 미러볼 범퍼 ───── */
export class Bumper {
  constructor(tx, ty) { this.x = tx * TILE + 1; this.y = ty * TILE + 1; this.w = 14; this.h = 14; this.t = 0; this.hit = 0; }
  update(w) {
    this.t++; if (this.hit > 0) this.hit--;
    for (const p of w.players) {
      if (p.dead || p.eliminated || !overlap(this, p)) continue;
      const dx = p.cx - (this.x + 7), dy = p.cy - (this.y + 7);
      const d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * 4; p.vy = (dy / d) * 4.5 - 1; p.stunT = 6; p.jumping = false;
      this.hit = 10; Sound.play('pad'); w.fx.sparkle(this.x + 7, this.y + 7, PAL.white);
    }
  }
  draw(g, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    const s = this.hit > 0 ? 1 : 0;
    g.fillStyle = PAL.ink; g.fillRect(x + 3 - s, y - s, 8 + 2 * s, 14 + 2 * s); g.fillRect(x - s, y + 3 - s, 14 + 2 * s, 8 + 2 * s); g.fillRect(x + 1 - s, y + 1 - s, 12 + 2 * s, 12 + 2 * s);
    g.fillStyle = PAL.silver; g.fillRect(x + 2, y + 2, 10, 10);
    const o = (this.t >> 3) & 1;
    g.fillStyle = PAL.dgray; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j + o) & 1) g.fillRect(x + 3 + i * 3, y + 3 + j * 3, 2, 2);
    g.fillStyle = PAL.white; g.fillRect(x + 4, y + 3, 2, 2);
  }
}

/* ───── 적 ───── */
const ENEMY_DEF = {
  marsh: { w: 12, h: 12, hp: 1, sprite: 'marsh', score: 50 },
  sauce: { w: 12, h: 14, hp: 2, sprite: 'sauce', score: 80 },
  shroom: { w: 12, h: 13, hp: 1, sprite: 'shroom', score: 60 },
  qbot: { w: 12, h: 12, hp: 1, sprite: 'qbot', score: 70, fly: true },
  mole: { w: 12, h: 13, hp: 1, sprite: 'mole', score: 70 },
  dancer: { w: 12, h: 15, hp: 1, sprite: 'dancer', score: 90 },
  drone: { w: 14, h: 12, hp: 2, sprite: 'drone', score: 90, fly: true },
  tomato: { w: 10, h: 10, hp: 99, sprite: null, score: 0, fixed: true },
};

export class Enemy {
  constructor(type, tx, ty) {
    const d = ENEMY_DEF[type];
    this.type = type; this.def = d;
    this.w = d.w; this.h = d.h; this.hp = d.hp;
    this.x = tx * TILE + (TILE - d.w) / 2; this.y = (ty + 1) * TILE - d.h;
    this.vx = 0; this.vy = 0; this.facing = -1; this.dead = false; this.stunT = 0; this.flash = 0; this.t = Math.random() * 120 | 0;
    this.homeX = this.x; this.homeY = this.y; this.state = 0; this.cool = 60 + (Math.random() * 60 | 0);
    this.up = type !== 'mole';
    this.harmless = false;
  }
  target(w) {
    let best = null, bd = 1e9;
    for (const p of w.players) {
      if (p.dead || p.eliminated || p.cloakT > 0) continue;
      const d = Math.abs(p.cx - (this.x + this.w / 2)) + Math.abs(p.cy - (this.y + this.h / 2)) * 1.5;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  update(w) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.stunT > 0) {
      this.stunT--;
      if (!this.def.fly) { this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall); this.vx *= 0.9; moveBody(w.level, this, {}); }
      return;
    }
    const lv = w.level;
    const tgt = this.target(w);
    const cx = this.x + this.w / 2;
    switch (this.type) {
      case 'marsh': this.walk(w, 0.4); break;
      case 'sauce': {
        if (tgt && Math.abs(tgt.cx - cx) < 170 && Math.abs(tgt.cy - this.y) < 90) {
          this.facing = tgt.cx < cx ? -1 : 1;
          if (--this.cool <= 0) {
            this.cool = 110;
            const dx = tgt.cx - cx;
            const vx = Math.max(-2.4, Math.min(2.4, dx / 45));
            w.spawnProj({ type: 'sauce', x: cx - 3, y: this.y + 2, vx, vy: -3, owner: null, grav: 0.13, life: 200, w: 6, h: 6 });
            Sound.play('pie');
          }
        }
        this.gravityOnly(w);
        break;
      }
      case 'shroom': {
        const ground = groundBelow(lv, this);
        if (ground && tgt && Math.abs(tgt.cx - cx) < 70 && --this.cool <= 0) {
          this.vy = -4.2; this.cool = 70; this.facing = tgt.cx < cx ? -1 : 1; this.vx = this.facing * 0.8;
        }
        if (ground && this.vy >= 0) this.walk(w, 0.3); else { this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall); moveBody(lv, this, {}); }
        break;
      }
      case 'qbot': {
        const bob = Math.sin(this.t / 20) * 0.3;
        if (tgt && Math.hypot(tgt.cx - cx, tgt.cy - this.y) < 170) {
          const dx = tgt.cx - cx, dy = tgt.cy - (this.y + 6);
          const d = Math.hypot(dx, dy) || 1;
          this.vx += (dx / d) * 0.03; this.vy += (dy / d) * 0.03;
          const sp = Math.hypot(this.vx, this.vy); if (sp > 0.6) { this.vx *= 0.6 / sp; this.vy *= 0.6 / sp; }
          this.facing = dx < 0 ? -1 : 1;
        } else { this.vx *= 0.95; this.vy = (this.homeY - this.y) * 0.02; }
        this.vy += bob * 0.05;
        moveBody(lv, this, {});
        break;
      }
      case 'mole': {
        const near = tgt && Math.abs(tgt.cx - cx) < 52 && Math.abs(tgt.cy - this.y) < 40;
        if (!this.up) { this.harmless = true; if (near && --this.cool <= 0) { this.up = true; this.state = 100; Sound.play('pad'); } }
        else { this.harmless = false; if (--this.state <= 0) { this.up = false; this.cool = 50; } }
        if (tgt) this.facing = tgt.cx < cx ? -1 : 1;
        break;
      }
      case 'dancer': {
        const beat = w.beat;
        if (beat.phase === 0 && beat.tick) { this.state = 30; }
        if (this.state > 0) { this.state--; this.walk(w, 2.2); } else this.walk(w, 0.35);
        break;
      }
      case 'drone': {
        const tx = tgt ? tgt.cx : this.homeX;
        this.vx += Math.sign(tx - cx) * 0.02; this.vx *= 0.97;
        this.vy = (this.homeY - this.y) * 0.03 + Math.sin(this.t / 25) * 0.2;
        this.facing = this.vx < 0 ? -1 : 1;
        moveBody(lv, this, {});
        if (--this.cool <= 0) {
          this.cool = 200;
          if (tgt && Math.hypot(tgt.cx - cx, tgt.cy - this.y) < 110) { w.flashScreen(18); Sound.play('flash'); w.event('flash'); }
        }
        break;
      }
      case 'tomato': {
        this.harmless = true;
        if (tgt && Math.abs(tgt.cx - cx) < 200 && --this.cool <= 0) {
          this.cool = 150 + (Math.random() * 80 | 0);
          const dx = tgt.cx - cx;
          w.spawnProj({ type: 'tomato', x: cx, y: this.y, vx: Math.max(-2.2, Math.min(2.2, dx / 50)), vy: -4.2, owner: null, grav: 0.14, life: 220, w: 8, h: 8 });
        }
        break;
      }
    }
    if (this.y > lv.pxH + 30) this.dead = true;
  }
  gravityOnly(w) { this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall); this.vx = 0; moveBody(w.level, this, {}); }
  walk(w, speed) {
    const lv = w.level;
    this.vx = this.facing * speed;
    this.vy = Math.min(this.vy + PHYS.gravity, PHYS.maxFall);
    const r = moveBody(lv, this, {});
    if (r.hitX) this.facing = -this.facing;
    if (r.ground) {
      // 낭떠러지 앞에서 돌아서기
      const fx = this.facing > 0 ? this.x + this.w + 1 : this.x - 1;
      const tx = Math.floor(fx / TILE), ty = Math.floor((this.y + this.h + 2) / TILE);
      if (!lv.solid(tx, ty)) this.facing = -this.facing;
      const c = lv.tile(tx, Math.floor((this.y + this.h - 2) / TILE));
      if (c === T.SPIKE) this.facing = -this.facing;
    }
  }
  hurt(w, dmg = 1, kx = 0) {
    if (this.type === 'tomato') return false;
    if (this.type === 'mole' && !this.up) return false;
    this.hp -= dmg; this.flash = 8;
    if (this.hp <= 0) { this.dead = true; w.fx.burst(this.x + this.w / 2, this.y + this.h / 2, PAL.white, 14); w.onEnemyDefeated(this); return true; }
    this.vx = kx; this.vy = -2; this.stunT = 20;
    return true;
  }
  get dangerous() { return !this.harmless && this.stunT <= 0 && this.type !== 'tomato'; }
  draw(g, cam, time) {
    if (this.type === 'tomato') {
      // 객석 실루엣 + 토마토
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
      g.fillStyle = '#0b0b14'; g.fillRect(x - 2, y + 2, 14, 8); g.fillRect(x + 1, y - 3, 8, 6);
      if (this.cool < 30) g.drawImage(enemySprite('tomato').right, 0, 0, 10, 8, x + 6, y - 9, 10, 8);
      return;
    }
    const s = enemySprite(this.def.sprite);
    const frame = this.stunT > 0 ? 0 : ((time + this.t) >> 4) & 1;
    const img = this.facing > 0 ? s.right : s.left;
    const sx = this.facing > 0 ? frame * s.w : (1 - frame) * s.w;
    let dx = Math.round(this.x + this.w / 2 - s.w / 2 - cam.x), dy = Math.round(this.y + this.h - s.h - cam.y);
    if (this.def.fly) dy = Math.round(this.y + this.h / 2 - s.h / 2 - cam.y);
    if (this.type === 'mole') {
      if (!this.up) { g.fillStyle = PAL.brown; g.fillRect(dx + 2, dy + s.h - 3, 12, 3); g.fillStyle = PAL.ink; g.fillRect(dx + 5, dy + s.h - 4, 6, 1); return; }
      const rise = Math.min(1, (100 - this.state) / 10);
      g.save(); g.beginPath(); g.rect(dx, dy, s.w, s.h); g.clip();
      g.drawImage(img, sx, 0, s.w, s.h, dx, dy + Math.round((1 - rise) * s.h), s.w, s.h); g.restore();
      return;
    }
    if (this.stunT > 0 && this.stunT > 25) { g.globalAlpha = 0.85; }
    g.drawImage(img, sx, 0, s.w, s.h, dx, dy, s.w, s.h);
    g.globalAlpha = 1;
    if (this.flash > 0 && (this.flash & 2)) { g.globalCompositeOperation = 'lighter'; g.drawImage(img, sx, 0, s.w, s.h, dx, dy, s.w, s.h); g.globalCompositeOperation = 'source-over'; }
    if (this.stunT > 25) {
      g.fillStyle = PAL.lyellow;
      for (let i = 0; i < 3; i++) { const a = time / 8 + i * 2.1; g.fillRect(dx + 8 + Math.round(Math.cos(a) * 6), dy - 3 + Math.round(Math.sin(a) * 2), 2, 2); }
    }
  }
}

/* ───── 투사체 ───── */
const PROJ_COL = { sauce: PAL.red, tomato: PAL.tomato, egg: PAL.white, pie: PAL.white };
export class Projectile {
  constructor(o) {
    Object.assign(this, { w: 8, h: 8, grav: 0.15, life: 180, bounce: 0, dead: false, t: 0 }, o);
  }
  update(w) {
    this.t++;
    if (this.type === 'mic') {
      // 부메랑: 나갔다가 돌아옴
      const owner = this.ownerRef;
      if (this.t < 26) { this.vx = this.dir * 3.6 * (1 - this.t / 30); }
      else if (owner && !owner.dead) {
        const dx = owner.cx - (this.x + 5), dy = owner.cy - (this.y + 5);
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * 3.6; this.vy = (dy / d) * 3.6;
        if (d < 10) { this.dead = true; if (owner.boomerang === this) owner.boomerang = null; return; }
      } else this.dead = true;
      if (this.t < 26) this.vy = 0;
      this.x += this.vx; this.y += this.vy;
      if ((this.t & 7) === 0) Sound.play('boomer');
      for (const g of w.gems) if (!g.dead && overlap(this, g) && g.pickDelay <= 0) { g.carried = this.ownerRef; g.x = this.x; g.y = this.y; }
      if (--this.life <= 0) { this.dead = true; if (owner && owner.boomerang === this) owner.boomerang = null; }
      return;
    }
    this.vy += this.grav;
    if (this.type === 'bomb' || this.type === 'qbomb' || this.type === 'egg') {
      const vy = this.vy, vx = this.vx;
      const r = moveBody(w.level, this, {});
      if (r.ground) { if (this.type === 'egg') { this.dead = true; w.onEggLand?.(this); return; } this.vy = -Math.abs(vy) * 0.55; this.vx *= 0.85; if (Math.abs(this.vy) < 0.5) this.vy = 0; }
      if (r.hitX) this.vx = -vx * 0.6;
      if (r.ceil) this.vy = Math.abs(this.vy) * 0.3;
      if (this.type === 'bomb') {
        if ((this.t & 15) === 0) Sound.play('fuse');
        if (this.t >= 90) { this.dead = true; w.explode(this.x + this.w / 2, this.y + this.h / 2, 34, this.ownerRef); }
      }
      if (this.type === 'qbomb' && this.reflected && this.t > 300) { this.dead = true; w.explode(this.x + 4, this.y + 4, 24, null); }
    } else {
      this.x += this.vx; this.y += this.vy;
      const tx = Math.floor((this.x + this.w / 2) / TILE), ty = Math.floor((this.y + this.h / 2) / TILE);
      if (w.level.solid(tx, ty) === 1) { this.dead = true; this.onDie?.(w); w.fx.burst(this.x + 4, this.y + 4, PROJ_COL[this.type] || PAL.white, 6, 1.2); if (this.type === 'pie') Sound.play('splat'); }
    }
    if (this.y > w.level.pxH + 40 || this.x < -40 || this.x > w.level.pxW + 40) this.dead = true;
    if (--this.life <= 0) {
      this.dead = true;
      if (this.type === 'qbomb') w.explode(this.x + 4, this.y + 4, 24, null);
    }
  }
  draw(g, cam, time) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    switch (this.type) {
      case 'sauce': g.fillStyle = PAL.ink; g.fillRect(x, y, 6, 6); g.fillStyle = PAL.red; g.fillRect(x + 1, y + 1, 4, 4); g.fillStyle = PAL.pink; g.fillRect(x + 1, y + 1, 2, 1); break;
      case 'tomato': g.drawImage(enemySprite('tomato').right, 0, 0, 10, 8, x - 1, y, 10, 8); break;
      case 'egg': g.fillStyle = PAL.ink; g.fillRect(x + 1, y, 6, 8); g.fillRect(x, y + 1, 8, 6); g.fillStyle = PAL.white; g.fillRect(x + 1, y + 1, 6, 6); g.fillStyle = PAL.cream; g.fillRect(x + 4, y + 4, 2, 2); break;
      case 'pie': g.drawImage(itemIcon('pie'), x - 2, y - 2); break;
      case 'bomb': {
        g.drawImage(itemIcon('bomb'), x - 2, y - 2);
        if ((time >> 1) & 1) { g.fillStyle = PAL.lyellow; g.fillRect(x + 6, y - 3, 2, 2); }
        if (this.t > 60 && (time >> 2) & 1) { g.globalCompositeOperation = 'lighter'; g.drawImage(itemIcon('bomb'), x - 2, y - 2); g.globalCompositeOperation = 'source-over'; }
        break;
      }
      case 'qbomb': {
        g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 10, 10); g.fillStyle = this.reflected ? PAL.green : PAL.yellow; g.fillRect(x, y, 8, 8);
        g.fillStyle = PAL.ink; g.font = '8px Galmuri9'; g.fillText('?', x + 2, y + 7);
        break;
      }
      case 'mic': {
        g.save(); g.translate(x + 5, y + 5); g.rotate(this.t * 0.5); g.drawImage(itemIcon('mic'), -6, -6); g.restore();
        break;
      }
      case 'micBoss': {
        g.save(); g.translate(x + 5, y + 5); g.rotate(-this.t * 0.4); g.drawImage(itemIcon('mic'), -6, -6); g.restore();
        break;
      }
      default: g.fillStyle = PAL.white; g.fillRect(x, y, this.w, this.h);
    }
  }
}

export function randomItem(r = Math.random) { return ITEMS[Math.floor(r() * ITEMS.length)]; }
export { rand };
