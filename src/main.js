import './style.css';
import { VW, VH, STEP_MS } from './core/constants.js';
import { Input } from './core/input.js';
import { Sound } from './core/audio.js';
import { Save } from './core/save.js';
import { installGuard } from './core/guard.js';
import { UI, isUnlocked } from './ui/ui.js';
import { Touch } from './ui/touch.js';
import { StoryMode } from './modes/story.js';
import { VersusMode } from './modes/versus.js';
import { ClientMode } from './modes/client.js';
import { CutsceneMode, TitleMode } from './modes/cutscene.js';
import { STORY, CHAPTERS } from './data/levels.js';
import { Net, cleanCode, filterChat } from './net/net.js';
import { sanitizeLook, defaultLook, HAIRS, HATS, OUTFITS, FACES } from './gfx/sprites.js';
import { TEAM_COLORS } from './game/player.js';

installGuard();
Save.load();
Input.setKeys(Save.data.settings.keys);
Sound.setVolume(Save.data.settings.music, Save.data.settings.sfx);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

/* ───── 화면 크기 (정수배 우선) ───── */
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  let s = Math.min(W / VW, H / VH);
  if (s >= 2) s = Math.floor(s);
  canvas.style.width = Math.floor(VW * s) + 'px';
  canvas.style.height = Math.floor(VH * s) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

