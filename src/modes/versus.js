import { World } from '../game/world.js';
import { Player, TEAM_COLORS } from '../game/player.js';
import { Gem, ItemBox, randomItem } from '../game/entities.js';
import { Input, B } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { Save } from '../core/save.js';
import { VERSUS_MAPS } from '../data/levels.js';
import { drawVersusHud, drawBanner } from '../game/hud.js';
import { Countdown } from './common.js';
import { TILE, VW, VH, makeRng } from '../core/constants.js';
import { PAL, ITEMS, FRAME, FRAME_NAMES } from '../gfx/sprites.js';
import { textOutline } from '../game/show.js';

export const RULES = { gems: '보석 쟁탈전', zone: '영역 차지', survival: '서바이벌' };
const ZONE_GOAL = 60 * 60;
const SNAP_EVERY = 3;

export function zoneRect(spot) { return { x: spot.x - 24, y: spot.y - 40, w: 48, h: 40 }; }

// 대전 화면 공통 그리기 (호스트·참가자 모두 사용)
export function drawVersusScene(g, world, view, opts = {}) {
  world.draw(g, {
    selfId: opts.selfId,
    zone: (g2, cam) => {
      if (view.zone) {
        const z = view.zone, x = z.x - cam.x, y = z.y - cam.y;
        const own = view.zoneOwner;
        g2.globalCompositeOperation = 'lighter';
        g2.fillStyle = own != null ? hexA(own, 0.22) : 'rgba(254,231,97,0.16)';
        g2.beginPath(); g2.moveTo(x + z.w / 2 - 6, 0); g2.lineTo(x + z.w / 2 + 6, 0); g2.lineTo(x + z.w, y + z.h); g2.lineTo(x, y + z.h); g2.closePath(); g2.fill();
        g2.globalCompositeOperation = 'source-over';
        g2.strokeStyle = own || PAL.lyellow; g2.setLineDash([3, 3]); g2.lineDashOffset = -world.time / 4;
        g2.strokeRect(x + 0.5, y + 0.5, z.w - 1, z.h - 1); g2.setLineDash([]);
        g2.fillStyle = own || PAL.lyellow; g2.fillRect(x, y + z.h - 2, z.w, 2);
      }
      if (view.wallL > 0 || view.wallR > 0) {
        for (const [x0, w] of [[0, view.wallL], [VW - view.wallR, view.wallR]]) {
          if (w <= 0) continue;
          for (let y = 0; y < VH; y += 6) {
            g2.fillStyle = ((y / 6) + (world.time >> 2)) % 2 ? '#2a0f3a' : '#3e1458';
            g2.fillRect(x0, y, w, 6);
          }
          g2.fillStyle = PAL.neonp; g2.fillRect(x0 === 0 ? w - 2 : x0, 0, 2, VH);
        }
      }
    },
  });
  world.show.drawAudience(g);
  world.show.drawSubtitle(g);
  drawVersusHud(g, view, world.time);
  if (view.banner) drawBanner(g, view.banner, view.bannerSub, world.time, view.bannerCol || PAL.lyellow);
  if (opts.blind) {
    g.globalAlpha = Math.min(1, opts.blind / 60) * 0.88; g.fillStyle = '#f4efe6';
    g.beginPath(); g.ellipse(VW / 2 + 30, VH / 2, 130, 80, 0.3, 0, 6.28); g.fill(); g.globalAlpha = 1;
  }
  if (opts.net) {
    g.font = '8px Galmuri9'; g.fillStyle = opts.net.ping > 150 ? PAL.orange : PAL.gray;
    g.fillText(`${opts.net.ping | 0}ms`, VW - 34, 28);
  }
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

export class VersusMode {
  // cfg: { settings:{rule,map,time,rounds,items,teams}, players:[{id,name,look,team,input:'p1'|'p2'|'solo'|'net', peer}], net, seed }
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg; this.net = cfg.net || null;
    this.kind = 'versus';
    this.settings = cfg.settings;
    this.winsNeed = { 1: 1, 3: 2, 5: 3 }[this.settings.rounds] || 2;
    this.round = 0;
    this.roster = cfg.players.map((p, i) => ({ ...p, wins: 0, color: this.settings.teams ? TEAM_COLORS[p.team % 2] : TEAM_COLORS[i % 4] }));
    this.rng = makeRng(cfg.seed || (Date.now() & 0xffffff));
    this.netInputs = new Map();
    this.startRound();
    const locals = this.roster.filter(r => r.input === 'p1' || r.input === 'p2');
    this.touchWant = locals.length >= 2 ? 'split' : 'solo';
    this.app.touch(true, this.touchWant);
    Sound.music('versus');
    if (this.net) this.bindNet();
  }

  bindNet() {
    this.offs = [
      this.net.on('i', (m, conn) => {
        const r = this.roster.find(x => x.peer === conn.peer);
        if (r) this.netInputs.set(r.id, m);
      }),
      this.net.on('chat', (m, conn) => this.app.relayChat?.(m, conn)),
      this.net.on('leave', (m, conn) => this.dropPeer(conn.peer)),
      this.net.on('_close', (m, conn) => this.dropPeer(conn.peer)),
    ];
  }
  dropPeer(peer) {
    const r = this.roster.find(x => x.peer === peer);
    if (!r || r.left) return;
    r.left = true;
    const p = this.world.players.find(q => q.id === r.id);
    if (p) { p.eliminated = true; p.dead = true; }
    this.world.show.line('mc', `${r.name} 님이 방송에서 나갔어요!`, 160);
    if (this.roster.filter(x => !x.left).length < 2) this.endMatch(true);
  }

  startRound() {
    this.round++;
    const s = this.settings;
    const mapIdx = this.round === 1 && this.cfg.firstMap != null ? this.cfg.firstMap : s.map >= 0 ? s.map : Math.floor(this.rng() * VERSUS_MAPS.length);
    this.mapIdx = mapIdx;
    const def = VERSUS_MAPS[mapIdx];
    const hooks = {
      damage: (p, src, kx, ky, by) => this.damage(p, src, kx, ky, by),
      fall: (p) => this.fall(p),
      respawn: (p) => this.respawn(p),
      gem: (p, g) => this.gem(p, g),
      punchPlayer: (a, b) => this.punchPlayer(a, b),
      projHit: (pr, q) => this.projHit(pr, q),
      teams: s.teams,
      hitStop: () => {},
      event: (name, data) => { if (name === 'boom') this.ev({ k: 'boom', x: data.x | 0, y: data.y | 0 }); },
      noShake: !Save.data.settings.shake,
    };
    this.world = new World(def, { kind: 'versus', hooks, rng: this.rng });
    this.world.hooks.noShake = !Save.data.settings.shake;
    const spawns = this.shuffle(this.world.spawns.slice());
    this.roster.forEach((r, i) => {
      const p = new Player({ id: r.id, name: r.name, look: r.look, team: s.teams ? r.team : r.id, color: s.teams ? r.team % 2 : i % 4 });
      p.color = r.color;
      p.lives = 3; p.gems = 0; p.zoneTime = 0;
      if (r.left) { p.eliminated = true; p.dead = true; }
      this.world.addPlayer(p, spawns[i % spawns.length]);
      p.input = r.input;
      p.inv = 60;
    });
    this.timeLeft = s.time * 60;
    this.elapsed = 0;
    this.state = 'intro';
    this.world.frozen = true;
    this.count = new Countdown({ curtain: this.round === 1, label: '시작!' });
    this.zoneIdx = 0; this.zoneMoveT = 30 * 60; this.zone = s.rule === 'zone' ? zoneRect(this.world.zoneSpots[0]) : null;
    this.wallL = 0; this.wallR = 0;
    this.itemT = 15 * 60; this.gemT = 0;
    this.leader = null; this.banner = null; this.endT = 0;
    this.events = []; this.snapT = 0;
    if (s.rule === 'gems') for (let i = 0; i < 5; i++) this.spawnGem();
    this.netEvents = [];
    if (this.net) this.net.broadcast({ t: 'round', round: this.round, map: mapIdx, roster: this.roster.map(r => ({ id: r.id, wins: r.wins, color: r.color })) });
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  ev(e) { this.events.push(e); }

  spawnGem() {
    const spots = this.world.gemSpots;
    if (!spots.length) return;
    const free = spots.filter(s => !this.world.gems.some(g => Math.abs(g.x - s.x) < 8 && Math.abs(g.y - s.y) < 8));
    if (!free.length) return;
    const s = free[Math.floor(this.rng() * free.length)];
    const last = this.timeLeft <= 30 * 60;
    const g = new Gem(s.x, s.y, last ? 'red' : 'gem'); g.value = last ? 2 : 1;
    this.world.gems.push(g);
    this.world.fx.sparkle(s.x + 5, s.y + 5, last ? PAL.neonp : PAL.teal);
  }
  dropGems(p, frac = 0.3) {
    if (this.settings.rule !== 'gems' || p.gems <= 0) return;
    const n = Math.max(1, Math.floor(p.gems * frac));
    p.gems -= n;
    for (let i = 0; i < n; i++) {
      const g = new Gem(p.cx - 5, p.y, 'gem');
      g.phys = true; g.vx = (this.rng() - 0.5) * 4; g.vy = -2 - this.rng() * 2.5; g.pickDelay = 30; g.life = 600;
      this.world.gems.push(g);
    }
    Sound.play('hurt'); this.ev({ k: 'snd', n: 'hurt' });
  }

  /* ── 훅 ── */
  damage(p, src, kx, ky, by) {
    if (p.dead || p.inv > 0 || this.state !== 'play') return;
    if (src === 'spike' || src === 'wall') { this.fall(p, src); return; }
    p.vx = kx; p.vy = ky; p.stunT = 18; p.inv = 50; p.jumping = false; p.onGround = false;
    this.dropGems(p);
    this.world.fx.burst(p.cx, p.cy, PAL.red, 8);
    this.ev({ k: 'knock', id: p.id, vx: kx, vy: ky });
    this.ev({ k: 'snd', n: 'hit' }); Sound.play('hit');
  }
  fall(p, src) {
    if (p.dead || this.state !== 'play') return;
    const w = this.world;
    Sound.play('fall'); this.ev({ k: 'snd', n: 'fall' });
    if (this.settings.rule === 'survival') {
      p.lives--;
      if (p.lives <= 0) { p.eliminated = true; p.dead = true; w.show.say('ko', { force: true }); w.show.crowdReact('cheer'); this.ev({ k: 'mc', key: 'ko' }); return; }
    }
    if (this.settings.rule === 'gems' && p.gems > 0) p.gems -= Math.max(1, Math.floor(p.gems * 0.3));
    p.dead = true; p.deadT = 60;
    w.show.crowdReact('oh', false); this.ev({ k: 'crowd', r: 'oh' });
  }
  respawn(p) {
    const sp = this.world.spawns;
    let s = sp[Math.floor(this.rng() * sp.length)];
    if (this.settings.rule === 'survival' && (this.wallL > 0 || this.wallR > 0)) s = { x: VW / 2 - 5, y: 4 * TILE };
    p.reset(); p.x = s.x; p.y = s.y; p.inv = 120; p.dead = false;
  }
  gem(p, g) {
    g.dead = true;
    if (this.settings.rule !== 'gems') return;
    p.gems += g.value || 1;
    Sound.play('gem', Math.min(10, p.gems)); this.ev({ k: 'snd', n: 'gem', p: Math.min(10, p.gems) });
    this.world.fx.sparkle(g.x + 5, g.y + 5);
  }
  punchPlayer(a, b) {
    if (this.settings.teams && a.team === b.team) return;
    if (b.inv > 0) return;
    const w = this.world;
    b.vx = a.facing * 3.4; b.vy = -3.2; b.stunT = 22; b.inv = 40; b.jumping = false; b.onGround = false;
    Sound.play('hit'); w.shake(3); w.fx.burst(b.cx, b.cy, PAL.white, 10);
    this.ev({ k: 'knock', id: b.id, vx: b.vx, vy: b.vy }); this.ev({ k: 'snd', n: 'hit' }); this.ev({ k: 'fx', x: b.cx | 0, y: b.cy | 0 });
    this.dropGems(b);
    w.show.addHype(5);
    if (this.rng() < 0.25) { w.show.say('ko'); this.ev({ k: 'mc', key: 'ko' }); }
  }
  projHit(pr, q) {
    const w = this.world;
    if (pr.type === 'pie') {
      q.blindT = 180; q.vx = Math.sign(pr.vx || 1) * 1.5; q.stunT = 10;
      Sound.play('splat'); this.ev({ k: 'snd', n: 'splat' });
      w.show.say('pieHit'); this.ev({ k: 'mc', key: 'pieHit' });
      w.fx.burst(q.cx, q.cy, PAL.white, 12);
    } else {
      this.damage(q, 'shot', Math.sign(pr.vx || 1) * 2.6, -3);
    }
  }

  /* ── 점수 ── */
  valueOf(p) { const r = this.settings.rule; return r === 'gems' ? p.gems : r === 'zone' ? Math.floor(p.zoneTime / 60) : p.lives; }
  standings() {
    const ps = this.world.players.filter(p => !this.roster.find(r => r.id === p.id)?.left);
    if (this.settings.teams) {
      const teams = {};
      for (const p of ps) { teams[p.team] ??= { team: p.team, val: 0, alive: false }; teams[p.team].val += this.settings.rule === 'zone' ? p.zoneTime : this.settings.rule === 'survival' ? p.lives : p.gems; if (!p.eliminated) teams[p.team].alive = true; }
      return Object.values(teams).sort((a, b) => b.val - a.val);
    }
    return ps.map(p => ({ id: p.id, val: this.settings.rule === 'zone' ? p.zoneTime : this.settings.rule === 'survival' ? p.lives : p.gems, alive: !p.eliminated })).sort((a, b) => b.val - a.val);
  }

  endRound(reason) {
    if (this.state !== 'play') return;
    this.state = 'roundEnd'; this.endT = 0; this.world.frozen = true;
    const st = this.standings();
    let winner = null;
    if (this.settings.rule === 'survival') {
      const alive = st.filter(s => s.alive);
      if (alive.length === 1) winner = alive[0];
      else if (st.length && (st.length < 2 || st[0].val > st[1].val)) winner = st[0];
    } else if (st.length && (st.length < 2 || st[0].val > st[1].val)) winner = st[0];
    let text = '무승부!', sub = '이번 판은 승자가 없어요';
    let col = PAL.white;
    if (winner) {
      if (this.settings.teams) {
        for (const r of this.roster) if (r.team === winner.team) r.wins++;
        text = (winner.team % 2 === 0 ? '빨강 팀' : '파랑 팀') + ' 승리!'; col = TEAM_COLORS[winner.team % 2];
      } else {
        const r = this.roster.find(x => x.id === winner.id); r.wins++;
        text = r.name + ' 승리!'; col = r.color;
      }
      sub = `${this.round}라운드 · ${reason || ''}`;
    }
    this.banner = text; this.bannerSub = sub; this.bannerCol = col;
    for (const p of this.world.players) if (winner && (this.settings.teams ? p.team === winner.team : p.id === winner.id)) p.win = true;
    this.world.show.say('roundWin', { force: true }); this.world.show.crowdReact('cheer');
    this.ev({ k: 'mc', key: 'roundWin' }); this.ev({ k: 'crowd', r: 'cheer' });
    Sound.play('exit');
  }
  endMatch(abort) {
    if (this.state === 'matchEnd') return;
    this.state = 'matchEnd';
    const list = this.roster.filter(r => !r.left || abort).map(r => ({ name: r.name, wins: r.wins, color: r.color, team: r.team, look: r.look, id: r.id }));
    list.sort((a, b) => b.wins - a.wins);
    const result = { list, teams: this.settings.teams, rule: this.settings.rule, abort: !!abort };
    if (this.net) { this.sendSnap(true); this.net.broadcast({ t: 'end', result }); }
    Sound.music('lobby');
    this.app.touch(false);
    this.app.ui.versusResult(result, {
      again: () => this.app.restartVersus(this.cfg),
      quit: () => this.app.leaveVersus(),
      online: !!this.net,
    });
  }

  /* ── 업데이트 ── */
  readInputs() {
    for (const p of this.world.players) {
      if (p.input === 'net') {
        const m = this.netInputs.get(p.id);
        if (!m) { p.setInput(0); continue; }
        p.setInput(m.b | 0);
        let extra = 0;
        if (m.jc !== p.lastJc) { if (p.lastJc !== undefined) extra |= B.J; p.lastJc = m.jc; }
        if (m.pc !== p.lastPc) { if (p.lastPc !== undefined) extra |= B.P; p.lastPc = m.pc; }
        if (m.ic !== p.lastIc) { if (p.lastIc !== undefined) extra |= B.I; p.lastIc = m.ic; }
        p.pressed |= extra;
        p.lastSeq = m.s | 0;
      } else if (p.input) {
        p.setInput(Input.read(p.input));
      }
    }
  }
  pause() {
    if (this.net || this.state === 'matchEnd') return;
    this.paused = true; this.app.touch(false);
    this.app.ui.pause({
      resume: () => { this.paused = false; this.app.touch(true, this.touchWant); },
      retry: () => { this.paused = false; this.app.restartVersus(this.cfg); },
      quit: () => { this.paused = false; this.app.leaveVersus(); },
    }, true);
  }
  update() {
    if (this.paused) return;
    const w = this.world, s = this.settings;
    // 일시정지 (로컬만)
    const pb = Input.keyBits('solo') & B.PAUSE;
    if (pb && !this.prevPause) { this.prevPause = pb; this.pause(); return; }
    this.prevPause = pb;
    this.readInputs();
    if (this.state === 'intro') {
      this.count.update();
      if (this.count.playing) { this.state = 'play'; w.frozen = false; if (this.round === 1) { w.show.say('vsStart', { force: true }); this.ev({ k: 'mc', key: 'vsStart' }); } }
    } else if (this.state === 'play') {
      this.count.update();
      this.timeLeft--; this.elapsed++;
      if (s.rule === 'gems') {
        if (++this.gemT >= 75) { this.gemT = 0; if (w.gems.filter(g => !g.phys).length < 6) this.spawnGem(); }
        if (this.timeLeft === 30 * 60) { w.show.say('last30', { force: true }); this.ev({ k: 'mc', key: 'last30' }); Sound.tempo(1.1); }
      }
      if (s.rule === 'zone') this.updateZone();
      if (s.rule === 'survival') this.updateSurvival();
      if (s.items && --this.itemT <= 0) {
        this.itemT = 15 * 60;
        if (w.boxes.length < 2 && w.itemSpots.length) {
          const sp = w.itemSpots[Math.floor(this.rng() * w.itemSpots.length)];
          const bx = new ItemBox(sp.x, sp.y - 30, null); bx.drop = 30; bx.type = randomItem(this.rng);
          w.boxes.push(bx);
        }
      }
      // 선두 변화
      const st = this.standings();
      if (st.length > 1 && st[0].val > st[1].val) {
        const lead = s.teams ? 't' + st[0].team : st[0].id;
        if (this.leader != null && lead !== this.leader && this.elapsed > 600) { w.show.say('reverse'); w.show.crowdReact('oh'); this.ev({ k: 'mc', key: 'reverse' }); }
        this.leader = lead;
      }
      if (this.timeLeft <= 0) this.endRound('시간 종료');
      if (s.rule === 'survival') {
        const alive = st.filter(x => x.alive);
        if (alive.length <= 1 && st.length > 1) this.endRound('최후의 생존자');
      }
      if (s.rule === 'zone' && w.players.some(p => p.zoneTime >= ZONE_GOAL)) this.endRound('60초 점령');
    } else if (this.state === 'roundEnd') {
      this.endT++;
      if (this.endT === 200) {
        const top = Math.max(...this.roster.map(r => r.wins));
        if (top >= this.winsNeed || this.round >= this.settings.rounds * 2) this.endMatch();
        else { Sound.tempo(1); this.startRound(); }
      }
    }
    w.update();
    if (this.net && ++this.snapT >= SNAP_EVERY) { this.snapT = 0; this.sendSnap(); }
  }

  updateZone() {
    const w = this.world;
    if (--this.zoneMoveT <= 0) {
      this.zoneMoveT = 30 * 60;
      this.zoneIdx = (this.zoneIdx + 1 + Math.floor(this.rng() * (w.zoneSpots.length - 1))) % w.zoneSpots.length;
      this.zone = zoneRect(w.zoneSpots[this.zoneIdx]);
      w.show.say('zoneMove', { force: true }); this.ev({ k: 'mc', key: 'zoneMove' }); Sound.play('ding'); this.ev({ k: 'snd', n: 'ding' });
    }
    const z = this.zone;
    const inside = w.players.filter(p => !p.dead && !p.eliminated && p.cx > z.x && p.cx < z.x + z.w && p.y + p.h > z.y && p.y < z.y + z.h);
    const teams = new Set(inside.map(p => p.team));
    this.zoneOwner = null;
    if (inside.length && teams.size === 1) {
      for (const p of inside) p.zoneTime++;
      this.zoneOwner = inside[0].color;
      if (w.time % 20 === 0) w.fx.sparkle(z.x + z.w / 2, z.y + 6, inside[0].color);
    }
  }
  updateSurvival() {
    const w = this.world;
    if (this.elapsed === 90 * 60) { w.show.say('shrink', { force: true }); this.ev({ k: 'mc', key: 'shrink' }); }
    if (this.elapsed > 90 * 60) {
      const n = Math.min(10, Math.floor((this.elapsed - 90 * 60) / 300) + 1);
      this.wallL = this.wallR = n * TILE - 8;
      for (const p of w.players) {
        if (p.dead || p.eliminated || p.inv > 0) continue;
        if (p.x < this.wallL || p.x + p.w > VW - this.wallR) this.damage(p, 'wall', 0, -3);
      }
    }
  }

  view() {
    return {
      tl: this.timeLeft, rule: this.settings.rule, winsNeed: this.winsNeed,
      players: this.roster.map(r => {
        const p = this.world.players.find(q => q.id === r.id);
        return { name: r.name, color: r.color, wins: r.wins, val: p ? this.valueOf(p) : 0, lives: p ? p.lives : 0, elim: !p || p.eliminated || r.left, item: p?.item };
      }),
      zone: this.zone, zoneOwner: this.zoneOwner, wallL: this.wallL, wallR: this.wallR,
      banner: this.state === 'roundEnd' ? this.banner : null, bannerSub: this.bannerSub, bannerCol: this.bannerCol,
    };
  }

  sendSnap(force) {
    const w = this.world;
    const r1 = (v) => Math.round(v * 10) / 10;
    const snap = {
      t: 's', f: w.time, st: this.state, ct: this.count.t,
      v: this.view(),
      p: w.players.map(p => [p.id, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), (p.facing > 0 ? 1 : 0) | (p.onGround ? 2 : 0) | (p.dead ? 4 : 0) | (p.eliminated ? 8 : 0) | (p.win ? 16 : 0),
        FRAME[p.frameName()] ?? 0, p.item ? ITEMS.indexOf(p.item) : -1, p.lastSeq | 0, p.blindT, p.cloakT, p.inv, p.deadT | 0, p.magnetT > 0 ? 1 : 0, p.springT > 0 ? 1 : 0]),
      g: w.gems.map(g => [Math.round(g.x), Math.round(g.y), g.kind === 'red' ? 1 : 0, g.life > 0 && g.life < 90 ? 1 : 0]),
      b: w.boxes.map(b => [Math.round(b.x), Math.round(b.y)]),
      pr: w.projectiles.map(p => [p.type, Math.round(p.x), Math.round(p.y), p.t, p.reflected ? 1 : 0]),
      ev: this.events,
      sub: w.show.sub ? { who: w.show.sub.who, text: w.show.sub.text, t: w.show.sub.t } : null,
      rc: w.show.react,
    };
    this.events = [];
    this.net.broadcast(snap);
  }

  draw(g) {
    const local = this.world.players.find(p => p.input === 'solo');
    drawVersusScene(g, this.world, this.view(), { selfId: local?.id, blind: this.net && local ? local.blindT : 0 });
    this.count.draw(g);
    if (this.state === 'intro' && this.count.t < 110) {
      g.font = '12px Galmuri11';
      textOutline(g, `${this.round}라운드 · ${RULES[this.settings.rule]} · ${VERSUS_MAPS[this.mapIdx].name}`, VW / 2, VH / 2 + 44, PAL.lyellow, PAL.ink, 'center');
    }
  }
  exit() { this.app.touch(false); Sound.tempo(1); if (this.offs) this.offs.forEach(f => f()); }
}

export { FRAME_NAMES };
