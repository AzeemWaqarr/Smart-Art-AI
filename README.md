# Smart Art – AI art coach (PWA)

Smart Art is an installable progressive web app (PWA). It's based on the 8-screen *Smart Art App Prototype* in this folder. Children and teens take a photo of their drawing and get kind, clear tips on colour, light, proportion and composition, in English or Urdu.

| Role | What they get | Where |
|---|---|---|
| **Student** (13+, or a child added by a parent) | Three tabs, as in the *Smart Art Coach* prototype. **Home**: streak, today's challenge, "Your week", a suggested lesson. **Coach**: upload a drawing to get what's working, 1–5 skill scores, 3 tips with reasons and a practice exercise. **Lessons**: short lessons. The header menu has progress and badges, drawings, plans, family & safety, notifications and settings (including light/dark theme). | `/app` |
| **Parent** | Add children (username login, no email), see each child's progress and drawings, daily time limit and other safety settings | `/parent` |
| **Admin** | Dashboard, users (search, suspend, reset password, delete), lessons, challenges, AI coach monitor, settings, announcements, audit log | `/admin` |

**Stack:** React 18 + TypeScript + Vite + `vite-plugin-pwa` (Workbox) · Node/Express API · Prisma ORM on PostgreSQL · drawings in Vercel Blob (or on disk locally) · deployable to Vercel · JWT session in an httpOnly cookie.

---

## Run it locally

Requires Node 20+ and Docker Desktop (for the local PostgreSQL database).

```bash
npm install
cp server/.env.example server/.env      # then edit JWT_SECRET, ADMIN_PASSWORD, GEMINI_API_KEY
npm run db:up                           # start PostgreSQL in Docker
npm run db:push -w server               # create the tables
npm run seed                            # admin + lessons + challenge (+ demo accounts)
npm run dev                             # API on :4000, app on http://localhost:5173
```

### Demo logins (created when `SEED_DEMO=true`)

| Role | Login | Password |
|---|---|---|
| Admin | `admin@smartart.local` (from `ADMIN_EMAIL`) | `ChangeMe123!` (from `ADMIN_PASSWORD`) |
| Parent | `parent@demo.pk` | `demo1234` |
| Child (age 11, linked to the parent) | `ayesha` | `demo1234` |
| Teen (15) | `teen@demo.pk` | `demo1234` |

**Change the admin password before going live.** Set `SEED_DEMO=false` in production.

---

## Connecting the AI coach (Gemini)

The coach uses **Google Gemini**. Get a free key at <https://aistudio.google.com/apikey>, then in `server/.env`:

```ini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-flash-latest   # optional; any vision-capable Gemini model id
AI_TIMEOUT=50                      # optional; seconds
```

Then run **`npm run ai:check`**. It lists the available models and sends a small red test image to confirm the model can read images. The same image test is under **Admin → AI coach → Test connection**. Restart the server after changing `.env`.

