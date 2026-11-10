import crypto from 'node:crypto';
import * as L from '../lib/lib.mjs';
export const config = { path: '/api/upload' };
export default L.wrap(async (req) => {
  if (req.method !== 'POST') return L.json(405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.json(401, { error: 'Not signed in' });
  const type = String(req.headers.get('content-type') || '').split(';')[0];
  if (!/^image\/(png|jpeg|webp)$/.test(type)) return L.json(415, { error: 'Only PNG, JPEG or WebP images' });
  if (!(await L.hit('up:' + (s.outlet || 'dir'), 300, 86400))) return L.json(429, { error: 'Daily photo limit reached' });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return L.json(400, { error: 'Empty file' });
  if (buf.length > 6 * 1024 * 1024) return L.json(413, { error: 'Image too large' });
  const id = crypto.randomBytes(16).toString('hex');
  const photos = await L.store('photos');
  await photos.set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { metadata: { type, outlet: s.outlet || 'director', at: new Date().toISOString() } });
  return L.json(200, { id });
});
