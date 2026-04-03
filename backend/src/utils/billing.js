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
 * Get the cycle increment in months from billing_cycle.
 */
function getCycleMonths(billingCycle) {
  const map = {
    monthly: 1, quarterly: 3, 'semi-annual': 6,
    yearly: 12, biennial: 24,
  };
  return map[billingCycle] || null;
}

/**
 * Get renewal months from contract_period or billing_cycle.
 */
function getRenewalMonths(server) {
  if (server.contract_period) {
    const match = server.contract_period.match(/^(\d+)\s*month/i);
    if (match) return parseInt(match[1]);
  }
  return getCycleMonths(server.billing_cycle);
}

/**
 * Calculate the next recurring billing date from a reference date + cycle.
 * Advances from reference by cycle months until in the future.
 */
function nextRecurringDate(referenceDate, cycleMonths) {
  const now = today();
  const ref = parseDate(referenceDate);
  let next = new Date(ref);
  while (next <= now) {
    next = addMonths(next, cycleMonths);
  }
  return next;
}

/**
 * Calculate the billing amount for one billing cycle.
 * monthly_cost is always per month. For yearly billing, charge = monthly × 12.
 */
function getBillingAmount(monthlyCost, billingCycle) {
  const multiplier = getCycleMonths(billingCycle) || 1;
  return monthlyCost * multiplier;
}

/**
 * Calculate next billing info for a server.
 *
 * KEY RULES:
 * - For RECURRING billing (monthly/quarterly/yearly etc.):
 *   billing date = next anniversary of start_date (or derived from end_date day)
 *   end_date is ONLY about contract duration, NOT billing timing
 * - For PREPAID: end_date IS the renewal date
 * - end_date only overrides billing for prepaid
 * - No "overdue" concept ever
 *
 * @param {object} server
 * @returns {object|null}
 */
export function getNextBillingDate(server) {
  const cost = server.monthly_cost || 0;
  if (cost <= 0) return null;

  // Cancelled servers: still billed until end_date, then done
  if (server.is_cancelled) {
    const endDate = server.contract_end_date || server.next_cancellation_date;
    if (endDate) {
      const endDays = daysBetween(today(), parseDate(endDate));
      if (endDays < 0) {
        // Contract ended — no more billing
        return { date: endDate, days_until: endDays, status: 'cancelled', label: `Cancelled — ended ${endDate}`, amount: 0 };
      }
    }
    if (!endDate) {
      return { date: null, days_until: null, status: 'cancelled', label: 'Cancelled', amount: 0 };
    }
    // Cancelled but end_date still in future — check if there's actually a billing
    // cycle that falls BEFORE the end_date. If next billing >= end_date, no more charges.
    // Fall through to normal billing calculation, then check against end_date.
  }

  const now = today();
  const cycleMonths = getCycleMonths(server.billing_cycle);

  // --- PREPAID ---
  if (server.billing_cycle === 'prepaid') {
    if (!server.contract_end_date) {
      return { date: null, days_until: null, status: 'prepaid_no_expiry', label: 'Prepaid — no expiry set', amount: cost };
    }
    const end = parseDate(server.contract_end_date);
    const days = daysBetween(now, end);
    if (days < 0) {
      return { date: server.contract_end_date, days_until: days, status: 'expired', label: `Prepaid expired ${server.contract_end_date}`, amount: cost };
    }
    return { date: server.contract_end_date, days_until: days, status: days <= 7 ? 'due_soon' : 'prepaid_expiry', label: `Prepaid — renew by ${server.contract_end_date}`, amount: cost };
  }

  // --- RECURRING BILLING ---
  const amount = getBillingAmount(cost, server.billing_cycle);

  // Priority 1: Use start_date to calculate next billing anniversary
  if (server.contract_start_date && cycleMonths) {
    const next = nextRecurringDate(server.contract_start_date, cycleMonths);
    const nextStr = formatDate(next);
    const days = daysBetween(now, next);
    return markCancelled(server, { date: nextStr, days_until: days, status: days <= 7 ? 'due_soon' : 'upcoming', label: `Due on ${nextStr}`, amount });
  }

  // Priority 2: No start_date but end_date exists → derive billing day from end_date
  // Extract day-of-month from end_date, find next occurrence of that day in the cycle
  if (server.contract_end_date && cycleMonths) {
    const endParsed = parseDate(server.contract_end_date);
    const billingDay = endParsed.getDate();

    // Start from a reference point far enough in the past, then advance
    // Use end_date minus a large multiple of cycles to establish a base
    let ref = new Date(endParsed);
    while (ref > now) {
      ref = addMonths(ref, -cycleMonths);
    }
    // Now advance forward from this past reference
    let next = new Date(ref);
    while (next <= now) {
      next = addMonths(next, cycleMonths);
    }
    const nextStr = formatDate(next);
    const days = daysBetween(now, next);
    return markCancelled(server, { date: nextStr, days_until: days, status: days <= 7 ? 'due_soon' : 'upcoming', label: `Due on ${nextStr}`, amount });
  }

  // --- NO DATE INFO ---
  return markCancelled(server, { date: null, days_until: null, status: 'unknown_date', label: 'Billing date unknown', amount });
}