**Using another model instead.** Leave `GEMINI_API_KEY` empty and set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` to point at any OpenAI-compatible vision model (Open WebUI, vLLM, Ollama). `AI_DISABLE_THINKING=true` turns off Qwen3's thinking phase, and `AI_JSON_MODE=true` is for servers that support `response_format`.

If a self-hosted model server uses an internal TLS certificate, start the server with `NODE_EXTRA_CA_CERTS=path/to/company-ca.pem`.

- If no AI is configured, a clearly labelled **demo coach** is used instead, so the app works without a model.
- Images are analysed one at a time in a small background queue. The app shows "Your coach is looking…" and polls until the tips are ready.
- If the model fails, the drawing is marked *failed*. The student or an admin can retry it.
- If the model says the photo isn't a drawing, the student gets a friendly "we couldn't find a drawing" message.
- The prompt (in `server/src/ai/coach.ts`) asks for strict JSON: praise, 2–3 tips with marker positions, and 0–100 skill scores, in both English and Urdu. The reply is cleaned up before use, so `<think>` blocks and markdown fences are tolerated.

---

## Daily challenges

Each day the server automatically creates a "Today's challenge" from a rotating pool of 10 bilingual prompts (in `server/src/services/challenges.ts`). Admins can also schedule their own challenges in **Admin → Challenges**, for a single day, a week or a month. You can turn the automatic ones off in **Admin → Settings**.

## Everything is free

There are no plans, payments or premium content. Every account gets unlimited coach tips and every lesson.

## Safety and privacy built in

- Under-13s cannot self-register. A parent creates their login (username + password, no email).
- Drawings are private. Photos are served only to the student and their parent. Admins see feedback data, never the photos.
- No public feed, no chat. The AI is instructed never to draw for the child.
- Parents can set a daily time limit (enforced by the server), turn the weekly report on or off, and change their child's password or remove the account.
- Passwords are hashed with bcrypt. Logins are rate-limited. Cookies are httpOnly + SameSite. Cross-site POSTs are rejected. A strict Content-Security-Policy is set via helmet. Admin actions are written to an audit log.

## PWA features

- Installable: manifest, icons, and an "Install app" button where the browser supports it.
- Offline: the app shell is precached. Lessons, progress and home use network-first caching, and drawing images use cache-first. An offline banner is shown.
- A "new version ready" banner appears when an update is deployed.
- The camera uses `getUserMedia` (back camera) with a live light check, and falls back to picking a photo. Photos are shrunk on the device before upload.

> **HTTPS is required** in production for the camera, service worker and secure cookies (`localhost` is exempt).

---

## Deploy to Vercel

The repo is set up for Vercel: `vercel.json` builds the PWA as static files, and `api/index.mjs` runs the Express API as one serverless function. Vercel needs two free add-ons, because a serverless function cannot keep files: **Neon Postgres** for the database and **Vercel Blob** for drawing photos.

1. **Import the project.** Sign in at vercel.com with GitHub, then **Add New → Project → Import** `Smart-Art-AI`. Leave Framework Preset as **Other** and Root Directory as `./`, because `vercel.json` sets the build. Click **Deploy**. This first build fails at the database step because there is no database yet. That is expected.
2. **Add the database.** In the project, go to **Storage → Create Database → Neon (Serverless Postgres)** and accept the defaults. Connect it to the project for all environments. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Add photo storage.** Go to **Storage → Create → Blob** and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Add the remaining variables** under **Settings → Environment Variables**, for all environments:

   | Name | Value |
   |---|---|
   | `JWT_SECRET` | a long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | the first admin account, created on the first deploy |
   | `SEED_DEMO` | `false` (`true` adds the demo parent, child and teen) |
   | `APP_TZ` | `Asia/Karachi` |
   | `GEMINI_API_KEY` | your Gemini key |
   | `GEMINI_MODEL` | optional, defaults to `gemini-flash-latest` |
   | `AI_TIMEOUT` | optional, `50` (must stay under the function's 60-second limit, which is the default on Vercel) |

5. **Redeploy.** Go to **Deployments → ⋯ on the latest → Redeploy**. The build creates the tables, the lessons, today's challenge and your admin account.
6. **Check it.** Open the site, log in as the admin, then go to **Admin → AI coach → Test connection**. It should answer "Red" within a few seconds. If it fails, check that `GEMINI_API_KEY` is set and redeploy.

Every push to `main` deploys automatically. The build re-applies schema changes to the database, but it stops rather than delete data. The free Hobby plan is for personal, non-commercial use, so use Vercel Pro for a commercial launch.

## Other hosting

```bash
npm run build                   # builds client/dist and server/dist
NODE_ENV=production npm start   # one port (PORT, default 4000) serves the API and the PWA
```

This needs a PostgreSQL `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Photos are saved to `UPLOAD_DIR` unless `BLOB_READ_WRITE_TOKEN` is set. To test a production build over plain `http://` on your LAN, add `COOKIE_SECURE=false`. Never do this on a public deployment.

**Docker:** `docker compose --profile app up -d --build` runs the app and its PostgreSQL together. The database lives in the `smartart-db` volume and photos in `smartart-uploads`.

## Project layout

```
server/
  prisma/schema.prisma      data model
  src/app.ts                Express app (+ serves client/dist when not on Vercel)
  src/index.ts              starts the server locally / in Docker
  src/auth.ts               sessions, roles, access checks
  src/ai/coach.ts           Gemini / OpenAI-compatible adapter + demo coach
  src/routes/               auth · student · family · admin
  src/services/             stats (streaks, skills), badges, drawings queue, settings
  src/seed.ts               admin, lessons, challenge, demo data
  src/services/storage.ts   drawing photos: Vercel Blob or local disk
api/index.mjs               Vercel serverless entry (uses server/dist)
vercel.json                 Vercel build, routing and headers
client/
  src/pages/                student + parent screens
  src/admin/                admin console
  src/ur.ts                 Urdu translations (English strings are the keys)
```
