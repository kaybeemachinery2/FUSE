# Manager's Portal - Vercel version (FUSE pilot)

Mobile web app for outlet managers: Manager Walk, Morning sales, Warehouse requisition, Closing counts,
Closing Sales Report (DSR, emailed to Directors with the monthly Excel), Closing Checklist (with photos).
Directors get Settings + the Monthly Excel download.

## Stack
- `public/index.html` - the whole app (single file) + `public/adapter.js` (login screen, talks to `/api/*`)
- `api/*.js` - Vercel serverless functions
- Upstash Redis = data, Vercel Blob = photos, Resend = email, Vercel Cron = 6:30pm morning-sales email

## Deploy (about 10 minutes)
1. Put this folder in a GitHub repo (or run `npx vercel` in it) and import it in Vercel.
2. **Storage tab** -> add **Upstash Redis** (Marketplace) and **Blob**. Vercel adds
   `KV_REST_API_URL`, `KV_REST_API_TOKEN` and `BLOB_READ_WRITE_TOKEN` automatically. Connect both to the project.
3. **Resend** (resend.com): verify your sending domain, create an API key.
4. Settings -> Environment Variables:

| Name | Value |
|---|---|
| `OUTLET_PINS` | `{"FUSE Seher":"1111","FUSE Johar":"2222","FUSE @ Yard":"3333","FUSE Lucky One":"4444"}` (choose real PINs) |
| `DIRECTOR_PASSWORD` | a long password for Directors / Operations |
| `SESSION_SECRET` | any random 32+ characters |
| `RESEND_API_KEY` | from Resend |
| `MAIL_FROM` | e.g. `FUSE Portal <portal@yourdomain.com>` |
| `CRON_SECRET` | any random string (Vercel sends it to the cron automatically) |
| `DIRECTORS` | optional, comma separated emails; otherwise the list saved in Settings (default: the 3 Directors) |

5. Redeploy. Open the URL on a phone and "Add to Home Screen".

## Notes
- Managers sign in with outlet + PIN and see only their outlet. Directors sign in with the password and get everything.
  Sessions last 12 hours. Wrong PINs are rate limited.
- Email recipients are always the Directors from Settings - the browser cannot choose them.
- Cron `30 13 * * *` UTC = 6:30pm Karachi. Vercel Hobby allows one cron per day, which is enough.
- Photos are only served to signed-in users.
- Switching on: disable the old Claude scheduled task (it would send a second email) and tell managers the new link/PINs.
- Moving existing data from the claude.ai version is not automatic (start fresh, or ask for an export script).

## Local test
`MEMORY_DB=1 MAIL_DRY_RUN=1 SESSION_SECRET=... DIRECTOR_PASSWORD=... OUTLET_PINS='{...}' node dev-server.js`
