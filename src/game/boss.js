import { TILE, overlap, rand } from '../core/constants.js';
import { PAL, itemIcon, portrait } from '../gfx/sprites.js';
import { Sound } from '../core/audio.js';
import { Enemy, ItemBox } from './entities.js';
import { T } from './tiledefs.js';
import { QUIZ } from '../data/quiz.js';
import { textOutline, wrap } from './show.js';

class Boss {
  constructor(w, tx, ty, hp) {
    this.w0 = w; this.maxHp = hp; this.hp = hp; this.t = 0; this.flash = 0; this.dead = false; this.deathT = 0;
    this.state = 'intro'; this.st = 90; this.hitCd = 0; this.half = false; this.name = '';
  }
  damage(w, n, x, y) {
    if (this.dead || this.hitCd > 0) return false;
    this.hp -= n; this.flash = 12; this.hitCd = 18;
    Sound.play('bossHit'); w.shake(4); w.fx.burst(x, y, PAL.lyellow, 14, 2.5);
    w.show.say('bossHit'); w.show.crowdReact('oh', false); w.show.addHype(8);
    if (!this.half && this.hp <= this.maxHp / 2) { this.half = true; w.show.say('bossHalf', { force: true }); }
    if (this.hp <= 0) this.onZero(w);
    return true;
  }
  onZero(w) { this.dead = true; this.deathT = 150; Sound.play('bossDie'); w.show.say('bossWin', { force: true }); w.show.crowdReact('cheer'); }
  tickBase(w) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.hitCd > 0) this.hitCd--;
    if (this.dead) {
      this.deathT--;
      if (this.deathT % 8 === 0) { w.fx.burst(this.cx + (Math.random() - 0.5) * 50, this.cy + (Math.random() - 0.5) * 40, [PAL.orange, PAL.yellow, PAL.white][this.deathT % 3], 12, 3); w.shake(3); }
      if (this.deathT <= 0) w.bossDefeated();
      return true;
    }
    return false;
  }
  hurtPlayer(w, p, box, kx = 0) {
    if (!p.dead && p.inv <= 0 && overlap(box, p)) w.hooks.damage(p, 'boss', kx || (p.cx < box.x + box.w / 2 ? -2.5 : 2.5), -3);
  }
  // 모든 플레이어 중 가장 가까운 대상
  target(w) { return w.players.find(p => !p.dead) || w.players[0]; }
  get speedMul() { return this.half ? 1.3 : 1; }
}

