import { World } from '../game/world.js';
import { Player } from '../game/player.js';
import { Input, B } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { Save } from '../core/save.js';
import { STORY } from '../data/levels.js';
import { PINK_TIPS } from '../data/lines.js';
import { drawStoryHud, drawBossBar } from '../game/hud.js';
import { Countdown } from './common.js';
import { TILE, VW, VH } from '../core/constants.js';
import { PAL } from '../gfx/sprites.js';
import { textOutline } from '../game/show.js';

export class StoryMode {
  constructor(app, idx) {
    this.app = app; this.idx = idx; this.def = STORY[idx];
    this.kind = 'story';
    this.build();
  }
  build() {
    const def = this.def;
    this.state = 'intro';
    this.frames = 0; this.score = 0; this.deaths = 0; this.hitTaken = false; this.goldGot = false; this.gemsGot = 0; this.streak = 0; this.streakT = 0;
    this.idleT = 0; this.hitStopT = 0; this.endT = 0;
    const hooks = {
      damage: (p, src, kx, ky) => this.damage(p, src, kx, ky),
      fall: (p) => this.fall(p),
      respawn: (p) => this.respawn(p),
      gem: (p, g) => this.gem(p, g),
      exit: (p) => this.clear(),
      bossDefeated: () => this.clear(),
      stomp: () => { this.score += 50; this.world.show.say('stomp'); this.world.show.addHype(5); },
      punchEnemy: () => { this.world.show.say('punch'); this.world.show.addHype(4); },
      enemyDown: (e) => { this.score += (e.def.score || 50) * this.world.show.mult; this.world.fx.text(e.x + e.w / 2, e.y, '+' + (e.def.score || 50), PAL.lyellow); },
      box: () => { this.world.show.say('box'); },
      hitStop: (n) => { this.hitStopT = n; },
      event: (name) => {
        const s = this.world.show;
        if (name === 'wrong') { s.say('wrong', { force: true }); s.crowdReact('boo'); }
        else if (name === 'right') { s.say('right'); s.crowdReact('clap', false); }
        else if (name === 'buzzer' || name === 'switch') s.say('buzzer');
        else if (name === 'flash') s.say('flash');
        else if (name === 'item') s.say('item');
      },
      noShake: !Save.data.settings.shake,
    };
    this.world = new World(def, { kind: 'story', hooks });
    this.world.hooks.noShake = !Save.data.settings.shake;
    this.player = this.world.addPlayer(new Player({ id: 0, name: Save.data.name || '참가자', look: Save.data.look, slot: 'solo' }));
    this.player.lives = 3;
    this.world.respawnAt = { ...this.world.start };
    this.world.snapCamera();
    this.world.frozen = true;
    this.count = new Countdown();
    Sound.music(def.music);
    this.bossTipT = 600;
    this.touchWant = 'solo';
    this.app.touch(true, 'solo');
  }

