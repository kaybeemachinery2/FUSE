import * as L from '../lib/lib.mjs';
// Netlify scheduled function: 13:30 UTC = 18:30 Karachi. Emails the Directors the FUSE morning sales.
export const config = { schedule: '30 13 * * *' };
const fmt = (n) => (n === undefined || n === null || n === '' ? '-' : Number(n).toLocaleString('en-US'));
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export default L.wrap(async (req) => {
  // Netlify calls scheduled functions itself (the body carries next_run). Any other call must carry the CRON_SECRET.
  let scheduled = false;
  try { const b = await req.clone().json(); scheduled = !!(b && b.next_run); } catch (e) {}
  if (!scheduled) {
    const auth = req.headers.get('authorization') || '';
    if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) return L.json(401, { error: 'Unauthorized' });
  }
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const cfg = await L.getConfig();
  const outlets = cfg.outlets ? Object.keys(cfg.outlets).filter((k) => k.indexOf('FUSE') === 0) : L.FUSE_OUTLETS;
  const list = outlets.length ? outlets : L.FUSE_OUTLETS;
  const docs = await L.store('docs');
  const by = {};
  for (const o of list) { const d = await docs.get('morning/' + L.sl(o) + '_' + today, { type: 'json' }); if (d) by[o] = d; }
  const th = 'style="background:#C82620;color:#fff;padding:8px;text-align:right;font-size:13px"';
  const td = 'style="padding:8px;border-bottom:1px solid #EFE5E0;text-align:right;font-size:13px"';
  const tdl = td.replace('right', 'left'), thl = th.replace('right', 'left');
  const tot = { total: 0, dineIn: 0, takeaway: 0, delivery: 0, running: 0 }; let n = 0;
  const rows = list.map((o) => {
    const d = by[o];
    if (!d) return '<tr><td ' + tdl + '>' + esc(o) + '</td><td colspan="7" ' + tdl + '><b style="color:#C62828">Not reported yet</b></td></tr>';
    n++; Object.keys(tot).forEach((k) => { tot[k] += Number(d[k]) || 0; });
    const at = d.enteredAt ? new Date(new Date(d.enteredAt).getTime() + 5 * 3600 * 1000).toISOString().slice(11, 16) : '';
    return '<tr><td ' + tdl + '><b>' + esc(o) + '</b></td><td ' + td + '><b>' + fmt(d.total) + '</b></td><td ' + td + '>' + fmt(d.dineIn) + '</td><td ' + td + '>' + fmt(d.takeaway) + '</td><td ' + td + '>' + fmt(d.delivery) + '</td><td ' + td + '>' + fmt(d.running) + '</td><td ' + tdl + '>' + esc(d.note) + '</td><td ' + td + '>' + at + '</td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:auto"><div style="background:#C82620;color:#fff;padding:16px 20px;font-family:Georgia,serif;font-size:22px;font-weight:bold">FUSE - Morning sales</div><div style="padding:12px 4px;color:#755F5A">' + today + ' - ' + n + ' of ' + list.length + ' outlets reported</div>' +
    '<table style="width:100%;border-collapse:collapse"><tr><th ' + thl + '>Outlet</th><th ' + th + '>Morning total</th><th ' + th + '>Dine in</th><th ' + th + '>Take away</th><th ' + th + '>Delivery</th><th ' + th + '>Running tables</th><th ' + thl + '>Note</th><th ' + th + '>Time</th></tr>' + rows +
    (n ? '<tr><td ' + tdl + '><b>Total</b></td><td ' + td + '><b>' + fmt(tot.total) + '</b></td><td ' + td + '><b>' + fmt(tot.dineIn) + '</b></td><td ' + td + '><b>' + fmt(tot.takeaway) + '</b></td><td ' + td + '><b>' + fmt(tot.delivery) + '</b></td><td ' + td + '><b>' + fmt(tot.running) + '</b></td><td></td><td></td></tr>' : '') +
    '</table><p style="color:#755F5A;font-size:12px">Amounts in Rs. Running tables are open bills and are not added into the morning total.</p></div>';
  const dd = new Date(today + 'T12:00:00Z').toUTCString().slice(5, 16);
  const subject = n ? 'FUSE morning sales - ' + dd + ' - Rs ' + fmt(tot.total) + ' (' + n + ' of ' + list.length + ' outlets)' : 'FUSE morning sales - ' + dd + ' - none reported yet';
  await L.sendMail({ to: cfg.directors, subject, html, text: subject });
  return L.json(200, { ok: true, subject, to: cfg.directors.length });
});
