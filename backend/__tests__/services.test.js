import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Service Routes', () => {
  let app, db, token, serverId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    const providerId = seedProvider(db);
    serverId = seedServer(db, providerId);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create a service with category and docker flag', async () => {
    const res = await request(app).post('/api/v1/services').set(auth()).send({
      server_id: serverId, name: 'nginx', category: 'web', port: 80, docker: true
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('nginx');
    expect(res.body.category).toBe('web');
    expect(res.body.docker).toBe(1);
    expect(res.body.status).toBe('running');
  });

  it('should list services with server name', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', port: 80 });
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'postgres', port: 5432, category: 'database' });
    const res = await request(app).get('/api/v1/services').set(auth());
    expect(res.body).toHaveLength(2);
    expect(res.body[0].server_name).toBeDefined();
  });

  it('should update a service', async () => {
    const created = await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', port: 80 });
    const res = await request(app).put(`/api/v1/services/${created.body.id}`).set(auth()).send({ port: 8080, status: 'stopped' });
    expect(res.body.port).toBe(8080);
    expect(res.body.status).toBe('stopped');
  });

  it('should delete a service', async () => {
    const created = await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', port: 80 });
    const res = await request(app).delete(`/api/v1/services/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should return 404 for non-existent service', async () => {
    const res = await request(app).get('/api/v1/services/999').set(auth());
    expect(res.status).toBe(404);
  });
});