  damage(p, src, kx, ky) {
    if (p.dead || p.inv > 0 || this.state !== 'play') return;
    const w = this.world;
    p.lives--; this.deaths++; this.hitTaken = true; p.lastDeath = w.time;
    Sound.play('hurt'); w.shake(5); this.app.vibrate(40);
    w.show.addHype(-15); this.streak = 0;
    w.fx.burst(p.cx, p.cy, PAL.red, 10);
    if (p.lives <= 0) { this.gameOver(); return; }
    if (p.lives === 1) w.show.say('oneLife', { force: true }); else w.show.say('hurt', { force: Math.random() < 0.5 });
    w.show.crowdReact('oh');
    if (src === 'spike' && !this.def.boss) { p.dead = true; p.deadT = 50; p.vx = 0; p.vy = -2; return; }
    p.vx = kx; p.vy = ky; p.stunT = 18; p.inv = 100; p.jumping = false; p.onGround = false;
  }
  fall(p) {
    if (p.dead || this.state !== 'play') return;
    const w = this.world;
    p.lives--; this.deaths++; this.hitTaken = true; p.lastDeath = w.time;
    Sound.play('fall'); w.show.addHype(-15); this.streak = 0;
    if (p.lives <= 0) { this.gameOver(); return; }
    if (p.lives === 1) w.show.say('oneLife', { force: true }); else w.show.say('fall', { force: true });
    w.show.crowdReact('oh');
    p.dead = true; p.deadT = 45;
  }
  respawn(p) {
    const w = this.world;
    let at = w.respawnAt || w.start;
    if (this.def.boss === 'quiz') at = { x: 14 * TILE + 3, y: 5 * TILE };
    else if (this.def.boss === 'mirror' && w.boss && w.boss.phase === 3) at = { x: 14 * TILE + 3, y: 5 * TILE };
    p.reset(); p.x = at.x; p.y = at.y; p.inv = 120; p.dead = false;
    if (this.def.boss === 'mirror' && w.boss && w.boss.phase === 3) { p.item = 'mic'; p.itemUses = 99; }
    w.fx.burst(p.cx, p.cy, PAL.white, 12);
  }
  gem(p, g) {
    const w = this.world;
    g.dead = true;
    if (g.kind === 'gold') {
      this.goldGot = true; this.score += 500 * w.show.mult; Sound.play('gold'); w.show.say('gold', { force: true }); w.show.crowdReact('cheer'); w.show.addHype(30);
      w.fx.burst(g.x + 5, g.y + 5, PAL.gold, 18); w.fx.text(g.x + 5, g.y, '+500', PAL.gold);
      return;
    }
    this.gemsGot++;
    this.streak = this.streakT > 0 ? this.streak + 1 : 1; this.streakT = 90;
    this.score += 100 * w.show.mult;
    Sound.play('gem', this.streak);
    w.fx.sparkle(g.x + 5, g.y + 5, PAL.teal);
    w.show.addHype(6);
    if (this.streak >= 3) w.show.say('gemStreak'); else w.show.say('gem');
    if (this.gemsGot >= w.needGems && w.exit && !w.exit.open) {
      w.exit.open = true; Sound.play('exit'); w.show.say('gemsDone', { force: true }); w.show.crowdReact('clap');
    }
  }
  clear() {
    if (this.state !== 'play') return;
    this.state = 'clear'; this.endT = 0;
    const w = this.world;
    this.player.win = true; this.player.vx = 0;
    Sound.play('exit'); w.show.say(this.def.boss ? 'bossWin' : 'clear', { force: true }); w.show.crowdReact('cheer');
    w.fx.confetti(w.cam.x, w.cam.x + VW, w.cam.y);
    Sound.music(null);
  }
  gameOver() {
    this.state = 'gameover'; this.endT = 0;
    this.player.dead = true; this.player.deadT = 999;
    Sound.music(null); Sound.play('boo');
    this.world.show.crowdReact('boo', false);
  }
  finish() {
    const secs = Math.floor(this.frames / 60);
    const stars = this.def.boss
      ? [true, secs <= this.def.time, !this.hitTaken]
      : [true, secs <= this.def.time, this.goldGot && this.deaths === 0];
    const timeBonus = Math.max(0, this.def.time - secs) * 10;
    const total = Math.round(this.score + timeBonus + this.player.lives * 200);
    const prevStars = Save.totalStars();
    Save.recordStage(this.def.id, { stars, score: total, time: secs });
    let unlock = null;
    if (this.def.boss) {
      const n = this.def.boss === 'chef' ? 1 : this.def.boss === 'quiz' ? 2 : 3;
      if (Save.data.bossClear < n) { Save.data.bossClear = n; Save.save(); unlock = n; }
    }
    this.app.ui.result({
      stage: this.def, idx: this.idx, stars, secs, score: total, timeBonus, gems: this.gemsGot, need: this.world.needGems, gold: this.goldGot,
      newStars: Save.totalStars() - prevStars, unlock,
    });
  }
  pause() {
    if (this.state !== 'play' && this.state !== 'intro') return;
    this.paused = true; Sound.play('select');
    this.app.touch(false);
    this.app.ui.pause({
      resume: () => { this.paused = false; this.app.touch(true, 'solo'); },
      retry: () => { this.paused = false; this.build(); },
      quit: () => { this.paused = false; this.app.toStageSelect(this.idx); },
    });
  }
  update() {
    if (this.paused) return;
    const w = this.world, p = this.player;
    const bits = Input.read('solo');
    if ((bits & B.PAUSE) && !(this.prevBits & B.PAUSE)) { this.prevBits = bits; this.pause(); return; }
    this.prevBits = bits;
    if (this.hitStopT > 0) { this.hitStopT--; return; }
    p.setInput(this.state === 'play' ? bits : 0);
    if (this.state === 'intro') {
      this.count.update();
      if (this.count.playing) { this.state = 'play'; w.frozen = false; w.show.say(this.def.boss ? 'bossStart' : 'start', { force: true }); w.show.crowdReact('clap'); }
    } else if (this.state === 'play') {
      this.count.update();
      this.frames++;
      if (this.streakT > 0) this.streakT--;
      if (bits) this.idleT = 0; else if (++this.idleT === 600) w.show.say('idle', { force: true });
      if (this.def.boss && --this.bossTipT <= 0) { this.bossTipT = 900; const tips = PINK_TIPS[this.def.boss]; w.show.tip(tips[Math.floor(Math.random() * tips.length)]); }
    } else {
      this.endT++;
      if (this.state === 'clear' && this.endT === 150) this.finish();
      if (this.state === 'gameover' && this.endT === 70) {
        this.app.ui.gameOver({ retry: () => this.build(), quit: () => this.app.toStageSelect(this.idx) });
      }
    }
    w.update();
  }
  draw(g) {
    const w = this.world;
    w.draw(g);
    w.show.drawAudience(g);
    w.show.drawSubtitle(g, w.boss ? 46 : undefined);
    drawStoryHud(g, { time: w.time, gems: this.gemsGot, need: w.needGems, gold: this.goldGot, lives: this.player.lives, frames: this.frames, target: this.def.time, item: this.player.item, itemUses: this.player.itemUses, score: this.score, show: w.show });
    if (w.boss) drawBossBar(g, w.boss, w.time);
    if (this.player.blindT > 0) this.drawPie(g);
    this.count.draw(g);
    if (this.state === 'intro' && this.count.t < 120) {
      g.font = '12px Galmuri11';
      textOutline(g, `${this.def.id}  ${this.def.name}`, VW / 2, VH / 2 + 40, PAL.lyellow, PAL.ink, 'center');
    }
  }
  drawPie(g) {
    const a = Math.min(1, this.player.blindT / 60);
    g.globalAlpha = a * 0.9; g.fillStyle = '#f4efe6';
    g.beginPath(); g.ellipse(VW / 2, VH / 2, 120, 70, 0, 0, 6.28); g.fill(); g.globalAlpha = 1;
  }
  exit() { this.app.touch(false); }
}
