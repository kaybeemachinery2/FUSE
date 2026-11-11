import * as L from '../lib/lib.mjs';
export const config = { path: '/api/health' };
// Open /api/health in a browser to see whether storage and settings work. It only reports yes/no, never secrets.
export default L.wrap(async () => {
  const out = { settings: {
    OUTLET_PINS: !!process.env.OUTLET_PINS, DIRECTOR_PASSWORD: !!process.env.DIRECTOR_PASSWORD,
    SESSION_SECRET: (process.env.SESSION_SECRET || '').length >= 16, RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    GMAIL_USER: !!process.env.GMAIL_USER, GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD } };
  out.email = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) ? 'gmail' : ((process.env.RESEND_API_KEY && process.env.MAIL_FROM) ? 'resend' : 'not set up');
  const t0 = Date.now();
  try {
    const docs = await L.store('docs');
    await docs.setJSON('health/check', { at: new Date().toISOString() });
    const back = await docs.get('health/check', { type: 'json' });
    const list = await docs.list({ prefix: 'health/' });
    out.storage = back && back.at ? 'ok' : 'wrote but could not read back';
    out.listing = (list.blobs || []).length >= 1 ? 'ok' : 'empty';
  } catch (e) { out.storage = 'FAILED: ' + String(e.message || e).slice(0, 300); }
  out.ms = Date.now() - t0;
  return L.json(200, out);
});
