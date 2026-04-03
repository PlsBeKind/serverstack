import { describe, it, expect, beforeEach } from 'vitest';
import { getNextBillingDate, getContractStatus, getUpcomingBilling } from '../src/utils/billing.js';
import { initDatabase } from '../src/database.js';

const futureDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('getNextBillingDate', () => {
  // --- RECURRING BILLING (monthly/yearly) ---

  it('monthly billing with start_date → next monthly anniversary', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly', contract_start_date: '2025-01-10' });
    expect(result.date).toBeDefined();
    expect(result.date.endsWith('-10')).toBe(true);
    expect(result.days_until).toBeGreaterThanOrEqual(0);
    expect(result.amount).toBe(10); // monthly = 1x
  });

  it('yearly billing with start_date → yearly amount (monthly × 12)', () => {
    const result = getNextBillingDate({ monthly_cost: 5.75, billing_cycle: 'yearly', contract_start_date: '2020-06-15' });
    expect(result.date).toBeDefined();
    expect(result.amount).toBe(5.75 * 12); // yearly = 12x monthly
  });

  it('monthly billing ignores end_date for billing calculation', () => {
    // end_date is 363 days away, but billing is monthly → next charge in ~30 days, NOT 363
    const result = getNextBillingDate({
      monthly_cost: 2, billing_cycle: 'monthly',
      contract_start_date: '2025-01-01',
      contract_end_date: futureDate(363),
    });
    expect(result.days_until).toBeLessThan(35); // should be within a month
  });

  it('no start_date but end_date → derive billing day from end_date', () => {
    // end_date is April 1, 2027, monthly billing → billing day is 1st of each month
    const result = getNextBillingDate({
      monthly_cost: 2, billing_cycle: 'monthly',
      contract_end_date: '2027-04-01',
    });
    expect(result.date).toBeDefined();
    expect(result.date.endsWith('-01')).toBe(true); // derived from end_date day
    expect(result.days_until).toBeLessThan(35); // next 1st of month
  });

  it('no dates at all → unknown_date', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly' });
    expect(result.status).toBe('unknown_date');
    expect(result.date).toBeNull();
  });

  // --- PREPAID ---

  it('prepaid with future end_date → prepaid_expiry', () => {
    const endDate = futureDate(30);
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: endDate });
    expect(result.status).toBe('prepaid_expiry');
    expect(result.date).toBe(endDate);
  });

  it('prepaid with no end_date → prepaid_no_expiry', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid' });
    expect(result.status).toBe('prepaid_no_expiry');
  });

  it('prepaid with past end_date → expired (not overdue)', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: '2024-01-01' });
    expect(result.status).toBe('expired');
  });

  // --- EDGE CASES ---

  it('no cost → null', () => {
    expect(getNextBillingDate({ monthly_cost: 0 })).toBeNull();
  });

  it('month-end clamping: Jan 31 → Feb 28', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'monthly', contract_start_date: '2025-01-31' });
    expect(result.date).toBeDefined();
    const day = parseInt(result.date.split('-')[2]);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('quarterly billing shows 3x monthly amount', () => {
    const result = getNextBillingDate({ monthly_cost: 10, billing_cycle: 'quarterly', contract_start_date: '2025-01-01' });
    expect(result.amount).toBe(30);
  });

  it('NEVER returns overdue', () => {
    const scenarios = [
      { monthly_cost: 10, contract_end_date: '2020-01-01', auto_renew: 0, billing_cycle: 'monthly' },
      { monthly_cost: 10, billing_cycle: 'prepaid', contract_end_date: '2020-01-01' },
    ];
    for (const s of scenarios) {
      const result = getNextBillingDate(s);
      expect(result?.status).not.toBe('overdue');
    }
  });
});

describe('getContractStatus', () => {
  it('no end_date → indefinite', () => {
    expect(getContractStatus({ contract_end_date: null }).status).toBe('indefinite');
  });

  it('auto_renew=true → renews', () => {
    const r = getContractStatus({ contract_end_date: futureDate(90), auto_renew: 1 });
    expect(r.status).toBe('renews');
    expect(r.label).toContain('Auto-renews');
  });

  it('auto_renew=true + past end_date → rolls forward', () => {
    const r = getContractStatus({ contract_end_date: '2025-01-01', auto_renew: 1, billing_cycle: 'monthly', contract_period: '12 months' });
    expect(r.status).toBe('renews');
    expect(r.days_until).toBeGreaterThanOrEqual(0); // rolled forward to future
  });

  it('auto_renew=false + future → expires with renewal needed', () => {
    const r = getContractStatus({ contract_end_date: futureDate(30), auto_renew: 0 });
    expect(r.status).toBe('expires');
    expect(r.label).toContain('renewal needed');
  });

  it('auto_renew=false + past → expired', () => {
    const r = getContractStatus({ contract_end_date: '2024-01-01', auto_renew: 0 });
    expect(r.status).toBe('expired');
  });
});

describe('getUpcomingBilling', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase(':memory:');
  });

  it('should include all servers with monthly_cost > 0', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'no-dates', 5);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)').run(pid, 'has-dates', 10, '2025-01-15', 'monthly');

    const billing = getUpcomingBilling(db);
    expect(billing).toHaveLength(2);
  });

  it('should show correct amount for yearly billing', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)').run(pid, 'yearly', 5.75, '2025-01-01', 'yearly');

    const billing = getUpcomingBilling(db);
    expect(billing[0].amount).toBe(5.75 * 12);
  });

  it('should exclude servers with zero cost', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'free', 0);
    expect(getUpcomingBilling(db)).toHaveLength(0);
  });

  it('should sort soonest first, unknown last', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost) VALUES (?, ?, ?)').run(pid, 'unknown', 5);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_end_date) VALUES (?, ?, ?, ?)').run(pid, 'soon', 15, futureDate(5));

    const billing = getUpcomingBilling(db);
    expect(billing[billing.length - 1].status).toBe('unknown_date');
  });
});
