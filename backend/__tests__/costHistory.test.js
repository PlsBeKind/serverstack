import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';

describe('Cost History', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create cost history on price change', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({
      new_cost: 15, reason: 'price_increase',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].old_cost).toBe(10);
    expect(res.body[0].new_cost).toBe(15);
    expect(res.body[0].reason).toBe('price_increase');
  });

  it('should update server monthly_cost on price change', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({
      new_cost: 20, reason: 'price_increase',
    });

    const updated = await request(app).get(`/api/v1/servers/${server.body.id}`).set(auth());
    expect(updated.body.monthly_cost).toBe(20);
  });

  it('should return cost history for a server', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({ new_cost: 15, reason: 'price_increase' });
    await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({ new_cost: 12, reason: 'promo_start' });

    const res = await request(app).get(`/api/v1/servers/${server.body.id}/cost-history`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Most recent first
    expect(res.body[0].new_cost).toBe(12);
    expect(res.body[1].new_cost).toBe(15);
  });

  it('should handle first entry with zero old_cost', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS',
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({
      new_cost: 10, reason: 'manual',
    });

    expect(res.body[0].old_cost).toBe(0);
    expect(res.body[0].new_cost).toBe(10);
  });

  it('should reject price change without new_cost', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS',
    });

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({
      reason: 'price_increase',
    });
    expect(res.status).toBe(400);
  });

  it('should support comma decimal in price change', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({
      new_cost: '16,89', reason: 'price_increase',
    });

    const updated = await request(app).get(`/api/v1/servers/${server.body.id}`).set(auth());
    expect(updated.body.monthly_cost).toBe(16.89);
  });

  it('should return cost trend for last 12 months', async () => {
    const res = await request(app).get('/api/v1/dashboard/cost-trend').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toHaveProperty('month');
    expect(res.body[0]).toHaveProperty('total');
  });

  it('should cascade delete cost history when server is deleted', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS', monthly_cost: 10,
    });

    await request(app).post(`/api/v1/servers/${server.body.id}/price-change`).set(auth()).send({ new_cost: 20, reason: 'manual' });
    await request(app).delete(`/api/v1/servers/${server.body.id}`).set(auth());

    const count = db.prepare('SELECT COUNT(*) as c FROM cost_history').get().c;
    expect(count).toBe(0);
  });
});
