const L = require('./_lib');
// POST {subject, htmlBody, attachments:[{content(base64),filename}]} -> emailed to the Directors in Settings.
// The recipient list is always taken from the server config, never from the browser.
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.send(res, 401, { error: 'Not signed in' });
  if (!(await L.hit('mail:' + (s.outlet || 'dir'), 40, 86400))) return L.send(res, 429, { error: 'Email limit reached for today' });
  const b = await L.readJson(req);
  const subject = String(b.subject || '').slice(0, 200);
  if (!/^(REVISED - )?DSR /.test(subject) && s.role !== 'director') return L.send(res, 403, { error: 'Not allowed' });
  const atts = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 2).map((a) => ({ filename: String(a.filename || 'file.xlsx').slice(0, 120), content: String(a.content || '') }));
  if (atts.reduce((n, a) => n + a.content.length, 0) > 6 * 1024 * 1024) return L.send(res, 413, { error: 'Attachment too large' });
  const cfg = await L.getConfig();
  await L.sendMail({ to: cfg.directors, subject, html: String(b.htmlBody || ''), text: 'See the HTML version of this email.', attachments: atts });
  return L.send(res, 200, { ok: true, to: cfg.directors.length });
});
module.exports.config = { api: { bodyParser: { sizeLimit: '9mb' } } };
