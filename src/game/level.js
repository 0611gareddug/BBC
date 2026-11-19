import { T, CHAR_TILE, CHAR_ENTITY, isAlwaysSolid } from './tiledefs.js';
import { TILE } from '../core/constants.js';

const DYNAMIC = new Set([T.JUMP, T.HOT, T.CONV_L, T.CONV_R, T.CRUMBLE, T.SWITCH, T.BUZZER, T.DOOR, T.DOOR_OPEN, T.QSIGN,
  T.PANEL_O, T.PANEL_X, T.TIMER, T.WARP_A, T.WARP_A2, T.WARP_B, T.WARP_B2, T.RHY_A, T.RHY_B, T.GHOST, T.SPOT, T.LASER, T.HINT]);

export class Level {
  constructor(def) {
    this.def = def;
    const rows = def.map.map(r => r.replace(/\./g, ' '));
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    this.tiles = new Uint8Array(this.w * this.h);
    this.entities = [];
    this.dyn = []; // {tx,ty,code,st}
    this.stateMap = new Map();
    this.redOn = false;
    this.warps = {};
    this.hints = [];
    this.qsigns = [];
    this.lasers = [];
    this.spots = [];
    for (let y = 0; y < this.h; y++) {
      const r = rows[y];
      for (let x = 0; x < this.w; x++) {
        const ch = r[x] || ' ';
        let code = CHAR_TILE[ch];
        if (code === undefined) {
          code = T.EMPTY;
          const e = CHAR_ENTITY[ch];
          if (e) this.entities.push({ type: e, tx: x, ty: y });
        }
        this.tiles[y * this.w + x] = code;
        if (DYNAMIC.has(code)) {
          const st = { tx: x, ty: y, code, timer: 0, gone: false, regen: 0, anim: 0, on: false, solid: true, hot: false, warn: false, soon: false, alpha: 0, fake: false };
          if (code === T.DOOR) st.solid = true;
          if (code === T.DOOR_OPEN) st.solid = false;
          if (code === T.HOT) st.phase = (x * 17) % 240;
          this.dyn.push(st);
          this.stateMap.set(y * this.w + x, st);
          if (code >= T.WARP_A && code <= T.WARP_B2) (this.warps[code] ||= []).push(st);
          if (code === T.HINT) this.hints.push(st);
          if (code === T.QSIGN) this.qsigns.push(st);
          if (code === T.LASER) this.lasers.push(st);
          if (code === T.SPOT) this.spots.push(st);
        }
      }
    }
    // 힌트 문구 순서대로 배정
    this.hints.sort((a, b) => a.tx - b.tx || a.ty - b.ty).forEach((h, i) => { h.text = (def.hints || [])[i] || ''; });
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
  }

