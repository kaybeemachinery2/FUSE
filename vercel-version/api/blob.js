const L = require('./_lib');
// GET /_blob/:id  (rewritten to /api/blob?id=...)  - only for signed-in users
module.exports = L.wrap(async (req, res) => {
  const s = L.getSession(req);
  if (!s) return L.send(res, 401, { error: 'Not signed in' });
  const id = String((req.query && req.query.id) || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return L.send(res, 404, { error: 'Not found' });
  if (process.env.MEMORY_DB === '1') {
    const b = L.memStore().blobs.get(id); if (!b) return L.send(res, 404, { error: 'Not found' });
    res.setHeader('Content-Type', b.type); res.setHeader('Cache-Control', 'private, max-age=86400'); return res.status(200).send(b.buf);
  }
  const raw = await L.db().get('blob:' + id); if (!raw) return L.send(res, 404, { error: 'Not found' });
  const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const r = await fetch(info.url); if (!r.ok) return L.send(res, 404, { error: 'Not found' });
  res.setHeader('Content-Type', info.type || 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=86400');
  res.status(200).send(Buffer.from(await r.arrayBuffer()));
});
