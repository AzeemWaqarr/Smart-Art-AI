import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env, aiIsReal } from './env.js';
import { loadUser } from './auth.js';
import { errorHandler } from './util.js';
import { authRouter } from './routes/auth.js';
import { studentRouter } from './routes/student.js';
import { familyRouter } from './routes/family.js';
import { adminRouter } from './routes/admin.js';
import { resumePending } from './services/drawings.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: env.cookieSecure ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// Reject cross-site state-changing requests (defence in depth on top of SameSite cookies).
// Accepts the request's own host, the host seen by a reverse proxy / dev proxy (X-Forwarded-Host),
// and any extra origins listed in ALLOWED_ORIGINS (comma-separated, e.g. https://app.example.com).
const extraHosts = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    try {
      return new URL(s.includes('://') ? s : `http://${s}`).host;
    } catch {
      return s;
    }
  });
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }
  const allowed = new Set([req.get('host'), ...(req.get('x-forwarded-host') || '').split(',').map((h) => h.trim()), ...extraHosts].filter(Boolean));
  if (!allowed.has(originHost)) {
    console.warn(`Blocked cross-site ${req.method} ${req.originalUrl} from ${origin} (host ${req.get('host')})`);
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }
  next();
});

app.use(loadUser);

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiIsReal() ? 'model' : 'demo' }));
app.use('/api/auth', authRouter);
app.use('/api/family', familyRouter);
app.use('/api/admin', adminRouter);
app.use('/api', studentRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built PWA in production (single origin, single port).
if (fs.existsSync(env.clientDist)) {
  app.use(
    express.static(env.clientDist, {
      index: false,
      setHeaders: (res, file) => {
        if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: env.clientDist });
  });
}

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Smart Art API on http://localhost:${env.port}`);
  console.log(aiIsReal() ? `AI coach: ${env.ai.model} at ${env.ai.baseUrl}` : 'AI coach: demo mode (set AI_BASE_URL in server/.env to use your model)');
  void resumePending();
});
