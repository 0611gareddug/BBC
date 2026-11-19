import { VW, VH } from '../core/constants.js';
import { PAL, charPreview, portrait, makeCanvas, CF_W, CF_H } from '../gfx/sprites.js';
import { backdrop } from '../gfx/tilegfx.js';
import { Input, B } from '../core/input.js';
import { Sound } from '../core/audio.js';
import { Save } from '../core/save.js';
import { wrap, textOutline, Show } from '../game/show.js';
import { FX } from '../game/entities.js';

const name = () => Save.data.name || '참가자';

export const SCENES = {
  opening: [
    { theme: 0, show: ['mc'], who: 'mc', text: () => '생방송 블록쇼 라이브! 오늘의 마지막 참가자를 소개합니다!' },
    { theme: 0, show: ['player', 'mc'], who: 'mc', text: () => `${name()} 님! 우승 상금은 무려… 반짝이는 황금 트로피!`, crowd: 'cheer' },
    { theme: 0, show: ['mc'], who: 'mc', dim: true, text: () => '(속닥) 물론 아무도 못 가져가게 무대를 아주 어렵게 만들어 뒀지만요. 후후.' },
    { theme: 0, show: ['pink', 'player'], who: 'pink', text: () => '핑크: 참가자님, 저는 어시스턴트 핑크예요. 몰래 힌트를 드릴게요. 힘내세요!' },
  ],
  after1: [
    { theme: 0, show: ['mc'], who: 'mc', text: () => '셰프 터보가 졌다고요?! …좋아요. 다음 무대는 퀴즈쇼입니다!' },
    { theme: 1, show: ['pink', 'player'], who: 'pink', text: () => '핑크: MC가 정답 패널을 몰래 조작하려나 봐요. 표지판 문제를 잘 읽어요!' },
  ],
  after2: [
    { theme: 1, show: ['mc'], who: 'mc', text: () => '퀴즈박스까지?! 이러면 시청률이… 아니, 상금이…!', crowd: 'oh' },
    { theme: 1, show: ['pink', 'player'], who: 'pink', text: () => '핑크: 큰일이에요! MC의 금고를 봤는데, 황금 트로피가 가짜였어요!' },
    { theme: 2, show: ['mc'], who: 'mc', dim: true, text: () => '쉿! 마지막 무대, 디스코 쇼에서 끝장을 내주겠어요!' },
  ],
  ending: [
    { theme: 2, show: ['mc'], who: 'mc', text: () => '말도 안 돼… 내 미러볼이… 내 생방송이…!', crowd: 'oh' },
    { theme: 2, show: ['player', 'mc'], who: 'mc', text: () => '그 순간, 생방송 카메라가 모든 장면을 비추고 있었습니다.', camera: true },
    { theme: 2, show: ['pink'], who: 'pink', text: () => '핑크: 오늘부터 제가 새 MC예요! 그리고 진짜 트로피는… 바로 여기!', crowd: 'cheer' },
    { theme: 2, show: ['player', 'trophy'], who: 'pink', text: () => `축하합니다! ${name()} 님, 블록쇼 라이브의 첫 번째 우승자!`, crowd: 'cheer', confetti: true },
    { theme: 2, show: ['player', 'trophy'], who: 'mc', bonus: true, text: () => '보너스 장면: 별 45개를 모두 모은 전설의 참가자! 객석 전원 기립 박수!', crowd: 'cheer', confetti: true },
  ],
};

let big = {};
function bigPortrait(who) {
  if (big[who]) return big[who];
  const src = portrait(who);
  const [c, g] = makeCanvas(64, 64);
  g.drawImage(src, 0, 0, 64, 64);
  big[who] = c;
  return c;
}

