# Smart Art – AI art coach (PWA)

Smart Art is an installable progressive web app (PWA). It's based on the 8-screen *Smart Art App Prototype* in this folder. Children and teens take a photo of their drawing and get kind, clear tips on colour, light, proportion and composition, in English or Urdu.

| Role | What they get | Where |
|---|---|---|
| **Student** (13+, or a child added by a parent) | Three tabs, as in the *Smart Art Coach* prototype. **Home**: streak, today's challenge, "Your week", a suggested lesson. **Coach**: upload a drawing to get what's working, 1–5 skill scores, 3 tips with reasons and a practice exercise. **Lessons**: short lessons. The header menu has progress and badges, drawings, plans, family & safety, notifications and settings (including light/dark theme). | `/app` |
| **Parent** | Add children (username login, no email), see each child's progress and drawings, daily time limit and other safety settings | `/parent` |
| **Admin** | Dashboard, users (search, suspend, reset password, delete), lessons, challenges, AI coach monitor, settings, announcements, audit log | `/admin` |

**Stack:** React 18 + TypeScript + Vite + `vite-plugin-pwa` (Workbox) · Node/Express API · Prisma ORM on SQLite (switchable to PostgreSQL) · JWT session in an httpOnly cookie.

---

## Run it locally

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env      # then edit JWT_SECRET, ADMIN_PASSWORD, AI_* values
npm run db:push -w server               # create the database
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

## Connecting your local Qwen model

The coach talks to any **OpenAI-compatible** `/v1/chat/completions` endpoint. The model must be a **vision** model, e.g. Qwen2.5-VL / Qwen3-VL. Text-only Qwen models cannot see the drawing.

In `server/.env`:

```ini
AI_PROVIDER=openai
AI_BASE_URL=https://ai.yourcompany.com/v1   # your model server, ending in /v1
AI_MODEL=qwen3-27b                          # exact id from <AI_BASE_URL>/models
AI_API_KEY=sk-...                           # your key
AI_TIMEOUT=180                              # seconds; a 27B model can be slow
AI_MAX_TOKENS=2048
AI_DISABLE_THINKING=true                    # Qwen3: skip the "thinking" phase for faster, shorter replies
AI_JSON_MODE=false                          # true if your server supports response_format=json_object (vLLM does)
```

Then run **`npm run ai:check`**. It lists the models on your server, warns if `AI_MODEL` doesn't match one, and sends a small red test image to confirm the model can read images. The same image test is under **Admin → AI coach → Test connection**. Restart the server after changing `.env`.

If your company server uses an internal TLS certificate, start the server with `NODE_EXTRA_CA_CERTS=path/to/company-ca.pem`.

- If `AI_BASE_URL` is empty, a clearly labelled **demo coach** is used instead, so the app works without a model.
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

## Production

```bash
npm run build          # builds client/dist and server/dist
NODE_ENV=production npm start   # one port (PORT, default 4000) serves the API and the PWA
```

To test a production build over plain `http://` on your LAN (e.g. from a phone), add `COOKIE_SECURE=false`. Never do this on a public deployment.

**Docker:** `docker compose up -d --build`. The database and uploads live in the `smartart-data` volume. Point `AI_BASE_URL` at `http://host.docker.internal:11434/v1` to reach a model running on the host.

**PostgreSQL:** in `server/prisma/schema.prisma` set `provider = "postgresql"`, set `DATABASE_URL`, then run `npm run db:push -w server`.

## Project layout

```
server/
  prisma/schema.prisma      data model
  src/index.ts              Express app (+ serves client/dist in production)
  src/auth.ts               sessions, roles, access checks
  src/ai/coach.ts           Qwen / OpenAI-compatible adapter + demo coach
  src/routes/               auth · student · family · admin
  src/services/             stats (streaks, skills), badges, drawings queue, settings
  src/seed.ts               admin, lessons, challenge, demo data
client/
  src/pages/                student + parent screens
  src/admin/                admin console
  src/ur.ts                 Urdu translations (English strings are the keys)
```
