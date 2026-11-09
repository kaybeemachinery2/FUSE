const L = require('./_lib');
// POST {op:'get',path} | {op:'set',path,data} | {op:'query',collection,where:[[field,value],...]}
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.send(res, 401, { error: 'Not signed in' });
  const b = await L.readJson(req);
  const store = L.db();
  if (b.op === 'get') {
    if (!L.canRead(s, b.path)) return L.send(res, 403, { error: 'Not allowed' });
    const v = await store.get('doc:' + b.path);
    return L.send(res, 200, { exists: v !== null && v !== undefined, data: v === null || v === undefined ? null : (typeof v === 'string' ? JSON.parse(v) : v) });
  }
  if (b.op === 'set') {
    if (!L.canWrite(s, b.path)) return L.send(res, 403, { error: 'Not allowed' });
    if (!b.data || typeof b.data !== 'object') return L.send(res, 400, { error: 'Bad data' });
    const json = JSON.stringify(b.data);
    if (json.length > 400000) return L.send(res, 413, { error: 'Document too large' });
    const p = L.pathParts(b.path);
    await store.set('doc:' + b.path, json);
    await store.sadd('col:' + p.col, b.path);
    return L.send(res, 200, { ok: true });
  }
  if (b.op === 'query') {
    const col = String(b.collection || '');
    const where = Array.isArray(b.where) ? b.where : [];
    if (s.role !== 'director') {
      // managers may only list their own outlet's documents
      const own = where.some((w) => w[0] === 'outlet' && w[1] === s.outlet);
      if (!own || L.MANAGER_COLLECTIONS.indexOf(col) < 0) return L.send(res, 403, { error: 'Not allowed' });
    }
    const ids = await store.smembers('col:' + col);
    if (!ids.length) return L.send(res, 200, { docs: [] });
    const vals = await store.mget(...ids.map((i) => 'doc:' + i));
    const docs = vals.filter((v) => v !== null && v !== undefined).map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
      .filter((d) => where.every((w) => d[w[0]] === w[1]));
    return L.send(res, 200, { docs });
  }
  return L.send(res, 400, { error: 'Unknown op' });
});
