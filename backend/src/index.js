import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './database.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import providerRoutes from './routes/providers.js';
import serverRoutes from './routes/servers.js';
import ipRoutes from './routes/ips.js';
import serviceRoutes from './routes/services.js';
import tagRoutes from './routes/tags.js';
import dashboardRoutes from './routes/dashboard.js';
import exportRoutes from './routes/export.js';
import cron from 'node-cron';
import { checkAlerts } from './jobs/alertChecker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Init database with migrations
  const db = await initDatabase();

  // Public routes
  app.use('/api/v1/auth', authRoutes(db));

  // Protected routes
  app.use('/api/v1/providers', authMiddleware, providerRoutes(db));
  app.use('/api/v1/servers', authMiddleware, serverRoutes(db));
  app.use('/api/v1/ips', authMiddleware, ipRoutes(db));
  app.use('/api/v1/services', authMiddleware, serviceRoutes(db));
  app.use('/api/v1/tags', authMiddleware, tagRoutes(db));
  app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes(db));
  app.use('/api/v1', authMiddleware, exportRoutes(db));

  // Serve frontend in production
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });

  // Error handler
  app.use((err, req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'server.internal_error' });
  });

  // Alert checker cron — runs daily at 8am
  cron.schedule('0 8 * * *', () => {
    try { checkAlerts(db); } catch (err) { console.error('Alert checker failed:', err); }
  });

  // Run alert check on startup
  try { checkAlerts(db); } catch { /* ignore on startup */ }

  app.listen(PORT, () => {
    console.log(`ServerStack running on port ${PORT}`);
  });

  return { app, db };
}

const { app, db } = await start();
export { app, db };