function markCancelled(server, result) {
  if (!server.is_cancelled) return result;
  if (result.status === 'cancelled') return result;

  // If cancelled and next billing date >= end_date, no more charges
  const endDate = server.contract_end_date || server.next_cancellation_date;
  if (endDate && result.date && result.date >= endDate) {
    const endDays = daysBetween(today(), parseDate(endDate));
    return { date: endDate, days_until: endDays, status: 'cancelled', label: `Cancelled — ends ${endDate}`, amount: 0 };
  }

  result.is_cancelled = true;
  return result;
}

/**
 * Contract status — separate from billing.
 * end_date = when the contract itself ends/renews.
 */
export function getContractStatus(server) {
  if (!server.contract_end_date) {
    return { status: 'indefinite', date: null, label: 'Indefinite' };
  }

  const end = parseDate(server.contract_end_date);
  const now = today();
  const days = daysBetween(now, end);

  if (server.auto_renew) {
    // Auto-renew + past → roll forward
    if (days < 0) {
      const renewalMonths = getRenewalMonths(server);
      if (renewalMonths) {
        let next = new Date(end);
        while (next <= now) next = addMonths(next, renewalMonths);
        const rolledDate = formatDate(next);
        const rolledDays = daysBetween(now, next);
        return { status: 'renews', date: rolledDate, days_until: rolledDays, label: `Auto-renews on ${rolledDate}` };
      }
    }
    return { status: 'renews', date: server.contract_end_date, days_until: days, label: `Auto-renews on ${server.contract_end_date}` };
  }

  if (days < 0) {
    return { status: 'expired', date: server.contract_end_date, days_until: days, label: `Expired ${server.contract_end_date} — renewal needed` };
  }

  return { status: 'expires', date: server.contract_end_date, days_until: days, label: `Expires on ${server.contract_end_date} — renewal needed` };
}

/**
 * Get ALL servers with monthly_cost > 0, with billing info.
 * Sorted: soonest first, then unknown last.
 */
export function getUpcomingBilling(db) {
  const servers = db.prepare(`
    SELECT s.id, s.name, s.monthly_cost, s.contract_start_date, s.billing_cycle,
           s.contract_end_date, s.contract_period, s.auto_renew, s.is_cancelled,
           s.next_cancellation_date, s.pending_cost, s.pending_cost_date,
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
      amount: billing.amount,
      billing_date: billing.date,
      billing_cycle: server.billing_cycle,
      days_until: billing.days_until,
      status: billing.status,
      label: billing.label,
      is_cancelled: billing.is_cancelled || billing.status === 'cancelled',
    });

    // Add pending price change as a separate event
    if (server.pending_cost && server.pending_cost_date) {
      const pendingDays = daysBetween(today(), parseDate(server.pending_cost_date));
      if (pendingDays >= 0) {
        results.push({
          server_id: server.id,
          server_name: server.name,
          provider_name: server.provider_name,
          amount: server.pending_cost,
          billing_date: server.pending_cost_date,
          billing_cycle: server.billing_cycle,
          days_until: pendingDays,
          status: 'price_change',
          label: `Price change: ${server.monthly_cost} → ${server.pending_cost}`,
          old_cost: server.monthly_cost,
        });
      }
    }
  }

  results.sort((a, b) => {
    if (a.days_until === null && b.days_until === null) return 0;
    if (a.days_until === null) return 1;
    if (b.days_until === null) return -1;
    return a.days_until - b.days_until;
  });

  return results;
}
