import express from 'express';
import { initDatabase } from '../src/database.js';
import { authMiddleware } from '../src/middleware/auth.js';
import authRoutes from '../src/routes/auth.js';

/**
 * Create a fresh app + in-memory DB for testing.
 */
export function createTestApp() {
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!!';

  const db = initDatabase(':memory:');
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/v1/auth', authRoutes(db));

  return { app, db };
}

/**
 * Register a user and return the JWT token.
 */
export async function getAuthToken(request, app, username = 'testuser', password = 'testpass123') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ username, password });
  return res.body.token;
}

/**
 * Seed a provider and return its ID.
 */
export function seedProvider(db, name = 'Hetzner') {
  const result = db.prepare('INSERT INTO providers (name, website) VALUES (?, ?)').run(name, 'https://hetzner.com');
  return result.lastInsertRowid;
}

/**
 * Seed a server and return its ID.
 */
export function seedServer(db, providerId, name = 'VPS Prod') {
  const result = db.prepare(
    'INSERT INTO servers (provider_id, name, hostname, os, ram_mb, storage_gb, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(providerId, name, 'srv1.example.com', 'Ubuntu 22.04', 16384, 100, 'active');
  return result.lastInsertRowid;
}
