// 온라인 참가자 화면: 방장 기기의 판정을 받아 그리고, 내 캐릭터는 즉시 움직임(예측)
import { World } from '../game/world.js';
import { Player } from '../game/player.js';
import { Gem, ItemBox, Projectile } from '../game/entities.js';
import { Input, B } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { Save } from '../core/save.js';
import { VERSUS_MAPS } from '../data/levels.js';
import { drawVersusScene } from './versus.js';
import { Countdown } from './common.js';
import { ITEMS, FRAME_NAMES, PAL } from '../gfx/sprites.js';
import { lerp } from '../core/constants.js';

export class ClientMode {
  constructor(app, cfg) {
    this.app = app; this.net = cfg.net; this.myId = cfg.myId;
    this.kind = 'client';
    this.roster = cfg.players; this.settings = cfg.settings;
    this.view = { tl: cfg.settings.time * 60, rule: cfg.settings.rule, winsNeed: { 1: 1, 3: 2, 5: 3 }[cfg.settings.rounds] || 2, players: [] };
    this.seq = 0; this.hist = []; this.jc = 0; this.pc = 0; this.ic = 0; this.prev = 0;
    this.buildMap(cfg.map);
    this.offs = [
      this.net.on('s', (m) => this.onSnap(m)),
      this.net.on('round', (m) => this.buildMap(m.map)),
      this.net.on('end', (m) => this.onEnd(m)),
      this.net.on('hostLeft', () => this.lost('방장이 방송을 종료했어요.')),
      this.net.on('_close', () => this.lost('방장과의 연결이 끊어졌어요.')),
    ];
    Sound.music('versus');
    this.touchWant = 'solo';
    this.app.touch(true, 'solo');
  }
  buildMap(mapIdx) {
    const def = VERSUS_MAPS[mapIdx];
    this.world = new World(def, { kind: 'versus', hooks: { damage() {}, fall() {}, respawn() {}, gem() {}, noShake: !Save.data.settings.shake } });
    this.others = new Map();
    for (const r of this.roster) {
      const p = new Player({ id: r.id, name: r.name, look: r.look, team: r.team });
      p.color = r.color || '#e43b44';
      this.world.addPlayer(p, this.world.spawns[0]);
      if (r.id === this.myId) this.me = p; else this.others.set(r.id, p);
      p.tx = p.x; p.ty = p.y;
    }
    this.world.frozen = true;
    this.count = new Countdown({ curtain: false, label: '시작!' });
    this.hist = [];
    this.gotSnap = false;
  }
  lost(msg) {
    if (this.ended) return;
    this.ended = true;
    this.app.touch(false);
    this.app.ui.alert(msg, () => this.app.leaveVersus());
  }
  onEnd(m) {
    if (this.ended) return;
    this.ended = true;
    this.app.touch(false);
    Sound.music('lobby');
    this.app.ui.versusResult(m.result, { quit: () => this.app.leaveVersus(), online: true, client: true });
  }
  onSnap(m) {
    const w = this.world;
    this.view = m.v;
    this.state = m.st;
    if (!this.gotSnap) { this.gotSnap = true; this.count.t = m.ct; }
    w.frozen = m.st !== 'play';
    // 플레이어
    for (const a of m.p) {
      const [id, x, y, vx, vy, fl, fr, it, seq, blind, cloak, inv, deadT, mag, spr] = a;
      const p = id === this.myId ? this.me : this.others.get(id);
      if (!p) continue;
      p.facing = fl & 1 ? 1 : -1;
      const wasDead = p.dead;
      p.dead = !!(fl & 4); p.eliminated = !!(fl & 8); p.win = !!(fl & 16);
      p.deadT = deadT; p.item = it >= 0 ? ITEMS[it] : null; p.blindT = blind; p.cloakT = cloak; p.inv = inv;
      p.magnetT = mag ? 10 : 0; p.springT = spr ? 10 : 0;
      p.netFrame = FRAME_NAMES[fr];
      if (p === this.me) {
        if (p.dead || wasDead) { p.x = x; p.y = y; p.vx = vx; p.vy = vy; this.hist = []; continue; }
        // 예측 보정
        const h = this.hist.find(e => e.s === seq);
        if (h) {
          const ex = x - h.x, ey = y - h.y;
          if (Math.abs(ex) > 40 || Math.abs(ey) > 40) { p.x += ex; p.y += ey; for (const e of this.hist) { e.x += ex; e.y += ey; } }
          else if (Math.abs(ex) > 1 || Math.abs(ey) > 1) { const k = 0.25; p.x += ex * k; p.y += ey * k; for (const e of this.hist) { e.x += ex * k; e.y += ey * k; } }
          this.hist = this.hist.filter(e => e.s > seq);
        } else if (Math.abs(x - p.x) > 64 || Math.abs(y - p.y) > 64) { p.x = x; p.y = y; }
      } else {
        p.tx = x; p.ty = y; p.vx = vx; p.vy = vy;
        if (Math.abs(p.tx - p.x) > 80 || Math.abs(p.ty - p.y) > 80) { p.x = x; p.y = y; }
      }
    }
    // 보석·상자·투사체
    w.gems = m.g.map(([x, y, red, blink]) => { const g = new Gem(x, y, red ? 'red' : 'gem'); g.bob = (x + y) * 0.1; if (blink) g.life = 60; return g; });
    w.boxes = m.b.map(([x, y]) => { const b = new ItemBox(x, y, null); b.t = (x * 3) % 100; return b; });
    w.projectiles = m.pr.map(([type, x, y, t, refl]) => { const p = new Projectile({ type, x, y, t, reflected: !!refl, w: 8, h: 8 }); return p; });
    // 이벤트
    for (const e of m.ev || []) {
      if (e.k === 'snd') Sound.play(e.n, e.p);
      else if (e.k === 'mc') { /* 자막은 아래에서 동기화 */ }
      else if (e.k === 'crowd') w.show.crowdReact(e.r);
      else if (e.k === 'boom') { w.fx.burst(e.x, e.y, PAL.orange, 18, 3); w.fx.ring(e.x, e.y, PAL.white); Sound.play('boom'); w.shake(5); }
      else if (e.k === 'fx') w.fx.burst(e.x, e.y, PAL.white, 8);
      else if (e.k === 'knock' && e.id === this.myId) { this.me.vx = e.vx; this.me.vy = e.vy; this.me.stunT = 18; this.app.vibrate(30); }
    }
    if (m.sub && (!w.show.sub || w.show.sub.text !== m.sub.text)) w.show.line(m.sub.who, m.sub.text, m.sub.t);
    if (m.rc && w.show.react !== m.rc) w.show.crowdReact(m.rc, false);
  }
  update() {
    const w = this.world;
    const bits = Input.read('solo') & ~B.PAUSE;
    const pressed = bits & ~this.prev; this.prev = bits;
    if (pressed & B.J) this.jc = (this.jc + 1) & 255;
    if (pressed & B.P) this.pc = (this.pc + 1) & 255;
    if (pressed & B.I) this.ic = (this.ic + 1) & 255;
    this.seq++;
    this.net.toHost({ t: 'i', b: bits, s: this.seq, jc: this.jc, pc: this.pc, ic: this.ic });
    if (!this.gotSnap) return;
    this.count.update();
    w.time++;
    const b = w.beat; const bi = Math.floor(w.time / b.len); b.tick = bi !== Math.floor((w.time - 1) / b.len); b.idx = bi % 4;
    w.updateTiles();
    // 내 캐릭터 예측
    const me = this.me;
    if (me && !me.dead && !me.eliminated && !w.frozen) {
      const item = me.item;
      me.item = null; // 아이템 사용은 방장이 판정
      me.setInput(bits);
      me.update(w);
      me.item = item;
      this.hist.push({ s: this.seq, x: me.x, y: me.y });
      if (this.hist.length > 120) this.hist.shift();
    } else if (me) { me.animT++; }
    // 다른 참가자 보간
    for (const p of this.others.values()) {
      p.tx += p.vx; p.ty += p.vy * 0.5;
      p.x = lerp(p.x, p.tx, 0.35); p.y = lerp(p.y, p.ty, 0.35);
      p.animT++;
      p.onGround = true;
    }
    for (const g of w.gems) g.bob += 0.07;
    for (const bx of w.boxes) bx.t++;
    for (const pr of w.projectiles) pr.t++;
    w.fx.update(); w.show.update(); w.updateCamera();
  }
  draw(g) {
    const w = this.world;
    // 다른 참가자는 방장이 보낸 프레임으로 그림
    const saved = [];
    for (const p of this.others.values()) { saved.push([p, p.frameName]); const f = p.netFrame; p.frameName = () => f || 'idle0'; }
    drawVersusScene(g, w, this.view.players ? this.view : { ...this.view, players: [] }, { selfId: this.myId, blind: this.me?.blindT, net: { ping: this.net.ping } });
    for (const [p] of saved) delete p.frameName;
    this.count.draw(g);
    if (!this.gotSnap) {
      g.font = '12px Galmuri11'; g.fillStyle = PAL.white; g.textAlign = 'center'; g.fillText('방장의 화면을 기다리는 중…', 240, 140); g.textAlign = 'left';
    }
  }
  exit() { this.app.touch(false); this.offs.forEach(f => f()); }
}
