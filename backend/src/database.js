import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize SQLite database and run pending migrations.
 * @param {string} [dbPath] - path to db file, ':memory:' for tests
 * @returns {Promise<import('better-sqlite3').Database>}
 */
export async function initDatabase(dbPath) {
  const resolvedPath = dbPath || path.resolve(__dirname, '../../data/serverstack.db');
  const db = new Database(resolvedPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  await runMigrations(db);

  return db;
}
