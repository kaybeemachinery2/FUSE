import * as L from '../lib/lib.mjs';
export const config = { path: '/api/db' };
// POST {op:'get',path} | {op:'set',path,data} | {op:'query',collection,where:[[field,value],...]}
export default L.wrap(async (req) => {
  if (req.method !== 'POST') return L.json(405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.json(401, { error: 'Not signed in' });
  const b = await req.json().catch(() => ({}));
  const docs = await L.store('docs');
  if (b.op === 'get') {
    if (!L.canRead(s, b.path)) return L.json(403, { error: 'Not allowed' });
    const v = await docs.get(b.path, { type: 'json' });
    return L.json(200, { exists: v !== null && v !== undefined, data: v || null });
  }
  if (b.op === 'set') {
    if (!L.canWrite(s, b.path)) return L.json(403, { error: 'Not allowed' });
    if (!b.data || typeof b.data !== 'object') return L.json(400, { error: 'Bad data' });
    if (JSON.stringify(b.data).length > 400000) return L.json(413, { error: 'Document too large' });
    await docs.setJSON(b.path, b.data);
    return L.json(200, { ok: true });
  }
  if (b.op === 'query') {
    const col = String(b.collection || '').replace(/[^a-z]/g, '');
    const where = Array.isArray(b.where) ? b.where : [];
    if (s.role !== 'director') {
      const own = where.some((w) => w[0] === 'outlet' && w[1] === s.outlet);
      if (!own || L.MANAGER_COLLECTIONS.indexOf(col) < 0) return L.json(403, { error: 'Not allowed' });
    }
    // document ids look like <outlet-slug>_<date>, so narrow the listing by outlet and month where possible
    let prefix = col + '/';
    const wo = where.find((w) => w[0] === 'outlet'), wm = where.find((w) => w[0] === 'month');
    if (wo) { prefix += L.sl(wo[1]) + '_'; if (wm) prefix += wm[1]; }
    const list = await docs.list({ prefix });
    const out = [];
    const keys = (list.blobs || []).map((x) => x.key);
    for (let i = 0; i < keys.length; i += 25) {
      const got = await Promise.all(keys.slice(i, i + 25).map((k) => docs.get(k, { type: 'json' })));
      got.forEach((d) => { if (d && where.every((w) => d[w[0]] === w[1])) out.push(d); });
    }
    return L.json(200, { docs: out });
  }
  return L.json(400, { error: 'Unknown op' });
});
