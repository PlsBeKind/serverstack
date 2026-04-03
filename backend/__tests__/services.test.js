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

  it('should create a service with all fields', async () => {
    const res = await request(app).post('/api/v1/services').set(auth()).send({
      server_id: serverId, name: 'Gitea', category: 'web', port: 3000,
      url: 'https://git.example.com', domain: 'git.example.com',
      protocol: 'https', docker: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Gitea');
    expect(res.body.domain).toBe('git.example.com');
    expect(res.body.protocol).toBe('https');
    expect(res.body.docker).toBe(1);
    expect(res.body.status).toBe('running');
  });

  it('should list all services with server and provider names', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', category: 'web', port: 80 });
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'postgres', category: 'database', port: 5432 });

    const res = await request(app).get('/api/v1/services').set(auth());
    expect(res.body).toHaveLength(2);
    expect(res.body[0].server_name).toBeDefined();
    expect(res.body[0].provider_name).toBeDefined();
  });

  it('should filter services by category', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', category: 'web' });
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'postgres', category: 'database' });

    const res = await request(app).get('/api/v1/services?category=web').set(auth());
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('nginx');
  });

  it('should filter services by domain', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'Gitea', domain: 'git.example.com' });
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'Blog', domain: 'blog.example.com' });

    const res = await request(app).get('/api/v1/services?domain=git').set(auth());
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Gitea');
  });

  it('should update a service', async () => {
    const created = await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', port: 80 });
    const res = await request(app).put(`/api/v1/services/${created.body.id}`).set(auth()).send({ port: 8080, status: 'stopped', domain: 'web.example.com' });
    expect(res.body.port).toBe(8080);
    expect(res.body.status).toBe('stopped');
    expect(res.body.domain).toBe('web.example.com');
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

  it('should get services for a specific server', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx', port: 80 });
    const res = await request(app).get(`/api/v1/servers/${serverId}/services`).set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should cascade delete services when server is deleted', async () => {
    await request(app).post('/api/v1/services').set(auth()).send({ server_id: serverId, name: 'nginx' });
    await request(app).delete(`/api/v1/servers/${serverId}`).set(auth());
    const count = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
    expect(count).toBe(0);
  });
});
