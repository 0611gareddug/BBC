import { PHYS, TILE } from '../core/constants.js';
import { B } from '../core/input.js';
import { moveBody, touchingWall } from './level.js';
import { T } from './tiledefs.js';
import { Sound } from '../core/audio.js';
import { charAtlas, CF_W, CF_H, FRAME } from '../gfx/sprites.js';

export const TEAM_COLORS = ['#e43b44', '#0099db', '#63c74d', '#feae34'];

export function pushX(level, body, dx) {
  const vx = body.vx, vy = body.vy;
  body.vx = dx; body.vy = 0;
  moveBody(level, body, {});
  body.vx = vx; body.vy = vy;
}

export class Player {
  constructor(opts) {
    this.id = opts.id ?? 0;
    this.name = opts.name || '참가자';
    this.look = opts.look;
    this.team = opts.team ?? this.id;
    this.color = TEAM_COLORS[opts.color ?? this.id % 4];
    this.slot = opts.slot || 'solo';
    this.w = 10; this.h = 15;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.bits = 0; this.prevBits = 0; this.pressed = 0;
    this.reset();
    this.lives = 3;
    this.gems = 0; this.gold = 0; this.score = 0; this.zoneTime = 0; this.roundWins = 0; this.kos = 0;
  }
  reset() {
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.wasGround = false; this.coyote = 0; this.buffer = 0; this.jumping = false;
    this.punchT = 0; this.punchCd = 0; this.punchHits = new Set(); this.throwT = 0;
    this.inv = 0; this.dead = false; this.deadT = 0; this.stunT = 0; this.wallDir = 0; this.wallLock = 0; this.dropT = 0;
    this.item = null; this.itemUses = 0;
    this.magnetT = 0; this.cloakT = 0; this.springT = 0; this.springUsed = false; this.blindT = 0;
    this.platform = null; this.onButter = false; this.warpCd = 0; this.animT = 0; this.win = false; this.landT = 0;
    this.boomerang = null; this.hidden = false; this.eliminated = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  setInput(bits) {
    this.pressed = bits & ~this.prevBits;
    this.prevBits = bits;
    this.bits = bits;
  }

  update(w) {
    const lv = w.level;
    if (this.eliminated) return;
    if (this.dead) {
      this.deadT--;
      if (this.deadT <= 0) w.hooks.respawn(this);
      return;
    }
    const b = w.frozen || this.win ? 0 : this.bits;
    const pressed = w.frozen || this.win ? 0 : this.pressed;
    if (this.inv > 0) this.inv--;
    if (this.punchCd > 0) this.punchCd--;
    if (this.throwT > 0) this.throwT--;
    if (this.stunT > 0) this.stunT--;
    if (this.wallLock > 0) this.wallLock--;
    if (this.dropT > 0) this.dropT--;
    if (this.warpCd > 0) this.warpCd--;
    if (this.magnetT > 0) this.magnetT--;
    if (this.cloakT > 0) this.cloakT--;
    if (this.blindT > 0) this.blindT--;
    if (this.springT > 0) { this.springT--; if (this.springT === 0) this.springUsed = false; }
    this.animT++;

    const ctrl = this.stunT <= 0;
    let dir = 0;
    if (ctrl) dir = (b & B.R ? 1 : 0) - (b & B.L ? 1 : 0);
    if (this.wallLock > 0) dir = 0;
    const slip = this.onButter || this.blindT > 0;
    const accel = this.onGround ? (slip ? 0.05 : PHYS.accelGround) : PHYS.accelAir;
    const decel = this.onGround ? (slip ? 0.015 : PHYS.decelGround) : PHYS.decelAir;
    const max = PHYS.maxSpeed;
    if (dir) {
      if (Math.abs(this.vx) <= max || Math.sign(this.vx) !== dir) {
        this.vx += dir * accel;
        if (Math.abs(this.vx) > max) this.vx = Math.sign(this.vx) * max;
      } else this.vx -= Math.sign(this.vx) * Math.min(decel, Math.abs(this.vx) - max);
      if (this.punchT <= 0) this.facing = dir;
    } else {
      const d = Math.min(Math.abs(this.vx), decel);
      this.vx -= Math.sign(this.vx) * d;
    }

    // 점프
    if (pressed & B.J) this.buffer = PHYS.buffer; else if (this.buffer > 0) this.buffer--;
    this.coyote = this.onGround ? PHYS.coyote : Math.max(0, this.coyote - 1);
    if (ctrl && (b & B.D) && (pressed & B.J) && this.onGround && this.standingOneway(lv)) {
      this.dropT = 12; this.buffer = 0; this.onGround = false; this.coyote = 0; this.y += 1;
    }
    if (ctrl && this.buffer > 0) {
      if (this.coyote > 0) {
        this.vy = -PHYS.jumpV; this.coyote = 0; this.buffer = 0; this.jumping = true; this.onGround = false; this.platform = null;
        Sound.play('jump'); w.fx.dust(this.cx, this.y + this.h, 3);
      } else if (this.wallDir !== 0) {
        this.vy = -PHYS.wallJumpY; this.vx = -this.wallDir * PHYS.wallJumpX; this.facing = -this.wallDir;
        this.wallLock = 9; this.buffer = 0; this.jumping = true; Sound.play('jump');
        w.fx.dust(this.wallDir > 0 ? this.x + this.w : this.x, this.cy, 3);
      } else if (this.springT > 0 && !this.springUsed) {
        this.vy = -PHYS.jumpV * 0.95; this.springUsed = true; this.buffer = 0; this.jumping = true;
        Sound.play('djump'); w.fx.ring(this.cx, this.y + this.h, '#feae34');
      }
    }
    if (!(b & B.J) && this.jumping && this.vy < -PHYS.jumpCut) { this.vy = -PHYS.jumpCut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;

    // 중력
    this.vy += PHYS.gravity;
    if (this.vy > PHYS.maxFall) this.vy = PHYS.maxFall;
    // 벽 미끄럼
    this.wallDir = 0;
    if (!this.onGround && dir !== 0 && this.vy > 0 && touchingWall(lv, this, dir)) {
      this.wallDir = dir;
      if (this.vy > PHYS.wallSlide) this.vy = PHYS.wallSlide;
      if ((this.animT & 7) === 0) w.fx.dust(dir > 0 ? this.x + this.w : this.x, this.y + 4, 1);
    }

    // 이동
    const fallV = this.vy;
    this.wasGround = this.onGround;
    const res = moveBody(lv, this, { dropThrough: this.dropT > 0, platforms: w.movers });
    this.onGround = res.ground;
    this.platform = res.platform;
    this.onButter = false;
    if (res.ground && !this.wasGround && fallV > 2) { Sound.play('land'); w.fx.dust(this.cx, this.y + this.h, 2); this.landT = 6; }
    if (this.landT > 0) this.landT--;
    if (res.ground) this.springUsed = false;

    // 밟은 타일 효과
    if (res.groundTiles) {
      let conv = 0;
      for (let i = 0; i < res.groundTiles.length; i += 2) {
        const tx = res.groundTiles[i], ty = res.groundTiles[i + 1];
        const code = lv.tile(tx, ty);
        const st = lv.st(tx, ty);
        switch (code) {
          case T.JUMP:
            this.vy = -PHYS.padV; this.onGround = false; this.jumping = false; st.anim = 10;
            Sound.play('pad'); w.fx.ring(tx * TILE + 8, ty * TILE, '#feae34');
            break;
          case T.HOT: if (st.hot) w.hooks.damage(this, 'burn', -this.facing * 1.5, -4); break;
          case T.CRUMBLE: if (!st.timer && !st.gone) { st.timer = 30; Sound.play('crumble'); } break;
          case T.TIMER: if (!st.timer && !st.gone) { st.timer = 180; Sound.play('tick'); } break;
          case T.BUZZER:
            if (!this.wasGround && st.anim <= 0) { st.anim = 14; lv.setRed(!lv.redOn); Sound.play('ding'); w.event('buzzer'); }
            break;
          case T.PANEL_O: case T.PANEL_X:
            if (st.fake && !st.timer && !st.gone) { st.timer = 10; Sound.play('buzz'); w.event('wrong', { x: tx, y: ty }); }
            else if (!st.fake && !st.told) { st.told = true; w.event('right', { st }); }
            break;
          case T.CONV_L: conv = -1; break;
          case T.CONV_R: conv = 1; break;
          case T.BUTTER: this.onButter = true; break;
        }
      }
      if (conv && this.onGround) pushX(lv, this, conv * 0.9);
    }
    if (w.slickZones) {
      for (const z of w.slickZones) if (this.onGround && this.cx > z.x && this.cx < z.x + z.w && Math.abs(this.y + this.h - z.y) < 3) this.onButter = true;
    }

    // 가시
    if (this.inv <= 0 && !this.dead) {
      const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
      const y0 = Math.floor(this.y / TILE), y1 = Math.floor((this.y + this.h - 0.01) / TILE);
      outer: for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const c = lv.tile(tx, ty);
        if (c === T.SPIKE || c === T.SPIKE_D) {
          const hy = c === T.SPIKE ? ty * TILE + 8 : ty * TILE;
          if (this.x < tx * TILE + 14 && this.x + this.w > tx * TILE + 2 && this.y < hy + 8 && this.y + this.h > hy) {
            w.hooks.damage(this, 'spike', 0, -3.5); break outer;
          }
        }
      }
    }
    // 낭떠러지
    if (this.y > lv.pxH + 24 && !this.dead) w.hooks.fall(this);

    // 워프
    if (this.warpCd <= 0) {
      const tx = Math.floor(this.cx / TILE), ty = Math.floor(this.cy / TILE);
      const c = lv.tile(tx, ty);
      if (c >= T.WARP_A && c <= T.WARP_B2) {
        const pair = c === T.WARP_A ? T.WARP_A2 : c === T.WARP_A2 ? T.WARP_A : c === T.WARP_B ? T.WARP_B2 : T.WARP_B;
        const dest = lv.warps[pair]?.[0];
        if (dest) {
          w.fx.burst(this.cx, this.cy, '#2ce8f5', 10);
          this.x = dest.tx * TILE + 3; this.y = dest.ty * TILE + 1; this.vy = Math.min(this.vy, 0);
          this.warpCd = 50; Sound.play('warp');
          w.fx.burst(this.cx, this.cy, '#2ce8f5', 10);
        }
      }
    }

    // 펀치
    if (ctrl && (pressed & B.P) && this.punchCd <= 0) {
      this.punchT = 14; this.punchCd = 20; this.punchHits.clear(); Sound.play('punch');
    }
    if (this.punchT > 0) this.punchT--;
    // 아이템
    if (ctrl && (pressed & B.I) && this.item) w.useItem(this);
  }

  standingOneway(lv) {
    const ty = Math.floor((this.y + this.h + 1) / TILE);
    const l = Math.floor(this.x / TILE), r = Math.floor((this.x + this.w - 0.01) / TILE);
    let one = false;
    for (let tx = l; tx <= r; tx++) { const s = lv.solid(tx, ty); if (s === 1) return false; if (s === 2) one = true; }
    return one || !!this.platform;
  }

  punchBox() {
    if (this.punchT < 4 || this.punchT > 11) return null;
    return this.facing > 0 ? { x: this.x + this.w - 2, y: this.y + 2, w: 15, h: 11 } : { x: this.x - 13, y: this.y + 2, w: 15, h: 11 };
  }

  frameName() {
    if (this.dead || this.stunT > 0) return 'hurt';
    if (this.win) return (this.animT >> 4) & 1 ? 'win1' : 'win0';
    if (this.punchT > 0) return this.punchT > 10 ? 'punch0' : 'punch1';
    if (this.throwT > 0) return 'throw';
    if (!this.onGround) {
      if (this.wallDir) return 'slide';
      return this.vy < 0 ? 'jump' : 'fall';
    }
    if (Math.abs(this.vx) > 0.25) return 'run' + ((this.animT >> 3) & 3);
    return (this.animT >> 5) & 1 ? 'idle1' : 'idle0';
  }

  draw(g, cam, opts = {}) {
    if (this.eliminated) return;
    if (this.dead && this.deadT < 40) return;
    const name = opts.frame || this.frameName();
    const f = FRAME[name] ?? 0;
    const at = charAtlas(this.look);
    const sx = this.facing > 0 ? f * CF_W : (at.n - 1 - f) * CF_W;
    const img = this.facing > 0 ? at.right : at.left;
    const dx = Math.round(this.x - 5 - cam.x), dy = Math.round(this.y + this.h - (CF_H + 8) - cam.y);
    let alpha = 1;
    if (this.inv > 0 && (this.inv >> 2) & 1) alpha = 0.35;
    if (this.cloakT > 0) alpha = opts.self ? 0.45 : 0.18;
    if (alpha < 1) g.globalAlpha = alpha;
    if (this.landT > 3) g.drawImage(img, sx, 0, CF_W, CF_H + 8, dx - 1, dy + 2, CF_W + 2, CF_H + 6);
    else g.drawImage(img, sx, 0, CF_W, CF_H + 8, dx, dy, CF_W, CF_H + 8);
    g.globalAlpha = 1;
    // 파이 범벅
    if (this.blindT > 0) {
      g.fillStyle = '#f4f4f4'; g.fillRect(dx + 7, dy + 12, 9, 4); g.fillRect(dx + 9, dy + 10, 6, 2); g.fillRect(dx + 8, dy + 16, 2, 3);
      g.fillStyle = '#ffb4c8'; g.fillRect(dx + 11, dy + 13, 2, 1);
    }
    if (this.magnetT > 0 && (this.animT >> 2) & 1) { g.strokeStyle = 'rgba(228,59,68,0.5)'; g.beginPath(); g.arc(this.cx - cam.x, this.cy - cam.y, 14 + (this.animT % 8), 0, 6.28); g.stroke(); }
    if (this.springT > 0) { g.fillStyle = '#feae34'; g.fillRect(dx + 6, dy + 29, 3, 1); g.fillRect(dx + 11, dy + 29, 3, 1); }
  }
}
