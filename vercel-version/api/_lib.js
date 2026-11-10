// Shared helpers: storage, sessions, permissions, email.
const crypto = require('crypto');

const DEFAULT_DIRECTORS = ['jawadkalia80@gmail.com', 'adeelferoz@gmail.com', 'kaybeemachinery2@gmail.com'];
const FUSE_OUTLETS = ['FUSE Seher', 'FUSE Johar', 'FUSE @ Yard', 'FUSE Lucky One'];
const sl = (n) => String(n).replace(/[^A-Za-z0-9]+/g, '_');

/* ---------- storage ---------- */
let _mem;
function memStore() {
  if (!_mem) {
    const kv = new Map(), sets = new Map();
    _mem = {
      kv, sets, blobs: new Map(), mails: [],
      async get(k) { return kv.has(k) ? kv.get(k) : null; },
      async set(k, v) { kv.set(k, v); return 'OK'; },
      async del(k) { kv.delete(k); },
      async sadd(k, ...m) { const s = sets.get(k) || new Set(); m.forEach((x) => s.add(x)); sets.set(k, s); },
      async smembers(k) { return [...(sets.get(k) || [])]; },
      async mget(...keys) { return keys.map((k) => (kv.has(k) ? kv.get(k) : null)); },
      async incr(k) { const n = (Number(kv.get(k)) || 0) + 1; kv.set(k, n); return n; },
      async expire() { return 1; },
    };
  }
  return _mem;
}
let _redis;
function db() {
  if (process.env.MEMORY_DB === '1') return memStore();
  if (!_redis) {
    const { Redis } = require('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error('Redis is not connected (add the Upstash Redis integration in Vercel > Storage)');
    _redis = new Redis({ url, token });
  }
  return _redis;
}

/* ---------- sessions ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set');
  return s;
}
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) { return null; }
}
function cookies(req) {
  const o = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return o;
}
function getSession(req) { return verify(cookies(req).sid); }
function setSessionCookie(res, payload, maxAgeSec) {
  const secure = process.env.MEMORY_DB === '1' ? '' : '; Secure';
  res.setHeader('Set-Cookie', 'sid=' + encodeURIComponent(sign(Object.assign({ exp: Date.now() + maxAgeSec * 1000 }, payload))) +
    '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAgeSec + secure);
}
function clearSessionCookie(res) { res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- http helpers ---------- */
function send(res, code, obj) { res.status(code).setHeader('Cache-Control', 'no-store'); res.json(obj); }
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { console.error(e); try { send(res, 500, { error: String(e.message || e) }); } catch (_) {} }
  };
}

/* ---------- permissions ---------- */
function pathParts(path) {
  const m = /^([a-z]+)\/([A-Za-z0-9_\-]+)$/.exec(String(path || ''));
  return m ? { col: m[1], id: m[2] } : null;
}
const MANAGER_COLLECTIONS = ['dsr', 'morning', 'walk', 'closing', 'cklist', 'req'];
function canRead(s, path) {
  const p = pathParts(path); if (!s || !p) return false;
  if (s.role === 'director') return true;
  if (p.col === 'config') return p.id === 'main';
  return canWrite(s, path);
}
function canWrite(s, path) {
  const p = pathParts(path); if (!s || !p) return false;
  if (s.role === 'director') return true;
  if (p.col === 'meters') return p.id === sl(s.outlet);
  if (MANAGER_COLLECTIONS.indexOf(p.col) >= 0) return p.id.indexOf(sl(s.outlet) + '_') === 0;
  return false;
}

/* ---------- config ---------- */
async function getConfig() {
  const c = await db().get('doc:config/main');
  const cfg = c ? (typeof c === 'string' ? JSON.parse(c) : c) : {};
  const envDir = String(process.env.DIRECTORS || '').split(/[\s,;]+/).filter((x) => /@/.test(x));
  cfg.directors = (cfg.directors && cfg.directors.length ? cfg.directors : (envDir.length ? envDir : DEFAULT_DIRECTORS));
  return cfg;
}

/* ---------- email (Resend) ---------- */
async function sendMail({ to, subject, html, text, attachments }) {
  const rec = { to, subject, html, text, attachments: (attachments || []).map((a) => ({ filename: a.filename, size: (a.content || '').length })) };
  if (process.env.MAIL_DRY_RUN === '1') { memStore().mails.push(rec); return { dry: true }; }
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error('RESEND_API_KEY and MAIL_FROM must be set');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text, attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content })) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Email failed: ' + (j.message || r.status));
  return j;
}

/* ---------- light rate limit ---------- */
async function hit(key, max, windowSec) {
  const n = await db().incr('rl:' + key);
  if (n === 1) await db().expire('rl:' + key, windowSec);
  return n <= max;
}

module.exports = { sl, db, memStore, sign, verify, getSession, setSessionCookie, clearSessionCookie, safeEqual, send, readJson, wrap, canRead, canWrite, pathParts, getConfig, sendMail, hit, DEFAULT_DIRECTORS, FUSE_OUTLETS, MANAGER_COLLECTIONS };
