import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider } from './helpers.js';

describe('Tag Routes', () => {
  let app, db, token, providerId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // Tag CRUD
  it('should list preset tags', async () => {
    const res = await request(app).get('/api/v1/tags').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
    expect(res.body.some(t => t.name === 'production')).toBe(true);
  });

  it('should create a custom tag', async () => {
    const res = await request(app).post('/api/v1/tags').set(auth()).send({ name: 'web', color: '#ff6600' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('web');
    expect(res.body.is_preset).toBe(0);
  });

  it('should reject duplicate tag names', async () => {
    await request(app).post('/api/v1/tags').set(auth()).send({ name: 'custom1' });
    const res = await request(app).post('/api/v1/tags').set(auth()).send({ name: 'custom1' });
    expect(res.status).toBe(409);
  });

  it('should delete a custom tag', async () => {
    const created = await request(app).post('/api/v1/tags').set(auth()).send({ name: 'temp' });
    const res = await request(app).delete(`/api/v1/tags/${created.body.id}`).set(auth());
    expect(res.status).toBe(204);
  });

  it('should NOT delete a preset tag', async () => {
    const tags = await request(app).get('/api/v1/tags').set(auth());
    const preset = tags.body.find(t => t.is_preset);
    const res = await request(app).delete(`/api/v1/tags/${preset.id}`).set(auth());
    expect(res.status).toBe(403);
  });

  // Server-tag assignment
  it('should assign a tag to a server', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const tags = await request(app).get('/api/v1/tags').set(auth());
    const tag = tags.body.find(t => t.name === 'production');

    const res = await request(app).post(`/api/v1/servers/${server.body.id}/tags`).set(auth()).send({ tag_id: tag.id });
    expect(res.status).toBe(201);
    expect(res.body.some(t => t.name === 'production')).toBe(true);
  });

  it('should include tags in server detail', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const tags = await request(app).get('/api/v1/tags').set(auth());
    const tag = tags.body.find(t => t.name === 'testing');
    await request(app).post(`/api/v1/servers/${server.body.id}/tags`).set(auth()).send({ tag_id: tag.id });

    const res = await request(app).get(`/api/v1/servers/${server.body.id}`).set(auth());
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.tags[0].name).toBe('testing');
  });

  it('should include tags in server list', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const tags = await request(app).get('/api/v1/tags').set(auth());
    await request(app).post(`/api/v1/servers/${server.body.id}/tags`).set(auth()).send({ tag_id: tags.body[0].id });

    const res = await request(app).get('/api/v1/servers').set(auth());
    expect(res.body[0].tags.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter servers by tag', async () => {
    const s1 = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'Prod Server' });
    await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'Dev Server' });
    const tags = await request(app).get('/api/v1/tags').set(auth());
    const prodTag = tags.body.find(t => t.name === 'production');
    await request(app).post(`/api/v1/servers/${s1.body.id}/tags`).set(auth()).send({ tag_id: prodTag.id });

    const res = await request(app).get('/api/v1/servers?tag=production').set(auth());
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Prod Server');
  });

  it('should remove a tag from a server', async () => {
    const server = await request(app).post('/api/v1/servers').set(auth()).send({ provider_id: providerId, name: 'VPS' });
    const tags = await request(app).get('/api/v1/tags').set(auth());
    const tag = tags.body[0];
    await request(app).post(`/api/v1/servers/${server.body.id}/tags`).set(auth()).send({ tag_id: tag.id });

    const res = await request(app).delete(`/api/v1/servers/${server.body.id}/tags/${tag.id}`).set(auth());
    expect(res.status).toBe(204);
  });
});
