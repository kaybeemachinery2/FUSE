/* Visible error report: shows problems on screen instead of a blank page (useful on phones). */
(function () {
  var box;
  function show(msg) {
    try {
      if (!box) {
        box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:100000;background:#FFF3E0;color:#B71C1C;font:13px/1.4 Arial,sans-serif;padding:10px 12px;border-bottom:2px solid #C82620;word-break:break-word';
        (document.body || document.documentElement).appendChild(box);
      }
      box.innerHTML += '<div>' + String(msg).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) + '</div>';
    } catch (e) {}
  }
  window.addEventListener('error', function (e) { show('Error: ' + (e.message || 'unknown') + (e.lineno ? ' (line ' + e.lineno + ')' : '')); });
  window.addEventListener('unhandledrejection', function (e) { show('Problem: ' + ((e.reason && e.reason.message) || e.reason)); });
  setTimeout(function () {
    if (!window.__SESSION && !document.getElementById('loginov')) show('Still waiting for the portal to start. Screenshot this and send it to Claude.');
  }, 7000);
})();
/* Implements the claude.use(...) runtime the portal was written for, on top of /api/*.
   Loaded before the app. Shows a login screen first (outlet + PIN, or Director password). */
(function () {
  var SESSION = null, readyP = null;
  window.__SESSION = null;

  function api(path, body, opts) {
    opts = opts || {};
    return fetch(path, Object.assign({ method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin' },
      body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, opts))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && path !== '/api/login') { SESSION = null; location.reload(); }
          if (!r.ok) { var e = new Error(j.error || ('Request failed (' + r.status + ')')); e.status = r.status; throw e; }
          return j;
        });
      });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function loginUI(outlets) {
    return new Promise(function (resolve) {
      var d = document.createElement('div');
      d.id = 'loginov';
      d.style.cssText = 'position:fixed;inset:0;background:#FBF4F1;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Arial,Helvetica,sans-serif';
      var mode = 'manager';
      function draw(msg) {
        d.innerHTML = '<div style="background:#fff;border:1px solid #EAD9D3;border-radius:14px;padding:22px;max-width:360px;width:100%;box-shadow:0 6px 24px rgba(200,38,32,.12)">' +
          '<div style="background:#C82620;color:#fff;border-radius:10px;padding:14px;text-align:center;font-family:Georgia,serif;font-size:22px;font-weight:bold;margin-bottom:16px">Manager\'s Portal</div>' +
          (msg ? '<div style="background:#FDECEA;color:#B71C1C;border-radius:8px;padding:10px;margin-bottom:12px;font-size:14px">' + esc(msg) + '</div>' : '') +
          (mode === 'manager'
            ? '<label style="font-size:13px;color:#755F5A">Outlet</label><select id="lo" style="width:100%;padding:13px;font-size:16px;margin:4px 0 12px;border:1px solid #D9C6BF;border-radius:8px">' +
              outlets.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>' +
              '<label style="font-size:13px;color:#755F5A">PIN</label><input id="lp" type="password" inputmode="numeric" autocomplete="current-password" style="width:100%;padding:13px;font-size:18px;margin:4px 0 14px;border:1px solid #D9C6BF;border-radius:8px;box-sizing:border-box">'
            : '<label style="font-size:13px;color:#755F5A">Director password</label><input id="lp" type="password" autocomplete="current-password" style="width:100%;padding:13px;font-size:16px;margin:4px 0 14px;border:1px solid #D9C6BF;border-radius:8px;box-sizing:border-box">') +
          '<button id="lgo" style="width:100%;padding:14px;font-size:17px;background:#C82620;color:#fff;border:0;border-radius:10px;font-weight:bold">Sign in</button>' +
          '<div style="text-align:center;margin-top:14px"><a href="#" id="lsw" style="color:#C82620;font-size:14px">' + (mode === 'manager' ? 'Director sign in' : 'Manager sign in') + '</a></div></div>';
        d.querySelector('#lsw').onclick = function (e) { e.preventDefault(); mode = mode === 'manager' ? 'director' : 'manager'; draw(); };
        var go = function () {
          var btn = d.querySelector('#lgo'); btn.disabled = true; btn.textContent = 'Signing in...';
          var body = mode === 'manager' ? { outlet: d.querySelector('#lo').value, pin: d.querySelector('#lp').value } : { password: d.querySelector('#lp').value };
          api('/api/login', body).then(function (r) { d.remove(); resolve(r); }).catch(function (e) { draw(e.message); });
        };
        d.querySelector('#lgo').onclick = go;
        d.querySelector('#lp').onkeydown = function (e) { if (e.key === 'Enter') go(); };
      }
      draw();
      document.body.appendChild(d);
    });
  }

  function signOutBtn() {
    var b = document.createElement('a');
    b.href = '#'; b.textContent = 'Sign out (' + (SESSION.role === 'director' ? 'Director' : SESSION.outlet) + ')';
    b.style.cssText = 'position:fixed;right:10px;bottom:6px;font:12px Arial;color:#755F5A;background:rgba(255,255,255,.85);padding:3px 8px;border-radius:10px;z-index:9999';
    b.onclick = function (e) { e.preventDefault(); api('/api/me?logout=1').then(function () { location.reload(); }); };
    document.body.appendChild(b);
  }

  function ready() {
    if (readyP) return readyP;
    readyP = fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { return x.ok ? x.j : loginUI(x.j.outlets || []); })
      .then(function (s) { SESSION = s; window.__SESSION = s; signOutBtn(); return s; });
    return readyP;
  }

  function mkdoc(path) {
    return {
      get: function () { return api('/api/db', { op: 'get', path: path }).then(function (r) { return { exists: !!r.exists, data: function () { return r.data ? JSON.parse(JSON.stringify(r.data)) : undefined; } }; }); },
      set: function (d) { return api('/api/db', { op: 'set', path: path, data: d }); }
    };
  }
  function query(col, where) {
    return {
      where: function (f, op, v) { return query(col, where.concat([[f, v]])); },
      get: function () { return api('/api/db', { op: 'query', collection: col, where: where }).then(function (r) { return { docs: r.docs.map(function (x) { return { data: function () { return x; } }; }) }; }); }
    };
  }
  function fileToBlob(f) { return f; }

  var CAPS = {
    db: function () { return { doc: mkdoc, collection: function (c) { return query(c, []); } }; },
    assets: function () {
      return {
        upload: function (blob, o) {
          var type = (o && o.type) || blob.type || 'image/jpeg';
          return fetch('/api/upload', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': type }, body: fileToBlob(blob) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload failed'); return { id: j.id }; }); });
        },
        delete: function () { return Promise.resolve(); }
      };
    },
    mcp: function () {
      return {
        callTool: function (server, tool, input) {
          if (tool !== 'send_message') return Promise.reject(new Error('Not supported'));
          return api('/api/send', { subject: input.subject, htmlBody: input.htmlBody, attachments: input.attachments || [] }).then(function () { return { payload: { id: '1' } }; });
        }
      };
    },
    downloads: function () {
      return {
        save: function (o) {
          var a = document.createElement('a'), u = URL.createObjectURL(o.data);
          a.href = u; a.download = o.filename; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
          return Promise.resolve();
        }
      };
    },
    user: function () {
      return { me: function () { return Promise.resolve({ email: null, isOwner: SESSION.role === 'director', canEdit: false }); } };
    }
  };

  window.claude = {
    use: function (name) {
      return ready().then(function () { if (!CAPS[name]) throw new Error('Unknown capability ' + name); return CAPS[name](); });
    }
  };
})();