/* ═════════ 셰프 터보 ═════════ */
export class ChefBoss extends Boss {
  constructor(w, tx, ty) {
    super(w, tx, ty, 12);
    this.name = '셰프 터보';
    this.x = tx * TILE - 12; this.y = (ty + 1) * TILE - 48; this.w = 40; this.h = 48;
    this.dir = -1; this.pan = null; this.next = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(w) {
    if (this.tickBase(w)) return;
    const p = this.target(w);
    const sp = this.speedMul;
    // 이동
    if (this.state !== 'pan') {
      this.x += this.dir * 0.4 * sp;
      if (this.x < 15 * TILE) this.dir = 1;
      if (this.x > 25 * TILE) this.dir = -1;
    }
    this.st -= sp;
    switch (this.state) {
      case 'intro': if (this.st <= 0) this.choose(); break;
      case 'idle': if (this.st <= 0) this.choose(); break;
      case 'pan': {
        const pan = this.pan;
        if (pan.phase === 'aim') { if (this.st <= 0) { pan.phase = 'drop'; pan.y = -40; } else pan.x += (Math.max(24, Math.min(440, p.cx)) - 16 - pan.x) * 0.08; }
        else if (pan.phase === 'drop') {
          pan.y += 9;
          for (const pl of w.players) this.hurtPlayer(w, pl, { x: pan.x, y: pan.y, w: 32, h: 14 });
          if (pan.y >= 14 * TILE - 14) { pan.y = 14 * TILE - 14; pan.phase = 'stuck'; this.st = 160; pan.hits = 0; Sound.play('boom'); w.shake(6); w.fx.dust(pan.x + 16, pan.y + 14, 10); }
        } else if (pan.phase === 'stuck') {
          if (this.st <= 0 || pan.hits >= 3) { pan.phase = 'lift'; this.st = 30; }
        } else if (pan.phase === 'lift') {
          pan.y -= 6;
          if (this.st <= 0) { this.pan = null; this.state = 'idle'; this.st = 70; }
        }
        break;
      }
      case 'eggs': {
        if (this.st % 22 < 1 * sp && this.eggs > 0) {
          this.eggs--;
          const dx = p.cx - this.cx + (Math.random() - 0.5) * 40;
          w.spawnProj({ type: 'egg', x: this.cx - 4, y: this.y + 4, vx: Math.max(-4, Math.min(4, dx / 50)), vy: -4, grav: 0.16, life: 300, w: 8, h: 8, owner: null });
          Sound.play('pie');
        }
        if (this.st <= 0) { this.state = 'idle'; this.st = 60; }
        break;
      }
      case 'hot': {
        if (this.st > 150) this.hotZone = { x: this.hotLeft ? 1 * TILE : 15 * TILE, y: 14 * TILE - 2, w: 14 * TILE, h: 4, warn: true };
        else if (this.st > 0) {
          this.hotZone.warn = false;
          for (const pl of w.players) if (pl.onGround && !pl.dead && pl.cx > this.hotZone.x && pl.cx < this.hotZone.x + this.hotZone.w && Math.abs(pl.y + pl.h - 14 * TILE) < 2) w.hooks.damage(pl, 'burn', 0, -4.5);
          if ((this.t & 7) === 0) w.fx.add({ x: this.hotZone.x + Math.random() * this.hotZone.w, y: this.hotZone.y, vx: 0, vy: -0.6, life: 20, col: PAL.orange, s: 2, g: 0 });
        } else { this.hotZone = null; this.state = 'idle'; this.st = 60; }
        break;
      }
    }
    // 몸통 접촉
    for (const pl of w.players) this.hurtPlayer(w, pl, { x: this.x + 4, y: this.y + 6, w: this.w - 8, h: this.h - 6 });
  }
  choose() {
    const opts = ['pan', 'pan', 'eggs', 'hot'];
    let s = opts[this.next++ % opts.length];
    if (s === 'pan') { this.state = 'pan'; this.st = 70; this.pan = { x: this.cx - 16, y: -40, phase: 'aim', hits: 0, cd: 0 }; }
    else if (s === 'eggs') { this.state = 'eggs'; this.st = 90; this.eggs = 3; }
    else { this.state = 'hot'; this.st = 240; const p = this.w0.players[0]; this.hotLeft = p.cx < 15 * TILE; }
  }
  weakBoxes() {
    if (this.pan && this.pan.phase === 'stuck') return [{ x: this.pan.x - 2, y: this.pan.y - 4, w: 36, h: 18, id: 'pan' }];
    return [];
  }
  onWeakHit(w, id) {
    if (id === 'pan' && this.pan) { if (this.damage(w, 1, this.pan.x + 16, this.pan.y)) this.pan.hits++; }
  }
  draw(g, cam, time) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    if (this.hotZone) {
      g.fillStyle = this.hotZone.warn ? ((time >> 3) & 1 ? 'rgba(254,174,52,0.5)' : 'rgba(254,174,52,0.15)') : 'rgba(247,118,34,0.75)';
      g.fillRect(Math.round(this.hotZone.x - cam.x), Math.round(this.hotZone.y - cam.y) - 2, this.hotZone.w, 6);
    }
    // 팬 & 늘어나는 팔
    if (this.pan) {
      const px = Math.round(this.pan.x - cam.x), py = Math.round(this.pan.y - cam.y);
      if (this.pan.phase === 'aim') {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px + 2, 14 * TILE - cam.y - 3, 28, 4);
      }
      if (this.pan.phase !== 'aim') {
        g.strokeStyle = PAL.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 6, y + 24); g.quadraticCurveTo(px + 30, py - 40, px + 34, py + 4); g.stroke();
        g.strokeStyle = PAL.silver; g.lineWidth = 2; g.stroke(); g.lineWidth = 1;
      }
      g.fillStyle = PAL.ink; g.fillRect(px - 1, py + 3, 34, 11); g.fillRect(px + 30, py + 5, 12, 4);
      g.fillStyle = PAL.dgray; g.fillRect(px, py + 4, 32, 9); g.fillStyle = PAL.slate; g.fillRect(px + 2, py + 4, 28, 3);
      g.fillStyle = PAL.brown; g.fillRect(px + 31, py + 6, 10, 2);
      if (this.pan.phase === 'stuck' && (time >> 3) & 1) { g.fillStyle = PAL.lyellow; g.fillRect(px + 12, py - 8, 8, 2); g.fillRect(px + 15, py - 12, 2, 8); }
    }
    if (this.dead && (time >> 2) & 1) return;
    // 로봇 셰프 몸체
    const bob = Math.round(Math.sin(this.t / 10));
    g.fillStyle = PAL.ink; g.fillRect(x + 2, y + 18 + bob, 36, 30 - bob);
    g.fillStyle = this.flash > 0 && (this.flash & 2) ? PAL.white : PAL.silver; g.fillRect(x + 4, y + 20 + bob, 32, 26 - bob);
    g.fillStyle = PAL.white; g.fillRect(x + 8, y + 24 + bob, 24, 18);
    g.fillStyle = PAL.red; g.fillRect(x + 18, y + 26 + bob, 4, 4); g.fillRect(x + 18, y + 34 + bob, 4, 4);
    // 머리 + 셰프 모자
    g.fillStyle = PAL.ink; g.fillRect(x + 6, y + 4 + bob, 28, 16);
    g.fillStyle = PAL.gray; g.fillRect(x + 7, y + 5 + bob, 26, 14);
    g.fillStyle = PAL.ink; g.fillRect(x + 10, y + 9 + bob, 20, 6);
    g.fillStyle = this.state === 'pan' ? PAL.red : PAL.teal; g.fillRect(x + 11, y + 10 + bob, 6, 4); g.fillRect(x + 23, y + 10 + bob, 6, 4);
    g.fillStyle = PAL.ink; g.fillRect(x + 4, y - 14 + bob, 32, 19);
    g.fillStyle = PAL.white; g.fillRect(x + 5, y - 13 + bob, 30, 13); g.fillRect(x + 7, y - 15 + bob, 8, 3); g.fillRect(x + 18, y - 16 + bob, 9, 4);
    g.fillStyle = PAL.gray; g.fillRect(x + 5, y + 1 + bob, 30, 3);
    // 콧수염
    g.fillStyle = PAL.ink; g.fillRect(x + 12, y + 16 + bob, 6, 2); g.fillRect(x + 22, y + 16 + bob, 6, 2);
    // 바퀴
    g.fillStyle = PAL.ink; g.fillRect(x + 6, y + 44, 10, 4); g.fillRect(x + 24, y + 44, 10, 4);
  }
}