/* ───── 앱 ───── */
const app = {
  mode: null,
  net: null,
  lobby: null,
  ui: UI,
  setMode(m) {
    if (this.mode && this.mode.exit) this.mode.exit();
    this.mode = m;
    if (m && m.touchWant) Touch.show(true, m.touchWant); else Touch.hide();
    this.hudButtons();
  },
  touch(on, mode) { Touch.show(on, mode); this.hudButtons(); },
  vibrate(ms) { if (Save.data.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* 무시 */ } },
  hudButtons() {
    const touch = Touch.isTouch();
    const playing = this.mode && ['story', 'versus', 'client'].includes(this.mode.kind) && !UI.active;
    document.getElementById('btn-full').classList.toggle('hide', !(touch && document.fullscreenEnabled !== false));
    document.getElementById('btn-pause').classList.toggle('hide', !(touch && playing && (this.mode.kind === 'story' || (this.mode.kind === 'versus' && !this.mode.net))));
    document.getElementById('btn-chat').classList.toggle('hide', !(playing && (this.mode.kind === 'client' || (this.mode.kind === 'versus' && this.mode.net))));
  },
  lookChanged() { if (this.mode && this.mode.kind === 'title') this.mode.refresh(); },
  toMenu() { this.setMode(new TitleMode(this)); Sound.music('title'); UI.mainMenu(); },
  openStory() {
    if (!Save.data.seenIntro) {
      this.playCutscene('opening', () => { Save.data.seenIntro = true; Save.save(); this.toMenuBg(); UI.chapters(); });
    } else UI.chapters();
  },
  toMenuBg() { if (!this.mode || this.mode.kind !== 'title') this.setMode(new TitleMode(this)); Sound.music('title'); },
  playCutscene(id, done) { this.setMode(new CutsceneMode(this, id, () => { this.toMenuBg(); done && done(); })); },
  startStage(idx) {
    if (!isUnlocked(idx)) return;
    UI.close();
    this.setMode(new StoryMode(this, idx));
  },
  toStageSelect(idx) {
    this.toMenuBg();
    const ci = CHAPTERS.findIndex(c => c.stages.includes(idx));
    UI.stages(Math.max(0, ci), idx);
  },
  afterStage(r, what) {
    const boss = r.stage.boss;
    const go = () => {
      if (what === 'next' && r.idx + 1 < STORY.length) this.startStage(r.idx + 1);
      else this.toStageSelect(Math.min(r.idx + 1, STORY.length - 1));
    };
    if (boss) {
      const scene = boss === 'chef' ? 'after1' : boss === 'quiz' ? 'after2' : 'ending';
      UI.close();
      if (boss === 'mirror') { Save.data.seenEnding = true; Save.save(); this.playCutscene(scene, () => this.toStageSelect(r.idx)); }
      else this.playCutscene(scene, go);
    } else go();
  },

  /* ── 로컬 대전 ── */
  startLocalVersus(settings) {
    UI.close();
    const p2look = sanitizeLook({ skin: 2, hair: 1, hairColor: 5, hat: 1, outfit: 3, outfitColor: 1, face: 1 });
    const cfg = {
      settings,
      players: [
        { id: 0, name: Save.data.name || '1P', look: Save.data.look, team: 0, input: 'p1' },
        { id: 1, name: '2P', look: p2look, team: 1, input: 'p2' },
      ],
      seed: (Math.random() * 1e9) | 0,
    };
    this.setMode(new VersusMode(this, cfg));
  },
  restartVersus(cfg) {
    UI.close();
    if (cfg.net) { this.backToLobby(); return; }
    this.setMode(new VersusMode(this, { ...cfg, seed: (Math.random() * 1e9) | 0 }));
  },
  leaveVersus() {
    if (this.net) { this.net.close(); this.net = null; this.lobby = null; }
    this.toMenuBg(); UI.versusMenu();
  },

  /* ── 온라인: 방장 ── */
  async hostOnline() {
    UI.open(`<div class="screen"><div class="panel col center"><h2 class="center">📡 방을 만드는 중…</h2><div class="small">중계 서버에 연결하고 있어요.</div></div></div>`, {}, {});
    const net = new Net();
    try { await net.hostRoom(); } catch (e) {
      net.close();
      UI.alert('방을 만들지 못했어요. 인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요.', () => UI.versusMenu());
      return;
    }
    this.net = net;
    this.lobby = {
      code: net.code, isHost: true, myId: 0, nextId: 1, muted: new Set(),
      players: [{ id: 0, name: Save.data.name, look: Save.data.look, team: 0, ready: true, host: true }],
      settings: { rule: 'gems', map: -1, time: 180, rounds: 3, items: true, teams: false },
    };
    const L = this.lobby;
    const lastChat = new Map();
    net.on('hello', (m, conn) => {
      if (L.players.find(p => p.peer === conn.peer)) return;
      if (L.players.length >= 4 || net.locked) { net.sendTo(conn, { t: 'deny', why: '방에 들어갈 수 없어요.' }); return; }
      const id = L.nextId++;
      const name = String(m.name || '참가자').replace(/[<>]/g, '').slice(0, 8) || '참가자';
      L.players.push({ id, peer: conn.peer, name, look: sanitizeLook(m.look), team: id % 2, ready: false });
      net.sendTo(conn, { t: 'welcome', id });
      Sound.play('chat');
      this.sysChat(`${name} 님이 들어왔어요.`);
      this.pushLobby();
    });
    net.on('ready', (m, conn) => { const p = L.players.find(x => x.peer === conn.peer); if (p) { p.ready = !!m.ready; this.pushLobby(); } });
    net.on('team', (m, conn) => { const p = L.players.find(x => x.peer === conn.peer); if (p) { p.team = (p.team + 1) % 2; this.pushLobby(); } });
    net.on('chat', (m, conn) => {
      const p = L.players.find(x => x.peer === conn.peer);
      if (!p) return;
      const now = performance.now();
      if (now - (lastChat.get(p.id) || 0) < 900) return;
      lastChat.set(p.id, now);
      const text = filterChat(m.text);
      if (!text) return;
      this.broadcastChat(p, text);
    });
    const drop = (m, conn) => {
      const i = L.players.findIndex(x => x.peer === conn.peer);
      if (i < 0) return;
      const [p] = L.players.splice(i, 1);
      this.sysChat(`${p.name} 님이 나갔어요.`);
      if (L.players.length < 4) L.settings.teams = false;
      this.pushLobby();
    };
    net.on('leave', drop); net.on('_close', drop);
    this.showLobby();
  },
  pushLobby() {
    const L = this.lobby;
    if (!L || !this.net) return;
    if (L.players.length !== 4) L.settings.teams = false;
    const pub = { t: 'lobby', code: L.code, settings: L.settings, players: L.players.map(p => ({ id: p.id, name: p.name, look: p.look, team: p.team, ready: p.ready, host: !!p.host })) };
    this.net.broadcast(pub);
    if (!this.mode || this.mode.kind !== 'versus') this.showLobby();
  },
  broadcastChat(p, text) {
    const color = this.lobby.settings.teams ? TEAM_COLORS[p.team % 2] : TEAM_COLORS[this.lobby.players.indexOf(p) % 4];
    const msg = { t: 'chat', id: p.id, name: p.name, color, text };
    this.net.broadcast(msg);
    this.showChat(msg);
  },
  sysChat(text) { const msg = { t: 'chat', id: -1, name: '📢', color: '#fee761', text }; this.net?.broadcast(msg); this.showChat(msg); },
  showChat(msg) {
    if (this.lobby?.muted?.has(msg.id)) return;
    UI.chatLine(msg.name, msg.color, msg.text);
    if (msg.id >= 0) Sound.play('chat');
    const m = this.mode;
    if (m && (m.kind === 'versus' || m.kind === 'client') && m.world) {
      const p = m.world.players.find(q => q.id === msg.id);
      if (p) p.say = { text: msg.text, t: 180 };
      this.feed(msg);
    }
  },
  feed(msg) {
    let f = document.getElementById('chatfeed');
    if (!f) { f = document.createElement('div'); f.id = 'chatfeed'; f.style.cssText = 'position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(64px,env(safe-area-inset-bottom));z-index:25;pointer-events:none;display:flex;flex-direction:column;gap:3px;max-width:50vw;font-size:13px'; document.body.appendChild(f); }
    const d = document.createElement('div');
    d.style.cssText = 'background:rgba(11,11,20,.75);padding:3px 8px;border-left:3px solid ' + msg.color;
    d.textContent = `${msg.name}: ${msg.text}`;
    f.appendChild(d);
    while (f.children.length > 5) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  },
  showLobby() {
    const L = this.lobby;
    if (!L) return;
    const acts = {
      set: (a) => { if (!L.isHost) return; UI.applySetting(L.settings, a); this.pushLobby(); },
      ready: () => { const me = L.players.find(p => p.id === L.myId); this.net.toHost({ t: 'ready', ready: !me?.ready }); },
      team: () => { if (L.isHost) { const me = L.players[0]; me.team = (me.team + 1) % 2; this.pushLobby(); } else this.net.toHost({ t: 'team' }); },
      copy: async () => {
        const url = location.origin + location.pathname + '?room=' + L.code;
        try { await navigator.clipboard.writeText(url); UI.toast('초대 링크를 복사했어요!'); } catch { prompt('초대 링크', url); }
      },
      send: () => {
        const inp = document.getElementById('chatin');
        const text = filterChat(inp.value);
        inp.value = '';
        if (!text) return;
        if (L.isHost) this.broadcastChat(L.players[0], text); else this.net.toHost({ t: 'chat', text });
      },
      mute: (id) => { id = +id; if (L.muted.has(id)) L.muted.delete(id); else L.muted.add(id); this.showLobby(); },
      start: () => this.hostStart(),
      leave: () => this.leaveVersus(),
    };
    Sound.music('lobby');
    UI.lobby(L, acts);
  },
  hostStart() {
    const L = this.lobby;
    if (L.players.length < 2) return;
    this.net.locked = true;
    const s = { ...L.settings };
    const firstMap = s.map >= 0 ? s.map : Math.floor(Math.random() * 6);
    const players = L.players.map((p, i) => ({ id: p.id, name: p.name, look: p.look, team: p.team, peer: p.peer, input: p.host ? 'solo' : 'net', color: s.teams ? TEAM_COLORS[p.team % 2] : TEAM_COLORS[i % 4] }));
    this.net.broadcast({ t: 'start', settings: s, map: firstMap, players: players.map(({ peer, input, ...r }) => r) });
    UI.close();
    const cfg = { settings: { ...s, map: s.map }, players, net: this.net, seed: (Math.random() * 1e9) | 0, firstMap };
    const vm = new VersusMode(this, cfg);
    this.setMode(vm);
  },
  backToLobby() {
    if (!this.net || !this.lobby) return this.leaveVersus();
    this.net.locked = false;
    for (const p of this.lobby.players) if (!p.host) p.ready = false;
    this.net.broadcast({ t: 'toLobby' });
    this.toMenuBg();
    this.pushLobby();
  },
  relayChat() {},

  /* ── 온라인: 참가자 ── */
  async joinOnline(raw) {
    const code = cleanCode(raw);
    const net = new Net();
    try {
      await net.joinRoom(code, { t: 'hello', name: Save.data.name, look: Save.data.look });
    } catch (e) {
      UI.joinMsg(e.message || '연결에 실패했어요.');
      net.close();
      return;
    }
    this.net = net;
    this.lobby = { code, isHost: false, myId: -1, players: [], settings: {}, muted: new Set() };
    const L = this.lobby;
    net.on('welcome', (m) => { L.myId = m.id; });
    net.on('deny', (m) => { UI.alert(m.why || '방에 들어갈 수 없어요.', () => this.leaveVersus()); });
    net.on('lobby', (m) => {
      L.players = m.players; L.settings = m.settings; L.code = m.code;
      if (!this.mode || this.mode.kind !== 'client') this.showLobby();
    });
    net.on('chat', (m) => this.showChat(m));
    net.on('start', (m) => {
      UI.close();
      this.setMode(new ClientMode(this, { net, myId: L.myId, settings: m.settings, players: m.players, map: m.map }));
    });
    net.on('toLobby', () => { this.toMenuBg(); this.showLobby(); });
    const lost = (why) => { if (!this.net) return; UI.alert(why, () => this.leaveVersus()); };
    net.on('hostLeft', () => { if (this.mode?.kind !== 'client') lost('방장이 방을 닫았어요.'); });
    net.on('_close', () => { if (this.mode?.kind !== 'client') lost('방장과의 연결이 끊어졌어요.'); });
    UI.toast('방에 들어왔어요!');
  },
  openChat() {
    if (document.getElementById('chatbox')) return;
    const box = document.createElement('div');
    box.id = 'chatbox';
    box.style.cssText = 'position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;display:flex;gap:6px;width:min(460px,90vw)';
    box.innerHTML = '<input class="textin" maxlength="60" placeholder="채팅 입력 후 Enter" style="flex:1"><button class="btn">보내기</button>';
    document.body.appendChild(box);
    const inp = box.querySelector('input');
    Input.typing = true;
    const close = () => { Input.typing = false; box.remove(); };
    const send = () => {
      const text = filterChat(inp.value);
      if (text && this.net && this.lobby) {
        if (this.lobby.isHost) this.broadcastChat(this.lobby.players[0], text); else this.net.toHost({ t: 'chat', text });
      }
      close();
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); if (e.key === 'Escape') close(); });
    inp.addEventListener('blur', () => setTimeout(close, 150));
    box.querySelector('button').addEventListener('pointerdown', (e) => { e.preventDefault(); send(); });
    setTimeout(() => inp.focus(), 30);
  },
};

