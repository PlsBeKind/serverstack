import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run all pending migrations on the database.
 * @param {import('better-sqlite3').Database} db
 */
export async function runMigrations(db) {
  // Create version tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Get current version
  const row = db.prepare('SELECT MAX(version) as current_version FROM schema_version').get();
  const currentVersion = row.current_version || 0;

  // Load migration files
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  let applied = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const migration = await import(pathToFileURL(filePath).href);

    if (migration.version > currentVersion) {
      const migrate = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      });

      migrate();
      applied++;
      console.log(`Migration ${migration.version} applied: ${file}`);
    }
  }

  if (applied === 0) {
    console.log(`Database up to date (version ${currentVersion})`);
  }
}
