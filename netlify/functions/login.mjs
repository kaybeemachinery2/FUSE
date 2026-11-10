import * as L from '../lib/lib.mjs';
export const config = { path: '/api/login' };
export default L.wrap(async (req) => {
  if (req.method !== 'POST') return L.json(405, { error: 'POST only' });
  const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
  if (!(await L.hit('login:' + ip, 15, 600))) return L.json(429, { error: 'Too many attempts. Wait 10 minutes.' });
  const b = await req.json().catch(() => ({}));
  if (b.password !== undefined) {
    const want = process.env.DIRECTOR_PASSWORD;
    if (!want) return L.json(500, { error: 'DIRECTOR_PASSWORD is not set' });
    if (!L.safeEqual(b.password, want)) return L.json(401, { error: 'Wrong password' });
    return L.json(200, { role: 'director' }, { 'Set-Cookie': L.sessionCookie({ role: 'director' }, 12 * 3600) });
  }
  let pins = {};
  try { pins = JSON.parse(process.env.OUTLET_PINS || '{}'); } catch (e) { return L.json(500, { error: 'OUTLET_PINS is not valid JSON' }); }
  const want = pins[b.outlet];
  if (!want || !L.safeEqual(String(b.pin || ''), String(want))) return L.json(401, { error: 'Wrong outlet or PIN' });
  return L.json(200, { role: 'manager', outlet: b.outlet }, { 'Set-Cookie': L.sessionCookie({ role: 'manager', outlet: b.outlet }, 12 * 3600) });
});