export class CutsceneMode {
  constructor(app, id, onDone) {
    this.app = app; this.onDone = onDone;
    this.kind = 'cutscene';
    const all = SCENES[id] || [];
    const allStars = Save.totalStars() >= 45;
    this.panels = all.filter(p => !p.bonus || allStars);
    this.i = 0; this.t = 0; this.shown = 0;
    this.fx = new FX();
    this.show = new Show({ disco: true });
    this.prev = 0xff;
    this.look = Save.data.look;
    this.pv = charPreview(this.look, 3, 'idle0');
    this.pvWin = charPreview(this.look, 3, 'win0');
    Sound.music(id === 'ending' ? 'ending' : 'title');
    this.enterPanel();
    this.app.ui.cutsceneOverlay(() => this.skip());
  }
  enterPanel() {
    const p = this.panels[this.i];
    if (!p) return;
    this.t = 0; this.shown = 0; this.text = p.text();
    if (p.crowd) this.show.crowdReact(p.crowd);
    if (p.confetti) this.fx.confetti(0, VW, 0, 120);
    if (p.camera) Sound.play('flash');
  }
  next() {
    if (this.shown < this.text.length) { this.shown = this.text.length; return; }
    Sound.play('select');
    this.i++;
    if (this.i >= this.panels.length) { this.finish(); return; }
    this.enterPanel();
  }
  skip() { this.finish(); }
  finish() {
    if (this.done) return;
    this.done = true;
    this.app.ui.cutsceneOverlay(null);
    this.onDone && this.onDone();
  }
  tap() { this.next(); }
  update() {
    if (this.done) return;
    this.t++;
    this.shown = Math.min(this.text.length, this.shown + 0.7);
    const b = Input.read('solo');
    const pressed = b & ~this.prev; this.prev = b;
    if (pressed & (B.J | B.P | B.I)) this.next();
    if (pressed & B.PAUSE) this.skip();
    this.fx.update(); this.show.update();
  }
  draw(g) {
    const p = this.panels[Math.min(this.i, this.panels.length - 1)];
    if (!p) return;
    g.drawImage(backdrop(p.theme), 0, 0);
    // 무대 바닥
    g.fillStyle = '#2a1a10'; g.fillRect(0, 190, VW, 80);
    g.fillStyle = '#4a2e1c'; for (let x = 0; x < VW; x += 24) g.fillRect(x, 190, 22, 3);
    g.fillStyle = PAL.ink; g.fillRect(0, 188, VW, 2);
    // 스포트라이트
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(254,231,97,0.10)';
    g.beginPath(); g.moveTo(230, 0); g.lineTo(250, 0); g.lineTo(330, 200); g.lineTo(150, 200); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    const bob = Math.round(Math.sin(this.t / 12) * 2);
    const slots = p.show.length === 1 ? [240] : [150, 320];
    p.show.forEach((who, k) => {
      const cx = slots[k];
      if (who === 'player') {
        const img = p.confetti ? this.pvWin : this.pv;
        g.drawImage(img, cx - img.width / 2, 192 - img.height + 6 + (p.confetti ? bob : 0));
      } else if (who === 'trophy') {
        const x = cx - 20, y = 120 + bob;
        g.fillStyle = PAL.ink; g.fillRect(x, y, 40, 30); g.fillRect(x + 14, y + 30, 12, 20); g.fillRect(x + 6, y + 50, 28, 8);
        g.fillStyle = PAL.gold; g.fillRect(x + 2, y + 2, 36, 26); g.fillRect(x + 16, y + 30, 8, 20); g.fillRect(x + 8, y + 52, 24, 4);
        g.fillStyle = PAL.lyellow; g.fillRect(x + 6, y + 4, 6, 18);
        g.fillStyle = PAL.dgold; g.fillRect(x + 30, y + 4, 6, 22);
        if ((this.t >> 3) & 1) { g.fillStyle = PAL.white; g.fillRect(x + 8, y + 6, 2, 2); }
      } else {
        const img = bigPortrait(who);
        const bodyCol = who === 'mc' ? PAL.slate : PAL.pink;
        g.fillStyle = PAL.ink; g.fillRect(cx - 26, 140 + bob, 52, 52);
        g.fillStyle = bodyCol; g.fillRect(cx - 24, 142 + bob, 48, 48);
        if (who === 'mc') { g.fillStyle = PAL.white; g.fillRect(cx - 6, 142 + bob, 12, 18); g.fillStyle = PAL.red; g.fillRect(cx - 3, 146 + bob, 6, 10); }
        else { g.fillStyle = PAL.white; g.fillRect(cx - 14, 150 + bob, 28, 4); }
        g.drawImage(img, cx - 32, 84 + bob);
      }
    });
    if (p.dim) { g.fillStyle = 'rgba(11,11,30,0.45)'; g.fillRect(0, 0, VW, VH); }
    if (p.camera && this.t < 20) { g.fillStyle = `rgba(255,255,255,${1 - this.t / 20})`; g.fillRect(0, 0, VW, VH); }
    this.fx.draw(g, { x: 0, y: 0 });
    this.show.drawAudience(g);
    // 대사 상자
    g.font = '12px Galmuri11';
    const lines = wrap(g, this.text, 380);
    const h = 22 + lines.length * 15;
    const x = 30, y = 200 - h + 30, w = VW - 60;
    g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = p.who === 'pink' ? '#3b1a2c' : '#1d2240'; g.fillRect(x, y, w, h);
    g.fillStyle = p.who === 'pink' ? PAL.pink : PAL.yellow; g.fillRect(x, y, 4, h);
    g.drawImage(portrait(p.who), x + 10, y + 8);
    let left = Math.floor(this.shown);
    lines.forEach((ln, i) => {
      g.fillStyle = PAL.white; g.fillText(ln.slice(0, Math.max(0, left)), x + 34, y + 18 + i * 15);
      left -= ln.length;
    });
    if (this.shown >= this.text.length && (this.t >> 4) & 1) { g.fillStyle = PAL.yellow; g.fillRect(x + w - 14, y + h - 10, 6, 4); g.fillRect(x + w - 13, y + h - 6, 4, 2); }
    g.font = '8px Galmuri9'; g.fillStyle = PAL.gray; g.fillText(`${this.i + 1}/${this.panels.length}`, x + w - 30, y + 10);
  }
  exit() {}
}

