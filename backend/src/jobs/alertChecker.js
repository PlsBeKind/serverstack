/**
 * Checks for expiring server contracts and promo endings, creates alerts.
 * @param {import('better-sqlite3').Database} db
 */
export function checkAlerts(db) {
  // Clean up duplicate alerts (from before dedup fix)
  db.exec(`
    DELETE FROM alerts WHERE id NOT IN (
      SELECT MIN(id) FROM alerts GROUP BY server_id, type, trigger_date
    )
  `);

  // Only alert on cancelled contracts (won't auto-renew, will actually expire)
  const expiringServers = db.prepare(`
    SELECT id, name, next_cancellation_date
    FROM servers
    WHERE is_cancelled = 1
      AND next_cancellation_date IS NOT NULL
      AND date(next_cancellation_date) <= date('now', '+30 days')
      AND date(next_cancellation_date) >= date('now')
  `).all();

  for (const server of expiringServers) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE server_id = ? AND type = 'cancellation' AND trigger_date = ?
    `).get(server.id, server.next_cancellation_date);

    if (!existing) {
      const daysLeft = Math.ceil((new Date(server.next_cancellation_date) - new Date()) / (1000 * 60 * 60 * 24));
      db.prepare(`
        INSERT INTO alerts (server_id, type, trigger_date, days_before, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        server.id, 'cancellation', server.next_cancellation_date, daysLeft,
        `Cancellation deadline for ${server.name} in ${daysLeft} days (${server.next_cancellation_date})`
      );
    }
  }

  // Promo prices ending within 14 days
  const expiringPromos = db.prepare(`
    SELECT id, name, monthly_cost, regular_cost, promo_end_date
    FROM servers
    WHERE promo_price = 1
      AND promo_end_date IS NOT NULL
      AND date(promo_end_date) <= date('now', '+14 days')
      AND date(promo_end_date) >= date('now')
  `).all();

  for (const server of expiringPromos) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE server_id = ? AND type = 'promo_end' AND trigger_date = ?
    `).get(server.id, server.promo_end_date);

    if (!existing) {
      const increase = server.regular_cost
        ? ` Price increases from ${server.monthly_cost} to ${server.regular_cost}.`
        : '';
      db.prepare(`
        INSERT INTO alerts (server_id, type, trigger_date, days_before, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        server.id, 'promo_end', server.promo_end_date,
        Math.ceil((new Date(server.promo_end_date) - new Date()) / (1000 * 60 * 60 * 24)),
        `Promo price for ${server.name} ends ${server.promo_end_date}.${increase}`
      );
    }
  }
}
