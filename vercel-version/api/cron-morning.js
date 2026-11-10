const L = require('./_lib');
// Vercel Cron, 13:30 UTC = 18:30 Karachi. Emails the Directors the FUSE morning sales.
const fmt = (n) => (n === undefined || n === null || n === '' ? '-' : Number(n).toLocaleString('en-US'));
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
module.exports = L.wrap(async (req, res) => {
  const auth = String(req.headers.authorization || '');
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) return L.send(res, 401, { error: 'Unauthorized' });
  const pkt = new Date(Date.now() + 5 * 3600 * 1000);
  const today = pkt.toISOString().slice(0, 10);
  const cfg = await L.getConfig();
  const outlets = cfg.outlets ? Object.keys(cfg.outlets).filter((k) => k.indexOf('FUSE') === 0) : L.FUSE_OUTLETS;
  const list = outlets.length ? outlets : L.FUSE_OUTLETS;
  const ids = await L.db().smembers('col:morning');
  const vals = ids.length ? await L.db().mget(...ids.map((i) => 'doc:' + i)) : [];
  const docs = vals.filter(Boolean).map((v) => (typeof v === 'string' ? JSON.parse(v) : v)).filter((d) => d.date === today);
  const by = {}; docs.forEach((d) => { by[d.outlet] = d; });
  const th = 'style="background:#C82620;color:#fff;padding:8px;text-align:right;font-size:13px"';
  const td = 'style="padding:8px;border-bottom:1px solid #EFE5E0;text-align:right;font-size:13px"';
  let tot = { total: 0, dineIn: 0, takeaway: 0, delivery: 0, running: 0 }, n = 0;
  const rows = list.map((o) => {
    const d = by[o];
    if (!d) return '<tr><td ' + td.replace('right', 'left') + '>' + esc(o) + '</td><td colspan="7" ' + td.replace('right', 'left') + '><b style="color:#C62828">Not reported yet</b></td></tr>';
    n++; ['total', 'dineIn', 'takeaway', 'delivery', 'running'].forEach((k) => { tot[k] += Number(d[k]) || 0; });
    const at = d.enteredAt ? new Date(new Date(d.enteredAt).getTime() + 5 * 3600 * 1000).toISOString().slice(11, 16) : '';
    return '<tr><td ' + td.replace('right', 'left') + '><b>' + esc(o) + '</b></td><td ' + td + '><b>' + fmt(d.total) + '</b></td><td ' + td + '>' + fmt(d.dineIn) + '</td><td ' + td + '>' + fmt(d.takeaway) + '</td><td ' + td + '>' + fmt(d.delivery) + '</td><td ' + td + '>' + fmt(d.running) + '</td><td ' + td.replace('right', 'left') + '>' + esc(d.note) + '</td><td ' + td + '>' + at + '</td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:auto"><div style="background:#C82620;color:#fff;padding:16px 20px;font-family:Georgia,serif;font-size:22px;font-weight:bold">FUSE - Morning sales</div><div style="padding:12px 4px;color:#755F5A">' + today + ' - ' + n + ' of ' + list.length + ' outlets reported</div>' +
    '<table style="width:100%;border-collapse:collapse"><tr><th ' + th.replace('right', 'left') + '>Outlet</th><th ' + th + '>Morning total</th><th ' + th + '>Dine in</th><th ' + th + '>Take away</th><th ' + th + '>Delivery</th><th ' + th + '>Running tables</th><th ' + th.replace('right', 'left') + '>Note</th><th ' + th + '>Time</th></tr>' + rows +
    (n ? '<tr><td ' + td.replace('right', 'left') + '><b>Total</b></td><td ' + td + '><b>' + fmt(tot.total) + '</b></td><td ' + td + '><b>' + fmt(tot.dineIn) + '</b></td><td ' + td + '><b>' + fmt(tot.takeaway) + '</b></td><td ' + td + '><b>' + fmt(tot.delivery) + '</b></td><td ' + td + '><b>' + fmt(tot.running) + '</b></td><td></td><td></td></tr>' : '') +
    '</table><p style="color:#755F5A;font-size:12px">Amounts in Rs. Running tables are open bills and are not added into the morning total.</p></div>';
  const dd = new Date(today + 'T12:00:00Z').toUTCString().slice(5, 16);
  const subject = n ? 'FUSE morning sales - ' + dd + ' - Rs ' + fmt(tot.total) + ' (' + n + ' of ' + list.length + ' outlets)' : 'FUSE morning sales - ' + dd + ' - none reported yet';
  await L.sendMail({ to: cfg.directors, subject, html, text: subject });
  return L.send(res, 200, { ok: true, subject, to: cfg.directors.length });
});
