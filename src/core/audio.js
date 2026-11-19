// Web Audio 기반 효과음 · 칩튠 배경음악 (모두 코드로 생성한 오리지널)
import { makeRng } from './constants.js';

let ac = null, master, musicBus, sfxBus, noiseBuf, pulse25, pulse12;
const vol = { music: 0.6, sfx: 0.8 };

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = vol.music * 0.5; musicBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx * 0.6; sfxBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  pulse25 = pulseWave(0.25); pulse12 = pulseWave(0.125);
  return ac;
}
function pulseWave(duty) {
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ac.createPeriodicWave(re, im);
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function osc(type, f0, f1, t, dur, v, bus = sfxBus, attack = 0.004) {
  const o = ac.createOscillator(), g = ac.createGain();
  if (type === 'p25') o.setPeriodicWave(pulse25); else if (type === 'p12') o.setPeriodicWave(pulse12); else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
  return o;
}
function noise(t, dur, v, freq = 3000, type = 'bandpass', q = 1, bus = sfxBus, f1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 1;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SFX = {
  jump: (t) => osc('p25', 330, 660, t, 0.12, 0.25),
  djump: (t) => { osc('p25', 440, 880, t, 0.1, 0.22); osc('p12', 660, 1320, t + 0.03, 0.1, 0.12); },
  land: (t) => noise(t, 0.06, 0.25, 600, 'lowpass'),
  punch: (t) => { noise(t, 0.08, 0.35, 1800, 'bandpass', 0.8, sfxBus, 600); },
  hit: (t) => { osc('square', 180, 60, t, 0.12, 0.3); noise(t, 0.1, 0.4, 2400, 'bandpass', 1); },
  stomp: (t) => { osc('square', 300, 90, t, 0.1, 0.3); osc('p25', 600, 1200, t + 0.05, 0.08, 0.15); },
  hurt: (t) => { osc('sawtooth', 440, 110, t, 0.3, 0.28); osc('square', 220, 80, t + 0.05, 0.25, 0.15); },
  fall: (t) => osc('triangle', 800, 120, t, 0.6, 0.35),
  gem: (t, p = 0) => { const f = mtof(76 + Math.min(p, 12)); osc('p25', f, f, t, 0.08, 0.2); osc('p25', f * 1.5, f * 1.5, t + 0.05, 0.12, 0.18); },
  gold: (t) => { [0, 4, 7, 12, 16].forEach((s, i) => osc('p25', mtof(79 + s), 0, t + i * 0.06, 0.18, 0.2)); },
  box: (t) => { osc('p25', 523, 523, t, 0.06, 0.2); osc('p25', 659, 659, t + 0.06, 0.06, 0.2); osc('p25', 784, 784, t + 0.12, 0.12, 0.2); },
  item: (t) => osc('p12', 900, 400, t, 0.1, 0.2),
  exit: (t) => { [0, 4, 7, 12].forEach((s, i) => osc('square', mtof(72 + s), 0, t + i * 0.08, 0.2, 0.15)); },
  switch: (t) => { osc('square', 1200, 1200, t, 0.04, 0.2); osc('square', 900, 900, t + 0.05, 0.05, 0.2); },
  ding: (t) => { osc('sine', 1568, 1568, t, 0.5, 0.3); osc('sine', 2093, 2093, t + 0.12, 0.6, 0.25); },
  buzz: (t) => { osc('sawtooth', 110, 100, t, 0.45, 0.3); osc('square', 116, 104, t, 0.45, 0.15); },
  warp: (t) => { osc('sine', 300, 1600, t, 0.25, 0.25); osc('p12', 1600, 300, t + 0.1, 0.2, 0.12); },
  pad: (t) => { osc('triangle', 150, 600, t, 0.2, 0.4); osc('p25', 300, 900, t, 0.15, 0.12); },
  crumble: (t) => noise(t, 0.25, 0.3, 500, 'lowpass', 1, sfxBus, 200),
  pie: (t) => { osc('triangle', 500, 250, t, 0.12, 0.25); noise(t, 0.05, 0.15, 3000); },
  splat: (t) => { noise(t, 0.2, 0.45, 900, 'lowpass', 2, sfxBus, 200); osc('sine', 200, 60, t, 0.15, 0.3); },
  fuse: (t) => noise(t, 0.15, 0.12, 5000, 'highpass'),
  boom: (t) => { noise(t, 0.6, 0.7, 1200, 'lowpass', 1, sfxBus, 80); osc('sine', 120, 30, t, 0.5, 0.6); [0.1, 0.2, 0.3].forEach(d => osc('p12', 1200 + d * 2000, 600, t + d, 0.08, 0.08)); },
  boomer: (t) => { osc('triangle', 600, 900, t, 0.1, 0.18); osc('triangle', 900, 600, t + 0.1, 0.1, 0.18); },
  magnet: (t) => { osc('sine', 200, 800, t, 0.3, 0.2); osc('sine', 203, 806, t, 0.3, 0.2); },
  cloak: (t) => { osc('sine', 1200, 300, t, 0.4, 0.15); noise(t, 0.3, 0.08, 6000, 'highpass'); },
  spring: (t) => { [0, 1, 2, 3].forEach(i => osc('triangle', 300 + i * 120, 600 + i * 150, t + i * 0.04, 0.06, 0.18)); },
  select: (t) => osc('p25', 880, 880, t, 0.07, 0.18),
  move: (t) => osc('p12', 660, 660, t, 0.04, 0.12),
  back: (t) => osc('p25', 440, 330, t, 0.08, 0.15),
  count: (t) => osc('square', 880, 880, t, 0.15, 0.2),
  go: (t) => { osc('square', 1320, 1320, t, 0.4, 0.2); osc('p25', 660, 660, t, 0.4, 0.15); },
  star: (t, p = 0) => { const b = 76 + p * 3; osc('p25', mtof(b), 0, t, 0.1, 0.2); osc('p25', mtof(b + 7), 0, t + 0.08, 0.25, 0.2); },
  chat: (t) => { osc('sine', 1046, 1046, t, 0.06, 0.15); osc('sine', 1318, 1318, t + 0.06, 0.08, 0.15); },
  bossHit: (t) => { osc('square', 220, 55, t, 0.25, 0.35); noise(t, 0.2, 0.4, 1500); },
  bossDie: (t) => { for (let i = 0; i < 8; i++) { noise(t + i * 0.12, 0.3, 0.5, 800 + i * 100, 'lowpass'); osc('sine', 150 - i * 10, 40, t + i * 0.12, 0.25, 0.4); } },
  laser: (t) => osc('sawtooth', 1800, 1700, t, 0.25, 0.08),
  check: (t) => { osc('p25', 784, 784, t, 0.08, 0.2); osc('p25', 1046, 1046, t + 0.08, 0.15, 0.2); },
  tick: (t) => osc('square', 1500, 1500, t, 0.03, 0.12),
  flash: (t) => { noise(t, 0.15, 0.3, 8000, 'highpass'); osc('sine', 2000, 1000, t, 0.12, 0.15); },
  cheer: (t) => {
    for (let i = 0; i < 14; i++) noise(t + Math.random() * 0.5, 0.4 + Math.random() * 0.5, 0.06, 900 + Math.random() * 1600, 'bandpass', 3);
    for (let i = 0; i < 5; i++) osc('triangle', 500 + Math.random() * 400, 800 + Math.random() * 500, t + Math.random() * 0.3, 0.4, 0.03);
  },
  boo: (t) => { for (let i = 0; i < 6; i++) { osc('sawtooth', 150 + Math.random() * 60, 110 + Math.random() * 30, t + Math.random() * 0.2, 0.7, 0.05); } noise(t, 0.8, 0.06, 400, 'lowpass'); },
  oh: (t) => { for (let i = 0; i < 6; i++) osc('triangle', 300 + Math.random() * 120, 480 + Math.random() * 160, t + Math.random() * 0.1, 0.6, 0.05); },
  clap: (t) => { for (let i = 0; i < 26; i++) noise(t + Math.random() * 0.9, 0.04, 0.12, 1800 + Math.random() * 1500, 'bandpass', 1.5); },
};

/* ───────── 음악 ───────── */
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10] };
const SONGS = {
  title: { bpm: 128, key: 60, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], seed: 11, drums: 'pop', lead: 'p25' },
  lobby: { bpm: 96, key: 57, scale: 'dorian', prog: [0, 3, 0, 4, 1, 4, 0, 4], seed: 23, drums: 'swing', swing: 0.18, lead: 'triangle' },
  kitchen: { bpm: 120, key: 62, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 1, 4], seed: 7, drums: 'bounce', lead: 'p25' },
  quiz: { bpm: 132, key: 57, scale: 'minor', prog: [0, 0, 5, 4, 3, 3, 4, 4], seed: 42, drums: 'tick', lead: 'p12' },
  disco: { bpm: 118, key: 55, scale: 'dorian', prog: [0, 3, 0, 3, 5, 4, 0, 4], seed: 99, drums: 'four', lead: 'p25', octBass: true },
  boss: { bpm: 150, key: 52, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], seed: 3, drums: 'drive', lead: 'sawtooth' },
  versus: { bpm: 140, key: 59, scale: 'minor', prog: [0, 0, 3, 4, 5, 5, 3, 4], seed: 77, drums: 'four', lead: 'p25', octBass: true },
  ending: { bpm: 100, key: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], seed: 5, drums: 'pop', lead: 'triangle' },
};
const compiled = {};

