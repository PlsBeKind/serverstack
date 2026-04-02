import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Provider Routes', () => {
  let app, db, token;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create a provider', async () => {
    const res = await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner', website: 'https://hetzner.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Hetzner');
  });

  it('should list providers', async () => {
    await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    await request(app).post('/api/v1/providers').set(auth()).send({ name: 'OVH' });
    const res = await request(app).get('/api/v1/providers').set(auth());
    expect(res.body).toHaveLength(2);
  });

  it('should get a provider by id', async () => {
    const created = await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    const res = await request(app).get(`/api/v1/providers/${created.body.id}`).set(auth());
    expect(res.body.name).toBe('Hetzner');
  });

  it('should update a provider', async () => {
    const created = await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    const res = await request(app).put(`/api/v1/providers/${created.body.id}`).set(auth()).send({ name: 'Hetzner Cloud' });
    expect(res.body.name).toBe('Hetzner Cloud');
  });

  it('should delete a provider without servers', async () => {
    const created = await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    const res = await request(app).delete(`/api/v1/providers/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should reject deleting provider with servers', async () => {
    const pid = seedProvider(db, 'Netcup');
    seedServer(db, pid);
    const res = await request(app).delete(`/api/v1/providers/${pid}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('providers.has_servers');
  });

  it('should return 404 for non-existent provider', async () => {
    const res = await request(app).get('/api/v1/providers/999').set(auth());
    expect(res.status).toBe(404);
  });

  it('should reject duplicate provider names', async () => {
    await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    const res = await request(app).post('/api/v1/providers').set(auth()).send({ name: 'Hetzner' });
    expect(res.status).toBe(409);
  });

  it('should require auth', async () => {
    const res = await request(app).get('/api/v1/providers');
    expect(res.status).toBe(401);
  });
});