UI.init(app);
Touch.init();
if (import.meta.env.DEV) { window.__app = app; window.__modes = { StoryMode, VersusMode, ClientMode, CutsceneMode }; window.__save = Save; }

/* ───── 상단 버튼 ───── */
document.getElementById('btn-full').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); try { await screen.orientation.lock('landscape'); } catch { /* 지원 안 함 */ } }
    else await document.exitFullscreen();
  } catch { UI.toast('이 브라우저는 전체 화면을 지원하지 않아요. 홈 화면에 추가해 보세요!'); }
  setTimeout(() => { resize(); Touch.relayout(); }, 300);
});
document.getElementById('btn-pause').addEventListener('click', () => app.mode?.pause?.());
document.getElementById('btn-chat').addEventListener('click', () => app.openChat());
document.addEventListener('fullscreenchange', () => setTimeout(() => { resize(); Touch.relayout(); }, 200));
Input.onKey((code) => {
  if (code === 'Enter' && !UI.active && app.mode && (app.mode.kind === 'client' || (app.mode.kind === 'versus' && app.mode.net))) app.openChat();
});
// 화면 터치로 컷신 넘기기
canvas.addEventListener('pointerdown', () => { Sound.unlock(); if (app.mode?.kind === 'cutscene') app.mode.tap(); });
document.getElementById('touch').addEventListener('pointerdown', () => Sound.unlock(), true);

