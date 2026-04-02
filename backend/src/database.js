import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize SQLite database with all tables per the plan data model.
 * @param {string} [dbPath] - path to db file, ':memory:' for tests
 * @returns {import('better-sqlite3').Database}
 */
export function initDatabase(dbPath) {
  const resolvedPath = dbPath || path.resolve(__dirname, '../../data/serverstack.db');
  const db = new Database(resolvedPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      website TEXT,
      support_email TEXT,
      support_phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      hostname TEXT,
      location TEXT,
      cpu_cores INTEGER,
      ram_mb INTEGER,
      storage_gb INTEGER,
      storage_type TEXT,
      os TEXT,
      status TEXT DEFAULT 'active',
      ssh_user TEXT,
      ssh_port INTEGER DEFAULT 22,
      ssh_public_key TEXT,
      ssh_host_key TEXT,
      login_user TEXT,
      login_password_enc TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      contract_number TEXT,
      monthly_cost REAL DEFAULT 0,
      regular_cost REAL,
      billing_cycle TEXT DEFAULT 'monthly',
      start_date TEXT,
      end_date TEXT,
      cancellation_period_days INTEGER DEFAULT 30,
      next_cancellation_date TEXT,
      auto_renew INTEGER DEFAULT 1,
      promo_price INTEGER DEFAULT 0,
      promo_end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ip_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      version TEXT DEFAULT 'ipv4',
      type TEXT DEFAULT 'primary',
      rdns TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      port INTEGER,
      url TEXT,
      docker INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER,
      type TEXT NOT NULL,
      trigger_date TEXT,
      days_before INTEGER,
      message TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}
