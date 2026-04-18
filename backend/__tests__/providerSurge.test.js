import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';

describe('Provider Price Surge', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should apply percentage surge to all provider servers', async () => {
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS 1', monthly_cost: 10 });
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS 2', monthly_cost: 20 });

    const res = await request(app).post(`/api/v1/providers/${providerId}/price-surge`).set(auth()).send({
      percentage: 18.51, effective_date: '2026-05-01', reason: 'price_increase',
    });

    expect(res.status).toBe(200);
    expect(res.body.affected_servers).toBe(2);
    expect(res.body.servers[0].old_cost).toBe(10);
    expect(res.body.servers[0].new_cost).toBe(11.85); // 10 * 1.1851 = 11.851 → 11.85
    expect(res.body.servers[1].old_cost).toBe(20);
    expect(res.body.servers[1].new_cost).toBe(23.70); // 20 * 1.1851 = 23.702 → 23.70
  });

  it('should set pending_cost on each server', async () => {
    const srv = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS', monthly_cost: 16.89 });

    await request(app).post(`/api/v1/providers/${providerId}/price-surge`).set(auth()).send({
      percentage: 18.51, effective_date: '2026-05-01',
    });

    const server = await request(app).get(`/api/v1/servers/${srv.body.id}`).set(auth());
    expect(server.body.pending_cost).toBe(20.02); // 16.89 * 1.1851 = 20.0195 → 20.02
    expect(server.body.pending_cost_date).toBe('2026-05-01');
  });

  it('should skip servers with zero cost', async () => {
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'Free', monthly_cost: 0 });
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'Paid', monthly_cost: 10 });

    const res = await request(app).post(`/api/v1/providers/${providerId}/price-surge`).set(auth()).send({
      percentage: 10, effective_date: '2026-05-01',
    });

    expect(res.body.affected_servers).toBe(1);
  });

  it('should reject missing fields', async () => {
    const res = await request(app).post(`/api/v1/providers/${providerId}/price-surge`).set(auth()).send({
      percentage: 10,
    });
    expect(res.status).toBe(400);
  });

  it('should support negative percentage (price decrease)', async () => {
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS', monthly_cost: 20 });

    const res = await request(app).post(`/api/v1/providers/${providerId}/price-surge`).set(auth()).send({
      percentage: -10, effective_date: '2026-05-01',
    });

    expect(res.body.servers[0].new_cost).toBe(18); // 20 * 0.9
  });
});
