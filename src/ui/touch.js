// 모바일 가상 패드: 왼쪽 플로팅 조이스틱 + 오른쪽 버튼 3개
import { B, Input } from '../core/input.js';
import { Save } from '../core/save.js';

class Pad {
  constructor(root, region, idx) {
    this.root = root; this.region = region; this.idx = idx;
    this.bits = 0; this.joy = null; this.btnPtr = new Map();
    this.els = {};
    this.build();
  }
  build() {
    const mk = (cls, html) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html || ''; this.root.appendChild(e); return e; };
    this.els.joy = mk('joy', '<div class="knob"></div>');
    this.els.knob = this.els.joy.firstChild;
    this.els.A = mk('tbtn jump', 'A<small>점프</small>');
    this.els.B = mk('tbtn', 'B<small>펀치</small>');
    this.els.C = mk('tbtn', 'C<small>아이템</small>');
    this.layout();
  }
  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Save.data.settings.btnScale || 1;
    const a = Save.data.settings.btnAlpha ?? 0.55;
    const [r0, r1] = this.region;
    const rw = (r1 - r0) * W;
    const split = r1 - r0 < 0.9;
    const big = Math.round(72 * s * (split ? 0.85 : 1)), sm = Math.round(56 * s * (split ? 0.85 : 1));
    const right = r0 * W + rw - (r1 >= 1 ? 30 : 12);
    const bottom = H - 24;
    this.btns = {
      A: { x: right - big * 0.75, y: bottom - big * 0.7, r: big / 2 },
      B: { x: right - big * 0.75 - big * 1.05, y: bottom - big * 0.35, r: sm / 2 },
      C: { x: right - big * 0.55, y: bottom - big * 0.7 - big * 1.05, r: sm / 2 },
    };
    for (const k of ['A', 'B', 'C']) {
      const b = this.btns[k], e = this.els[k];
      e.style.left = b.x + 'px'; e.style.top = b.y + 'px';
      e.style.width = e.style.height = b.r * 2 + 'px';
      e.style.fontSize = Math.round(b.r * 0.6) + 'px';
      e.style.opacity = a + 0.25;
    }
    this.joyZone = { x0: r0 * W, x1: r0 * W + rw * (split ? 0.5 : 0.45) };
    this.home = { x: r0 * W + Math.min(110, rw * 0.22) + 20, y: H - 100 };
    this.joyR = 52 * s;
    this.els.joy.style.width = this.els.joy.style.height = this.joyR * 2.3 + 'px';
    this.els.joy.style.margin = `${-this.joyR * 1.15}px 0 0 ${-this.joyR * 1.15}px`;
    this.els.joy.style.opacity = a + 0.2;
    if (!this.joy) this.placeJoy(this.home.x, this.home.y, 0, 0);
  }
  placeJoy(x, y, dx, dy) {
    this.els.joy.style.left = x + 'px'; this.els.joy.style.top = y + 'px';
    this.els.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  contains(x) { return x >= this.region[0] * window.innerWidth && x < this.region[1] * window.innerWidth; }
  hitBtn(x, y) {
    for (const k of ['A', 'B', 'C']) { const b = this.btns[k]; if (Math.hypot(x - b.x, y - b.y) < b.r * 1.25) return k; }
    return null;
  }
  down(id, x, y) {
    const k = this.hitBtn(x, y);
    if (k) { this.btnPtr.set(id, k); this.recalc(); if (Save.data.settings.vibrate && navigator.vibrate) navigator.vibrate(8); return true; }
    if (!this.joy && x < this.joyZone.x1 + 40) { this.joy = { id, ox: x, oy: y, dx: 0, dy: 0 }; this.placeJoy(x, y, 0, 0); this.recalc(); return true; }
    return false;
  }
  move(id, x, y) {
    if (this.joy && this.joy.id === id) {
      let dx = x - this.joy.ox, dy = y - this.joy.oy;
      const d = Math.hypot(dx, dy), R = this.joyR;
      if (d > R) { this.joy.ox += dx * (1 - R / d) * 0.5; this.joy.oy += dy * (1 - R / d) * 0.5; dx *= R / d; dy *= R / d; }
      this.joy.dx = dx; this.joy.dy = dy;
      this.placeJoy(this.joy.ox, this.joy.oy, dx, dy);
      this.recalc(); return true;
    }
    if (this.btnPtr.has(id)) { const k = this.hitBtn(x, y); if (k && k !== this.btnPtr.get(id)) { this.btnPtr.set(id, k); this.recalc(); } return true; }
    return false;
  }
  up(id) {
    if (this.joy && this.joy.id === id) { this.joy = null; this.placeJoy(this.home.x, this.home.y, 0, 0); this.recalc(); return true; }
    if (this.btnPtr.delete(id)) { this.recalc(); return true; }
    return false;
  }
  recalc() {
    let b = 0;
    if (this.joy) {
      const R = this.joyR, dz = R * 0.22;
      if (this.joy.dx < -dz) b |= B.L;
      if (this.joy.dx > dz) b |= B.R;
      if (this.joy.dy < -R * 0.55) b |= B.U;
      if (this.joy.dy > R * 0.5) b |= B.D;
    }
    const held = new Set(this.btnPtr.values());
    if (held.has('A')) b |= B.J;
    if (held.has('B')) b |= B.P;
    if (held.has('C')) b |= B.I;
    for (const k of ['A', 'B', 'C']) this.els[k].classList.toggle('down', held.has(k));
    this.bits = b;
  }
  reset() { this.joy = null; this.btnPtr.clear(); this.recalc(); this.placeJoy(this.home.x, this.home.y, 0, 0); }
}

