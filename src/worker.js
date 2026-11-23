// Lienvo sur Cloudflare Workers : pages statiques + appairage (Durable Object).
// La vidéo et les fichiers ne passent jamais ici : ils vont en pair à pair (WebRTC).
import { DurableObject } from 'cloudflare:workers';
import QRCode from 'qrcode';

const TTL = 5 * 60 * 1000;  // validité d'un code
const MAX_FAILS = 8;        // essais ratés par IP et par minute

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = path => env.ASSETS.fetch(new Request(new URL(path, url), request));

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return secure(new Response('WebSocket attendu', { status: 426 }));
      const origin = request.headers.get('Origin');
      if (!origin || new URL(origin).origin !== url.origin) return secure(new Response('Origine refusée', { status: 403 }));
      return env.HUB.get(env.HUB.idFromName('global')).fetch(request);
    }
    if (url.pathname === '/config') return secure(await config(env));
    if (url.pathname === '/qr') return secure(await qr(url));
    if (url.pathname === '/') return secure(await asset('/index.html'));
    if (url.pathname === '/p') return secure(await asset('/phone.html'));
    if (url.pathname === '/conditions.html') return secure(await asset('/conditions.html'));
    if (url.pathname === '/confidentialite.html') return secure(await asset('/confidentialite.html'));
    if (url.pathname === '/mentions-legales.html') return secure(await asset('/mentions-legales.html'));
    return secure(await env.ASSETS.fetch(request));
  }
};

function secure(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), fullscreen=(self)');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function qr(url) {
  const text = url.searchParams.get('t') || '';
  let target;
  try { target = new URL(text); } catch { return new Response('QR invalide', { status: 400 }); }
  const codes = target.searchParams.getAll('c');
  const relayModes = target.searchParams.getAll('turntest');
  const code = codes[0] || '';
  const paramsAllowed = [...target.searchParams.keys()].every(key => key === 'c' || key === 'turntest');
  const relayModeValid = relayModes.length === 0 || (relayModes.length === 1 && relayModes[0] === '1');
  if (target.origin !== url.origin || target.pathname !== '/p' || !/^\d{6}$/.test(code) || codes.length !== 1 || !paramsAllowed || !relayModeValid) {
    return new Response('QR invalide', { status: 400 });
  }
  const svg = await QRCode.toString(target.href, { type: 'svg', margin: 1, color: { dark: '#10203A', light: '#FFFFFF' } });
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// STUN Cloudflare, plus TURN Cloudflare (TURN_KEY_ID + TURN_API_TOKEN) ou TURN générique (TURN_URL, TURN_USER, TURN_PASS)
async function config(env) {
  const iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];
  if (env.TURN_KEY_ID && env.TURN_API_TOKEN) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 })
      });
      if (r.ok) iceServers.push(...[].concat((await r.json()).iceServers));
    } catch {}
  } else if (env.TURN_URL) {
    iceServers.push({ urls: env.TURN_URL.split(','), username: env.TURN_USER, credential: env.TURN_PASS });
  }
  return Response.json({ iceServers }, { headers: { 'Cache-Control': 'no-store' } });
}

export class Hub extends DurableObject {
  rooms = new Map(); // code -> { pc, timer }
  fails = new Map(); // ip -> { n, until }

  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const c = { ws: server, ip: request.headers.get('cf-connecting-ip') || '?', role: null, peer: null, code: null };
    server.addEventListener('message', e => this.onMessage(c, e.data));
    server.addEventListener('close', () => this.leave(c));
    server.addEventListener('error', () => this.leave(c));
    return new Response(null, { status: 101, webSocket: client });
  }

  send(c, m) { try { c.ws.send(JSON.stringify(m)); } catch {} }

  locked(ip) {
    const f = this.fails.get(ip);
    if (!f) return false;
    if (Date.now() > f.until) { this.fails.delete(ip); return false; }
    return f.n >= MAX_FAILS;
  }
  fail(ip) {
    const f = this.fails.get(ip) || { n: 0, until: Date.now() + 60000 };
    f.n++; this.fails.set(ip, f);
  }

  newCode() {
    let c;
    do {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      if (values[0] >= 4294000000) continue;
      c = String(values[0] % 1e6).padStart(6, '0');
    } while (this.rooms.has(c));
    return c;
  }
  release(c) {
    if (!c.code) return;
    const r = this.rooms.get(c.code);
    if (r) clearTimeout(r.timer);
    this.rooms.delete(c.code);
    c.code = null;
  }
  offerCode(c) {
    this.release(c);
    const code = this.newCode();
    const timer = setTimeout(() => this.offerCode(c), TTL); // expiré : nouveau code automatique
    this.rooms.set(code, { pc: c, timer });
    c.code = code;
    this.send(c, { type: 'code', code, expiresAt: Date.now() + TTL });
  }

  onMessage(c, raw) {
    if (typeof raw !== 'string' || raw.length > 65536) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'host' && !c.role) {
      c.role = 'pc'; this.offerCode(c);
    } else if (m.type === 'join' && !c.role) {
      if (this.locked(c.ip)) return this.send(c, { type: 'error', reason: 'locked' });
      const code = String(m.code || '').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) { this.fail(c.ip); return this.send(c, { type: 'error', reason: 'invalid' }); }
      const room = this.rooms.get(code);
      if (!room) { this.fail(c.ip); return this.send(c, { type: 'error', reason: 'invalid' }); }
      c.role = 'phone';
      clearTimeout(room.timer);
      this.rooms.delete(code);   // usage unique
      room.pc.code = null;
      room.pc.peer = c; c.peer = room.pc;
      this.send(room.pc, { type: 'paired' });
      this.send(c, { type: 'paired' });
    } else if (m.type === 'signal' && c.peer) {
      this.send(c.peer, { type: 'signal', data: m.data });
    }
  }

  leave(c) {
    if (c.role === 'pc') this.release(c);
    const p = c.peer;
    if (!p) return;
    c.peer = null; p.peer = null;
    this.send(p, { type: 'peer-left' });
    if (p.role === 'pc') this.offerCode(p);
  }
}
