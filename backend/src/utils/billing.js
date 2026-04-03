const pad = (n) => String(n).padStart(2, '0');

/**
 * Format a local Date as YYYY-MM-DD.
 */
function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Advance a date by N months, clamping to last day of month.
 * Handles edge cases: Jan 31 + 1 month = Feb 28 (not Mar 3).
 */
function addMonths(date, months) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(targetMonth);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

/**
 * Calculate the next billing date for a server.
 * Billing date = when money leaves your account, independent of contract end.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} billingCycle - monthly|quarterly|semi-annual|yearly|biennial|prepaid|hourly
 * @param {string} [endDate] - for prepaid, the end date
 * @returns {string|null} YYYY-MM-DD or null
 */
export function getNextBillingDate(startDate, billingCycle, endDate) {
  if (!startDate || !billingCycle) return null;
  if (billingCycle === 'hourly') return null;

  if (billingCycle === 'prepaid') {
    if (!endDate) return null;
    const [ey, em, ed] = endDate.split('-').map(Number);
    const end = new Date(ey, em - 1, ed);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return end >= now ? endDate : null;
  }

  const monthsPerCycle = {
    monthly: 1,
    quarterly: 3,
    'semi-annual': 6,
    yearly: 12,
    biennial: 24,
  };

  const months = monthsPerCycle[billingCycle];
  if (!months) return null;

  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);

  let next = new Date(start);
  while (next <= now) {
    next = addMonths(next, months);
  }

  return formatDate(next);
}

/**
 * Get the contract status for a server (independent of billing).
 *
 * @param {object} server - must have contract_end_date, auto_renew
 * @returns {{ status: string, date: string|null, label: string }}
 */
export function getContractStatus(server) {
  if (!server.contract_end_date) {
    return { status: 'indefinite', date: null, label: 'Indefinite' };
  }

  const [y, m, d] = server.contract_end_date.split('-').map(Number);
  const endDate = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (server.auto_renew) {
    return {
      status: 'renews',
      date: server.contract_end_date,
      days_until: daysUntil,
      label: `Renews on ${server.contract_end_date}`,
    };
  }

  return {
    status: daysUntil < 0 ? 'expired' : 'expires',
    date: server.contract_end_date,
    days_until: daysUntil,
    label: daysUntil < 0 ? `Expired ${server.contract_end_date}` : `Expires on ${server.contract_end_date}`,
  };
}

/**
 * Get all servers with their next billing date within a given number of days.
 * @param {import('better-sqlite3').Database} db
 * @param {number} [days=60]
 * @returns {Array}
 */
export function getUpcomingBilling(db, days = 60) {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.monthly_cost, s.contract_start_date, s.billing_cycle,
           s.contract_end_date, s.auto_renew, p.name as provider_name
    FROM servers s
    LEFT JOIN providers p ON s.provider_id = p.id
    WHERE s.monthly_cost > 0 AND s.contract_start_date IS NOT NULL
  `).all();

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + days);

  const results = [];

  for (const server of servers) {
    const nextDate = getNextBillingDate(server.contract_start_date, server.billing_cycle, server.contract_end_date);
    if (!nextDate) continue;

    const [ny, nm, nd] = nextDate.split('-').map(Number);
    const next = new Date(ny, nm - 1, nd);
    if (next >= now && next <= cutoff) {
      const daysUntil = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
      results.push({
        server_id: server.id,
        server_name: server.name,
        provider_name: server.provider_name,
        amount: server.monthly_cost,
        billing_date: nextDate,
        billing_cycle: server.billing_cycle,
        days_until: daysUntil,
      });
    }
  }

  results.sort((a, b) => a.days_until - b.days_until);
  return results;
}
