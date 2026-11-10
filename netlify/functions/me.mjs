import * as L from '../lib/lib.mjs';
export const config = { path: '/api/me' };
export default L.wrap(async (req) => {
  if (new URL(req.url).searchParams.get('logout')) return L.json(200, { ok: true }, { 'Set-Cookie': L.clearCookie() });
  const s = L.getSession(req);
  if (!s) {
    let outlets = []; try { outlets = Object.keys(JSON.parse(process.env.OUTLET_PINS || '{}')); } catch (e) {}
    return L.json(401, { error: 'login', outlets });
  }
  return L.json(200, { role: s.role, outlet: s.outlet || null });
});
