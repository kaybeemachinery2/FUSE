# Manager's Portal (FUSE pilot)

Mobile web app for outlet managers: Manager Walk, Morning sales, Warehouse requisition, Closing counts (with variance),
Closing Sales Report (DSR, emailed to Directors with the monthly Excel), Closing Checklist (with photos).
Directors get Settings and the Monthly Excel download.

## Deploy on Netlify (from GitHub)
1. Netlify -> **Add new site -> Import an existing project -> GitHub** -> pick this repo. The build settings are read from
   `netlify.toml` (publish `public`, functions `netlify/functions`). Press **Deploy**.
2. **Site configuration -> Environment variables**, add:

| Name | Value |
|---|---|
| `DIRECTOR_PASSWORD` | a long password for Directors / Operations |
| `OUTLET_PINS` | `{"FUSE Seher":"4821","FUSE Johar":"7305","FUSE @ Yard":"1946","FUSE Lucky One":"6258"}` (choose your own; one line, straight quotes) |
| `SESSION_SECRET` | any random 16+ characters |
| `RESEND_API_KEY` + `MAIL_FROM` | for emails (optional at first), e.g. `FUSE Portal <portal@yourdomain.com>` |
| `CRON_SECRET` | optional, only to trigger the morning email by hand |
| `DIRECTORS` | optional, comma separated emails; otherwise the list saved in Settings (default: the 3 Directors) |

3. **Deploys -> Trigger deploy -> Deploy site** so the variables take effect. Open the site URL on a phone and "Add to Home Screen".

Data and photos are stored in **Netlify Blobs** (built in - nothing to connect). The 6:30pm Karachi morning-sales email is a
Netlify scheduled function (`30 13 * * *` UTC); it runs on the published production deploy.

## How it behaves
- Managers sign in with outlet + PIN and see only their outlet. Directors sign in with the password and see everything. Sessions last 12 hours; wrong PINs are rate limited.
- Email recipients are always the Directors from Settings - the browser cannot choose them.
- Photos are only served to signed-in users.

## Layout
- `public/index.html` - the whole app, `public/adapter.js` - login screen and the calls to `/api/*`
- `netlify/functions/*.mjs` - API (login, me, db, upload, blob, send, cron-morning); `netlify/lib/lib.mjs` - shared code
- `vercel-version/` - the earlier Vercel version of the same backend (not used by Netlify)

## Local test
`MEMORY_DB=1 MAIL_DRY_RUN=1 SESSION_SECRET=... DIRECTOR_PASSWORD=... OUTLET_PINS='{...}' node dev-netlify.mjs` then open http://localhost:3100
(in-memory storage and no real emails; the real Netlify Blobs and scheduled function can only be exercised on Netlify).
