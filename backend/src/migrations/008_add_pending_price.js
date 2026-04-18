export const version = 8;

export function up(db) {
  const cols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);

  if (!cols.includes('pending_cost')) {
    db.exec('ALTER TABLE servers ADD COLUMN pending_cost REAL');
  }
  if (!cols.includes('pending_cost_date')) {
    db.exec('ALTER TABLE servers ADD COLUMN pending_cost_date TEXT');
  }
  if (!cols.includes('pending_cost_reason')) {
    db.exec("ALTER TABLE servers ADD COLUMN pending_cost_reason TEXT DEFAULT 'price_increase'");
  }
}
