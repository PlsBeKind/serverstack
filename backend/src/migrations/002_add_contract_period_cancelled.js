export const version = 2;

export function up(db) {
  const cols = db.prepare("PRAGMA table_info(contracts)").all().map(c => c.name);

  if (!cols.includes('contract_period')) {
    db.exec('ALTER TABLE contracts ADD COLUMN contract_period TEXT');
  }

  if (!cols.includes('is_cancelled')) {
    db.exec('ALTER TABLE contracts ADD COLUMN is_cancelled INTEGER DEFAULT 0');
  }
}
