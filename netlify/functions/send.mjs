import * as L from '../lib/lib.mjs';
export const config = { path: '/api/send' };
// Recipients always come from the Directors list in Settings, never from the browser.
export default L.wrap(async (req) => {
  if (req.method !== 'POST') return L.json(405, { error: 'POST only' });
  const s = L.getSession(req);
  if (!s) return L.json(401, { error: 'Not signed in' });
  if (!(await L.hit('mail:' + (s.outlet || 'dir'), 40, 86400))) return L.json(429, { error: 'Email limit reached for today' });
  const b = await req.json().catch(() => ({}));
  const subject = String(b.subject || '').slice(0, 200);
  if (!/^(REVISED - )?DSR /.test(subject) && s.role !== 'director') return L.json(403, { error: 'Not allowed' });
  const atts = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 2).map((a) => ({ filename: String(a.filename || 'file.xlsx').slice(0, 120), content: String(a.content || '') }));
  if (atts.reduce((n, a) => n + a.content.length, 0) > 5 * 1024 * 1024) return L.json(413, { error: 'Attachment too large' });
  const cfg = await L.getConfig();
  await L.sendMail({ to: cfg.directors, subject, html: String(b.htmlBody || ''), text: 'See the HTML version of this email.', attachments: atts });
  return L.json(200, { ok: true, to: cfg.directors.length });
});
