// Shared helpers for the Netlify version: storage (Netlify Blobs), sessions, permissions, email.
import crypto from 'node:crypto';

export const DEFAULT_DIRECTORS = ['jawadkalia80@gmail.com', 'adeelferoz@gmail.com', 'kaybeemachinery2@gmail.com'];
export const FUSE_OUTLETS = ['FUSE Seher', 'FUSE Johar', 'FUSE @ Yard', 'FUSE Lucky One'];
export const MANAGER_COLLECTIONS = ['dsr', 'morning', 'walk', 'closing', 'cklist', 'req'];
export const sl = (n) => String(n).replace(/[^A-Za-z0-9]+/g, '_');
const MEM = process.env.MEMORY_DB === '1';

/* ---------- storage ---------- */
const _mem = globalThis.__memStores || (globalThis.__memStores = { stores: new Map(), mails: [] });
function memStore(name) {
  if (!_mem.stores.has(name)) {
    const m = new Map();
    _mem.stores.set(name, {
      async get(k, o) { if (!m.has(k)) return null; const v = m.get(k); return o && o.type === 'json' ? JSON.parse(v.data) : v.data; },
      async getWithMetadata(k) { if (!m.has(k)) return null; const v = m.get(k); return { data: v.data, metadata: v.metadata || {} }; },
      async setJSON(k, o) { m.set(k, { data: JSON.stringify(o) }); },
      async set(k, d, o) { m.set(k, { data: d, metadata: (o && o.metadata) || {} }); },
      async list(o) { const p = (o && o.prefix) || ''; return { blobs: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })) }; },
    });
  }
  return _mem.stores.get(name);
}
export async function store(name) {
  if (MEM) return memStore(name);
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name, consistency: 'strong' });
}
export const mails = () => _mem.mails;

/* ---------- sessions ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set (16+ characters)');
  return s;
}
const hmac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');
export function sign(payload) { const b = Buffer.from(JSON.stringify(payload)).toString('base64url'); return b + '.' + hmac(b); }
export function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [b, mac] = token.split('.');
  const a = Buffer.from(mac), g = Buffer.from(hmac(b));
  if (a.length !== g.length || !crypto.timingSafeEqual(a, g)) return null;
  try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp && p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
export function getSession(req) {
  const c = {}; String(req.headers.get('cookie') || '').split(';').forEach((x) => { const i = x.indexOf('='); if (i > 0) c[x.slice(0, i).trim()] = decodeURIComponent(x.slice(i + 1).trim()); });
  return verify(c.sid);
}
export function sessionCookie(payload, maxAge) {
  const v = encodeURIComponent(sign(Object.assign({ exp: Date.now() + maxAge * 1000 }, payload)));
  return 'sid=' + v + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAge + (MEM ? '' : '; Secure');
}
export const clearCookie = () => 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
export function safeEqual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

/* ---------- http ---------- */
export function json(code, obj, headers) {
  return new Response(JSON.stringify(obj), { status: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}) });
}
export function wrap(fn) {
  return async (req, context) => {
    try { return await fn(req, context); }
    catch (e) { console.error(e); return json(500, { error: String(e.message || e) }); }
  };
}

/* ---------- permissions ---------- */
export function pathParts(path) { const m = /^([a-z]+)\/([A-Za-z0-9_\-]+)$/.exec(String(path || '')); return m ? { col: m[1], id: m[2] } : null; }
export function canWrite(s, path) {
  const p = pathParts(path); if (!s || !p) return false;
  if (s.role === 'director') return true;
  if (p.col === 'meters') return p.id === sl(s.outlet);
  if (MANAGER_COLLECTIONS.indexOf(p.col) >= 0) return p.id.indexOf(sl(s.outlet) + '_') === 0;
  return false;
}
export function canRead(s, path) {
  const p = pathParts(path); if (!s || !p) return false;
  if (s.role === 'director') return true;
  if (p.col === 'config') return p.id === 'main';
  return canWrite(s, path);
}

/* ---------- config / email / rate limit ---------- */
export async function getConfig() {
  const docs = await store('docs');
  const cfg = (await docs.get('config/main', { type: 'json' })) || {};
  const envDir = String(process.env.DIRECTORS || '').split(/[\s,;]+/).filter((x) => /@/.test(x));
  cfg.directors = cfg.directors && cfg.directors.length ? cfg.directors : (envDir.length ? envDir : DEFAULT_DIRECTORS);
  return cfg;
}
import nodemailer from 'nodemailer';
export const _mail = { transport: null }; // tests can replace this
export async function sendMail({ to, subject, html, text, attachments }) {
  if (process.env.MAIL_DRY_RUN === '1') { mails().push({ to, subject, html, attachments: (attachments || []).map((a) => ({ filename: a.filename, size: (a.content || '').length })) }); return { dry: true }; }
  // Option 1: Gmail (needs GMAIL_USER and a 16-character Google app password in GMAIL_APP_PASSWORD)
  const gUser = process.env.GMAIL_USER, gPass = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (gUser && gPass) {
    const tr = _mail.transport || nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gUser, pass: gPass }, connectionTimeout: 15000, socketTimeout: 20000 });
    try {
      const info = await tr.sendMail({
        from: process.env.MAIL_FROM || ('FUSE Portal <' + gUser + '>'), to: Array.isArray(to) ? to.join(', ') : to, subject, html, text,
        attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' })),
      });
      return { gmail: true, id: info.messageId };
    } catch (e) {
      const m = String(e && e.message || e);
      throw new Error('Gmail email failed: ' + (/Invalid login|Username and Password|535/i.test(m) ? 'Gmail rejected the login. Check GMAIL_USER and the app password.' : m.slice(0, 200)));
    }
  }
  // Option 2: Resend
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error('Email is not set up yet (add GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY + MAIL_FROM)');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text, attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content })) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Email failed: ' + (j.message || r.status));
  return j;
}
export async function hit(key, max, windowSec) {
  const meta = await store('meta'), k = 'rl/' + key.replace(/[^A-Za-z0-9_.:-]/g, '_');
  const cur = await meta.get(k, { type: 'json' });
  const now = Date.now();
  const rec = cur && cur.exp > now ? cur : { n: 0, exp: now + windowSec * 1000 };
  rec.n++; await meta.setJSON(k, rec);
  return rec.n <= max;
}