// 세로 화면 안내
const rot = document.getElementById('rotate');
if (Touch.isTouch()) rot.classList.add('need');

// 탭 전환 시 자동 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.mode && app.mode.kind === 'story' && app.mode.state === 'play' && !app.mode.paused) app.mode.pause();
});

/* ───── 게임 루프 (고정 60Hz) ───── */
let last = performance.now(), acc = 0, slowFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - last; last = now;
  if (dt > 250) dt = STEP_MS;
  acc += dt;
  let steps = 0;
  while (acc >= STEP_MS && steps < 4) {
    if (app.mode) app.mode.update();
    UI.padNav();
    acc -= STEP_MS; steps++;
  }
  if (steps >= 4) acc = 0;
  // 느린 기기면 효과 줄이기
  if (dt > 24) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (app.mode?.world) app.mode.world.lowFx = slowFrames > 60;
  if (app.mode) app.mode.draw(ctx);
  else { ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, VW, VH); }
}

/* ───── 시작 ───── */
(async () => {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('10px Galmuri9'), document.fonts.load('14px Galmuri11-Bold')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch { /* 글꼴 없이 진행 */ }
  document.getElementById('loading').remove();
  app.setMode(new TitleMode(app));
  const room = new URLSearchParams(location.search).get('room');
  if (room && Save.data.name) { UI.versusMenu(); UI.joinScreen(cleanCode(room)); }
  else UI.title();
  requestAnimationFrame((t) => { last = t; frame(t); });
})();

// 서비스 워커 (오프라인·홈 화면 앱)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