/* ═════════ 퀴즈박스 Q ═════════ */
export class QuizBoss extends Boss {
  constructor(w, tx, ty) {
    super(w, tx, ty, 15);
    this.name = '퀴즈박스 Q';
    this.x = tx * TILE - 24; this.y = 36; this.w = 48; this.h = 40;
    this.q = null; this.next = 0; this.used = new Set(); this.noise = 0; this.fakes = [];
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(w) {
    if (this.tickBase(w)) return;
    const sp = this.speedMul;
    this.x = 240 - 24 + Math.sin(this.t / (110 / sp)) * 150;
    this.y = 36 + Math.sin(this.t / 37) * 6;
    if (this.noise > 0) this.noise--;
    this.st -= 1;
    switch (this.state) {
      case 'intro': case 'idle': if (this.st <= 0) this.choose(w); break;
      case 'quiz': {
        if (this.st === 0) {
          // 오답 쪽 바닥 제거
          const wrongO = !this.q.a;
          for (const s of w.level.dyn) if ((s.code === T.PANEL_O && wrongO) || (s.code === T.PANEL_X && !wrongO)) { s.gone = true; s.regen = 999999; }
          Sound.play('buzz'); w.shake(3); this.reveal = 150;
          this.survivors = w.players.filter(p => !p.dead).map(p => p.id);
        }
        if (this.st < 0) {
          this.reveal--;
          if (this.reveal <= 0) {
            for (const s of w.level.dyn) if (s.code === T.PANEL_O || s.code === T.PANEL_X) { s.gone = false; s.regen = 0; }
            const ok = w.players.some(p => !p.dead && this.survivors.includes(p.id) && p.lastDeath < this.qStart);
            if (ok) { this.damage(w, 1, this.cx, this.cy); Sound.play('ding'); w.show.line('mc', '정답이라니… 문제를 너무 쉽게 냈어요!', 140); }
            this.q = null; this.state = 'idle'; this.st = 50;
          }
        }
        break;
      }
      case 'bombs': {
        if (this.st % 30 === 0 && this.bombs > 0) {
          this.bombs--;
          w.spawnProj({ type: 'qbomb', x: this.cx - 4, y: this.y + this.h - 4, vx: (Math.random() - 0.5) * 3, vy: 0, grav: 0.15, life: 420, w: 8, h: 8, owner: null });
        }
        if (this.st <= 0) { this.state = 'idle'; this.st = 90; }
        break;
      }
      case 'noise': {
        if (this.st === 160) w.spawnProj({ type: 'qbomb', x: this.cx - 4, y: this.y + 30, vx: -1.5, vy: 0, grav: 0.15, life: 420, w: 8, h: 8 });
        if (this.st === 120) w.spawnProj({ type: 'qbomb', x: this.cx - 4, y: this.y + 30, vx: 1.5, vy: 0, grav: 0.15, life: 420, w: 8, h: 8 });
        if (this.st <= 0) { this.fakes = []; this.state = 'idle'; this.st = 60; }
        break;
      }
    }
    // 반사된 폭탄 충돌
    for (const pr of w.projectiles) {
      if (pr.type === 'qbomb' && pr.reflected && !pr.dead) {
        const dx = this.cx - (pr.x + 4), dy = this.cy - (pr.y + 4), d = Math.hypot(dx, dy) || 1;
        pr.vx = dx / d * 4.5; pr.vy = dy / d * 4.5; pr.grav = 0;
        if (overlap(pr, this)) { pr.dead = true; w.explode(pr.x + 4, pr.y + 4, 16, null, true); this.damage(w, 2, pr.x, pr.y); }
      }
    }
    for (const pl of w.players) this.hurtPlayer(w, pl, this);
  }
  choose(w) {
    const opts = ['quiz', 'bombs', 'quiz', 'noise'];
    const s = opts[this.next++ % opts.length];
    if (s === 'quiz') {
      let i; do { i = Math.floor(Math.random() * QUIZ.length); } while (this.used.has(i) && this.used.size < QUIZ.length);
      this.used.add(i); this.q = QUIZ[i]; this.state = 'quiz'; this.st = Math.round(260 / this.speedMul); this.qStart = w.time;
      Sound.play('ding'); w.show.line('mc', '문제! ' + this.q.q + '. 맞으면 O, 틀리면 X!', 220);
    } else if (s === 'bombs') { this.state = 'bombs'; this.st = 150; this.bombs = this.half ? 5 : 4; }
    else {
      this.state = 'noise'; this.st = 200; this.noise = 200; Sound.play('flash');
      this.fakes = [{ x: 6 * TILE, y: 12 * TILE }, { x: 20 * TILE, y: 12 * TILE }, { x: 13 * TILE, y: 4 * TILE }];
    }
  }
  weakBoxes() { return []; }
  draw(g, cam, time) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    // 가짜 발판
    for (const f of this.fakes) {
      if ((time >> 1) % 3 === 0) continue;
      g.globalAlpha = 0.6; g.fillStyle = PAL.teal; g.fillRect(f.x - cam.x, f.y - cam.y, 48, 5); g.globalAlpha = 1;
    }
    if (this.dead && (time >> 2) & 1) return;
    const gl = this.noise > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    // 프로펠러
    g.fillStyle = PAL.ink; g.fillRect(x + 22, y - 8, 4, 8);
    const pw = (time >> 1) & 1 ? 28 : 16; g.fillRect(x + 24 - pw / 2, y - 10, pw, 3);
    // 몸체 (모니터)
    g.fillStyle = PAL.ink; g.fillRect(x + gl, y, 48, 40);
    g.fillStyle = this.flash > 0 && (this.flash & 2) ? PAL.white : PAL.dblue; g.fillRect(x + 2 + gl, y + 2, 44, 36);
    g.fillStyle = PAL.ink; g.fillRect(x + 5 + gl, y + 5, 38, 26);
    const scr = this.noise > 0 ? (time & 1 ? PAL.neonp : PAL.teal) : this.state === 'quiz' ? PAL.yellow : PAL.teal;
    g.fillStyle = scr; g.fillRect(x + 6 + gl, y + 6, 36, 24);
    if (this.noise > 0) { for (let i = 0; i < 6; i++) { g.fillStyle = PAL.ink; g.fillRect(x + 6, y + 6 + ((time * 3 + i * 7) % 24), 36, 1); } }
    g.fillStyle = PAL.ink;
    if (this.state === 'quiz' && this.st > 0) {
      g.font = '12px Galmuri11'; g.textAlign = 'center'; g.fillText(String(Math.ceil(this.st / 60)), x + 24, y + 24); g.textAlign = 'left';
    } else {
      // ? 얼굴
      g.fillRect(x + 18 + gl, y + 9, 12, 3); g.fillRect(x + 27 + gl, y + 11, 3, 6); g.fillRect(x + 22 + gl, y + 16, 6, 3); g.fillRect(x + 22 + gl, y + 18, 3, 4); g.fillRect(x + 22 + gl, y + 24, 3, 3);
    }
    g.fillStyle = PAL.red; g.fillRect(x + 38, y + 33, 4, 3); g.fillStyle = PAL.green; g.fillRect(x + 32, y + 33, 4, 3);
    // 퀴즈 패널 문구
    if (this.q && this.state === 'quiz') {
      g.font = '12px Galmuri11';
      const lines = wrap(g, this.q.q, 300);
      const bw = 320, bh = 16 + lines.length * 14;
      const bx = 80, by = 92;
      g.fillStyle = PAL.ink; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      g.fillStyle = '#122a5c'; g.fillRect(bx, by, bw, bh);
      lines.forEach((l, i) => textOutline(g, l, bx + bw / 2, by + 16 + i * 14, PAL.white, PAL.ink, 'center'));
      if (this.st > 0) { g.fillStyle = PAL.yellow; g.fillRect(bx, by + bh - 3, bw * (this.st / 260), 3); }
      g.font = '10px Galmuri9';
      textOutline(g, 'O 쪽 (왼쪽)', 60, 210, PAL.blue); textOutline(g, 'X 쪽 (오른쪽)', 380, 210, PAL.red);
    }
  }
}

