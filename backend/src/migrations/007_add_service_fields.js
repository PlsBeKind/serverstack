export const version = 7;

export function up(db) {
  const cols = db.prepare("PRAGMA table_info(services)").all().map(c => c.name);

  if (!cols.includes('domain')) {
    db.exec('ALTER TABLE services ADD COLUMN domain TEXT');
  }

  if (!cols.includes('protocol')) {
    db.exec("ALTER TABLE services ADD COLUMN protocol TEXT DEFAULT 'tcp'");
  }
}
