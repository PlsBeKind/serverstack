import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('IP Address Routes', () => {
  let app, db, token, serverId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    const providerId = seedProvider(db);
    serverId = seedServer(db, providerId);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should create an IP with version and type', async () => {
    const res = await request(app).post('/api/v1/ips').set(auth()).send({
      server_id: serverId, address: '10.0.0.1', version: 'ipv4', type: 'primary'
    });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe('ipv4');
    expect(res.body.type).toBe('primary');
  });

  it('should list IPs with server name', async () => {
    await request(app).post('/api/v1/ips').set(auth()).send({ server_id: serverId, address: '10.0.0.1' });
    await request(app).post('/api/v1/ips').set(auth()).send({ server_id: serverId, address: '10.0.0.2', type: 'additional' });
    const res = await request(app).get('/api/v1/ips').set(auth());
    expect(res.body).toHaveLength(2);
    expect(res.body[0].server_name).toBeDefined();
  });

  it('should update an IP', async () => {
    const created = await request(app).post('/api/v1/ips').set(auth()).send({ server_id: serverId, address: '10.0.0.1' });
    const res = await request(app).put(`/api/v1/ips/${created.body.id}`).set(auth()).send({ rdns: 'srv1.example.com' });
    expect(res.body.rdns).toBe('srv1.example.com');
  });

  it('should delete an IP', async () => {
    const created = await request(app).post('/api/v1/ips').set(auth()).send({ server_id: serverId, address: '10.0.0.1' });
    const res = await request(app).delete(`/api/v1/ips/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });
});
