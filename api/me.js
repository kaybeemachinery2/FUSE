const L = require('./_lib');
module.exports = L.wrap(async (req, res) => {
  if (req.query && req.query.logout) { L.clearSessionCookie(res); return L.send(res, 200, { ok: true }); }
  const s = L.getSession(req);
  if (!s) {
    let outlets = []; try { outlets = Object.keys(JSON.parse(process.env.OUTLET_PINS || '{}')); } catch (e) {}
    return L.send(res, 401, { error: 'login', outlets });
  }
  return L.send(res, 200, { role: s.role, outlet: s.outlet || null });
});
