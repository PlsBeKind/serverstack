/**
 * Checks for expiring contracts and promo endings, creates alerts.
 * @param {import('better-sqlite3').Database} db
 */
export function checkAlerts(db) {
  // Only alert on cancelled contracts (won't auto-renew, will actually expire)
  const expiringContracts = db.prepare(`
    SELECT c.*, s.name as server_name
    FROM contracts c
    LEFT JOIN servers s ON c.server_id = s.id
    WHERE c.is_cancelled = 1
      AND c.next_cancellation_date IS NOT NULL
      AND date(c.next_cancellation_date) <= date('now', '+30 days')
      AND date(c.next_cancellation_date) >= date('now')
  `).all();

  for (const contract of expiringContracts) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE contract_id = ? AND type = 'cancellation' AND sent = 0
    `).get(contract.id);

    if (!existing) {
      const daysLeft = Math.ceil((new Date(contract.next_cancellation_date) - new Date()) / (1000 * 60 * 60 * 24));
      db.prepare(`
        INSERT INTO alerts (contract_id, type, trigger_date, days_before, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        contract.id, 'cancellation', contract.next_cancellation_date, daysLeft,
        `Cancellation deadline for ${contract.server_name || 'unknown server'} in ${daysLeft} days (${contract.next_cancellation_date})`
      );
    }
  }

  // Promo prices ending within 14 days
  const expiringPromos = db.prepare(`
    SELECT c.*, s.name as server_name
    FROM contracts c
    LEFT JOIN servers s ON c.server_id = s.id
    WHERE c.promo_price = 1
      AND c.promo_end_date IS NOT NULL
      AND date(c.promo_end_date) <= date('now', '+14 days')
      AND date(c.promo_end_date) >= date('now')
  `).all();

  for (const contract of expiringPromos) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE contract_id = ? AND type = 'promo_end' AND sent = 0
    `).get(contract.id);

    if (!existing) {
      const increase = contract.regular_cost
        ? ` Price increases from ${contract.monthly_cost} to ${contract.regular_cost}.`
        : '';
      db.prepare(`
        INSERT INTO alerts (contract_id, type, trigger_date, days_before, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        contract.id, 'promo_end', contract.promo_end_date,
        Math.ceil((new Date(contract.promo_end_date) - new Date()) / (1000 * 60 * 60 * 24)),
        `Promo price for ${contract.server_name || 'unknown server'} ends ${contract.promo_end_date}.${increase}`
      );
    }
  }
}