/* ═════════ 미러볼 MC ═════════ */
export class MirrorBoss extends Boss {
  constructor(w, tx, ty) {
    super(w, tx, ty, 10);
    this.name = '미러볼 MC';
    this.phase = 1; this.x = tx * TILE - 20; this.y = 14 * TILE - 96; this.w = 56; this.h = 96;
    this.angle = 0; this.legCd = [0, 0]; this.ballX = 0; this.ballY = 0; this.dancerT = 120; this.collapse = 0; this.mcX = 15 * TILE; this.mcY = 0; this.mcVy = 0; this.trans = 0;
    this.laserOn = false;
  }
  get cx() { return this.phase === 3 ? this.mcX + 8 : this.phase === 2 ? this.ballX : this.x + this.w / 2; }
  get cy() { return this.phase === 3 ? this.mcY + 10 : this.phase === 2 ? this.ballY : this.y + 30; }
  onZero(w) {
    if (this.phase < 3) {
      this.trans = 150; this.hitCd = 150;
      Sound.play('bossDie'); w.shake(8);
      this.phase++;
      this.hp = this.maxHp; this.half = false;
      if (this.phase === 2) { this.ballX = this.x + this.w / 2; this.ballY = this.y + 30; w.show.line('mc', '로봇이 부서져도 미러볼은 아직 돌아갑니다!', 180); }
      if (this.phase === 3) {
        this.mcX = this.ballX - 8; this.mcY = this.ballY;
        w.show.line('mc', '좋아요! 이번엔 제가 직접 상대해드리죠!', 180);
        for (const p of w.players) { p.item = 'mic'; p.itemUses = 99; }
        w.show.tip('핑크: 마이크 부메랑을 줬어요! 아이템 버튼으로 MC의 마이크를 노려요!', 240);
      }
      return;
    }
    super.onZero(w);
  }
  update(w) {
    if (this.tickBase(w)) return;
    if (this.trans > 0) { this.trans--; if (this.phase === 3 && this.trans === 0) this.mcVy = -3; return; }
    const beat = w.beat;
    const p = this.target(w);
    for (let i = 0; i < 2; i++) if (this.legCd[i] > 0) this.legCd[i]--;
    if (this.phase === 1) {
      // 박자: 0~3 박 켜짐, 4~5 꺼짐 (6박 주기)
      const cyc = Math.floor(w.time / beat.len) % 6;
      this.laserOn = cyc < 4; this.laserWarn = cyc === 5;
      this.angle += this.half ? 0.022 : 0.016;
      this.x += Math.sin(this.t / 140) * 0.5;
      if (this.laserOn) {
        const ox = this.x + this.w / 2, oy = this.y + 28;
        for (let k = 0; k < 2; k++) {
          const a = this.angle + k * Math.PI;
          const ex = ox + Math.cos(a) * 300, ey = oy + Math.sin(a) * 300;
          for (const pl of w.players) {
            if (pl.dead || pl.inv > 0) continue;
            if (distSeg(pl.cx, pl.cy, ox, oy, ex, ey) < 6) w.hooks.damage(pl, 'laser', Math.cos(a + 1.57) * 2, -3);
          }
        }
        if ((this.t & 15) === 0) Sound.play('laser');
      }
      for (const pl of w.players) this.hurtPlayer(w, pl, { x: this.x + 12, y: this.y + 8, w: this.w - 24, h: 52 });
    } else if (this.phase === 2) {
      const sp = this.speedMul;
      this.ballX = 240 + Math.sin(this.t / (90 / sp)) * 170;
      this.ballY = 70 + Math.sin(this.t / (45 / sp)) * 24;
      if (--this.dancerT <= 0) {
        this.dancerT = this.half ? 180 : 240;
        const alive = w.enemies.filter(e => e.type === 'dancer' && !e.dead).length;
        if (alive < 2) {
          const side = Math.random() < 0.5 ? 2 : 27;
          const e = new Enemy('dancer', side, 13); e.dropBomb = true; w.enemies.push(e);
          w.fx.burst(side * TILE + 8, 13 * TILE, PAL.neonp, 12);
        }
      }
      if (this.t % 80 === 0) {
        for (let k = -1; k <= 1; k++) w.spawnProj({ type: 'sauce', spark: true, x: this.ballX - 3, y: this.ballY + 16, vx: k * 1.2, vy: 1, grav: 0.1, life: 200, w: 6, h: 6 });
      }
      for (const pl of w.players) this.hurtPlayer(w, pl, { x: this.ballX - 18, y: this.ballY - 18, w: 36, h: 36 });
    } else {
      // MC 직접 대결: 플랫폼 사이를 뛰어다님
      this.mcVy += 0.2; this.mcY += this.mcVy;
      const floorY = 14 * TILE - 22;
      const plats = [{ x0: 4 * TILE, x1: 9 * TILE, y: 10 * TILE - 22 }, { x0: 21 * TILE, x1: 26 * TILE, y: 10 * TILE - 22 }, { x0: 12 * TILE, x1: 18 * TILE, y: 7 * TILE - 22 }];
      let landed = false;
      if (this.mcVy > 0) {
        for (const pl of plats) if (this.mcX + 8 > pl.x0 && this.mcX + 8 < pl.x1 && this.mcY >= pl.y && this.mcY - this.mcVy <= pl.y + 1) { this.mcY = pl.y; landed = true; }
        if (!landed && this.mcY >= floorY && this.floorUnder(w)) { this.mcY = floorY; landed = true; }
      }
      if (landed) {
        this.mcVy = 0;
        if (this.t % 70 === 0) { this.mcVy = -5.2; this.mcVx = (p.cx < this.mcX ? -1 : 1) * (1 + Math.random() * 1.2); }
      }
      if (this.mcVy !== 0) this.mcX = Math.max(TILE * 2, Math.min(TILE * 27, this.mcX + (this.mcVx || 0)));
      if (this.mcY > 17 * TILE) { this.mcY = 3 * TILE; this.mcX = 15 * TILE; this.mcVy = 0; }
      if (this.t % (this.half ? 70 : 100) === 0) {
        const dx = p.cx - this.mcX;
        w.spawnProj({ type: 'micBoss', x: this.mcX, y: this.mcY, vx: Math.sign(dx) * 2.2, vy: -2.6, grav: 0.08, life: 240, w: 10, h: 10 });
      }
      // 무대 붕괴
      if (++this.collapse % 100 === 0) {
        const k = Math.floor(this.collapse / 100);
        if (k <= 8) {
          for (const tx of [k, 29 - k]) for (let ty = 14; ty <= 16; ty++) if (tx > 0 && tx < 29) w.level.tiles[ty * w.level.w + tx] = T.EMPTY;
          w.rebuildStatic(); w.shake(4); Sound.play('crumble');
          if (k === 1) w.show.say('scroll', { force: true });
        }
      }
      for (const pl of w.players) this.hurtPlayer(w, pl, { x: this.mcX + 2, y: this.mcY + 2, w: 12, h: 20 });
    }
  }
  floorUnder(w) { const tx = Math.floor((this.mcX + 8) / TILE); return w.level.tile(tx, 14) !== T.EMPTY; }
  weakBoxes() {
    if (this.trans > 0) return [];
    if (this.phase === 1) return [{ x: this.x - 2, y: this.y + this.h - 18, w: 16, h: 18, id: 'leg0' }, { x: this.x + this.w - 14, y: this.y + this.h - 18, w: 16, h: 18, id: 'leg1' }];
    if (this.phase === 3) return [{ x: this.mcX, y: this.mcY, w: 16, h: 22, id: 'mc' }];
    return [];
  }
  onWeakHit(w, id) {
    if (id === 'leg0' || id === 'leg1') { const i = +id[3]; if (this.legCd[i] <= 0) { this.legCd[i] = 20; this.damage(w, 1, this.x + (i ? this.w : 0), this.y + this.h - 10); } }
    if (id === 'mc') this.damage(w, 1, this.mcX + 8, this.mcY + 10);
  }
  // 폭발·부메랑 판정
  explosionHit(w, x, y, r) {
    if (this.phase === 2 && Math.hypot(this.ballX - x, this.ballY - y) < r + 20) this.damage(w, 2, this.ballX, this.ballY);
  }
  boomerangHit(w, pr) {
    if (this.phase === 3 && overlap(pr, { x: this.mcX, y: this.mcY, w: 16, h: 22 })) { if (this.damage(w, 2, this.mcX + 8, this.mcY)) { pr.t = Math.max(pr.t, 26); } }
  }
  draw(g, cam, time) {
    if (this.dead && (time >> 2) & 1) return;
    const fl = this.flash > 0 && (this.flash & 2);
    if (this.phase === 1) {
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
      // 다리 + 추
      for (const [lx, i] of [[x + 6, 0], [x + this.w - 14, 1]]) {
        g.fillStyle = PAL.ink; g.fillRect(lx, y + 52, 8, this.h - 64);
        g.fillStyle = PAL.dgray; g.fillRect(lx + 2, y + 52, 4, this.h - 64);
        g.fillStyle = PAL.ink; g.fillRect(lx - 8, y + this.h - 18, 24, 18);
        g.fillStyle = this.legCd[i] > 0 ? PAL.white : PAL.gold; g.fillRect(lx - 6, y + this.h - 16, 20, 14);
        g.fillStyle = PAL.dgold; g.fillRect(lx - 6, y + this.h - 6, 20, 4);
        if ((time >> 4) & 1) { g.fillStyle = PAL.white; g.fillRect(lx - 3, y + this.h - 14, 3, 3); }
      }
      // 몸통
      g.fillStyle = PAL.ink; g.fillRect(x + 4, y + 30, this.w - 8, 26);
      g.fillStyle = fl ? PAL.white : PAL.dpurple; g.fillRect(x + 6, y + 32, this.w - 12, 22);
      g.fillStyle = PAL.neonp; for (let i = 0; i < 5; i++) g.fillRect(x + 10 + i * 8, y + 40, 4, 4 + ((time >> 3) + i) % 3);
      // 레이저
      if (this.laserOn || this.laserWarn) {
        const ox = x + this.w / 2, oy = y + 28;
        for (let k = 0; k < 2; k++) {
          const a = this.angle + k * Math.PI;
          g.strokeStyle = this.laserOn ? 'rgba(255,79,163,0.9)' : ((time >> 2) & 1 ? 'rgba(254,174,52,0.6)' : 'rgba(0,0,0,0)');
          g.lineWidth = this.laserOn ? 4 : 1; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * 300, oy + Math.sin(a) * 300); g.stroke();
          if (this.laserOn) { g.strokeStyle = PAL.white; g.lineWidth = 1; g.stroke(); }
        }
        g.lineWidth = 1;
      }
      drawBall(g, x + this.w / 2, y + 22, 18, time, fl);
    } else if (this.phase === 2) {
      drawBall(g, Math.round(this.ballX - cam.x), Math.round(this.ballY - cam.y), 20, time, fl);
      if (this.trans > 0) { g.font = '12px Galmuri11'; textOutline(g, '2 라운드!', 240, 120, PAL.yellow, PAL.ink, 'center'); }
    } else {
      const x = Math.round(this.mcX - cam.x), y = Math.round(this.mcY - cam.y);
      if (this.trans > 0) { drawBall(g, Math.round(this.ballX - cam.x), Math.round(this.ballY - cam.y), 20 * (this.trans / 150), time, false); return; }
      // MC 본인 (반짝이 정장)
      g.fillStyle = PAL.ink; g.fillRect(x + 1, y + 6, 14, 16);
      g.fillStyle = fl ? PAL.white : PAL.gold; g.fillRect(x + 2, y + 7, 12, 10);
      g.fillStyle = PAL.slate; g.fillRect(x + 3, y + 17, 4, 4); g.fillRect(x + 9, y + 17, 4, 4);
      g.drawImage(portrait('mc'), x, y - 10);
      g.fillStyle = PAL.ink; g.fillRect(x + 14, y + 8, 2, 6); g.drawImage(itemIcon('mic'), x + 12, y + 2);
    }
  }
}

