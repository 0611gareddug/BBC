// 레벨 도달 가능성 검사 (개략적 BFS). 사용: node scripts/validate-levels.mjs
import { STORY, VERSUS_MAPS } from '../src/data/levels.js';

const SOLID = new Set('#JHSB<>CIgZTOXRr'.split(''));
const ONEWAY = new Set(['=']);
const DOOR = new Set(['D', 'd']);

function check(def) {
  const rows = def.map;
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y < 0 ? '.' : y >= H ? '.' : x < 0 || x >= W ? '#' : (rows[y][x] || '.'));
  const solid = (x, y) => SOLID.has(at(x, y));
  const support = (x, y) => SOLID.has(at(x, y)) || ONEWAY.has(at(x, y)) || DOOR.has(at(x, y));
  const blocked = (x, y) => solid(x, y); // 문은 열 수 있다고 가정
  const hazard = (x, y) => '^v'.includes(at(x, y));
  // 움직이는 발판 경로를 지지대로 취급
  const extra = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) === 'm') { let a = x, b = x + 1; while (a > 0 && at(a - 1, y) !== 'x' && !solid(a - 1, y)) a--; while (b < W - 1 && at(b + 1, y) !== 'x' && !solid(b + 1, y)) b++; for (let i = a; i <= b; i++) extra.add(i + ',' + y); }
    if (at(x, y) === 'n') { let t = y; while (t > 0 && at(x, t - 1) !== 'x' && !solid(x, t - 1)) t--; for (let i = t; i <= y; i++) { extra.add(x + ',' + i); extra.add((x + 1) + ',' + i); } }
  }
  const sup = (x, y) => support(x, y) || extra.has(x + ',' + y);
  const stand = (x, y) => y >= 0 && y < H && !blocked(x, y) && !hazard(x, y) && sup(x, y + 1);
  const pad = (x, y) => at(x, y + 1) === 'J';
  let start = null; const targets = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (c === '@' && !start) start = [x, y];
    if ('*$EK'.includes(c)) targets.push([x, y, c]);
  }
  if (!start) return ['시작점 없음'];
  const seen = new Set(); const q = [start]; seen.add(start + '');
  const push = (x, y) => { const k = x + ',' + y; if (!seen.has(k) && stand(x, y)) { seen.add(k); q.push([x, y]); } };
  const fallTo = (x, y) => { for (let yy = y; yy < H; yy++) { if (blocked(x, yy)) return null; if (hazard(x, yy)) return null; if (stand(x, yy)) return [x, yy]; } return null; };
  const clearCol = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (blocked(x, y)) return false; return true; };
  const clearRow = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (blocked(x, y)) return false; return true; };
  const warps = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(x, y); if ('WwYy'.includes(c)) warps[c] = [x, y]; }
  const pair = { W: 'w', w: 'W', Y: 'y', y: 'Y' };
  while (q.length) {
    const [x, y] = q.shift();
    // 워프
    const wc = at(x, y);
    if (pair[wc] && warps[pair[wc]]) { const [wx, wy] = warps[pair[wc]]; const f = fallTo(wx, wy); if (f) push(...f); }
    for (const dx of [-1, 1]) {
      if (!blocked(x + dx, y)) { if (stand(x + dx, y)) push(x + dx, y); else { const f = fallTo(x + dx, y); if (f) push(...f); } }
    }
    const up = pad(x, y) ? 6 : 3;
    for (let dy = -up; dy <= 8; dy++) {
      const maxDx = dy <= -3 ? (up > 3 ? 3 : 2) : dy === -2 ? 3 : dy <= 0 ? 4 : Math.min(7, 4 + Math.floor(dy / 2));
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!stand(tx, ty)) continue;
        const top = Math.min(y, ty) - (dy < 0 ? 0 : 1);
        if (!clearCol(x, y, top) || !clearRow(top, x, tx) || !clearCol(tx, top, ty)) continue;
        push(tx, ty);
      }
    }
    // 벽 점프 통로 (좁은 수직 통로)
    let r = y - 1, skip = 0;
    const inShaft = (rr) => (blocked(x - 1, rr) || blocked(x - 2, rr)) && (blocked(x + 1, rr) || blocked(x + 2, rr));
    while (r >= 0 && skip < 3 && !blocked(x, r) && !inShaft(r)) { r--; skip++; }
    const s0 = r;
    while (r >= 0 && !blocked(x, r) && inShaft(r)) r--;
    if (r < s0 - 2) {
      for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 3; dy++) if (stand(x + dx, r + dy)) push(x + dx, r + dy);
    }
  }
  const problems = [];
  for (const [tx, ty, c] of targets) {
    let ok = false;
    for (const k of seen) {
      const [sx, sy] = k.split(',').map(Number);
      if (Math.abs(sx - tx) <= 3 && sy - ty >= 0 && sy - ty <= 3) { ok = true; break; }
      if (c !== '*' && c !== '$' && sx === tx && sy === ty) { ok = true; break; }
      if (pad(sx, sy) && Math.abs(sx - tx) <= 2 && sy - ty >= 0 && sy - ty <= 7) { ok = true; break; }
    }
    if (!ok) problems.push(`${c} (${tx},${ty}) 도달 불가`);
  }
  return problems;
}

let bad = 0;
for (const d of [...STORY, ...VERSUS_MAPS]) {
  if (d.boss) continue;
  const p = check(d);
  const gems = d.map.join('').split('*').length - 1;
  console.log(`${d.id} ${d.name} [${d.map[0].length}×${d.map.length}] 보석 ${gems}: ${p.length ? '⚠ ' + p.join(', ') : 'OK'}`);
  bad += p.length;
}
process.exit(bad ? 1 : 0);
