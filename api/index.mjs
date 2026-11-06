// Vercel serverless entry: every /api/* request is handled by the Express app.
// The server is compiled to server/dist by `npm run vercel-build`.
import { app } from '../server/dist/app.js';

export default app;
