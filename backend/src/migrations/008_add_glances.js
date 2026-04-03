export const version = 8;

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS glances_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      glances_url TEXT NOT NULL,
      glances_username TEXT,
      glances_password_enc TEXT,
      poll_interval_seconds INTEGER NOT NULL DEFAULT 60,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS glances_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      timestamp DATETIME NOT NULL,
      cpu_percent REAL,
      cpu_temp REAL,
      ram_total INTEGER,
      ram_used INTEGER,
      ram_percent REAL,
      swap_total INTEGER,
      swap_used INTEGER,
      swap_percent REAL,
      net_rx_rate INTEGER,
      net_tx_rate INTEGER,
      net_cumulative_rx INTEGER,
      net_cumulative_tx INTEGER,
      disk_usage_json TEXT,
      gpu_json TEXT,
      uptime TEXT,
      load_1 REAL,
      load_5 REAL,
      load_15 REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_glances_snapshots_server_time ON glances_snapshots(server_id, timestamp)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS glances_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retention_hours INTEGER NOT NULL DEFAULT 168,
      default_poll_interval INTEGER NOT NULL DEFAULT 60
    )
  `);

  // Insert default settings row if none exists
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM glances_settings').get();
  if (existing.cnt === 0) {
    db.prepare('INSERT INTO glances_settings (retention_hours, default_poll_interval) VALUES (?, ?)').run(168, 60);
  }
}