function compile(name) {
  if (compiled[name]) return compiled[name];
  const s = SONGS[name];
  const rng = makeRng(s.seed * 7919);
  const sc = SCALES[s.scale];
  const deg = (d) => { const o = Math.floor(d / 7); return sc[((d % 7) + 7) % 7] + o * 12; };
  const bars = s.prog.length * 2;
  const steps = bars * 16;
  const lead = new Array(steps).fill(null), harm = new Array(steps).fill(null), bass = new Array(steps).fill(null), drum = new Array(steps).fill(0);
  // 리듬 템플릿 (16분음표 위치)
  const rhythms = [
    [0, 3, 6, 8, 10, 12], [0, 2, 4, 6, 8, 11, 14], [0, 4, 6, 8, 12, 14], [0, 3, 4, 7, 8, 12], [0, 6, 8, 10, 11, 12, 14], [0, 2, 3, 8, 10, 12, 13],
  ];
  // A 구간 4마디 멜로디 동기를 만들고 변주
  const motifs = [];
  for (let m = 0; m < 2; m++) {
    const rh = rhythms[rng.int(rhythms.length)];
    let cur = 2 + rng.int(3);
    const notes = rh.map((p, i) => { cur += [-2, -1, 1, 2, 0, 1, -1, 3][rng.int(8)]; cur = Math.max(-1, Math.min(9, cur)); return { p, d: cur, len: (rh[i + 1] ?? 16) - p }; });
    motifs.push(notes);
  }
  for (let b = 0; b < bars; b++) {
    const half = b >= s.prog.length ? 1 : 0;
    const chord = s.prog[b % s.prog.length];
    const base = b * 16;
    const chordTones = [chord, chord + 2, chord + 4];
    // 리드
    const mot = motifs[(b + half) % 2];
    const leadUp = half && b % 4 === 3 ? 2 : 0;
    for (const n of mot) {
      if (half && b % 4 === 3 && n.p > 10) continue;
      // 마디 첫 박은 화음음으로 맞춤
      let d = n.p === 0 ? chordTones[rng.int(3)] + 7 : n.d + chord + leadUp;
      lead[base + n.p] = { m: s.key + 12 + deg(d), len: Math.max(1, n.len - (n.len > 2 ? 1 : 0)) };
    }
    // 화음 아르페지오
    for (let i = 0; i < 16; i += 2) harm[base + i] = { m: s.key + deg(chordTones[(i / 2) % 3]), len: 1 };
    // 베이스
    const root = s.key - 24 + deg(chord);
    const bpat = s.octBass ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 12];
    bpat.forEach((p, i) => { bass[base + p] = { m: root + (s.octBass && i % 2 ? 12 : 0) + (!s.octBass && p === 12 ? 7 : 0), len: s.octBass ? 1 : 3 }; });
    // 드럼 1=킥 2=스네어 4=하이햇 8=오픈햇
    for (let i = 0; i < 16; i++) {
      let v = 0;
      switch (s.drums) {
        case 'four': if (i % 4 === 0) v |= 1; if (i % 8 === 4) v |= 2; if (i % 4 === 2) v |= 8; else if (i % 2 === 0) v |= 4; break;
        case 'pop': if (i === 0 || i === 6 || i === 10) v |= 1; if (i === 4 || i === 12) v |= 2; if (i % 2 === 0) v |= 4; break;
        case 'bounce': if (i === 0 || i === 7 || i === 10) v |= 1; if (i === 4 || i === 12) v |= 2; if (i % 2 === 0) v |= 4; break;
        case 'tick': if (i === 0 || i === 8) v |= 1; if (i === 4 || i === 12 || i === 14) v |= 2; v |= 4; break;
        case 'swing': if (i === 0 || i === 10) v |= 1; if (i === 4 || i === 12) v |= 2; if (i % 4 === 0 || i % 4 === 3) v |= 4; break;
        case 'drive': if (i % 4 === 0 || i === 6 || i === 14) v |= 1; if (i === 4 || i === 12) v |= 2; v |= 4; break;
      }
      if (b % 8 === 7 && i >= 12) v |= 2;
      drum[base + i] = v;
    }
  }
  const c = { s, steps, lead, harm, bass, drum };
  compiled[name] = c;
  return c;
}

