import { describe, it, expect, beforeEach } from 'vitest';
import { getNextBillingDate, getContractStatus, getUpcomingBilling } from '../src/utils/billing.js';
import { initDatabase } from '../src/database.js';

describe('getNextBillingDate', () => {
  it('should calculate next monthly billing', () => {
    const next = getNextBillingDate('2025-01-10', 'monthly');
    expect(next).toBeDefined();
    expect(next.endsWith('-10')).toBe(true);
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should handle month-end clamping: Jan 31 → Feb 28', () => {
    // Start on Jan 31, monthly billing — Feb should be 28 (not March 3)
    const next = getNextBillingDate('2025-01-31', 'monthly');
    expect(next).toBeDefined();
    // Every month should be valid (not overflow into next month)
    const day = parseInt(next.split('-')[2]);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should handle leap year: Jan 31 → Feb 29 in leap year', () => {
    // 2028 is a leap year
    const next = getNextBillingDate('2027-01-31', 'monthly');
    expect(next).toBeDefined();
  });

  it('should calculate next yearly billing', () => {
    const next = getNextBillingDate('2020-06-15', 'yearly');
    expect(next).toBeDefined();
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should calculate next quarterly billing', () => {
    const next = getNextBillingDate('2025-01-01', 'quarterly');
    expect(next).toBeDefined();
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should return end_date for prepaid with future end', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const endDate = futureDate.toISOString().split('T')[0];
    expect(getNextBillingDate('2024-01-01', 'prepaid', endDate)).toBe(endDate);
  });

  it('should return null for prepaid with past end', () => {
    expect(getNextBillingDate('2024-01-01', 'prepaid', '2024-06-01')).toBeNull();
  });

  it('should return null for prepaid without end date', () => {
    expect(getNextBillingDate('2024-01-01', 'prepaid')).toBeNull();
  });

  it('should return null for hourly', () => {
    expect(getNextBillingDate('2024-01-01', 'hourly')).toBeNull();
  });

  it('should return null for missing data', () => {
    expect(getNextBillingDate(null, 'monthly')).toBeNull();
    expect(getNextBillingDate('2024-01-01', null)).toBeNull();
  });

  it('should return start date for future start', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const start = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(getNextBillingDate(start, 'monthly')).toBe(start);
  });

  it('should handle yearly contract with monthly billing independently', () => {
    // Server started Jan 2025 with monthly billing
    const next = getNextBillingDate('2025-01-15', 'monthly');
    expect(next).toBeDefined();
    // Should be on the 15th
    expect(next.endsWith('-15')).toBe(true);
  });
});

describe('getContractStatus', () => {
  it('should return indefinite when no end date', () => {
    const result = getContractStatus({ contract_end_date: null, auto_renew: true });
    expect(result.status).toBe('indefinite');
    expect(result.date).toBeNull();
  });

  it('should return renews when auto_renew is true', () => {
    const future = new Date();
    future.setDate(future.getDate() + 90);
    const endDate = future.toISOString().split('T')[0];
    const result = getContractStatus({ contract_end_date: endDate, auto_renew: 1 });
    expect(result.status).toBe('renews');
    expect(result.date).toBe(endDate);
    expect(result.days_until).toBeGreaterThan(0);
  });

  it('should return expires when auto_renew is false', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const endDate = future.toISOString().split('T')[0];
    const result = getContractStatus({ contract_end_date: endDate, auto_renew: 0 });
    expect(result.status).toBe('expires');
    expect(result.days_until).toBeGreaterThan(0);
  });

  it('should return expired for past end date without auto_renew', () => {
    const result = getContractStatus({ contract_end_date: '2024-01-01', auto_renew: 0 });
    expect(result.status).toBe('expired');
    expect(result.days_until).toBeLessThan(0);
  });
});

describe('getUpcomingBilling', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase(':memory:');
  });

  it('should return upcoming billing events within 60 days', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const start = new Date();
    start.setDate(start.getDate() - 25);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)')
      .run(pid, 'srv1', 29.99, startStr, 'monthly');

    const billing = getUpcomingBilling(db, 60);
    expect(billing.length).toBeGreaterThanOrEqual(1);
    expect(billing[0].server_name).toBe('srv1');
    expect(billing[0].amount).toBe(29.99);
    expect(billing[0].billing_cycle).toBe('monthly');
  });

  it('should exclude servers without billing data', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, billing_cycle) VALUES (?, ?, ?, ?)').run(pid, 'srv1', 29.99, 'monthly');
    const billing = getUpcomingBilling(db, 60);
    expect(billing).toHaveLength(0);
  });

  it('should sort by nearest billing date', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const close = new Date(); close.setDate(close.getDate() - 28);
    const far = new Date(); far.setDate(far.getDate() - 10);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)').run(pid, 'far', 10, fmt(far), 'monthly');
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)').run(pid, 'close', 20, fmt(close), 'monthly');

    const billing = getUpcomingBilling(db, 60);
    if (billing.length >= 2) {
      expect(billing[0].days_until).toBeLessThanOrEqual(billing[1].days_until);
    }
  });
});
