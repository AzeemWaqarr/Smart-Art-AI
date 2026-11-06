import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

const isProd = process.env.NODE_ENV === 'production';
const onVercel = !!process.env.VERCEL;

/**
 * Which AI model the coach uses.
 * - GEMINI_API_KEY set: Google Gemini through its OpenAI-compatible endpoint (GEMINI_MODEL, default gemini-flash-latest).
 * - otherwise AI_BASE_URL / AI_API_KEY / AI_MODEL: any OpenAI-compatible server (Open WebUI, vLLM, Ollama…).
 * - neither: the built-in demo coach.
 */
function aiConfig() {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  const provider = forced || (geminiKey ? 'gemini' : 'openai');
  const shared = {
    timeoutMs: Number(process.env.AI_TIMEOUT || (onVercel ? 50 : 120)) * 1000,
    maxTokens: Number(process.env.AI_MAX_TOKENS || 4096),
  };
  if (provider === 'gemini') {
    return {
      ...shared,
      provider,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      disableThinking: process.env.AI_DISABLE_THINKING !== 'false',
      jsonMode: true,
    };
  }
  return {
    ...shared,
    provider,
    baseUrl: (process.env.AI_BASE_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'qwen2.5vl:7b',
    disableThinking: process.env.AI_DISABLE_THINKING !== 'false',
    jsonMode: process.env.AI_JSON_MODE === 'true',
  };
}

const jwtSecret =process.env.JWT_SECRET || '';
if (isProd && (jwtSecret.length < 24 || jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set to a long random string in production.');
}

export const env = {
  isProd,
  onVercel,
  port: Number(process.env.PORT || 4000),
  jwtSecret: jwtSecret || 'dev-only-secret-do-not-use-in-production',
  tz: process.env.APP_TZ || 'Asia/Karachi',
  // only used when Vercel Blob is not configured (local / Docker)
  uploadDir: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR || 'uploads'),
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  ai: aiConfig(),
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@smartart.local',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    name: process.env.ADMIN_NAME || 'Smart Art Admin',
  },
  seedDemo: process.env.SEED_DEMO !== 'false',
  // Secure cookies need HTTPS. Set COOKIE_SECURE=false only for testing a production build over plain http.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
};

/** True when a real model endpoint is configured; otherwise the demo coach is used. */
export function aiIsReal() {
  return env.ai.provider !== 'mock' && !!env.ai.baseUrl;
}
