import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';
import { checkAlerts } from '../src/jobs/alertChecker.js';

describe('Scheduled Price Change', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should schedule a price change', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/schedule-price-change`).set(auth()).send({
      new_cost: 15, effective_date: '2026-05-01', reason: 'price_increase',
    });

    expect(res.status).toBe(201);
    expect(res.body.pending_cost).toBe(15);
    expect(res.body.pending_cost_date).toBe('2026-05-01');
  });

  it('should cancel a scheduled price change', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    await request(app).post(`/api/v1/servers/${server.body.id}/schedule-price-change`).set(auth()).send({
      new_cost: 15, effective_date: '2026-05-01',
    });

    const res = await request(app).delete(`/api/v1/servers/${server.body.id}/schedule-price-change`).set(auth());
    expect(res.status).toBe(204);

    const updated = await request(app).get(`/api/v1/servers/${server.body.id}`).set(auth());
    expect(updated.body.pending_cost).toBeNull();
  });

  it('should auto-apply pending price when effective date has passed', async () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, pending_cost, pending_cost_date, pending_cost_reason) VALUES (?, ?, ?, ?, ?, ?)')
      .run(pid, 'srv1', 10, 15, '2025-01-01', 'price_increase').lastInsertRowid;

    checkAlerts(db);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(sid);
    expect(server.monthly_cost).toBe(15);
    expect(server.pending_cost).toBeNull();
    expect(server.pending_cost_date).toBeNull();

    const history = db.prepare('SELECT * FROM cost_history WHERE server_id = ?').all(sid);
    expect(history).toHaveLength(1);
    expect(history[0].old_cost).toBe(10);
    expect(history[0].new_cost).toBe(15);
    expect(history[0].reason).toBe('price_increase');
  });

  it('should NOT apply pending price when effective date is in the future', async () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare('INSERT INTO servers (provider_id, name, monthly_cost, pending_cost, pending_cost_date) VALUES (?, ?, ?, ?, ?)')
      .run(pid, 'srv1', 10, 15, '2099-01-01').lastInsertRowid;

    checkAlerts(db);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(sid);
    expect(server.monthly_cost).toBe(10);
    expect(server.pending_cost).toBe(15);
  });

  it('should support comma decimals in scheduled price', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/schedule-price-change`).set(auth()).send({
      new_cost: '16,89', effective_date: '2026-05-01',
    });

    expect(res.body.pending_cost).toBe(16.89);
  });

  it('should reject missing fields', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/schedule-price-change`).set(auth()).send({
      new_cost: 15,
    });
    expect(res.status).toBe(400);
  });
});