export const Touch = {
  root: null, pads: [], on: false, mode: null,
  isTouch: () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches,
  init() {
    this.root = document.getElementById('touch');
    const R = this.root;
    const find = (x) => this.pads.find(p => p.contains(x));
    R.addEventListener('pointerdown', (e) => { e.preventDefault(); const p = find(e.clientX); if (p) p.down(e.pointerId, e.clientX, e.clientY); try { R.setPointerCapture(e.pointerId); } catch { /* 무시 */ } }, { passive: false });
    R.addEventListener('pointermove', (e) => { e.preventDefault(); for (const p of this.pads) if (p.move(e.pointerId, e.clientX, e.clientY)) break; }, { passive: false });
    const up = (e) => { for (const p of this.pads) if (p.up(e.pointerId)) break; };
    R.addEventListener('pointerup', up); R.addEventListener('pointercancel', up); R.addEventListener('lostpointercapture', up);
    window.addEventListener('resize', () => { for (const p of this.pads) p.layout(); });
  },
  show(on, mode = 'solo') {
    if (!this.isTouch()) { this.hide(); return; }
    if (!on) { this.hide(); return; }
    if (this.on && this.mode === mode) return;
    this.hide();
    this.on = true; this.mode = mode;
    this.root.innerHTML = '';
    this.root.classList.add('on');
    if (mode === 'split') {
      const d = document.createElement('div'); d.className = 'tdiv'; this.root.appendChild(d);
      this.pads = [new Pad(this.root, [0, 0.5], 0), new Pad(this.root, [0.5, 1], 1)];
    } else this.pads = [new Pad(this.root, [0, 1], 0)];
    Input.touch[0] = this.pads[0]; Input.touch[1] = this.pads[1] || null;
  },
  hide() {
    this.on = false; this.mode = null;
    for (const p of this.pads) p.reset();
    this.pads = []; Input.touch[0] = null; Input.touch[1] = null;
    if (this.root) { this.root.classList.remove('on'); this.root.innerHTML = ''; }
  },
  relayout() { for (const p of this.pads) p.layout(); },
};
