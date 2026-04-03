export const version = 3;

export function up(db) {
  const serverCols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);

  // Add contract fields to servers if not present
  const contractFields = [
    ['contract_number', 'TEXT'],
    ['monthly_cost', 'REAL DEFAULT 0'],
    ['regular_cost', 'REAL'],
    ['billing_cycle', 'TEXT'],
    ['contract_start_date', 'TEXT'],
    ['contract_end_date', 'TEXT'],
    ['cancellation_period_days', 'INTEGER DEFAULT 30'],
    ['next_cancellation_date', 'TEXT'],
    ['auto_renew', 'INTEGER DEFAULT 1'],
    ['promo_price', 'INTEGER DEFAULT 0'],
    ['promo_end_date', 'TEXT'],
    ['contract_period', 'TEXT'],
    ['is_cancelled', 'INTEGER DEFAULT 0'],
    ['contract_notes', 'TEXT'],
  ];

  for (const [name, type] of contractFields) {
    if (!serverCols.includes(name)) {
      db.exec(`ALTER TABLE servers ADD COLUMN ${name} ${type}`);
    }
  }

  // Build contract_id -> server_id mapping BEFORE dropping anything
  const contractsExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contracts'").get();
  const contractToServer = {};

  if (contractsExist) {
    // Migrate contract data into servers
    const contracts = db.prepare('SELECT * FROM contracts').all();
    const seen = new Set();
    for (const c of contracts) {
      contractToServer[c.id] = c.server_id;
      if (seen.has(c.server_id)) continue;
      seen.add(c.server_id);
      db.prepare(`
        UPDATE servers SET
          contract_number = ?, monthly_cost = ?, regular_cost = ?,
          billing_cycle = ?, contract_start_date = ?, contract_end_date = ?,
          cancellation_period_days = ?, next_cancellation_date = ?,
          auto_renew = ?, promo_price = ?, promo_end_date = ?,
          contract_period = ?, is_cancelled = ?, contract_notes = ?
        WHERE id = ?
      `).run(
        c.contract_number, c.monthly_cost, c.regular_cost,
        c.billing_cycle, c.start_date, c.end_date,
        c.cancellation_period_days, c.next_cancellation_date,
        c.auto_renew, c.promo_price, c.promo_end_date,
        c.contract_period, c.is_cancelled, c.notes,
        c.server_id
      );
    }
  }

  // Recreate alerts table with server_id instead of contract_id FK
  // Must disable FK temporarily to drop the table with references
  db.pragma('foreign_keys = OFF');

  const oldAlerts = db.prepare('SELECT * FROM alerts').all();
  db.exec('DROP TABLE alerts');
  db.exec(`
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      type TEXT NOT NULL,
      trigger_date TEXT,
      days_before INTEGER,
      message TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
    )
  `);

  // Restore alerts with server_id mapped from contract_id
  for (const a of oldAlerts) {
    const serverId = a.server_id || contractToServer[a.contract_id] || null;
    db.prepare('INSERT INTO alerts (server_id, type, trigger_date, days_before, message, sent, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(serverId, a.type, a.trigger_date, a.days_before, a.message, a.sent, a.sent_at, a.created_at);
  }

  // Drop contracts table
  db.exec('DROP TABLE IF EXISTS contracts');

  db.pragma('foreign_keys = ON');
}
