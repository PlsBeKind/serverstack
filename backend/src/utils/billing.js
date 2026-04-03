/**
 * Calculate the next billing date for a server based on start date and billing cycle.
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} billingCycle - monthly | quarterly | semi-annual | yearly | hourly | biennial | prepaid
 * @param {string} [endDate] - for prepaid contracts, billing happens at end date
 * @returns {string|null} next billing date as YYYY-MM-DD, or null if can't determine
 */
export function getNextBillingDate(startDate, billingCycle, endDate) {
  if (!startDate || !billingCycle) return null;

  if (billingCycle === 'prepaid') {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    return end >= now ? endDate : null;
  }

  if (billingCycle === 'hourly') return null;

  const monthsPerCycle = {
    monthly: 1,
    quarterly: 3,
    'semi-annual': 6,
    yearly: 12,
    biennial: 24,
  };

  const months = monthsPerCycle[billingCycle];
  if (!months) return null;

  // Parse as local date to avoid timezone shifts
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Find the next billing date by advancing from start by cycle increments
  let next = new Date(start);
  while (next <= now) {
    next.setMonth(next.getMonth() + months);
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/**
 * Get all servers with their next billing date within a given number of days.
 * @param {import('better-sqlite3').Database} db
 * @param {number} [days=30]
 * @returns {Array} servers with nextBillingDate and billing amount
 */
export function getUpcomingBilling(db, days = 30) {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.monthly_cost, s.contract_start_date, s.billing_cycle,
           s.contract_end_date, p.name as provider_name
    FROM servers s
    LEFT JOIN providers p ON s.provider_id = p.id
    WHERE s.monthly_cost > 0 AND s.contract_start_date IS NOT NULL
  `).all();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  const results = [];

  for (const server of servers) {
    const nextDate = getNextBillingDate(server.contract_start_date, server.billing_cycle, server.contract_end_date);
    if (!nextDate) continue;

    const next = new Date(nextDate);
    if (next >= now && next <= cutoff) {
      const daysUntil = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
      results.push({
        server_id: server.id,
        server_name: server.name,
        provider_name: server.provider_name,
        amount: server.monthly_cost,
        billing_date: nextDate,
        days_until: daysUntil,
      });
    }
  }

  results.sort((a, b) => a.days_until - b.days_until);
  return results;
}
