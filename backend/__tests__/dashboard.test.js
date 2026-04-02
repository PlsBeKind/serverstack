import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Dashboard Routes', () => {
  let app, db, token;

  beforeEach(async () => {
    ({ app, db } = createTestApp());
    token = await getAuthToken(request, app);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should return summary', async () => {
    const providerId = seedProvider(db);
    seedServer(db, providerId);

    const res = await request(app).get('/api/v1/dashboard/summary').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.servers.total).toBe(1);
    expect(res.body.servers.active).toBe(1);
    expect(res.body.providers).toBe(1);
  });

  it('should return costs with provider breakdown', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId);
    db.prepare('INSERT INTO contracts (server_id, monthly_cost) VALUES (?, ?)').run(serverId, 29.99);

    const res = await request(app).get('/api/v1/dashboard/costs').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total_monthly).toBe(29.99);
    expect(res.body.total_yearly).toBeCloseTo(359.88);
    expect(res.body.by_provider).toHaveLength(1);
    expect(res.body.by_provider[0].name).toBe('Hetzner');
  });

  it('should calculate promo savings', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId);
    db.prepare('INSERT INTO contracts (server_id, monthly_cost, regular_cost, promo_price) VALUES (?, ?, ?, ?)').run(serverId, 19.99, 29.99, 1);

    const res = await request(app).get('/api/v1/dashboard/costs').set(auth());
    expect(res.body.promo_savings).toBe(10);
  });

  it('should return alerts', async () => {
    db.prepare("INSERT INTO alerts (type, message) VALUES (?, ?)").run('cancellation', 'Test alert');

    const res = await request(app).get('/api/v1/dashboard/alerts').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('should mark alert as read', async () => {
    db.prepare("INSERT INTO alerts (type, message) VALUES (?, ?)").run('cancellation', 'Test alert');

    await request(app).put('/api/v1/dashboard/alerts/1/read').set(auth());
    const alert = db.prepare('SELECT sent FROM alerts WHERE id = 1').get();
    expect(alert.sent).toBe(1);
  });

  it('should mark all alerts as read', async () => {
    db.prepare("INSERT INTO alerts (type, message) VALUES (?, ?)").run('cancellation', 'Alert 1');
    db.prepare("INSERT INTO alerts (type, message) VALUES (?, ?)").run('expiry', 'Alert 2');

    await request(app).put('/api/v1/dashboard/alerts/read-all').set(auth());
    const unsent = db.prepare('SELECT COUNT(*) as c FROM alerts WHERE sent = 0').get().c;
    expect(unsent).toBe(0);
  });

  it('should return resources with cores, RAM, storage', async () => {
    const providerId = seedProvider(db);
    seedServer(db, providerId);

    const res = await request(app).get('/api/v1/dashboard/resources').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total_ram_mb).toBe(16384);
    expect(res.body.total_storage_gb).toBe(100);
    expect(res.body.total_cores).toBeDefined();
  });
});
