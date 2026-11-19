import { defaultLook, sanitizeLook } from '../gfx/sprites.js';

const KEY = 'bsl_save_v1';
const SALT = 'blockshow-live*2026';

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

function fresh() {
  return {
    name: '',
    look: defaultLook(),
    stages: {},
    bossClear: 0,
    seenIntro: false,
    seenEnding: false,
    settings: { music: 0.6, sfx: 0.8, btnScale: 1, btnAlpha: 0.55, vibrate: true, shake: true, keys: null },
  };
}

export const Save = {
  data: fresh(),
  ok: true,
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { this.data = fresh(); return; }
      const obj = JSON.parse(raw);
      if (!obj || hash(SALT + obj.d) !== obj.h) { this.data = fresh(); return; }
      const d = JSON.parse(obj.d);
      const f = fresh();
      this.data = {
        ...f, ...d,
        look: sanitizeLook(d.look),
        settings: { ...f.settings, ...(d.settings || {}) },
        stages: typeof d.stages === 'object' && d.stages ? d.stages : {},
      };
    } catch { this.data = fresh(); this.ok = false; }
  },
  save() {
    try {
      const d = JSON.stringify(this.data);
      localStorage.setItem(KEY, JSON.stringify({ d, h: hash(SALT + d) }));
      this.ok = true;
    } catch { this.ok = false; }
  },
  stage(id) { return this.data.stages[id] || null; },
  recordStage(id, res) {
    const prev = this.data.stages[id] || { stars: [false, false, false], best: 0, time: 0 };
    const stars = prev.stars.map((s, i) => s || !!res.stars[i]);
    const best = Math.max(prev.best || 0, res.score | 0);
    const time = prev.time ? Math.min(prev.time, res.time) : res.time;
    this.data.stages[id] = { stars, best, time, clear: true };
    this.save();
  },
  totalStars() {
    let n = 0;
    for (const k in this.data.stages) n += (this.data.stages[k].stars || []).filter(Boolean).length;
    return n;
  },
  isCleared(id) { return !!this.data.stages[id]?.clear; },
  exportCode() {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify({ d: this.data, h: hash(SALT + JSON.stringify(this.data)) })))); } catch { return ''; }
  },
  importCode(code) {
    try {
      const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (hash(SALT + JSON.stringify(obj.d)) !== obj.h) return false;
      const f = fresh();
      this.data = { ...f, ...obj.d, look: sanitizeLook(obj.d.look), settings: { ...f.settings, ...(obj.d.settings || {}) } };
      this.save();
      return true;
    } catch { return false; }
  },
  reset() { const s = this.data.settings; this.data = fresh(); this.data.settings = s; this.save(); },
};
