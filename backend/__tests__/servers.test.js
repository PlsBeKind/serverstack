import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';

describe('Server Routes', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create a server with contract fields', async () => {
    const res = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'VPS Prod', type: 'vps', hostname: 'srv1.example.com',
      monthly_cost: 29.99, billing_cycle: 'monthly', contract_number: 'C-123'
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('VPS Prod');
    expect(res.body.monthly_cost).toBe(29.99);
    expect(res.body.contract_number).toBe('C-123');
  });

  it('should list servers', async () => {
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS Prod' });
    const res = await request(app).get('/api/v1/servers').set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should get expiring servers', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'Expiring', monthly_cost: 10, next_cancellation_date: futureDate
    });
    const res = await request(app).get('/api/v1/servers/expiring?days=30').set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should update a server including contract fields', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({
      provider_id: providerId, name: 'Old Name', monthly_cost: 10
    });
    const res = await request(app).put(`/api/v1/servers/${created.body.id}`).set(auth()).send({
      name: 'New Name', monthly_cost: 20, is_cancelled: true
    });
    expect(res.body.name).toBe('New Name');
    expect(res.body.monthly_cost).toBe(20);
    expect(res.body.is_cancelled).toBe(1);
  });

  it('should delete a server', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const res = await request(app).delete(`/api/v1/servers/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should reject server with invalid provider', async () => {
    const res = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: 999, name: 'VPS' });
    expect(res.status).toBe(400);
  });

  it('should get server services', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    db.prepare("INSERT INTO services (server_id, name, port) VALUES (?, ?, ?)").run(created.body.id, 'nginx', 80);
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/services`).set(auth());
    expect(res.body).toHaveLength(1);
  });

  it('should get server IPs', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    db.prepare("INSERT INTO ip_addresses (server_id, address, version) VALUES (?, ?, ?)").run(created.body.id, '10.0.0.1', 'ipv4');
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/ips`).set(auth());
    expect(res.body).toHaveLength(1);
  });

  // Credential tests
  it('should add credentials to a server', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const res = await request(app).post(`/api/v1/servers/${created.body.id}/credentials`).set(auth()).send({
      label: 'root', username: 'root', password: 'secret123'
    });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('root');
    expect(res.body.password_enc).toBeUndefined();
  });

  it('should reveal credential password on demand', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const cred = await request(app).post(`/api/v1/servers/${created.body.id}/credentials`).set(auth()).send({ label: 'root', password: 'my-secret' });
    const res = await request(app).get(`/api/v1/servers/${created.body.id}/credentials/${cred.body.id}/password`).set(auth());
    expect(res.body.password).toBe('my-secret');
  });

  it('should delete a credential', async () => {
    const created = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const cred = await request(app).post(`/api/v1/servers/${created.body.id}/credentials`).set(auth()).send({ label: 'root' });
    const res = await request(app).delete(`/api/v1/servers/${created.body.id}/credentials/${cred.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });
});
