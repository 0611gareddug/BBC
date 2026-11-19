import { TILE, VW, VH, HUD_H, AUD_H, overlap, clamp, PHYS } from '../core/constants.js';
import { Level } from './level.js';
import { T } from './tiledefs.js';
import { FX, Gem, ItemBox, Exit, Checkpoint, Mover, Bumper, Enemy, Projectile, randomItem } from './entities.js';
import { makeBoss } from './boss.js';
import { THEMES, buildStatic, drawDynamicTile, backdrop } from '../gfx/tilegfx.js';
import { PAL, makeCanvas } from '../gfx/sprites.js';
import { Sound } from '../core/audio.js';
import { Show, textOutline, wrap } from './show.js';
import { QUIZ } from '../data/quiz.js';

export const ITEM_USES = { pie: 3, bomb: 2, mic: 99, magnet: 1, cloak: 1, spring: 1 };

export class World {
  constructor(def, opts = {}) {
    this.def = def;
    this.kind = opts.kind || 'story';
    this.level = new Level(def);
    this.theme = THEMES[def.theme || 0];
    this.themeIdx = def.theme || 0;
    this.static = buildStatic(this.level, this.theme);
    this.fx = new FX();
    this.show = new Show({ disco: this.themeIdx === 2 });
    this.players = [];
    this.gems = []; this.boxes = []; this.enemies = []; this.projectiles = []; this.movers = []; this.bumpers = []; this.checks = [];
    this.slickZones = [];
    this.exit = null; this.boss = null;
    this.start = { x: 2 * TILE, y: 12 * TILE };
    this.spawns = []; this.gemSpots = []; this.zoneSpots = []; this.itemSpots = [];
    this.time = 0; this.frozen = false;
    this.cam = { x: 0, y: 0, sx: 0, sy: 0 };
    this.shakeT = 0; this.shakeA = 0; this.flashT = 0;
    this.hooks = opts.hooks || {};
    this.rng = opts.rng || Math.random;
    this.bpm = def.bpm || 120;
    this.beat = { len: 3600 / this.bpm, idx: 0, frac: 0, tick: false, phase: 0 };
    this.needGems = 0;
    this.events = [];
    this.lowFx = false;
    this.scroll = def.scroll ? { ...def.scroll, active: false, done: false } : null;
    this.darkCanvas = def.dark ? makeCanvas(VW, VH) : null;

    for (const e of this.level.entities) {
      const x = e.tx * TILE, y = e.ty * TILE;
      const type = e.type.startsWith('box') ? 'box' : e.type;
      switch (type) {
        case 'start': this.start = { x: x + 3, y: y + 1 }; this.spawns.push({ x: x + 3, y: y + 1 }); break;
        case 'exit': this.exit = new Exit(e.tx, e.ty); break;
        case 'check': this.checks.push(new Checkpoint(e.tx, e.ty)); break;
        case 'gem':
          if (this.kind === 'versus') this.gemSpots.push({ x: x + 3, y: y + 3 });
          else { this.gems.push(new Gem(x + 3, y + 3)); this.needGems++; }
          break;
        case 'gold': this.gems.push(new Gem(x + 3, y + 3, 'gold')); break;
        case 'box': if (this.kind === 'versus') this.itemSpots.push({ x: x + 1, y: y + 1 }); else this.boxes.push(new ItemBox(x + 1, y + 1, e.type.split(':')[1] || null)); break;
        case 'moverH': this.movers.push(new Mover(e.tx, e.ty, 'h')); break;
        case 'moverV': this.movers.push(new Mover(e.tx, e.ty, 'v')); break;
        case 'bumper': this.bumpers.push(new Bumper(e.tx, e.ty)); break;
        case 'boss': this.bossSpawn = { tx: e.tx, ty: e.ty }; break;
        case 'zone': this.zoneSpots.push({ x: x + 8, y: y + 16 }); break;
        default: if (this.kind !== 'versus' && e.type !== 'zone') this.enemies.push(new Enemy(e.type, e.tx, e.ty));
      }
    }
    if (this.kind === 'versus') this.spawns = this.level.entities.filter(e => e.type === 'start').map(e => ({ x: e.tx * TILE + 3, y: e.ty * TILE + 1 }));
    // 퀴즈 표지판 배정
    const used = new Set();
    for (const s of this.level.qsigns) {
      let i; do { i = Math.floor(Math.random() * QUIZ.length); } while (used.has(i) && used.size < QUIZ.length);
      used.add(i); s.quiz = QUIZ[i];
    }
    if (this.level.qsigns.length) {
      for (const st of this.level.dyn) {
        if (st.code !== T.PANEL_O && st.code !== T.PANEL_X) continue;
        let best = null, bd = 1e9;
        for (const s of this.level.qsigns) { const d = Math.abs(s.tx - st.tx); if (d < bd) { bd = d; best = s; } }
        st.fake = best ? (best.quiz.a ? st.code === T.PANEL_X : st.code === T.PANEL_O) : false;
      }
    }
    if (def.boss && this.bossSpawn) this.boss = makeBoss(def.boss, this, this.bossSpawn.tx, this.bossSpawn.ty);
  }

