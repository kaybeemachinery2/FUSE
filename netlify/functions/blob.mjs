import * as L from '../lib/lib.mjs';
export const config = { path: ['/_blob/:id', '/api/blob'] };
export default L.wrap(async (req, context) => {
  const s = L.getSession(req);
  if (!s) return L.json(401, { error: 'Not signed in' });
  const id = String((context && context.params && context.params.id) || new URL(req.url).searchParams.get('id') || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return L.json(404, { error: 'Not found' });
  const photos = await L.store('photos');
  const r = await photos.getWithMetadata(id, { type: 'arrayBuffer' });
  if (!r) return L.json(404, { error: 'Not found' });
  return new Response(r.data, { status: 200, headers: { 'Content-Type': (r.metadata && r.metadata.type) || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
});
