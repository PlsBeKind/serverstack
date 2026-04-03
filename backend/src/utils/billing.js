const pad = (n) => String(n).padStart(2, '0');

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function today() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function daysBetween(from, to) {
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * Advance a date by N months, clamping to last day of month.
 * Jan 31 + 1 month = Feb 28 (not Mar 3).
 */
function addMonths(date, months) {
  const originalDay = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

/**
 * Get the renewal increment in months from contract_period or billing_cycle.
 */
function getRenewalMonths(server) {
  if (server.contract_period) {
    const match = server.contract_period.match(/^(\d+)\s*month/i);
    if (match) return parseInt(match[1]);
  }
  const cycleMonths = {
    monthly: 1, quarterly: 3, 'semi-annual': 6,
    yearly: 12, biennial: 24,
  };
  return cycleMonths[server.billing_cycle] || null;
}

/**
 * Roll an end_date forward by renewal periods until it's in the future.
 * Used when auto_renew=true and end_date is past.
 */
function rollForward(endDate, renewalMonths) {
  const now = today();
  let next = parseDate(endDate);
  while (next <= now) {
    next = addMonths(next, renewalMonths);
  }
  return formatDate(next);
}

/**
 * Calculate next billing info for a server.
 *
 * Priority:
 * 1. end_date (= end of paid period) always wins
 *    - auto_renew=true + past → roll forward (auto-renewed, NOT overdue)
 *    - auto_renew=false + past → expired (renewal needed, NOT overdue)
 *    - future → next billing date
 * 2. No end_date → calculate from start_date + billing_cycle
 * 3. No dates at all → unknown
 *
 * There is NO "overdue" concept. Past end_date is either auto-renewed or expired.
 *
 * @param {object} server
 * @returns {object|null} { date, days_until, status, label }
 */
export function getNextBillingDate(server) {
  const cost = server.monthly_cost || 0;
  if (cost <= 0) return null;

  const now = today();

  // --- PREPAID ---
  if (server.billing_cycle === 'prepaid') {
    if (!server.contract_end_date) {
      return { date: null, days_until: null, status: 'prepaid_no_expiry', label: 'Prepaid — no expiry set' };
    }
    const end = parseDate(server.contract_end_date);
    const days = daysBetween(now, end);
    if (days < 0) {
      return { date: server.contract_end_date, days_until: days, status: 'expired', label: `Prepaid expired ${server.contract_end_date}` };
    }
    return { date: server.contract_end_date, days_until: days, status: days <= 7 ? 'due_soon' : 'prepaid_expiry', label: `Prepaid — renew by ${server.contract_end_date}` };
  }

  // --- END_DATE SET (= end of current paid period, always wins) ---
  if (server.contract_end_date) {
    const end = parseDate(server.contract_end_date);
    const days = daysBetween(now, end);

    if (days < 0) {
      // Past end_date
      if (server.auto_renew) {
        // Auto-renewed — roll forward to next period
        const renewalMonths = getRenewalMonths(server);
        if (renewalMonths) {
          const rolledDate = rollForward(server.contract_end_date, renewalMonths);
          const rolledDays = daysBetween(now, parseDate(rolledDate));
          return { date: rolledDate, days_until: rolledDays, status: rolledDays <= 7 ? 'due_soon' : 'upcoming', label: `Auto-renewed — next billing ${rolledDate}` };
        }
        return { date: null, days_until: null, status: 'unknown_date', label: 'Auto-renews — period unknown' };
      }
      // Not auto-renew + past = expired (not overdue)
      return { date: server.contract_end_date, days_until: days, status: 'expired', label: `Expired ${server.contract_end_date} — renewal needed` };
    }

    // Future end_date = next billing
    return { date: server.contract_end_date, days_until: days, status: days <= 7 ? 'due_soon' : 'upcoming', label: `Due on ${server.contract_end_date}` };
  }

  // --- NO END_DATE: calculate from start_date + billing_cycle ---
  if (server.contract_start_date && server.billing_cycle) {
    const cycleMonths = {
      monthly: 1, quarterly: 3, 'semi-annual': 6,
      yearly: 12, biennial: 24,
    };
    const months = cycleMonths[server.billing_cycle];

    if (months) {
      const start = parseDate(server.contract_start_date);
      let next = new Date(start);
      while (next <= now) {
        next = addMonths(next, months);
      }
      const nextStr = formatDate(next);
      const days = daysBetween(now, next);
      return { date: nextStr, days_until: days, status: days <= 7 ? 'due_soon' : 'upcoming', label: `Due on ${nextStr}` };
    }
  }

  // --- HAS COST BUT NO DATE INFO ---
  return { date: null, days_until: null, status: 'unknown_date', label: 'Billing date unknown' };
}

/**
 * Contract status — separate from billing.
 */
export function getContractStatus(server) {
  if (!server.contract_end_date) {
    return { status: 'indefinite', date: null, label: 'Indefinite' };
  }

  const days = daysBetween(today(), parseDate(server.contract_end_date));

  if (server.auto_renew) {
    return { status: 'renews', date: server.contract_end_date, days_until: days, label: `Auto-renews on ${server.contract_end_date}` };
  }

  if (days < 0) {
    return { status: 'expired', date: server.contract_end_date, days_until: days, label: `Expired ${server.contract_end_date} — renewal needed` };
  }

  return { status: 'expires', date: server.contract_end_date, days_until: days, label: `Expires on ${server.contract_end_date} — renewal needed` };
}

/**
 * Get ALL servers with monthly_cost > 0, with billing info.
 * Sorted: expired first, then soonest, then unknown last.
 */
export function getUpcomingBilling(db) {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.monthly_cost, s.contract_start_date, s.billing_cycle,
           s.contract_end_date, s.contract_period, s.auto_renew, s.is_cancelled,
           p.name as provider_name
    FROM servers s
    LEFT JOIN providers p ON s.provider_id = p.id
    WHERE s.monthly_cost > 0
  `).all();

  const results = [];

  for (const server of servers) {
    const billing = getNextBillingDate(server);
    if (!billing) continue;

    results.push({
      server_id: server.id,
      server_name: server.name,
      provider_name: server.provider_name,
      amount: server.monthly_cost,
      billing_date: billing.date,
      billing_cycle: server.billing_cycle,
      days_until: billing.days_until,
      status: billing.status,
      label: billing.label,
    });
  }

  // Sort: expired first (negative days), then soonest, then unknown (null) last
  results.sort((a, b) => {
    if (a.days_until === null && b.days_until === null) return 0;
    if (a.days_until === null) return 1;
    if (b.days_until === null) return -1;
    return a.days_until - b.days_until;
  });

  return results;
}
