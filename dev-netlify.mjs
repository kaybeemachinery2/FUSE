// Local test server for the Netlify functions (not used on Netlify). Runs with in-memory storage when MEMORY_DB=1.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const dir = path.dirname(url.fileURLToPath(import.meta.url));
const fns = [];
for (const f of fs.readdirSync(path.join(dir, 'netlify/functions'))) {
  const m = await import(path.join(dir, 'netlify/functions', f));
  [].concat((m.config && m.config.path) || ['/.netlify/functions/' + f.replace('.mjs', '')]).forEach((p) => fns.push({ p, h: m.default }));
}
const match = (pat, pn) => { const a = pat.split('/'), b = pn.split('/'); if (a.length !== b.length) return null; const params = {}; for (let i = 0; i < a.length; i++) { if (a[i].startsWith(':')) params[a[i].slice(1)] = b[i]; else if (a[i] !== b[i]) return null; } return params; };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  for (const f of fns) {
    const params = match(f.p, u.pathname); if (!params) continue;
    const ch = []; for await (const c of req) ch.push(c);
    const body = Buffer.concat(ch);
    const r = await f.h(new Request(u, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), { params });
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : null; if (sc && sc.length) h['set-cookie'] = sc;
    res.writeHead(r.status, h); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const file = path.join(dir, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript' : 'text/html' }); res.end(fs.readFileSync(file));
}).listen(3100, () => console.log('http://localhost:3100'));
