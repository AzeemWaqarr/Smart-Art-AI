/* Checks the AI model connection from the command line:  npm run ai:check
   Lists the models your server offers and runs the same image test as Admin → AI coach. */
import { aiIsReal, env } from './env.js';
import { testAi } from './ai/coach.js';

async function main() {
  if (!aiIsReal()) {
    console.log('AI_BASE_URL is empty in server/.env, so the demo coach is used. Set it to your model server URL (ending in /v1).');
    process.exit(1);
  }
  console.log(`Server: ${env.ai.baseUrl}\nModel:  ${env.ai.model}\nKey:    ${env.ai.apiKey ? 'set' : 'not set'}\n`);
  try {
    const res = await fetch(`${env.ai.baseUrl}/models`, {
      headers: env.ai.apiKey ? { Authorization: `Bearer ${env.ai.apiKey}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id: string }[] };
      const ids = (data.data || []).map((m) => m.id);
      console.log('Models on this server:\n' + (ids.length ? ids.map((id) => `  - ${id}${id === env.ai.model ? '   <- AI_MODEL' : ''}`).join('\n') : '  (none listed)'));
      if (ids.length && !ids.includes(env.ai.model)) console.log(`\n! AI_MODEL "${env.ai.model}" is not in this list. Copy the exact id into server/.env.`);
    } else {
      console.log(`Could not list models (HTTP ${res.status}). Continuing with the image test…`);
    }
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause;
    console.log(`Could not reach ${env.ai.baseUrl}/models: ${cause?.code || (e as Error).message}`);
    if (cause?.code && /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(cause.code)) {
      console.log('Your company server uses its own certificate. Set NODE_EXTRA_CA_CERTS=<path to the company CA .pem> before starting the server.');
    }
  }
  console.log('\nImage test (can the model see a red square?)…');
  const r = await testAi();
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.message}`);
  process.exit(r.ok ? 0 : 1);
}

void main();
