export const version = 6;

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      old_cost REAL,
      new_cost REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT 'manual',
      changed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  // Seed initial cost_history entries for servers that already have a monthly_cost
  const servers = db.prepare('SELECT id, monthly_cost FROM servers WHERE monthly_cost > 0').all();
  for (const s of servers) {
    const existing = db.prepare('SELECT id FROM cost_history WHERE server_id = ?').get(s.id);
    if (!existing) {
      db.prepare('INSERT INTO cost_history (server_id, old_cost, new_cost, reason) VALUES (?, ?, ?, ?)')
        .run(s.id, null, s.monthly_cost, 'manual');
    }
  }
}
