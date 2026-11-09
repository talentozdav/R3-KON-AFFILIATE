import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authMiddleware } from './server/middleware/auth.js';
import { authRouter } from './server/routes/auth.js';
import { applicationsRouter } from './server/routes/applications.js';
import { affiliatesRouter } from './server/routes/affiliates.js';
import { adminRouter } from './server/routes/admin.js';
import { referralsRouter } from './server/routes/referrals.js';

import { clientRouter } from './server/routes/client.js';
import { checkDatabaseConnectivity } from './server/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

app.use(express.json());
app.use(express.static(path.resolve(__dirname, 'public')));
app.use(authMiddleware);

// Health check with live database connectivity test
app.get('/api/health', async (_req, res) => {
  const dbHealth = await checkDatabaseConnectivity();
  res.json({
    status: dbHealth.connected ? 'operational' : 'degraded',
    network: 'R3 Global Affiliate Network & Client Coordination',
    environment: isProduction ? 'production' : 'development',
    serverless: isVercel,
    database: {
      connected: dbHealth.connected,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error || null
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/affiliates', affiliatesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/client', clientRouter);

// JSON 404 handler for any unmapped API endpoint (prevents Vercel HTML error parsing failures)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}. Verify API endpoint path.`
  });
});

// JSON error middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[R3 Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An internal server error occurred.'
  });
});

// Local / Standalone Server initialization
async function setupViteAndListen() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Only bind port when running as a standalone server, not under Vercel serverless functions
  if (!isVercel) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[R3 Network] Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

// Only run server listener if server.ts is the main module
const isMain = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (!isVercel && isMain && process.env.NODE_ENV !== 'test') {
  setupViteAndListen().catch((err) => {
    console.error('[R3 Network] Failed to initialize server:', err);
    process.exit(1);
  });
}

export default app;
