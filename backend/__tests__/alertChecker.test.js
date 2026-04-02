import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../src/database.js';
import { checkAlerts } from '../src/jobs/alertChecker.js';

describe('Alert Checker', () => {
  let db;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('should create alert for expiring contracts', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare("INSERT INTO servers (provider_id, name) VALUES (?, ?)").run(pid, 'srv1').lastInsertRowid;

    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT INTO contracts (server_id, monthly_cost, next_cancellation_date, is_cancelled) VALUES (?, ?, ?, ?)').run(sid, 10, futureDate, 1);

    checkAlerts(db);

    const alerts = db.prepare('SELECT * FROM alerts').all();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('cancellation');
    expect(alerts[0].contract_id).toBeDefined();
    expect(alerts[0].trigger_date).toBe(futureDate);
    expect(alerts[0].days_before).toBeGreaterThan(0);
  });

  it('should create alert for ending promos', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare("INSERT INTO servers (provider_id, name) VALUES (?, ?)").run(pid, 'srv1').lastInsertRowid;

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT INTO contracts (server_id, monthly_cost, regular_cost, promo_price, promo_end_date) VALUES (?, ?, ?, ?, ?)').run(sid, 10, 20, 1, futureDate);

    checkAlerts(db);

    const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'promo_end'").all();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].trigger_date).toBe(futureDate);
  });

  it('should not duplicate alerts', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare("INSERT INTO servers (provider_id, name) VALUES (?, ?)").run(pid, 'srv1').lastInsertRowid;

    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT INTO contracts (server_id, monthly_cost, next_cancellation_date, is_cancelled) VALUES (?, ?, ?, ?)').run(sid, 10, futureDate, 1);

    checkAlerts(db);
    checkAlerts(db);

    const alerts = db.prepare('SELECT * FROM alerts').all();
    expect(alerts).toHaveLength(1);
  });
});
