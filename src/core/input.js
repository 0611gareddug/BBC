// 입력: 키보드 · 게임패드 · 터치를 비트 묶음으로 통합
export const B = { L: 1, R: 2, U: 4, D: 8, J: 16, P: 32, I: 64, PAUSE: 128 };
export const ACTIONS = [
  ['left', B.L, '왼쪽'], ['right', B.R, '오른쪽'], ['up', B.U, '위'], ['down', B.D, '아래'],
  ['jump', B.J, '점프'], ['punch', B.P, '펀치'], ['item', B.I, '아이템'], ['pause', B.PAUSE, '일시정지'],
];

export const DEFAULT_KEYS = {
  solo: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], jump: ['KeyZ', 'Space'], punch: ['KeyX'], item: ['KeyC'], pause: ['Escape', 'KeyP'] },
  p1: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Comma', 'ArrowUp'], punch: ['Period'], item: ['Slash'], pause: ['Escape'] },
  p2: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['KeyW'], punch: ['KeyF'], item: ['KeyG'], pause: ['Escape'] },
};

export function keyLabel(code) {
  if (!code) return '-';
  const m = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Comma: ',', Period: '.', Slash: '/', Escape: 'Esc', Enter: 'Enter', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Tab: 'Tab' };
  if (m[code]) return m[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

class InputSystem {
  constructor() {
    this.down = new Set();
    this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    this.touch = [null, null];
    this.typing = false;
    this.listeners = [];
    this.capture = null; // 키 변경 대기 콜백
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(e.code); return; }
      if (this.typing) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) for (const l of this.listeners) l(e.code, e);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => this.down.clear());
  }
  setKeys(k) {
    const d = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    if (k) for (const p in d) for (const a in d[p]) if (Array.isArray(k?.[p]?.[a]) && k[p][a].length) d[p][a] = k[p][a].slice(0, 3);
    this.keys = d;
  }
  onKey(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }

  keyBits(profile) {
    if (this.typing) return 0;
    const k = this.keys[profile];
    let b = 0;
    for (const [a, bit] of ACTIONS) if (k[a].some(c => this.down.has(c))) b |= bit;
    return b;
  }

  padBits(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const list = [];
    for (const p of pads) if (p && p.connected) list.push(p);
    const p = list[i];
    if (!p) return 0;
    let b = 0;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const bt = (n) => p.buttons[n] && p.buttons[n].pressed;
    if (ax < -0.4 || bt(14)) b |= B.L;
    if (ax > 0.4 || bt(15)) b |= B.R;
    if (ay < -0.5 || bt(12)) b |= B.U;
    if (ay > 0.5 || bt(13)) b |= B.D;
    if (bt(0)) b |= B.J;
    if (bt(2) || bt(3)) b |= B.P;
    if (bt(1) || bt(5) || bt(7)) b |= B.I;
    if (bt(9)) b |= B.PAUSE;
    return b;
  }

  // 슬롯별 입력: solo, p1, p2
  read(slot) {
    let b = 0;
    if (slot === 'solo') { b = this.keyBits('solo') | this.padBits(0); if (this.touch[0]) b |= this.touch[0].bits; }
    else if (slot === 'p1') { b = this.keyBits('p1') | this.padBits(0); if (this.touch[0]) b |= this.touch[0].bits; }
    else if (slot === 'p2') { b = this.keyBits('p2') | this.padBits(1); if (this.touch[1]) b |= this.touch[1].bits; }
    return b;
  }
}

export const Input = new InputSystem();
