import fs from 'node:fs';
import { app } from './app.js';
import { aiIsReal, env } from './env.js';
import { resumePending } from './services/drawings.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

app.listen(env.port, () => {
  console.log(`Smart Art API on http://localhost:${env.port}`);
  console.log(aiIsReal() ? `AI coach: ${env.ai.model} at ${env.ai.baseUrl}` : 'AI coach: demo mode (set AI_BASE_URL in server/.env to use your model)');
  void resumePending();
});