  idx(tx, ty) { return ty * this.w + tx; }
  tile(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return T.EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  st(tx, ty) { return this.stateMap.get(ty * this.w + tx); }

  // 0: 빈칸, 1: 단단함, 2: 위에서만 밟힘
  solid(tx, ty) {
    if (tx < 0 || tx >= this.w) return 1;
    if (ty < 0 || ty >= this.h) return 0;
    const c = this.tiles[ty * this.w + tx];
    if (c === T.EMPTY) return 0;
    if (c === T.ONEWAY) return 2;
    if (isAlwaysSolid(c)) return 1;
    if (c === T.SOLID) return 1;
    switch (c) {
      case T.CRUMBLE: case T.TIMER: case T.PANEL_O: case T.PANEL_X:
        return this.stateMap.get(ty * this.w + tx).gone ? 0 : 1;
      case T.DOOR: case T.DOOR_OPEN:
        return this.stateMap.get(ty * this.w + tx).solid ? 1 : 0;
      case T.RHY_A: case T.RHY_B:
        return this.stateMap.get(ty * this.w + tx).on ? 1 : 0;
      default: return 0;
    }
  }

  setRed(on) {
    this.redOn = on;
    for (const s of this.dyn) {
      if (s.code === T.DOOR) s.solid = !on;
      else if (s.code === T.DOOR_OPEN) s.solid = on;
      else if (s.code === T.SWITCH || s.code === T.BUZZER) s.on = on;
    }
  }
}

/* ───── 충돌 이동 ─────
   body: {x,y,w,h,vx,vy}  opts: {dropThrough, platforms}
   결과: {hitX, hitY, ground, ceil, groundTiles[]} */
export function moveBody(level, body, opts = {}) {
  const res = { hitX: 0, ground: false, ceil: false, groundTiles: null, platform: null };
  const EPS = 0.001;
  // X축
  if (body.vx !== 0) {
    const nx = body.x + body.vx;
    const top = Math.floor(body.y / TILE), bot = Math.floor((body.y + body.h - EPS) / TILE);
    if (body.vx > 0) {
      const tx = Math.floor((nx + body.w - EPS) / TILE);
      let blocked = false;
      for (let ty = top; ty <= bot; ty++) if (level.solid(tx, ty) === 1) { blocked = true; break; }
      if (blocked) { body.x = tx * TILE - body.w; res.hitX = 1; body.vx = 0; } else body.x = nx;
    } else {
      const tx = Math.floor(nx / TILE);
      let blocked = false;
      for (let ty = top; ty <= bot; ty++) if (level.solid(tx, ty) === 1) { blocked = true; break; }
      if (blocked) { body.x = (tx + 1) * TILE; res.hitX = -1; body.vx = 0; } else body.x = nx;
    }
  }
  // Y축
  const oldBottom = body.y + body.h;
  const ny = body.y + body.vy;
  const left = Math.floor(body.x / TILE), right = Math.floor((body.x + body.w - EPS) / TILE);
  if (body.vy >= 0) {
    const ty = Math.floor((ny + body.h - EPS) / TILE);
    const tileTop = ty * TILE;
    let land = false;
    const gt = [];
    for (let tx = left; tx <= right; tx++) {
      const s = level.solid(tx, ty);
      if (s === 1 || (s === 2 && !opts.dropThrough && oldBottom <= tileTop + EPS)) { land = true; gt.push(tx, ty); }
    }
    // 움직이는 발판 (위에서만)
    let plat = null;
    if (opts.platforms) {
      for (const p of opts.platforms) {
        if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
        if (oldBottom <= p.y + 2 && ny + body.h >= p.y) {
          if (!land || p.y < tileTop) { plat = p; }
        }
      }
    }
    if (plat && (!land || plat.y <= tileTop)) {
      body.y = plat.y - body.h; body.vy = 0; res.ground = true; res.platform = plat;
    } else if (land) {
      body.y = tileTop - body.h; body.vy = 0; res.ground = true; res.groundTiles = gt;
    } else body.y = ny;
  } else {
    const ty = Math.floor(ny / TILE);
    let bonk = false;
    for (let tx = left; tx <= right; tx++) if (level.solid(tx, ty) === 1) { bonk = true; break; }
    if (bonk) { body.y = (ty + 1) * TILE; body.vy = 0; res.ceil = true; } else body.y = ny;
  }
  return res;
}

// 몸 아래(1px)에 단단한 것이 있는지
export function groundBelow(level, body) {
  const ty = Math.floor((body.y + body.h + 0.5) / TILE);
  const left = Math.floor(body.x / TILE), right = Math.floor((body.x + body.w - 0.001) / TILE);
  for (let tx = left; tx <= right; tx++) { const s = level.solid(tx, ty); if (s) return true; }
  return false;
}

// 벽 접촉 여부 (dir: -1 왼쪽, 1 오른쪽)
export function touchingWall(level, body, dir) {
  const tx = dir > 0 ? Math.floor((body.x + body.w + 0.5) / TILE) : Math.floor((body.x - 0.5) / TILE);
  const top = Math.floor((body.y + 2) / TILE), bot = Math.floor((body.y + body.h - 2) / TILE);
  for (let ty = top; ty <= bot; ty++) if (level.solid(tx, ty) === 1) return true;
  return false;
}
