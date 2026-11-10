const crypto = require('crypto');
const L = require('./_lib');
// POST raw image bytes (Content-Type: image/*) -> {id}
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.send(res, 401, { error: 'Not signed in' });
  const type = String(req.headers['content-type'] || '').split(';')[0];
  if (!/^image\/(png|jpeg|webp)$/.test(type)) return L.send(res, 415, { error: 'Only PNG, JPEG or WebP images' });
  if (!(await L.hit('up:' + (s.outlet || 'dir'), 300, 86400))) return L.send(res, 429, { error: 'Daily photo limit reached' });
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 8 * 1024 * 1024) return L.send(res, 413, { error: 'Image too large' }); chunks.push(c); }
  const buf = Buffer.concat(chunks);
  if (!buf.length) return L.send(res, 400, { error: 'Empty file' });
  const id = crypto.randomBytes(16).toString('hex');
  if (process.env.MEMORY_DB === '1') { L.memStore().blobs.set(id, { buf, type }); }
  else {
    const { put } = require('@vercel/blob');
    const r = await put('photos/' + id + (type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg'), buf, { access: 'public', contentType: type, addRandomSuffix: true });
    await L.db().set('blob:' + id, JSON.stringify({ url: r.url, type }));
  }
  return L.send(res, 200, { id });
});
module.exports.config = { api: { bodyParser: false } };
