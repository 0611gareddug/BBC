// P2P 연결: PeerJS 무료 중계로 처음 연결만 맺고, 이후 데이터는 기기끼리 직접 주고받음 (WebRTC)
import { Peer } from 'peerjs';

const PREFIX = 'blockshowlive-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
export function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); }

const DEV_HOST = import.meta.env.DEV ? new URLSearchParams(location.search).get('peerhost') : null;
const PEER_OPTS = {
  debug: 0,
  ...(DEV_HOST ? { host: DEV_HOST.split(':')[0], port: +DEV_HOST.split(':')[1], path: '/', secure: false } : {}),
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] },
};

export class Net {
  constructor() {
    this.peer = null; this.conns = new Map(); this.host = null; this.isHost = false;
    this.handlers = new Map(); this.code = null; this.closed = false; this.ping = 0;
    this.pingTimer = null;
  }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  emit(type, msg, conn) { const s = this.handlers.get(type); if (s) for (const f of [...s]) f(msg, conn); }

  wire(conn) {
    conn.on('data', (m) => {
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      if (m.t === 'ping') { this.sendTo(conn, { t: 'pong', ts: m.ts }); return; }
      if (m.t === 'pong') { this.ping = this.ping ? this.ping * 0.7 + (performance.now() - m.ts) * 0.3 : performance.now() - m.ts; return; }
      this.emit(m.t, m, conn);
    });
    conn.on('close', () => { this.conns.delete(conn.peer); this.emit('_close', {}, conn); });
    conn.on('error', () => { this.conns.delete(conn.peer); this.emit('_close', {}, conn); });
  }

  hostRoom() {
    return new Promise((resolve, reject) => {
      const tryOnce = (left) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, PEER_OPTS);
        let opened = false;
        peer.on('open', () => {
          opened = true; this.peer = peer; this.code = code; this.isHost = true;
          peer.on('connection', (conn) => {
            conn.on('open', () => {
              if (this.conns.size >= 3 || this.locked) { conn.send({ t: 'deny', why: this.locked ? '이미 게임이 시작됐어요.' : '방이 가득 찼어요. (최대 4명)' }); setTimeout(() => conn.close(), 300); return; }
              this.conns.set(conn.peer, conn); this.wire(conn); this.emit('_join', {}, conn);
            });
          });
          peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
          this.startPing();
          resolve(code);
        });
        peer.on('error', (e) => {
          if (!opened && e.type === 'unavailable-id' && left > 0) { peer.destroy(); tryOnce(left - 1); return; }
          if (!opened) { peer.destroy(); reject(e); }
        });
      };
      tryOnce(4);
    });
  }

  joinRoom(code, hello) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(PEER_OPTS);
      let done = false;
      const fail = (why) => { if (done) return; done = true; peer.destroy(); reject(new Error(why)); };
      const timer = setTimeout(() => fail('방을 찾지 못했어요. 코드를 확인하거나 다른 와이파이로 바꿔보세요.'), 12000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(timer); done = true;
          this.peer = peer; this.host = conn; this.code = code; this.isHost = false;
          this.wire(conn);
          conn.send(hello);
          this.startPing();
          resolve();
        });
        conn.on('error', () => fail('연결에 실패했어요.'));
      });
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') fail('그런 방이 없어요. 코드를 다시 확인해 주세요.');
        else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') fail('중계 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
        else fail('연결 오류: ' + (e.type || '알 수 없음'));
      });
    });
  }

  startPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      const m = { t: 'ping', ts: performance.now() };
      if (this.isHost) for (const c of this.conns.values()) this.sendTo(c, m);
      else if (this.host) this.sendTo(this.host, m);
    }, 2000);
  }
  sendTo(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch { /* 무시 */ } }
  broadcast(msg) { for (const c of this.conns.values()) this.sendTo(c, msg); }
  toHost(msg) { this.sendTo(this.host, msg); }
  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    try {
      if (this.isHost) this.broadcast({ t: 'hostLeft' });
      else this.toHost({ t: 'leave' });
    } catch { /* 무시 */ }
    setTimeout(() => { try { this.peer?.destroy(); } catch { /* 무시 */ } }, 200);
    this.conns.clear(); this.handlers.clear();
  }
}

// 간단한 욕설 필터
const BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', '미친놈', '닥쳐', 'fuck', 'shit', 'bitch'];
export function filterChat(s) {
  let t = String(s || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60);
  for (const b of BAD) t = t.split(b).join('*'.repeat(b.length)).replace(new RegExp(b, 'gi'), '*'.repeat(b.length));
  return t.trim();
}
