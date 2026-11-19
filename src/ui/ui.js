import { Save } from '../core/save.js';
import { Sound } from '../core/audio.js';
import { Input, ACTIONS, keyLabel, B } from '../core/input.js';
import { STORY, CHAPTERS, VERSUS_MAPS } from '../data/levels.js';
import { charPreview, HAIRS, HATS, OUTFITS, FACES, SKINS, HAIR_COLORS, OUTFIT_COLORS, sanitizeLook } from '../gfx/sprites.js';
import { RULES } from '../modes/versus.js';
import { Touch } from './touch.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const starHtml = (arr) => `<span class="stars">${[0, 1, 2].map(i => arr && arr[i] ? '★' : '<span class="off">★</span>').join('')}</span>`;

export function isUnlocked(i) { return i === 0 || Save.isCleared(STORY[i - 1].id); }

function partLocked(item) {
  if (item.star && Save.totalStars() < item.star) return `별 ${item.star}개 필요`;
  if (item.boss && Save.data.bossClear < item.boss) return `챕터 ${item.boss} 보스 클리어`;
  return null;
}

export const UI = {
  app: null, root: null, acts: {}, back: null, active: false, padPrev: 0, padRepeat: 0,
  init(app) {
    this.app = app;
    this.root = $('#ui');
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const f = this.acts[el.dataset.act];
      if (f) { Sound.unlock(); Sound.play(el.dataset.snd || 'select'); f(el.dataset.arg, el, e); }
    });
    this.root.addEventListener('pointerover', (e) => { const b = e.target.closest('.btn'); if (b && e.pointerType === 'mouse') b.focus({ preventScroll: true }); });
    Input.onKey((code, e) => this.key(code, e));
    $('#skipbtn').addEventListener('click', () => this.skipFn && this.skipFn());
  },
  open(html, acts = {}, opts = {}) {
    this.root.innerHTML = html;
    this.root.classList.toggle('dim', !!opts.dim);
    this.acts = acts; this.back = opts.back || null; this.active = true;
    const first = opts.focus ? $(opts.focus, this.root) : $('.btn:not([disabled])', this.root);
    if (first && !Touch.isTouch()) first.focus({ preventScroll: true });
    this.app.hudButtons();
  },
  close() { this.root.innerHTML = ''; this.root.classList.remove('dim'); this.acts = {}; this.back = null; this.active = false; this.app.hudButtons(); },
  toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('on'), ms);
  },
  // 메뉴 키보드 조작
  key(code, e) {
    if (!this.active || Input.capture) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      if (code === 'Escape') ae.blur();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(code)) {
      const dir = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[code];
      this.moveFocus(dir); e?.preventDefault?.();
    } else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') {
      if (ae && ae.classList.contains('btn')) { e?.preventDefault?.(); ae.click(); }
    } else if (code === 'Escape' || code === 'KeyX' || code === 'Backspace') {
      if (this.back) { Sound.play('back'); this.back(); }
    }
  },
  moveFocus([dx, dy]) {
    const list = [...this.root.querySelectorAll('.btn:not([disabled]), input[type=range], .textin')].filter(b => b.offsetParent);
    if (!list.length) return;
    const cur = document.activeElement;
    if (!list.includes(cur)) { list[0].focus(); return; }
    if (cur.type === 'range' && dx) { cur.value = +cur.value + dx * (+cur.step || 1); cur.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bd = 1e9;
    for (const b of list) {
      if (b === cur) continue;
      const q = b.getBoundingClientRect(), bx = q.left + q.width / 2, by = q.top + q.height / 2;
      const ddx = bx - cx, ddy = by - cy;
      const along = ddx * dx + ddy * dy;
      if (along <= 4) continue;
      const perp = Math.abs(ddx * dy) + Math.abs(ddy * dx);
      const d = along + perp * 2.5;
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { best.focus({ preventScroll: false }); best.scrollIntoView({ block: 'nearest' }); Sound.play('move'); }
  },
  padNav() {
    if (!this.active) return;
    const b = Input.padBits(0);
    const pressed = b & ~this.padPrev;
    if (b & (B.L | B.R | B.U | B.D)) { if (++this.padRepeat > 18) { this.padRepeat = 12; this.padPrev = 0; } } else this.padRepeat = 0;
    this.padPrev = b;
    if (pressed & B.U) this.key('ArrowUp'); if (pressed & B.D) this.key('ArrowDown');
    if (pressed & B.L) this.key('ArrowLeft'); if (pressed & B.R) this.key('ArrowRight');
    if (pressed & B.J) { const ae = document.activeElement; if (ae && ae.classList.contains('btn')) ae.click(); }
    if (pressed & (B.I | B.PAUSE)) this.key('Escape');
  },

  /* ───── 타이틀 ───── */
  title() {
    this.open(`
      <div class="screen center" style="gap:18px">
        <div class="title-logo"><div class="bulbs"></div><h1>블록쇼 라이브!</h1><p>BLOCK SHOW LIVE</p></div>
        <button class="btn big primary blink" data-act="go">▶ 눌러서 방송 시작</button>
        <div class="small center">PC: 방향키·Z·X·C  |  모바일: 가로 화면 + 터치 패드</div>
      </div>`, { go: () => { Sound.unlock(); Sound.music('title'); this.mainMenu(); } });
  },

  mainMenu() {
    if (!Save.data.name) return this.askName(() => this.mainMenu());
    const stars = Save.totalStars();
    this.open(`
      <div class="screen">
        <div class="title-logo"><div class="bulbs"></div><h1 style="font-size:calc(var(--u)*1.8)">블록쇼 라이브!</h1><p>참가자 ${esc(Save.data.name)} · ★ ${stars}/45</p></div>
        <div class="menu-grid">
          <button class="btn big primary" data-act="story">🎬 스토리</button>
          <button class="btn big teal" data-act="versus">🥊 대전</button>
          <button class="btn big" data-act="custom">👕 꾸미기</button>
          <button class="btn big" data-act="settings">⚙ 설정</button>
        </div>
        <button class="btn" data-act="help">❔ 조작 방법</button>
      </div>`, {
      story: () => this.app.openStory(),
      versus: () => this.versusMenu(),
      custom: () => this.customize(() => this.mainMenu()),
      settings: () => this.settings(() => this.mainMenu()),
      help: () => this.help(() => this.mainMenu()),
    }, { back: () => this.title() });
  },

  askName(done) {
    this.open(`
      <div class="screen"><div class="panel col">
        <h2>참가자 이름을 알려주세요</h2>
        <div class="small">방송 자막과 대전 이름표에 나와요. (최대 8자)</div>
        <input class="textin" id="nm" maxlength="8" placeholder="예: 블록왕" value="${esc(Save.data.name)}" autocomplete="off" />
        <button class="btn primary big" data-act="ok">확인</button>
      </div></div>`, {
      ok: () => {
        const v = $('#nm').value.replace(/[<>]/g, '').trim().slice(0, 8);
        if (!v) { this.toast('이름을 입력해 주세요!'); return; }
        Save.data.name = v; Save.save(); done();
      },
    }, { focus: '#nm' });
    const inp = $('#nm');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.acts.ok(); e.stopPropagation(); });
    setTimeout(() => inp.focus(), 50);
  },

  help(back) {
    this.open(`
      <div class="screen"><div class="panel col">
        <h2>조작 방법</h2>
        <div class="score-board">
          <span>이동</span><b>← → (A D)</b>
          <span>점프 (길게 누르면 높이)</span><b>Z / Space</b>
          <span>펀치</span><b>X</b>
          <span>아이템 사용</span><b>C</b>
          <span>얇은 발판 내려가기</span><b>↓ + 점프</b>
          <span>벽 점프</span><b>벽 쪽으로 누르며 점프</b>
          <span>일시정지</span><b>Esc / P</b>
        </div>
        <div class="small">로컬 대전: 1P 방향키 + , . /  ·  2P W A S D + F G</div>
        <div class="small">모바일: 왼쪽 아무 곳이나 눌러 조이스틱, 오른쪽 A(점프) B(펀치) C(아이템). 오른쪽 위 ⛶ 로 전체 화면.</div>
        <div class="small">게임패드: 스틱/십자키 이동, A 점프, X 펀치, B 아이템, Start 일시정지</div>
        <button class="btn" data-act="back" data-snd="back">돌아가기</button>
      </div></div>`, { back }, { back });
  },

  /* ───── 스토리 선택 ───── */
  chapters() {
    const doors = CHAPTERS.map((c, ci) => {
      const first = c.stages[0];
      const open = isUnlocked(first);
      const got = c.stages.reduce((n, i) => n + (Save.stage(STORY[i].id)?.stars || []).filter(Boolean).length, 0);
      return `<button class="btn door t${ci}" data-act="ch" data-arg="${ci}" ${open ? '' : 'disabled'}>
        <span class="small">챕터 ${ci + 1}</span><span class="dname">${c.name}</span><div class="knob"></div>
        <span class="stars">★ ${got}/15</span>${open ? '' : '<span class="lock">🔒 잠김</span>'}</button>`;
    }).join('');
    this.open(`
      <div class="screen wide"><div class="panel col">
        <h2>🎬 스튜디오 선택</h2>
        <div class="doors">${doors}</div>
        <div class="row"><button class="btn" data-act="intro">▶ 오프닝 다시 보기</button><span class="grow"></span><button class="btn" data-act="back" data-snd="back">돌아가기</button></div>
      </div></div>`, {
      ch: (a) => this.stages(+a),
      intro: () => this.app.playCutscene('opening', () => this.chapters()),
      back: () => this.mainMenu(),
    }, { back: () => this.mainMenu() });
  },

  stages(ci, focusIdx) {
    const c = CHAPTERS[ci];
    const items = c.stages.map((i) => {
      const d = STORY[i], s = Save.stage(d.id), open = isUnlocked(i);
      const info = s ? `<span class="small">최고 ${s.best} · ${Math.floor(s.time / 60)}:${String(s.time % 60).padStart(2, '0')}</span>` : open ? '<span class="small">처음 도전</span>' : '<span class="lock">🔒</span>';
      return `<button class="btn stage-item" data-act="go" data-arg="${i}" ${open ? '' : 'disabled'} id="st${i}">
        <span class="no">${d.id}</span><span class="grow">${d.boss ? '👑 ' : ''}${esc(d.name)}<br>${info}</span>${starHtml(s?.stars)}</button>`;
    }).join('');
    this.open(`
      <div class="screen"><div class="panel col">
        <h2>챕터 ${ci + 1} · ${c.name} <span class="small">${c.sub}</span></h2>
        <div class="stage-list">${items}</div>
        <div class="star-why"><span>★ 클리어  ★ 목표 시간 안에  ★ 황금 보석 + 목숨 하나도 안 잃기 (보스: 피격 없이)</span></div>
        <button class="btn" data-act="back" data-snd="back">스튜디오 선택</button>
      </div></div>`, {
      go: (a) => this.app.startStage(+a),
      back: () => this.chapters(),
    }, { back: () => this.chapters(), focus: focusIdx != null ? '#st' + focusIdx : null });
  },

  /* ───── 결과 ───── */
  result(r) {
    const why = r.stage.boss ? ['보스 격파', `${r.stage.time}초 안에 클리어`, '한 번도 맞지 않기'] : ['클리어', `${r.stage.time}초 안에 클리어`, '황금 보석 + 목숨 그대로'];
    const next = r.idx + 1 < STORY.length ? r.idx + 1 : null;
    const unlockMsg = r.unlock ? `<div class="small" style="color:var(--lyellow)">🎁 새 꾸미기 아이템 해금! ${r.unlock === 1 ? '셰프 모자' : r.unlock === 2 ? '퀴즈 안경' : '디스코 재킷'}</div>` : '';
    this.open(`
      <div class="screen"><div class="panel col center">
        <h2 class="center">${r.stage.boss ? '보스 격파!' : '스테이지 클리어!'}</h2>
        <div class="small">${r.stage.id} ${esc(r.stage.name)}</div>
        <div class="result-stars">${r.stars.map((s, i) => `<span class="${s ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.35}s">★</span>`).join('')}</div>
        <div class="star-why">${why.map((w, i) => `<span>${r.stars[i] ? '✔' : '✘'} ${w}</span>`).join('')}</div>
        <div class="score-board">
          <span>보석</span><b>${r.gems}/${r.need}${r.gold ? ' + 황금' : ''}</b>
          <span>시간</span><b>${Math.floor(r.secs / 60)}:${String(r.secs % 60).padStart(2, '0')}</b>
          <span>시간 보너스</span><b>+${r.timeBonus}</b>
          <span>총점</span><b>${r.score}</b>
        </div>
        ${unlockMsg}
        <div class="row center">
          ${next != null ? '<button class="btn primary big" data-act="next">다음 무대 ▶</button>' : ''}
          <button class="btn" data-act="retry">다시 하기</button>
          <button class="btn" data-act="list" data-snd="back">목록</button>
        </div>
      </div></div>`, {
      next: () => this.app.afterStage(r, 'next'),
      retry: () => this.app.startStage(r.idx),
      list: () => this.app.afterStage(r, 'list'),
    }, { dim: true, back: () => this.app.afterStage(r, 'list') });
    r.stars.forEach((s, i) => s && setTimeout(() => Sound.play('star', i), 300 + i * 350));
  },
  gameOver(cb) {
    this.open(`
      <div class="screen"><div class="panel col center">
        <h2 class="center">📺 방송 사고!</h2>
        <div class="small">목숨을 모두 잃었어요. MC가 신나서 웃고 있어요…</div>
        <div class="row center"><button class="btn primary big" data-act="retry">다시 도전</button><button class="btn" data-act="quit" data-snd="back">나가기</button></div>
      </div></div>`, { retry: () => { this.close(); cb.retry(); }, quit: () => cb.quit() }, { dim: true, back: () => cb.quit() });
  },
  pause(cb, versus) {
    this.open(`
      <div class="screen"><div class="panel col center">
        <h2 class="center">📺 광고 후 계속됩니다</h2>
        <button class="btn primary big" data-act="resume">계속하기</button>
        <button class="btn" data-act="retry">${versus ? '처음부터' : '다시 하기'}</button>
        <button class="btn" data-act="set">설정</button>
        <button class="btn" data-act="quit" data-snd="back">나가기</button>
      </div></div>`, {
      resume: () => { this.close(); cb.resume(); },
      retry: () => { this.close(); cb.retry(); },
      set: () => this.settings(() => this.pause(cb, versus), true),
      quit: () => { this.close(); cb.quit(); },
    }, { dim: true, back: () => { this.close(); cb.resume(); } });
  },
  alert(msg, ok) {
    this.open(`<div class="screen"><div class="panel col center"><h2 class="center">알림</h2><div>${esc(msg)}</div><button class="btn primary" data-act="ok">확인</button></div></div>`,
      { ok: () => ok && ok() }, { dim: true, back: () => ok && ok() });
  },
  cutsceneOverlay(fn) {
    this.skipFn = fn;
    $('#skipbtn').classList.toggle('on', !!fn);
    if (fn) this.close();
  },

  /* ───── 꾸미기 ───── */
  customize(back) {
    const look = { ...Save.data.look };
    const parts = [
      ['hair', '머리', HAIRS], ['hat', '모자', HATS], ['outfit', '의상', OUTFITS], ['face', '얼굴', FACES],
      ['skin', '피부', SKINS], ['hairColor', '머리색', HAIR_COLORS], ['outfitColor', '옷 색', OUTFIT_COLORS],
    ];
    const render = () => {
      const rows = parts.map(([k, label, list]) => {
        const it = list[look[k]];
        const lk = typeof it === 'object' ? partLocked(it) : null;
        const val = typeof it === 'string' ? `<span class="swatch" style="background:${it}"></span>` : `${esc(it.name)}${lk ? ` <span class="lock">🔒</span>` : ''}`;
        return `<div class="opt"><span class="small">${label}</span><button class="btn icon" data-act="prev" data-arg="${k}" data-snd="move">◀</button><div class="val">${val}</div><button class="btn icon" data-act="next" data-arg="${k}" data-snd="move">▶</button></div>`;
      }).join('');
      const locked = parts.map(([k, , list]) => typeof list[look[k]] === 'object' ? partLocked(list[look[k]]) : null).filter(Boolean);
      const focusArg = document.activeElement?.dataset?.arg, focusAct = document.activeElement?.dataset?.act;
      this.open(`
        <div class="screen wide"><div class="panel col">
          <h2>👕 분장실</h2>
          <div class="custom">
            <div class="col center"><div class="mirror"><canvas id="pv" width="60" height="90"></canvas></div>
              <div class="small center">${esc(Save.data.name)}</div>
              <button class="btn" data-act="name">이름 바꾸기</button></div>
            <div class="col">${rows}
              ${locked.length ? `<div class="small" style="color:var(--pink)">잠긴 아이템: ${locked.join(', ')}</div>` : ''}
              <div class="row"><button class="btn" data-act="rand">🎲 무작위</button><span class="grow"></span>
              <button class="btn primary" data-act="save" ${locked.length ? 'disabled' : ''}>저장</button><button class="btn" data-act="back" data-snd="back">취소</button></div>
            </div>
          </div>
        </div></div>`, acts, { back });
      const c = $('#pv'), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(charPreview(look, 3, 'idle0'), 0, 0);
      if (focusAct) { const b = this.root.querySelector(`[data-act="${focusAct}"][data-arg="${focusArg}"]`) || this.root.querySelector(`[data-act="${focusAct}"]`); b && b.focus(); }
    };
    const lists = Object.fromEntries(parts.map(([k, , l]) => [k, l]));
    const acts = {
      prev: (k) => { look[k] = (look[k] - 1 + lists[k].length) % lists[k].length; render(); },
      next: (k) => { look[k] = (look[k] + 1) % lists[k].length; render(); },
      rand: () => {
        for (const [k, , l] of parts) {
          const ok = l.map((it, i) => (typeof it === 'object' && partLocked(it)) ? -1 : i).filter(i => i >= 0);
          look[k] = ok[Math.floor(Math.random() * ok.length)];
        }
        render();
      },
      save: () => { Save.data.look = sanitizeLook(look); Save.save(); this.app.lookChanged(); this.toast('저장했어요!'); back(); },
      name: () => this.askName(() => this.customize(back)),
      back: () => back(),
    };
    render();
  },

  /* ───── 설정 ───── */
  settings(back, inGame) {
    const s = Save.data.settings;
    let prof = 'solo';
    const render = () => {
      const keys = Input.keys[prof];
      const keyRows = ACTIONS.map(([a, , label]) => `<div class="opt" style="grid-template-columns: 5em 1fr 1fr"><span class="small">${label}</span>
        <button class="btn" data-act="bind" data-arg="${a}">${keyLabel(keys[a][0])}</button><span class="small">${keys[a].slice(1).map(keyLabel).join(' ')}</span></div>`).join('');
      this.open(`
        <div class="screen"><div class="panel col">
          <h2>⚙ 설정</h2>
          <div class="slider"><span>음악</span><input type="range" min="0" max="1" step="0.1" value="${s.music}" data-k="music"><span>${Math.round(s.music * 10)}</span></div>
          <div class="slider"><span>효과음</span><input type="range" min="0" max="1" step="0.1" value="${s.sfx}" data-k="sfx"><span>${Math.round(s.sfx * 10)}</span></div>
          <div class="slider"><span>버튼 크기</span><input type="range" min="0.8" max="1.4" step="0.1" value="${s.btnScale}" data-k="btnScale"><span>${Math.round(s.btnScale * 100)}%</span></div>
          <div class="slider"><span>버튼 투명도</span><input type="range" min="0.2" max="0.9" step="0.1" value="${s.btnAlpha}" data-k="btnAlpha"><span>${Math.round(s.btnAlpha * 100)}%</span></div>
          <div class="row"><button class="btn toggle ${s.vibrate ? 'sel' : ''}" data-act="tg" data-arg="vibrate">${s.vibrate ? '켜짐' : '꺼짐'}</button><span>진동</span>
          <button class="btn toggle ${s.shake ? 'sel' : ''}" data-act="tg" data-arg="shake">${s.shake ? '켜짐' : '꺼짐'}</button><span>화면 흔들림</span></div>
          <h2 style="margin-top:6px">⌨ 키 설정</h2>
          <div class="seg">${[['solo', '1인'], ['p1', '대전 1P'], ['p2', '대전 2P']].map(([p, n]) => `<button class="btn ${p === prof ? 'sel' : ''}" data-act="prof" data-arg="${p}">${n}</button>`).join('')}</div>
          ${keyRows}
          <div class="row"><button class="btn" data-act="keyreset">키 초기화</button></div>
          ${inGame ? '' : `<h2 style="margin-top:6px">💾 저장</h2>
          <div class="row"><button class="btn" data-act="exp">저장 코드 내보내기</button><button class="btn" data-act="imp">불러오기</button><button class="btn" data-act="reset">기록 초기화</button></div>
          ${Save.ok ? '' : '<div class="small" style="color:var(--pink)">이 브라우저에서는 기록이 저장되지 않아요. (시크릿 모드 등)</div>'}`}
          <button class="btn primary" data-act="back" data-snd="back">완료</button>
        </div></div>`, acts, { back: done });
      this.root.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => {
        s[r.dataset.k] = +r.value; r.nextElementSibling.textContent = r.dataset.k.startsWith('btn') ? Math.round(+r.value * 100) + '%' : Math.round(+r.value * 10);
        Sound.setVolume(s.music, s.sfx); Touch.relayout();
      }));
    };
    const done = () => { Save.save(); back(); };
    const acts = {
      tg: (k) => { s[k] = !s[k]; render(); },
      prof: (p) => { prof = p; render(); },
      bind: (a, el) => {
        el.textContent = '키를 누르세요…';
        Input.capture = (code) => {
          if (code !== 'Escape') {
            Input.keys[prof][a] = [code, ...Input.keys[prof][a].filter(c => c !== code)].slice(0, 3);
            s.keys = Input.keys; Save.save();
          }
          render();
        };
      },
      keyreset: () => { s.keys = null; Input.setKeys(null); Save.save(); render(); },
      exp: async () => {
        const code = Save.exportCode();
        try { await navigator.clipboard.writeText(code); this.toast('저장 코드를 복사했어요! 다른 기기의 "불러오기"에 붙여넣으세요.', 3500); }
        catch { prompt('이 코드를 복사해 두세요:', code); }
      },
      imp: () => {
        const code = prompt('저장 코드를 붙여넣으세요');
        if (!code) return;
        if (Save.importCode(code)) { Input.setKeys(Save.data.settings.keys); this.app.lookChanged(); this.toast('불러왔어요!'); render(); } else this.toast('코드가 올바르지 않아요.');
      },
      reset: () => { if (confirm('모든 클리어 기록과 별을 지울까요? (되돌릴 수 없어요)')) { Save.reset(); this.app.lookChanged(); this.toast('기록을 초기화했어요.'); render(); } },
      back: done,
    };
    render();
  },

  /* ───── 대전 ───── */
  versusMenu() {
    this.open(`
      <div class="screen"><div class="panel col">
        <h2>🥊 대전 모드</h2>
        <button class="btn big teal" data-act="local">👥 같은 기기에서 2인 대전</button>
        <button class="btn big primary" data-act="host">📡 방 만들기 (온라인)</button>
        <button class="btn big" data-act="join">🔑 코드로 참가하기</button>
        <div class="small">온라인은 방 코드 4자리로 다른 기기와 직접 연결해요. 일부 회사·학교 와이파이에서는 연결이 막힐 수 있어요.</div>
        <button class="btn" data-act="back" data-snd="back">돌아가기</button>
      </div></div>`, {
      local: () => this.localSetup(),
      host: () => this.app.hostOnline(),
      join: () => this.joinScreen(),
      back: () => this.mainMenu(),
    }, { back: () => this.mainMenu() });
  },

  settingsBlock(st, editable) {
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="btn ${st[key] === v ? 'sel' : ''}" data-act="set" data-arg="${key}:${v}" ${editable ? '' : 'disabled'}>${n}</button>`).join('')}</div>`;
    return `
      <div class="small">규칙</div>${seg('rule', Object.entries(RULES))}
      <div class="small">무대</div>${seg('map', [[-1, '무작위'], ...VERSUS_MAPS.map((m, i) => [i, m.name])])}
      <div class="small">제한 시간 · 판 수</div>${seg('time', [[120, '2분'], [180, '3분'], [300, '5분']])}${seg('rounds', [[1, '1판'], [3, '3판'], [5, '5판']])}
      <div class="small">아이템 · 팀</div>${seg('items', [[true, '아이템 켜기'], [false, '끄기']])}${st.players > 2 || st.teamsAllowed ? seg('teams', [[false, '개인전'], [true, '2:2 팀전']]) : ''}`;
  },
  applySetting(st, arg) {
    const [k, v] = arg.split(':');
    st[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  },

  localSetup() {
    const st = this.localSettings ||= { rule: 'gems', map: -1, time: 180, rounds: 3, items: true, teams: false };
    const render = () => this.open(`
      <div class="screen"><div class="panel col">
        <h2>👥 2인 대전 준비</h2>
        ${this.settingsBlock(st, true)}
        <div class="small">1P: ${esc(Save.data.name)} (방향키 + , . /) · 2P: 친구 (W A S D + F G). 모바일은 화면 왼쪽·오른쪽을 나눠 써요.</div>
        <div class="row"><button class="btn primary big grow" data-act="start">대전 시작!</button><button class="btn" data-act="back" data-snd="back">돌아가기</button></div>
      </div></div>`, {
      set: (a) => { this.applySetting(st, a); render(); },
      start: () => this.app.startLocalVersus({ ...st, teams: false }),
      back: () => this.versusMenu(),
    }, { back: () => this.versusMenu() });
    render();
  },

  joinScreen(prefill = '') {
    this.open(`
      <div class="screen"><div class="panel col">
        <h2>🔑 코드로 참가</h2>
        <input class="textin code-in" id="code" maxlength="4" placeholder="ABCD" value="${esc(prefill)}" autocomplete="off" autocapitalize="characters" />
        <div class="row"><button class="btn primary big grow" data-act="go">참가하기</button><button class="btn" data-act="back" data-snd="back">돌아가기</button></div>
        <div class="small" id="jmsg"></div>
      </div></div>`, {
      go: () => { const c = $('#code').value; if (c.replace(/\W/g, '').length !== 4) { this.toast('4자리 코드를 입력해 주세요.'); return; } $('#jmsg').textContent = '연결하는 중…'; this.app.joinOnline(c); },
      back: () => this.versusMenu(),
    }, { back: () => this.versusMenu(), focus: '#code' });
    const inp = $('#code');
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.acts.go(); });
    if (!prefill) setTimeout(() => inp.focus(), 50);
  },
  joinMsg(t) { const m = $('#jmsg'); if (m) m.textContent = t; },

  // 대기실 (lobby: {code, players, settings, isHost, myId})
  lobby(L, acts) {
    const cards = [0, 1, 2, 3].map(i => {
      const p = L.players[i];
      if (!p) return `<div class="pcard empty"><span class="small">빈 자리</span></div>`;
      const teamTxt = L.settings.teams ? `<span class="small" style="color:${p.team % 2 ? 'var(--teal)' : 'var(--red)'}">${p.team % 2 ? '파랑 팀' : '빨강 팀'}</span>` : '';
      const ready = p.host ? '<span class="rd" style="color:var(--lyellow)">👑 방장</span>' : p.ready ? '<span class="rd" style="color:var(--green)">✔ 준비 완료</span>' : '<span class="rd small">준비 중…</span>';
      const mute = p.id !== L.myId ? `<button class="btn icon" style="min-height:32px;min-width:32px;font-size:12px" data-act="mute" data-arg="${p.id}">${L.muted?.has(p.id) ? '🔇' : '🔈'}</button>` : '';
      return `<div class="pcard"><canvas data-look='${esc(JSON.stringify(p.look))}' width="20" height="30"></canvas><div class="col grow" style="gap:2px"><span class="nm">${esc(p.name)}${p.id === L.myId ? ' (나)' : ''}</span>${ready}${teamTxt}</div>${mute}</div>`;
    }).join('');
    const me = L.players.find(p => p.id === L.myId);
    const allReady = L.players.length >= 2 && L.players.every(p => p.host || p.ready);
    const st = { ...L.settings, players: L.players.length, teamsAllowed: L.players.length === 4 };
    const hostBtns = L.isHost
      ? `<button class="btn primary big grow" data-act="start" ${allReady ? '' : 'disabled'}>${L.players.length < 2 ? '참가자를 기다리는 중…' : allReady ? '방송 시작!' : '모두 준비하면 시작'}</button>`
      : `<button class="btn ${me?.ready ? 'sel' : 'primary'} big grow" data-act="ready">${me?.ready ? '✔ 준비 완료 (취소)' : '준비하기'}</button>`;
    const prevLog = $('#chatlog')?.innerHTML || '';
    this.open(`
      <div class="screen wide"><div class="lobby">
        <div class="panel col">
          <h2>📡 대기실</h2>
          <div class="small center">방 코드</div>
          <div class="code-big">${esc(L.code)}</div>
          <div class="row center"><button class="btn yellow" data-act="copy">🔗 초대 링크 복사</button></div>
          <div class="pcards">${cards}</div>
          ${L.settings.teams ? '<button class="btn" data-act="team">팀 바꾸기</button>' : ''}
        </div>
        <div class="panel col">
          <h2>${L.isHost ? '방송 설정' : '방송 설정 (방장이 정해요)'}</h2>
          ${this.settingsBlock(st, L.isHost)}
          <div class="chat"><div class="chat-log" id="chatlog">${prevLog}</div>
            <div class="row"><input class="textin grow" id="chatin" maxlength="60" placeholder="채팅 (Enter)" autocomplete="off" /><button class="btn" data-act="send">보내기</button></div></div>
          <div class="row">${hostBtns}<button class="btn" data-act="leave" data-snd="back">나가기</button></div>
        </div>
      </div></div>`, acts, { back: acts.leave, focus: '.btn' });
    this.root.querySelectorAll('canvas[data-look]').forEach(c => { try { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(charPreview(sanitizeLook(JSON.parse(c.dataset.look)), 1, 'idle0'), 0, 0); } catch { /* 무시 */ } });
    const ci = $('#chatin');
    ci.addEventListener('focus', () => { Input.typing = true; });
    ci.addEventListener('blur', () => { Input.typing = false; });
    ci.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') acts.send(); });
    const log = $('#chatlog'); log.scrollTop = log.scrollHeight;
  },
  chatLine(name, color, text) {
    const log = $('#chatlog');
    if (!log) return;
    const d = document.createElement('div');
    d.innerHTML = `<span style="color:${esc(color)}">${esc(name)}</span>: ${esc(text)}`;
    log.appendChild(d);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  },

  versusResult(r, cb) {
    const rows = r.list.map((p, i) => `<span>${i === 0 && !r.abort ? '🏆 ' : ''}<span style="color:${esc(p.color)}">■</span> ${esc(p.name)}</span><b>${p.wins}승</b>`).join('');
    const title = r.abort ? '대전이 중단됐어요' : r.teams ? `${r.list[0].team % 2 ? '파랑 팀' : '빨강 팀'} 우승!` : `${esc(r.list[0].name)} 우승!`;
    this.open(`
      <div class="screen"><div class="panel col center">
        <h2 class="center">${title}</h2>
        <div class="small">${RULES[r.rule] || ''}</div>
        <div class="score-board">${rows}</div>
        <div class="row center">
          ${cb.client ? '<span class="small">방장이 대기실로 돌아가면 함께 이동해요.</span>' : `<button class="btn primary big" data-act="again">${cb.online ? '대기실로' : '다시 하기'}</button>`}
          <button class="btn" data-act="quit" data-snd="back">${cb.online ? '방 나가기' : '메뉴로'}</button>
        </div>
      </div></div>`, { again: () => cb.again?.(), quit: () => cb.quit() }, { dim: true, back: () => cb.quit() });
  },
};
