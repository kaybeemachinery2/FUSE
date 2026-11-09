// Local test server (not used on Vercel): serves /public and mounts /api/*.js like Vercel does.
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const PORT = process.env.PORT || 3000;
const mime = { '.html': 'text/html', '.js': 'application/javascript' };
http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  res.send = (b) => res.end(b);
  req.query = u.query;
  let p = u.pathname;
  if (p.startsWith('/_blob/')) { req.query = { id: p.slice(7) }; p = '/api/blob'; }
  if (p.startsWith('/api/')) {
    const f = path.join(__dirname, p + '.js');
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('no'); }
    const m = require(f);
    if (!(m.config && m.config.api && m.config.api.bodyParser === false)) {
      const ch = []; for await (const c of req) ch.push(c);
      const raw = Buffer.concat(ch).toString();
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
    }
    return (m.default || m)(req, res);
  }
  const f = path.join(__dirname, 'public', p === '/' ? 'index.html' : p);
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('Content-Type', mime[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log('http://localhost:' + PORT));
