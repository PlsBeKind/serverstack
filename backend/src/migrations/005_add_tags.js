export const version = 5;

const PRESET_TAGS = [
  { name: 'production', color: '#10b981' },
  { name: 'testing', color: '#f59e0b' },
  { name: 'idle', color: '#6b7280' },
  { name: 'promo', color: '#8b5cf6' },
  { name: 'backup', color: '#3b82f6' },
  { name: 'monitoring', color: '#06b6d4' },
];

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      is_preset INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_tags (
      server_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (server_id, tag_id),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  // Seed preset tags if not already present
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, color, is_preset) VALUES (?, ?, 1)');
  for (const tag of PRESET_TAGS) {
    insertTag.run(tag.name, tag.color);
  }
}
