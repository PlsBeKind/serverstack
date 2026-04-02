import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

describe('Auth Routes', () => {
  let app, db;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
  });

  describe('GET /api/v1/auth/status', () => {
    it('should return registration_open true when no users', async () => {
      const res = await request(app).get('/api/v1/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.registration_open).toBe(true);
    });

    it('should return registration_open false after user exists', async () => {
      await request(app).post('/api/v1/auth/register').send({ username: 'admin', password: 'password123' });
      const res = await request(app).get('/api/v1/auth/status');
      expect(res.body.registration_open).toBe(false);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register first user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'admin', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('admin');
    });

    it('should reject second registration (only one user allowed)', async () => {
      await request(app).post('/api/v1/auth/register').send({ username: 'admin', password: 'password123' });
      const res = await request(app).post('/api/v1/auth/register').send({ username: 'admin2', password: 'password456' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('auth.registration_closed');
    });

    it('should reject short password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ username: 'admin', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({ username: 'admin', password: 'password123' });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'nobody', password: 'password123' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ username: 'admin', password: 'password123' });
      token = res.body.token;
    });

    it('should change password with valid current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: 'newpass1234' });

      expect(res.status).toBe(200);

      const login = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'newpass1234' });
      expect(login.status).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpass1234' });

      expect(res.status).toBe(401);
    });

    it('should require auth', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'password123', newPassword: 'newpass1234' });

      expect(res.status).toBe(401);
    });
  });
});
