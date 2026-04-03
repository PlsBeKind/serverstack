export const version = 4;

export function up(db) {
  // Create server_disks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_disks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      label TEXT,
      size_gb INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'ssd',
      monthly_cost REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing storage_gb/storage_type into a disk row per server
  const serverCols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
  if (serverCols.includes('storage_gb')) {
    const servers = db.prepare('SELECT id, storage_gb, storage_type FROM servers WHERE storage_gb IS NOT NULL AND storage_gb > 0').all();
    for (const s of servers) {
      db.prepare('INSERT INTO server_disks (server_id, label, size_gb, type) VALUES (?, ?, ?, ?)')
        .run(s.id, 'Primary', s.storage_gb, s.storage_type || 'ssd');
    }

    // SQLite can't drop columns before 3.35.0, so we leave storage_gb/storage_type
    // as deprecated columns. They won't be used by the app anymore.
    // On fresh installs, migration 001+003 creates them but they're ignored.
  }
}