function drawBall(g, cx, cy, r, time, fl) {
  r = Math.max(2, Math.round(r));
  g.fillStyle = PAL.ink; g.beginPath(); g.arc(cx, cy, r + 1, 0, 6.28); g.fill();
  g.fillStyle = fl ? PAL.white : PAL.silver; g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.clip();
  const o = (time >> 2) % 6;
  for (let yy = -r; yy < r; yy += 5) for (let xx = -r; xx < r; xx += 5) {
    const k = ((xx + yy) / 5 + o) | 0;
    g.fillStyle = k % 3 === 0 ? PAL.white : k % 3 === 1 ? PAL.gray : PAL.dgray;
    g.fillRect(cx + xx + 1, cy + yy + 1, 4, 4);
  }
  g.restore();
  g.fillStyle = PAL.ink; g.fillRect(cx - 1, cy - r - 8, 2, 8);
  if ((time >> 3) & 1) { g.fillStyle = PAL.neonc; g.fillRect(cx - r + 4, cy - 3, 2, 2); g.fillStyle = PAL.neonp; g.fillRect(cx + r - 6, cy + 4, 2, 2); }
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function makeBoss(kind, w, tx, ty) {
  if (kind === 'chef') return new ChefBoss(w, tx, ty);
  if (kind === 'quiz') return new QuizBoss(w, tx, ty);
  return new MirrorBoss(w, tx, ty);
}
export { ItemBox, rand };