// 타이틀 배경: 무대 위에서 춤추는 참가자
export class TitleMode {
  constructor(app) {
    this.app = app; this.kind = 'title'; this.t = 0;
    this.fx = new FX(); this.show = new Show({ disco: true });
    this.refresh();
  }
  refresh() {
    this.look = Save.data.look;
    this.frames = ['win0', 'win1', 'idle0', 'run0', 'run2', 'jump'].map(f => charPreview(this.look, 3, f));
  }
  update() {
    this.t++; this.fx.update(); this.show.update();
    if (this.t % 240 === 1) this.show.crowdReact(['cheer', 'clap'][(this.t / 240 | 0) % 2], false);
    if (this.t % 90 === 0) this.fx.confetti(0, VW, 0, 20);
  }
  draw(g) {
    const th = Math.floor(this.t / 600) % 3;
    g.drawImage(backdrop(th), 0, 0);
    g.fillStyle = '#2a1a10'; g.fillRect(0, 196, VW, 80);
    g.fillStyle = '#4a2e1c'; for (let x = (this.t >> 1) % 24 - 24; x < VW; x += 24) g.fillRect(x, 196, 22, 3);
    g.fillStyle = PAL.ink; g.fillRect(0, 194, VW, 2);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const a = Math.sin(this.t / 50 + i * 3) * 80;
      g.fillStyle = i ? 'rgba(255,79,163,0.10)' : 'rgba(63,247,217,0.10)';
      g.beginPath(); g.moveTo(120 + i * 240, 0); g.lineTo(130 + i * 240, 0); g.lineTo(240 + a + 60, 200); g.lineTo(240 + a - 60, 200); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const seq = [0, 1, 0, 1, 2, 5, 2, 3, 4, 3];
    const f = this.frames[seq[(this.t >> 4) % seq.length]];
    const hop = seq[(this.t >> 4) % seq.length] === 5 ? -8 : 0;
    g.drawImage(f, VW - 92 - f.width / 2, 198 - f.height + 6 + hop);
    this.fx.draw(g, { x: 0, y: 0 });
    this.show.drawAudience(g);
  }
  exit() {}
}
