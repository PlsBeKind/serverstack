import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Contract Routes', () => {
  let app, db, token, serverId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    const providerId = seedProvider(db);
    serverId = seedServer(db, providerId);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create a contract (only server_id required)', async () => {
    const res = await request(app).post('/api/v1/contracts').set(auth()).send({
      server_id: serverId, monthly_cost: 29.99
    });
    expect(res.status).toBe(201);
    expect(res.body.monthly_cost).toBe(29.99);
    expect(res.body.server_id).toBe(serverId);
  });

  it('should include provider_name via server join', async () => {
    await request(app).post('/api/v1/contracts').set(auth()).send({ server_id: serverId, monthly_cost: 29.99 });
    const res = await request(app).get('/api/v1/contracts').set(auth());
    expect(res.body[0].provider_name).toBe('Hetzner');
  });

  it('should get expiring contracts', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await request(app).post('/api/v1/contracts').set(auth()).send({
      server_id: serverId, monthly_cost: 29.99, next_cancellation_date: futureDate
    });
    const res = await request(app).get('/api/v1/contracts/expiring?days=30').set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should update a contract', async () => {
    const created = await request(app).post('/api/v1/contracts').set(auth()).send({
      server_id: serverId, monthly_cost: 29.99
    });
    const res = await request(app).put(`/api/v1/contracts/${created.body.id}`).set(auth()).send({ monthly_cost: 39.99 });
    expect(res.body.monthly_cost).toBe(39.99);
  });

  it('should delete a contract', async () => {
    const created = await request(app).post('/api/v1/contracts').set(auth()).send({
      server_id: serverId, monthly_cost: 29.99
    });
    const res = await request(app).delete(`/api/v1/contracts/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should reject missing server_id', async () => {
    const res = await request(app).post('/api/v1/contracts').set(auth()).send({ monthly_cost: 29.99 });
    expect(res.status).toBe(400);
  });
});
