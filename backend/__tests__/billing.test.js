import { describe, it, expect, beforeEach } from 'vitest';
import { getNextBillingDate, getUpcomingBilling } from '../src/utils/billing.js';
import { initDatabase } from '../src/database.js';

describe('Billing Date Calculation', () => {
  it('should calculate next monthly billing date', () => {
    // Fixed start date well in the past
    const next = getNextBillingDate('2025-01-10', 'monthly');
    expect(next).toBeDefined();
    // Should be on the 10th of some future month
    expect(next.endsWith('-10')).toBe(true);
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should calculate next yearly billing date', () => {
    const next = getNextBillingDate('2020-06-15', 'yearly');
    expect(next).toBeDefined();
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should calculate next quarterly billing date', () => {
    const next = getNextBillingDate('2025-01-01', 'quarterly');
    expect(next).toBeDefined();
    expect(next >= new Date().toISOString().split('T')[0]).toBe(true);
  });

  it('should return end_date for prepaid', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const endDate = futureDate.toISOString().split('T')[0];
    const next = getNextBillingDate('2024-01-01', 'prepaid', endDate);
    expect(next).toBe(endDate);
  });

  it('should return null for prepaid with past end date', () => {
    const next = getNextBillingDate('2024-01-01', 'prepaid', '2024-06-01');
    expect(next).toBeNull();
  });

  it('should return null for hourly', () => {
    const next = getNextBillingDate('2024-01-01', 'hourly');
    expect(next).toBeNull();
  });

  it('should return null for missing start date', () => {
    expect(getNextBillingDate(null, 'monthly')).toBeNull();
  });

  it('should return null for missing billing cycle', () => {
    expect(getNextBillingDate('2024-01-01', null)).toBeNull();
  });

  it('should handle future start date (not yet billed)', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const start = futureDate.toISOString().split('T')[0];
    const next = getNextBillingDate(start, 'monthly');
    expect(next).toBe(start);
  });
});

describe('Upcoming Billing API', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase(':memory:');
  });

  it('should return upcoming billing events', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    // Start date 25 days ago, monthly billing → next billing in ~5 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 25);
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)')
      .run(pid, 'srv1', 29.99, startDate.toISOString().split('T')[0], 'monthly');

    const billing = getUpcomingBilling(db, 30);
    expect(billing.length).toBeGreaterThanOrEqual(1);
    expect(billing[0].server_name).toBe('srv1');
    expect(billing[0].amount).toBe(29.99);
    expect(billing[0].days_until).toBeLessThanOrEqual(30);
  });

  it('should not include servers without start date', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, billing_cycle) VALUES (?, ?, ?, ?)')
      .run(pid, 'srv1', 29.99, 'monthly');

    const billing = getUpcomingBilling(db, 30);
    expect(billing).toHaveLength(0);
  });

  it('should sort by nearest billing date first', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;

    const close = new Date();
    close.setDate(close.getDate() - 28);
    const far = new Date();
    far.setDate(far.getDate() - 10);

    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)')
      .run(pid, 'far-server', 10, far.toISOString().split('T')[0], 'monthly');
    db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, contract_start_date, billing_cycle) VALUES (?, ?, ?, ?, ?)')
      .run(pid, 'close-server', 20, close.toISOString().split('T')[0], 'monthly');

    const billing = getUpcomingBilling(db, 30);
    if (billing.length >= 2) {
      expect(billing[0].days_until).toBeLessThanOrEqual(billing[1].days_until);
    }
  });
});
