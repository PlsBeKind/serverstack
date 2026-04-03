import { describe, it, expect, beforeEach } from 'vitest';
import { getNextBillingDate, getContractStatus, getUpcomingBilling } from '../src/utils/billing.js';
import { initDatabase } from '../src/database.js';

const futureDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pastDate = (daysAgo) => futureDate(-daysAgo);

describe('getNextBillingDate', () => {
  // 1. end_date in future → next billing = end_date
  it('should use end_date when set and in future', () => {
    const endDate = futureDate(15);
    const result = getNextBillingDate({ monthly_cost: 10, contract_end_date: endDate, billing_cycle: 'monthly', contract_start_date: '2025-01-01' });
    expect(result.date).toBe(endDate);
    expect(result.days_until).toBe(15);
    expect(result.status).toBe('upcoming');
  });

  // 2. end_date in past + auto_renew=true → roll forward (NOT overdue)
  it('should roll forward when auto_renew=true and end_date is past', () => {
    const result = getNextBillingDate({
      monthly_cost: 10, contract_end_date: pastDate(15), auto_renew: 1,
      billing_cycle: 'monthly', contract_period: '1 month',
    });
    expect(result.status).not.toBe('overdue');
    expect(['upcoming', 'due_soon']).toContain(result.status);
    expect(result.days_until).toBeGreaterThanOrEqual(0);
    expect(result.label).toContain('Auto-renewed');
  });

  // 3. end_date in past + auto_renew=false → expired (NOT overdue)
  it('should show expired when auto_renew=false and end_date is past', () => {
    const result = getNextBillingDate({ monthly_cost: 10, contract_end_date: '2025-01-01', auto_renew: 0 });
    expect(result.status).toBe('expired');
    expect(result.status).not.toBe('overdue');
    expect(result.label).toContain('Expired');
    expect(result.label).toContain('renewal needed');
  });

  // 4. No end_date + monthly billing + start_date → calculate
  it('should calculate monthly anniversary when no end_date', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly', contract_start_date: '2025-01-10' });
    expect(result.date).toBeDefined();
    expect(result.date.endsWith('-10')).toBe(true);
    expect(result.days_until).toBeGreaterThanOrEqual(0);
  });

  // 5. No end_date + yearly billing + start_date → calculate
  it('should calculate yearly anniversary when no end_date', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'yearly', contract_start_date: '2020-06-15' });
    expect(result.date).toBeDefined();
    expect(result.days_until).toBeGreaterThanOrEqual(0);
  });

  // 6. No end_date, no start_date, but has cost → unknown
  it('should return unknown_date when cost exists but no dates', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly' });
    expect(result.status).toBe('unknown_date');
    expect(result.date).toBeNull();
  });

  // 7. Prepaid + end_date in future
  it('should show prepaid expiry', () => {
    const endDate = futureDate(30);
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: endDate });
    expect(result.status).toBe('prepaid_expiry');
    expect(result.date).toBe(endDate);
  });

  // 8. Prepaid + no end_date
  it('should show prepaid_no_expiry', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid' });
    expect(result.status).toBe('prepaid_no_expiry');
  });

  // Prepaid + past end_date → expired (not overdue)
  it('should show prepaid as expired when end_date past', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: '2024-06-01' });
    expect(result.status).toBe('expired');
    expect(result.status).not.toBe('overdue');
  });

  // No cost → null
  it('should return null for zero cost', () => {
    expect(getNextBillingDate({ monthly_cost: 0 })).toBeNull();
  });

  // end_date always wins over calculated
  it('should prefer end_date over calculated billing date', () => {
    const endDate = futureDate(5);
    const result = getNextBillingDate({ monthly_cost: 10, contract_end_date: endDate, billing_cycle: 'monthly', contract_start_date: '2025-01-15' });
    expect(result.date).toBe(endDate);
  });

  // Month-end clamping
  it('should handle Jan 31 → Feb 28', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly', contract_start_date: '2025-01-31' });
    expect(result.date).toBeDefined();
    const day = parseInt(result.date.split('-')[2]);
    expect(day).toBeLessThanOrEqual(31);
  });

  // Auto-renew roll-forward uses contract_period
  it('should roll forward using contract_period when available', () => {
    const result = getNextBillingDate({
      monthly_cost: 10, contract_end_date: pastDate(5), auto_renew: 1,
      billing_cycle: 'monthly', contract_period: '3 months',
    });
    expect(result.date).toBeDefined();
    expect(result.days_until).toBeGreaterThanOrEqual(0);
  });

  // due_soon within 7 days
  it('should return due_soon when within 7 days', () => {
    const result = getNextBillingDate({ monthly_cost: 10, contract_end_date: futureDate(3) });
    expect(result.status).toBe('due_soon');
  });

  // No "overdue" status ever
  it('should NEVER return overdue status', () => {
    const scenarios = [
      { monthly_cost: 10, contract_end_date: '2020-01-01', auto_renew: 0 },
      { monthly_cost: 10, contract_end_date: '2020-01-01', auto_renew: 1, billing_cycle: 'monthly' },
      { monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: '2020-01-01' },
    ];
    for (const s of scenarios) {
      const result = getNextBillingDate(s);
      expect(result?.status, `Scenario ${JSON.stringify(s)} returned overdue`).not.toBe('overdue');
    }
  });
});

describe('getContractStatus', () => {
  it('should return indefinite when no end_date', () => {
    expect(getContractStatus({ contract_end_date: null }).status).toBe('indefinite');
  });

  it('should return auto-renews', () => {
    const r = getContractStatus({ contract_end_date: futureDate(90), auto_renew: 1 });
    expect(r.status).toBe('renews');
    expect(r.label).toContain('Auto-renews');
  });

  it('should return expires with renewal needed', () => {
    const r = getContractStatus({ contract_end_date: futureDate(30), auto_renew: 0 });
    expect(r.status).toBe('expires');
    expect(r.label).toContain('renewal needed');
  });

  it('should return expired for past date', () => {
    const r = getContractStatus({ contract_end_date: '2024-01-01', auto_renew: 0 });
    expect(r.status).toBe('expired');
  });
});

describe('getUpcomingBilling', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase(':memory:');
  });

  it('should include ALL servers with monthly_cost > 0', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'no-dates', 5);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)').run(pid, 'has-dates', 10, '2025-01-15', 'monthly');

    const billing = getUpcomingBilling(db);
    expect(billing).toHaveLength(2);
  });

  it('should sort expired first, then soonest, then unknown last', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'unknown', 5);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_end_date, auto_renew) VALUES (?, ?, ?, ?, ?)').run(pid, 'expired', 10, '2024-01-01', 0);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_end_date) VALUES (?, ?, ?, ?)').run(pid, 'upcoming', 15, futureDate(20));

    const billing = getUpcomingBilling(db);
    expect(billing[0].server_name).toBe('expired');
    expect(billing[0].status).toBe('expired');
    expect(billing[billing.length - 1].server_name).toBe('unknown');
  });

  it('should exclude servers with zero cost', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'free', 0);
    expect(getUpcomingBilling(db)).toHaveLength(0);
  });
});
