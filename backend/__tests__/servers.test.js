import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';

describe('Server Routes', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create a server', async () => {
    const res = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS Prod', type: 'vps', hostname: 'srv1.example.com', os: 'Ubuntu', ram_mb: 16384, storage_gb: 100
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('VPS Prod');
    expect(res.body.login_password_enc).toBeUndefined();
  });

  it('should list servers without passwords', async () => {
    await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS Prod', login_password: 'secret123'
    });
    const res = await request(app).get('/api/v1/servers').set(auth());
    expect(res.body[0].login_password_enc).toBeUndefined();
  });

  it('should get server detail with has_password flag', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS Prod', login_password: 'secret'
    });
    const res = await request(app).get(`/api/v1/servers/${created.body.id}`).set(auth());
    expect(res.body.has_password).toBe(true);
    expect(res.body.login_password_enc).toBeUndefined();
  });

  it('should reveal password on demand', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS Prod', login_password: 'my-secret-pw'
    });
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/password`).set(auth());
    expect(res.body.password).toBe('my-secret-pw');
  });

  it('should update a server', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'Old Name'
    });
    const res = await request(app).put(`/api/v1/servers/${created.body.id}`).set(auth()).send({ name: 'New Name' });
    expect(res.body.name).toBe('New Name');
  });

  it('should delete a server', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS'
    });
    const res = await request(app).delete(`/api/v1/servers/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should reject server with invalid provider', async () => {
    const res = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: 999, name: 'VPS'
    });
    expect(res.status).toBe(400);
  });

  it('should get server services', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS'
    });
    db.prepare("INSERT INTO services (server_id, name, port) VALUES (?, ?, ?)").run(created.body.id, 'nginx', 80);
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/services`).set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should get server IPs', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS'
    });
    db.prepare("INSERT INTO ip_addresses (server_id, address, version) VALUES (?, ?, ?)").run(created.body.id, '10.0.0.1', 'ipv4');
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/ips`).set(auth());
    expect(res.body).toHaveLength(1);
  });
});
