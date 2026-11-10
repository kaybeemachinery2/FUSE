const L = require('./_lib');
// POST {outlet, pin}  -> manager session   |   POST {password} -> director session
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  if (!(await L.hit('login:' + ip, 15, 600))) return L.send(res, 429, { error: 'Too many attempts. Wait 10 minutes.' });
  const b = await L.readJson(req);
  if (b.password !== undefined) {
    const want = process.env.DIRECTOR_PASSWORD;
    if (!want) return L.send(res, 500, { error: 'DIRECTOR_PASSWORD is not set' });
    if (!L.safeEqual(b.password, want)) return L.send(res, 401, { error: 'Wrong password' });
    L.setSessionCookie(res, { role: 'director' }, 12 * 3600);
    return L.send(res, 200, { role: 'director' });
  }
  let pins = {};
  try { pins = JSON.parse(process.env.OUTLET_PINS || '{}'); } catch (e) { return L.send(res, 500, { error: 'OUTLET_PINS is not valid JSON' }); }
  const want = pins[b.outlet];
  if (!want || !L.safeEqual(String(b.pin || ''), String(want))) return L.send(res, 401, { error: 'Wrong outlet or PIN' });
  L.setSessionCookie(res, { role: 'manager', outlet: b.outlet }, 12 * 3600);
  return L.send(res, 200, { role: 'manager', outlet: b.outlet });
});