  addPlayer(p, at) {
    const s = at || this.start;
    p.x = s.x; p.y = s.y;
    this.players.push(p);
    return p;
  }

  event(name, data) { this.events.push({ name, data }); this.hooks.event?.(name, data); }
  shake(n) { if (this.hooks.noShake) return; this.shakeT = 12; this.shakeA = Math.max(this.shakeA, n); }
  flashScreen(n) { this.flashT = n; }
  rebuildStatic() { this.static = buildStatic(this.level, this.theme); }
  bossDefeated() { this.hooks.bossDefeated?.(); }
  spawnProj(o) { const p = new Projectile(o); this.projectiles.push(p); return p; }

  explode(x, y, r, owner, noBoss) {
    Sound.play('boom'); this.shake(5);
    this.fx.burst(x, y, PAL.orange, 20, 3); this.fx.burst(x, y, PAL.yellow, 14, 2); this.fx.ring(x, y, PAL.white);
    this.fx.add({ x: x - 1, y: y - 1, vx: 0, vy: 0, life: 6, col: PAL.white, s: Math.round(r), g: 0 });
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + 6) e.hurt(this, 2, Math.sign(e.x - x) * 2);
    for (const p of this.players) {
      if (p.dead || p === owner || p.eliminated) continue;
      if (owner && owner.team === p.team && this.kind === 'versus' && this.hooks.teams) continue;
      if (this.kind === 'story' && owner) continue;
      const d = Math.hypot(p.cx - x, p.cy - y);
      if (d < r + 4) this.hooks.damage(p, 'boom', Math.sign(p.cx - x || 1) * 3.2, -4, owner);
    }
    const lv = this.level;
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = lv.tile(tx, ty);
      if (c === T.CRUMBLE || c === T.TIMER) { const st = lv.st(tx, ty); if (!st.gone) { st.gone = true; st.timer = 0; st.regen = 240; this.fx.burst(tx * TILE + 8, ty * TILE + 8, '#d9a066', 6); } }
    }
    if (this.boss && !noBoss && this.boss.explosionHit) this.boss.explosionHit(this, x, y, r);
    this.event('boom', { x, y });
  }

  useItem(p) {
    const it = p.item;
    if (!it) return;
    let used = true;
    switch (it) {
      case 'pie': this.spawnProj({ type: 'pie', x: p.cx - 4 + p.facing * 6, y: p.y + 2, vx: p.facing * 3.2 + p.vx * 0.3, vy: -2.4, grav: 0.13, w: 8, h: 8, life: 160, owner: p.id, ownerRef: p }); Sound.play('pie'); break;
      case 'bomb': this.spawnProj({ type: 'bomb', x: p.cx - 4, y: p.y, vx: p.facing * 2.6 + p.vx * 0.4, vy: -3.2, grav: 0.18, w: 8, h: 8, life: 200, owner: p.id, ownerRef: p }); Sound.play('item'); break;
      case 'mic':
        if (p.boomerang && !p.boomerang.dead) { used = false; break; }
        p.boomerang = this.spawnProj({ type: 'mic', x: p.cx - 5, y: p.y + 2, vx: p.facing * 3.6, vy: 0, grav: 0, w: 10, h: 10, life: 140, dir: p.facing, owner: p.id, ownerRef: p });
        Sound.play('boomer');
        break;
      case 'magnet': p.magnetT = 480; Sound.play('magnet'); break;
      case 'cloak': p.cloakT = 300; Sound.play('cloak'); this.fx.burst(p.cx, p.cy, PAL.purple, 14); break;
      case 'spring': p.springT = 600; p.springUsed = false; Sound.play('spring'); break;
    }
    if (!used) return;
    p.throwT = 10;
    if (it !== 'mic') { p.itemUses--; if (p.itemUses <= 0) p.item = null; }
    this.event('item', { p: p.id, it });
  }

  giveItem(p, type) {
    p.item = type; p.itemUses = ITEM_USES[type];
    Sound.play('box');
    this.fx.text(p.cx, p.y - 6, ({ pie: '파이!', bomb: '폭죽!', mic: '마이크!', magnet: '자석!', cloak: '망토!', spring: '스프링!' })[type], PAL.lyellow);
  }

  onEnemyDefeated(e) {
    this.hooks.enemyDown?.(e);
    if (e.dropBomb) { const b = new ItemBox(e.x, e.y - 4, 'bomb'); b.fromBoss = true; this.boxes.push(b); }
  }
  onEggLand(pr) {
    const y = Math.ceil((pr.y + pr.h) / TILE) * TILE;
    this.slickZones.push({ x: pr.x - 20, y, w: 48, t: 300 });
    Sound.play('splat'); this.fx.burst(pr.x + 4, pr.y + 6, PAL.lyellow, 8, 1.4);
  }

  /* ───────── 업데이트 ───────── */
  update() {
    this.time++;
    const lv = this.level;
    // 박자
    const b = this.beat;
    const bi = Math.floor(this.time / b.len);
    b.tick = bi !== Math.floor((this.time - 1) / b.len);
    b.idx = bi % 4; b.frac = (this.time / b.len) % 1; b.phase = b.idx;
    if (this.shakeT > 0) { this.shakeT--; if (this.shakeT === 0) this.shakeA = 0; }
    if (this.flashT > 0) this.flashT--;

    this.updateTiles();
    for (const m of this.movers) m.update(this);
    if (!this.frozen) for (const p of this.players) p.update(this);
    else for (const p of this.players) { p.animT++; }
    if (!this.frozen) {
      for (const e of this.enemies) if (!e.dead && this.near(e.x, e.y, 400)) e.update(this);
      if (this.boss) this.boss.update(this);
      for (const pr of this.projectiles) pr.update(this);
      for (const g of this.gems) g.update(this);
      for (const bx of this.boxes) bx.update(this);
      for (const bm of this.bumpers) bm.update(this);
      if (this.exit) this.exit.update();
      this.collide();
    }
    for (let i = this.slickZones.length - 1; i >= 0; i--) if (--this.slickZones[i].t <= 0) this.slickZones.splice(i, 1);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.gems = this.gems.filter(g => !g.dead);
    this.boxes = this.boxes.filter(b => !b.dead);
    this.fx.low = this.lowFx;
    this.fx.update();
    this.show.update();
    this.updateCamera();
  }

  near(x, y, d) {
    for (const p of this.players) if (Math.abs(p.x - x) < d && Math.abs(p.y - y) < d * 0.8) return true;
    return this.kind === 'versus';
  }

  updateTiles() {
    const lv = this.level;
    const b = this.beat;
    for (const st of lv.dyn) {
      switch (st.code) {
        case T.HOT: {
          const t = (this.time + st.phase) % 240;
          st.hot = t < 110; st.warn = t >= 200;
          break;
        }
        case T.JUMP: case T.BUZZER: if (st.anim > 0) st.anim--; break;
        case T.SWITCH: if (st.anim > 0) st.anim--; break;
        case T.CRUMBLE: case T.TIMER: case T.PANEL_O: case T.PANEL_X: {
          if (st.timer > 0) {
            st.timer--;
            if (st.timer === 0) { st.gone = true; st.regen = st.code === T.TIMER ? 180 : st.code === T.CRUMBLE ? 180 : 240; this.fx.burst(st.tx * TILE + 8, st.ty * TILE + 8, st.code === T.CRUMBLE ? '#d9a066' : PAL.yellow, 6, 1.2); }
          } else if (st.gone && st.regen > 0 && st.regen < 99999) {
            st.regen--;
            if (st.regen <= 0) { if (this.tileFree(st.tx, st.ty)) { st.gone = false; st.told = false; } else st.regen = 10; }
          }
          break;
        }
        case T.DOOR: case T.DOOR_OPEN: {
          const want = st.code === T.DOOR ? !lv.redOn : lv.redOn;
          if (want && !st.solid) { if (this.tileFree(st.tx, st.ty)) st.solid = true; }
          else if (!want) st.solid = false;
          break;
        }
        case T.RHY_A: case T.RHY_B: {
          const on = st.code === T.RHY_A ? b.idx !== 3 : b.idx !== 1;
          st.soon = st.code === T.RHY_A ? (b.idx === 2 && b.frac > 0.5) : (b.idx === 0 && b.frac > 0.5);
          if (on && !st.on) { if (this.tileFree(st.tx, st.ty)) st.on = true; } else if (!on) st.on = false;
          break;
        }
        case T.LASER: {
          const i = st.tx % 2;
          const onBeats = i ? [0, 1] : [2, 3];
          st.on = onBeats.includes(b.idx);
          st.warn = !st.on && onBeats.includes((b.idx + 1) % 4) && b.frac > 0.35;
          if (st.on) {
            if (st.beamLen === undefined) {
              let ty = st.ty + 1; while (ty < lv.h && lv.solid(st.tx, ty) !== 1) ty++;
              st.beamLen = (ty - st.ty - 1) * TILE;
            }
            const beam = { x: st.tx * TILE + 5, y: (st.ty + 1) * TILE, w: 6, h: st.beamLen };
            for (const p of this.players) if (!p.dead && p.inv <= 0 && p.cloakT <= 0 && overlap(beam, p)) this.hooks.damage(p, 'laser', p.facing * -2, -3);
            if (b.tick && this.near(st.tx * TILE, st.ty * TILE, 300)) Sound.play('laser');
          }
          break;
        }
      }
    }
  }

  tileFree(tx, ty) {
    const r = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
    for (const p of this.players) if (!p.dead && overlap(r, p)) return false;
    return true;
  }

  collide() {
    const lv = this.level;
    for (const p of this.players) {
      if (p.dead || p.eliminated) continue;
      // 보석
      for (const g of this.gems) {
        if (g.dead) continue;
        if (g.carried === p) { this.hooks.gem(p, g); continue; }
        if (p.magnetT > 0 && g.pickDelay <= 0) {
          const dx = p.cx - (g.x + 5), dy = p.cy - (g.y + 5), d = Math.hypot(dx, dy);
          if (d < 56) { g.x += dx / d * 2.5; g.y += dy / d * 2.5; }
        }
        if (g.pickDelay <= 0 && overlap(p, g)) this.hooks.gem(p, g);
      }
      // 선물 상자
      for (const bx of this.boxes) {
        if (!bx.dead && overlap(p, bx)) {
          bx.dead = true;
          const type = bx.type || randomItem(this.rng);
          this.giveItem(p, type);
          this.fx.burst(bx.x + 7, bx.y + 7, PAL.neonp, 12);
          this.hooks.box?.(p, bx);
        }
      }
      // 체크포인트
      for (const c of this.checks) {
        if (!c.active && overlap(p, c)) {
          for (const o of this.checks) o.active = false;
          c.active = true; this.respawnAt = { x: c.x + 3, y: c.y + 1 }; Sound.play('check'); this.show.say('check'); this.fx.sparkle(c.x + 8, c.y);
        }
      }
      // 출구
      if (this.exit && this.exit.open && overlap(p, { x: this.exit.x + 8, y: this.exit.y + 8, w: 16, h: 24 })) this.hooks.exit?.(p);
      // 적
      for (const e of this.enemies) {
        if (e.dead || !overlap(p, e)) continue;
        if (e.type === 'tomato' || (e.type === 'mole' && !e.up)) continue;
        const stomp = p.vy > 0.5 && p.y + p.h - p.vy <= e.y + 6;
        if (stomp) {
          p.vy = (p.bits & 16) ? -PHYS.jumpV * 0.95 : -PHYS.stompBounce; p.jumping = (p.bits & 16) !== 0;
          Sound.play('stomp');
          e.hurt(this, e.type === 'sauce' ? 1 : 9, 0);
          this.fx.ring(e.x + e.w / 2, e.y, PAL.white);
          this.hooks.stomp?.(p, e);
        } else if (e.dangerous && p.cloakT <= 0 && p.inv <= 0) {
          this.hooks.damage(p, 'enemy', p.cx < e.x + e.w / 2 ? -2.5 : 2.5, -3);
        }
      }
      // 펀치
      const pb = p.punchBox();
      if (pb) {
        for (const e of this.enemies) {
          if (e.dead || p.punchHits.has(e) || !overlap(pb, e)) continue;
          p.punchHits.add(e);
          if (e.type === 'dancer' && e.facing !== p.facing && e.state > 0) { p.vx = -p.facing * 2.5; p.stunT = 10; Sound.play('hit'); continue; }
          if (e.hurt(this, 1, p.facing * 2.5)) { Sound.play('hit'); this.fx.burst(pb.x + pb.w / 2, pb.y + 5, PAL.white, 6); this.hooks.punchEnemy?.(p, e); this.hitStop(); }
        }
        // 스위치
        const x0 = Math.floor(pb.x / TILE), x1 = Math.floor((pb.x + pb.w) / TILE), y0 = Math.floor(pb.y / TILE), y1 = Math.floor((pb.y + pb.h) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          if (lv.tile(tx, ty) === T.SWITCH) {
            const st = lv.st(tx, ty);
            if (!p.punchHits.has(st) && st.anim <= 0) { p.punchHits.add(st); st.anim = 20; lv.setRed(!lv.redOn); Sound.play('switch'); this.event('switch'); this.fx.sparkle(tx * TILE + 8, ty * TILE + 8, PAL.white); }
          }
        }
        // 보스 약점
        if (this.boss && !this.boss.dead) {
          for (const wb of this.boss.weakBoxes()) if (!p.punchHits.has(wb.id) && overlap(pb, wb)) { p.punchHits.add(wb.id); this.boss.onWeakHit(this, wb.id); this.hitStop(); }
        }
        // 물음표 폭탄 되받아치기
        for (const pr of this.projectiles) {
          if (pr.type === 'qbomb' && !pr.reflected && overlap(pb, pr)) { pr.reflected = true; pr.owner = p.id; pr.t = 0; pr.life = 300; Sound.play('hit'); this.fx.ring(pr.x + 4, pr.y + 4, PAL.green); }
        }
        // 대전: 다른 플레이어
        if (this.kind === 'versus') {
          for (const q of this.players) {
            if (q === p || q.dead || q.eliminated || p.punchHits.has(q) || !overlap(pb, q)) continue;
            p.punchHits.add(q);
            this.hooks.punchPlayer?.(p, q);
          }
        }
      }
      // 낙사 판정 (강제 스크롤)
      if (this.scroll && this.scroll.active && !this.scroll.done && p.x < this.cam.x - 6 && !p.dead) this.hooks.fall(p);
    }
    // 투사체
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.owner == null || pr.type === 'qbomb' && !pr.reflected) {
        // 적 투사체 → 플레이어
        for (const p of this.players) {
          if (p.dead || p.inv > 0 || p.eliminated || !overlap(pr, p)) continue;
          if (pr.type === 'qbomb') { pr.dead = true; this.explode(pr.x + 4, pr.y + 4, 24, null, true); this.hooks.damage(p, 'boom', Math.sign(p.cx - pr.x) * 3, -4); break; }
          pr.dead = true;
          this.hooks.damage(p, 'shot', Math.sign(pr.vx || 1) * 2, -2.5);
          this.fx.burst(pr.x + 4, pr.y + 4, pr.type === 'egg' ? PAL.lyellow : PAL.red, 8);
          break;
        }
        continue;
      }
      const owner = pr.ownerRef;
      if (pr.type === 'pie' || pr.type === 'mic') {
        for (const e of this.enemies) {
          if (e.dead || !overlap(pr, e)) continue;
          if (pr.type === 'pie') { e.stunT = 180; pr.dead = true; Sound.play('splat'); this.fx.burst(pr.x + 4, pr.y + 4, PAL.white, 10); break; }
          if (!pr.hitSet) pr.hitSet = new Set();
          if (!pr.hitSet.has(e)) { pr.hitSet.add(e); e.hurt(this, 1, Math.sign(pr.vx || 1) * 2); Sound.play('hit'); }
        }
        if (this.boss && pr.type === 'mic' && this.boss.boomerangHit) this.boss.boomerangHit(this, pr);
        if (this.kind === 'versus' && !pr.dead) {
          for (const q of this.players) {
            if (q.dead || q.eliminated || q === owner || q.inv > 0 || !overlap(pr, q)) continue;
            if (this.hooks.teams && owner && owner.team === q.team) continue;
            if (!pr.hitSet) pr.hitSet = new Set();
            if (pr.hitSet.has(q)) continue;
            pr.hitSet.add(q);
            this.hooks.projHit?.(pr, q);
            if (pr.type === 'pie') { pr.dead = true; break; }
          }
        }
        if (pr.type === 'mic') {
          for (const g of this.gems) if (!g.dead && g.pickDelay <= 0 && overlap(pr, g) && owner && !owner.dead) this.hooks.gem(owner, g);
        }
      }
      if (pr.type === 'bomb' && this.kind === 'versus') {
        for (const q of this.players) if (!q.dead && q !== owner && overlap(pr, q) && pr.t > 6) { pr.dead = true; this.explode(pr.x + 4, pr.y + 4, 34, owner); break; }
      }
    }
  }

  hitStop() { this.hooks.hitStop?.(3); }

  /* ───────── 카메라 ───────── */
  updateCamera() {
    const lv = this.level;
    const c = this.cam;
    if (this.kind === 'versus' || lv.pxW <= VW && lv.pxH <= VH + 2) {
      c.x = Math.max(0, (lv.pxW - VW) / 2); c.y = Math.max(0, lv.pxH - VH);
    } else {
      const alive = this.players.filter(p => !p.eliminated);
      const p = alive[0] || this.players[0];
      if (p) {
        const tx = p.cx - VW / 2 + p.facing * 28;
        const ty = p.cy - VH / 2 - 6;
        c.x += (tx - c.x) * 0.1;
        if (Math.abs(ty - c.y) > 24) c.y += (ty - c.y - Math.sign(ty - c.y) * 24) * 0.12;
      }
      if (this.scroll && !this.scroll.done) {
        const s = this.scroll;
        if (!s.active && p && p.x > s.from * TILE) { s.active = true; s.camX = c.x; this.show.say('scroll', { force: true }); }
        if (s.active) {
          s.camX += s.speed;
          if (c.x < s.camX) c.x = s.camX; else s.camX = c.x;
          if (c.x + VW >= s.to * TILE) { s.done = true; }
        }
      }
      c.x = clamp(c.x, 0, Math.max(0, lv.pxW - VW));
      c.y = clamp(c.y, -HUD_H + 2, Math.max(0, lv.pxH - VH + AUD_H - 4));
    }
    if (this.shakeT > 0) { c.sx = (Math.random() - 0.5) * this.shakeA; c.sy = (Math.random() - 0.5) * this.shakeA; } else { c.sx = 0; c.sy = 0; }
  }

  snapCamera() {
    const p = this.players[0];
    if (!p) return;
    this.cam.x = clamp(p.cx - VW / 2, 0, Math.max(0, this.level.pxW - VW));
    this.cam.y = clamp(p.cy - VH / 2, -HUD_H + 2, Math.max(0, this.level.pxH - VH + AUD_H - 4));
    this.updateCamera();
  }

  /* ───────── 그리기 ───────── */
  draw(g, opts = {}) {
    const cam = { x: Math.round(this.cam.x + this.cam.sx), y: Math.round(this.cam.y + this.cam.sy) };
    const lv = this.level, time = this.time;
    // 배경
    const bg = backdrop(this.themeIdx);
    const off = -Math.round(cam.x * 0.3) % VW;
    g.drawImage(bg, off, 0); g.drawImage(bg, off + VW, 0);
    if (this.themeIdx === 2) this.drawDiscoLights(g, time);
    // 정적 타일
    const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
    const w = Math.min(VW, lv.pxW - sx), h = Math.min(VH, lv.pxH - sy);
    if (w > 0 && h > 0) g.drawImage(this.static, sx, sy, w, h, sx - cam.x, sy - cam.y, w, h);
    // 미끄러운 웅덩이
    for (const z of this.slickZones) { g.fillStyle = 'rgba(254,231,97,0.85)'; g.fillRect(Math.round(z.x - cam.x), Math.round(z.y - cam.y) - 2, z.w, 3); }
    // 동적 타일
    const tx0 = Math.floor(cam.x / TILE) - 1, tx1 = tx0 + VW / TILE + 2, ty0 = Math.floor(cam.y / TILE) - 1, ty1 = ty0 + Math.ceil(VH / TILE) + 2;
    this.updateGhosts(cam);
    for (const st of lv.dyn) {
      if (st.tx < tx0 || st.tx > tx1 || st.ty < ty0 || st.ty > ty1) continue;
      drawDynamicTile(g, st.code, st.tx * TILE - cam.x, st.ty * TILE - cam.y, this.theme, st, time);
    }
    // 레이저 빔
    for (const st of lv.lasers) {
      if (st.tx < tx0 || st.tx > tx1) continue;
      const bx = st.tx * TILE + 5 - cam.x, by = (st.ty + 1) * TILE - cam.y;
      if (st.on && st.beamLen) {
        g.fillStyle = 'rgba(228,59,68,0.45)'; g.fillRect(bx - 2, by, 10, st.beamLen);
        g.fillStyle = PAL.red; g.fillRect(bx, by, 6, st.beamLen); g.fillStyle = PAL.white; g.fillRect(bx + 2, by, 2, st.beamLen);
      } else if (st.warn && (time >> 2) & 1) { g.fillStyle = 'rgba(247,118,34,0.6)'; g.fillRect(bx + 2, by, 2, st.beamLen || 100); }
    }
    if (this.exit) this.exit.draw(g, cam, time);
    for (const c of this.checks) c.draw(g, cam);
    for (const m of this.movers) m.draw(g, cam);
    for (const b of this.bumpers) b.draw(g, cam);
    for (const gm of this.gems) gm.draw(g, cam, time);
    for (const bx of this.boxes) bx.draw(g, cam);
    for (const e of this.enemies) if (e.x > cam.x - 40 && e.x < cam.x + VW + 40) e.draw(g, cam, time);
    if (this.boss) this.boss.draw(g, cam, time);
    if (opts.zone) opts.zone(g, cam);
    for (const p of this.players) p.draw(g, cam, { self: opts.selfId === p.id });
    if (this.kind === 'versus') this.drawNameTags(g, cam);
    for (const pr of this.projectiles) pr.draw(g, cam, time);
    this.fx.draw(g, cam);
    if (this.scroll && this.scroll.active && !this.scroll.done) this.drawCollapse(g, time);
    if (this.darkCanvas) this.drawDark(g, cam, time);
    this.drawSigns(g, cam, time);
    if (this.flashT > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.9, this.flashT / 14)})`; g.fillRect(0, 0, VW, VH); }
  }

  drawDiscoLights(g, time) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(time / 70 + i * 2.1) * 0.5;
      const cx = 80 + i * 160;
      g.fillStyle = ['rgba(255,79,163,0.07)', 'rgba(63,247,217,0.07)', 'rgba(254,174,52,0.06)'][i];
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx + Math.sin(a) * 300 - 50, VH); g.lineTo(cx + Math.sin(a) * 300 + 50, VH); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  spotCones() {
    const out = [];
    for (const s of this.level.spots) {
      const ox = s.tx * TILE + 8, oy = s.ty * TILE + 14;
      const cx = ox + Math.sin(this.time / 70 + s.tx * 0.7) * 72;
      out.push({ ox, oy, cx, by: this.level.pxH });
    }
    return out;
  }
  updateGhosts(cam) {
    const lv = this.level;
    if (!lv.dyn.some(s => s.code === T.GHOST)) return;
    const cones = this.spotCones();
    for (const st of lv.dyn) {
      if (st.code !== T.GHOST) continue;
      const x = st.tx * TILE + 8, y = st.ty * TILE + 8;
      let a = 0;
      for (const c of cones) {
        const t = (y - c.oy) / (c.by - c.oy);
        if (t <= 0) continue;
        const mx = c.ox + (c.cx - c.ox) * (y - c.oy) / 160;
        const hw = 10 + (y - c.oy) * 0.33;
        if (Math.abs(x - mx) < hw) a = 1;
      }
      for (const p of this.players) { const d = Math.hypot(p.cx - x, p.cy - y); if (d < 44) a = Math.max(a, 1 - (d - 24) / 20); }
      st.alpha += (Math.min(1, a) - st.alpha) * 0.25;
    }
  }
  drawDark(g, cam, time) {
    const [dc, dg] = this.darkCanvas;
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, VW, VH);
    dg.fillStyle = 'rgba(4,2,12,0.9)'; dg.fillRect(0, 0, VW, VH);
    dg.globalCompositeOperation = 'destination-out';
    for (const c of this.spotCones()) {
      const ox = c.ox - cam.x, oy = c.oy - cam.y;
      const y1 = VH;
      const mx = ox + (c.cx - c.ox) * (y1 + cam.y - c.oy) / 160;
      const hw = 10 + (y1 + cam.y - c.oy) * 0.33;
      dg.fillStyle = 'rgba(0,0,0,0.8)';
      dg.beginPath(); dg.moveTo(ox - 4, oy); dg.lineTo(ox + 4, oy); dg.lineTo(mx + hw, y1); dg.lineTo(mx - hw, y1); dg.closePath(); dg.fill();
    }
    const hole = (x, y, r, a = 1) => {
      const grd = dg.createRadialGradient(x, y, r * 0.3, x, y, r);
      grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = grd; dg.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const p of this.players) if (!p.dead) hole(p.cx - cam.x, p.cy - cam.y, 64);
    for (const gm of this.gems) hole(gm.x + 5 - cam.x, gm.y + 5 - cam.y, 14, 0.7);
    if (this.exit && this.exit.open) hole(this.exit.x + 16 - cam.x, this.exit.y + 16 - cam.y, 40, 0.8);
    for (const c of this.checks) hole(c.x + 8 - cam.x, c.y + 4 - cam.y, 18, 0.6);
    for (const pr of this.projectiles) hole(pr.x - cam.x, pr.y - cam.y, 12, 0.6);
    for (const e of this.enemies) if (e.type === 'dancer') hole(e.x + 6 - cam.x, e.y - cam.y, 16, 0.4);
    g.drawImage(dc, 0, 0);
    // 조명 줄기 빛
    g.globalCompositeOperation = 'lighter';
    for (const c of this.spotCones()) {
      const ox = c.ox - cam.x, oy = c.oy - cam.y, y1 = VH;
      const mx = ox + (c.cx - c.ox) * (y1 + cam.y - c.oy) / 160, hw = 10 + (y1 + cam.y - c.oy) * 0.33;
      g.fillStyle = 'rgba(254,231,97,0.08)';
      g.beginPath(); g.moveTo(ox - 4, oy); g.lineTo(ox + 4, oy); g.lineTo(mx + hw, y1); g.lineTo(mx - hw, y1); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  drawCollapse(g, time) {
    const w = 10;
    for (let y = 0; y < VH; y += 6) {
      const o = ((y * 13 + time * 3) % 9);
      g.fillStyle = (y / 6 + (time >> 2)) % 2 ? '#2a0f3a' : '#0b0716';
      g.fillRect(0, y, w + o, 6);
      if ((y + time) % 5 === 0) { g.fillStyle = PAL.neonp; g.fillRect(w + o, y + 2, 3, 1); }
    }
  }

  drawSigns(g, cam, time) {
    const lv = this.level;
    const p = this.players[0];
    if (!p) return;
    g.font = '10px Galmuri9';
    for (const s of lv.qsigns) {
      const sx = s.tx * TILE + 8, sy = s.ty * TILE;
      if (Math.abs(p.cx - sx) > 72 || Math.abs(p.cy - sy) > 60) continue;
      const lines = wrap(g, 'Q. ' + s.quiz.q, 170);
      const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 14, bh = lines.length * 12 + 18;
      const bx = Math.round(sx - cam.x - bw / 2), by = Math.round(sy - cam.y - bh - 10);
      g.fillStyle = PAL.ink; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle = PAL.lyellow; g.fillRect(bx, by, bw, bh);
      g.fillStyle = PAL.ink; g.fillRect(bx + bw / 2 - 3, by + bh + 1, 6, 3);
      lines.forEach((l, i) => { g.fillStyle = PAL.ink; g.fillText(l, bx + 7, by + 12 + i * 12); });
      g.fillStyle = PAL.blue; g.fillText('O', bx + 7, by + bh - 4); g.fillStyle = PAL.red; g.fillText('X', bx + bw - 14, by + bh - 4);
      g.fillStyle = PAL.dgray; g.fillText('?', bx + bw / 2 - 2, by + bh - 4);
    }
    // 핑크 힌트
    for (const h of lv.hints) {
      const hx = h.tx * TILE + 8, hy = h.ty * TILE + 8;
      const d = Math.hypot(p.cx - hx, p.cy - hy);
      if (d < 22 && !h.shown) { h.shown = true; if (h.text) this.show.tip(h.text, Math.max(220, h.text.length * 7)); }
      if (d > 80) h.shown = false;
    }
  }

  drawNameTags(g, cam) {
    g.font = '8px Galmuri9'; g.textAlign = 'center';
    for (const p of this.players) {
      if (p.dead || p.eliminated) continue;
      if (p.cloakT > 0) continue;
      const x = Math.round(p.cx - cam.x), y = Math.round(p.y - cam.y - 14);
      const nm = p.name.slice(0, 8);
      const w = Math.ceil(g.measureText(nm).width) + 6;
      g.fillStyle = 'rgba(11,11,20,0.7)'; g.fillRect(x - w / 2, y - 8, w, 10);
      g.fillStyle = p.color; g.fillRect(x - w / 2, y + 2, w, 1);
      g.fillStyle = PAL.white; g.fillText(nm, x, y);
      g.fillStyle = p.color; g.fillRect(x - 1, y + 3, 3, 2);
      if (p.say && p.say.t > 0) {
        p.say.t--;
        const tw = Math.min(150, Math.ceil(g.measureText(p.say.text).width) + 8);
        const bx = Math.max(2, Math.min(VW - tw - 2, x - tw / 2)), by = y - 22;
        g.fillStyle = PAL.ink; g.fillRect(bx - 1, by - 1, tw + 2, 13);
        g.fillStyle = PAL.white; g.fillRect(bx, by, tw, 11);
        g.fillStyle = PAL.ink; g.fillRect(x - 1, by + 11, 3, 2);
        g.save(); g.beginPath(); g.rect(bx, by, tw, 11); g.clip();
        g.fillText(p.say.text, bx + tw / 2, by + 9); g.restore();
      }
    }
    g.textAlign = 'left';
  }
}
