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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());
  app.use(authMiddleware);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'operational',
      network: 'R3 Global Affiliate Network',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/affiliates', affiliatesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/referrals', referralsRouter);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[R3 Network] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[R3 Network] Failed to initialize server:', err);
  process.exit(1);
});