const music = { name: null, step: 0, next: 0, timer: null, tempo: 1, song: null };
function scheduler() {
  if (!ac || !music.song) return;
  const s = music.song.s;
  while (music.next < ac.currentTime + 0.15) {
    const i = music.step % music.song.steps;
    const t = music.next;
    let stepDur = 60 / (s.bpm * music.tempo) / 4;
    if (s.swing) stepDur *= (i % 2 === 0 ? 1 + s.swing : 1 - s.swing);
    const base = 60 / (s.bpm * music.tempo) / 4;
    const L = music.song.lead[i];
    if (L) osc(s.lead, mtof(L.m), 0, t, L.len * base * 0.95, s.lead === 'sawtooth' ? 0.07 : 0.12, musicBus, 0.008);
    const H = music.song.harm[i];
    if (H) osc('p12', mtof(H.m), 0, t, base * 0.9, 0.04, musicBus);
    const Bs = music.song.bass[i];
    if (Bs) osc('triangle', mtof(Bs.m), 0, t, Bs.len * base * 0.9, 0.28, musicBus, 0.005);
    const D = music.song.drum[i];
    if (D & 1) osc('sine', 150, 40, t, 0.12, 0.5, musicBus, 0.001);
    if (D & 2) { noise(t, 0.12, 0.25, 1800, 'bandpass', 0.7, musicBus); osc('triangle', 220, 160, t, 0.06, 0.12, musicBus); }
    if (D & 4) noise(t, 0.03, 0.07, 8000, 'highpass', 1, musicBus);
    if (D & 8) noise(t, 0.12, 0.08, 7000, 'highpass', 1, musicBus);
    music.next += stepDur;
    music.step++;
  }
}

export const Sound = {
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  },
  get ready() { return !!ac; },
  setVolume(m, s) {
    vol.music = m; vol.sfx = s;
    if (musicBus) { musicBus.gain.value = m * 0.5; sfxBus.gain.value = s * 0.6; }
  },
  play(name, p) {
    if (!ac || ac.state !== 'running') return;
    const f = SFX[name];
    if (f) f(ac.currentTime + 0.005, p);
  },
  music(name) {
    if (!ensure()) return;
    if (music.name === name) return;
    this.stopMusic();
    if (!name) return;
    music.name = name;
    music.song = compile(name);
    music.step = 0; music.tempo = 1;
    music.next = ac.currentTime + 0.08;
    music.timer = setInterval(scheduler, 30);
  },
  stopMusic() {
    if (music.timer) clearInterval(music.timer);
    music.timer = null; music.name = null; music.song = null;
  },
  tempo(x) { music.tempo = x; },
  get musicName() { return music.name; },
  suspend() { if (ac && ac.state === 'running') ac.suspend(); },
  resume() { if (ac && ac.state === 'suspended') ac.resume(); },
};

document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.suspend(); else Sound.resume(); });
