import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Glances Routes', () => {
  let app, db, token, providerId, serverId;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
    providerId = seedProvider(db);
    serverId = seedServer(db, providerId, 'Monitor Test');
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('GET /api/v1/servers/:id/glances/config', () => {
    it('should return null when no config exists', async () => {
      const res = await request(app).get(`/api/v1/servers/${serverId}/glances/config`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('should return config without password', async () => {
      await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
        glances_username: 'admin',
        glances_password: 'secret',
        poll_interval_seconds: 120,
      });
      const res = await request(app).get(`/api/v1/servers/${serverId}/glances/config`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.glances_url).toBe('http://10.0.0.1:61208');
      expect(res.body.glances_username).toBe('admin');
      expect(res.body.has_password).toBe(true);
      expect(res.body.glances_password_enc).toBeUndefined();
      expect(res.body.poll_interval_seconds).toBe(120);
    });
  });

  describe('POST /api/v1/servers/:id/glances/config', () => {
    it('should save config with required fields only', async () => {
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
      });
      expect(res.status).toBe(201);
      expect(res.body.glances_url).toBe('http://10.0.0.1:61208');
      expect(res.body.no_auth_warning).toBeUndefined();
      expect(res.body.warning).toBe('glances.no_auth_warning');
    });

    it('should reject missing url', async () => {
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({});
      expect(res.status).toBe(400);
    });

    it('should update existing config', async () => {
      await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
      });
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.2:61208',
        poll_interval_seconds: 30,
      });
      expect(res.status).toBe(200);
      expect(res.body.glances_url).toBe('http://10.0.0.2:61208');
    });

    it('should reject invalid URL schemes', async () => {
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'ftp://10.0.0.1:61208',
      });
      expect(res.status).toBe(400);
    });

    it('should save and return selected_devices', async () => {
      const devices = {
        network_interfaces: ['eth0', 'ens192'],
        disk_partitions: ['/', '/home'],
        sensors: ['Package id 0'],
        gpus: [0],
      };
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
        selected_devices: devices,
      });
      expect(res.status).toBe(201);
      expect(res.body.selected_devices).toEqual(devices);

      // Verify GET returns the same
      const get = await request(app).get(`/api/v1/servers/${serverId}/glances/config`).set(auth());
      expect(get.body.selected_devices).toEqual(devices);
    });

    it('should update selected_devices on existing config', async () => {
      await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
        selected_devices: { network_interfaces: ['eth0'], disk_partitions: [], sensors: [], gpus: [] },
      });
      const res = await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
        selected_devices: { network_interfaces: ['eth0', 'ens192'], disk_partitions: ['/'], sensors: [], gpus: [] },
      });
      expect(res.status).toBe(200);
      expect(res.body.selected_devices.network_interfaces).toEqual(['eth0', 'ens192']);
      expect(res.body.selected_devices.disk_partitions).toEqual(['/']);
    });
  });

  describe('DELETE /api/v1/servers/:id/glances/config', () => {
    it('should delete existing config', async () => {
      await request(app).post(`/api/v1/servers/${serverId}/glances/config`).set(auth()).send({
        glances_url: 'http://10.0.0.1:61208',
      });
      const res = await request(app).delete(`/api/v1/servers/${serverId}/glances/config`).set(auth());
      expect(res.status).toBe(204);

      const check = await request(app).get(`/api/v1/servers/${serverId}/glances/config`).set(auth());
      expect(check.body).toBeNull();
    });
  });

  describe('GET /api/v1/servers/:id/glances/history', () => {
    it('should return empty array when no snapshots', async () => {
      const res = await request(app).get(`/api/v1/servers/${serverId}/glances/history`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return snapshots with parsed JSON', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent, ram_percent, ram_total, ram_used,
          disk_usage_json, gpu_json, net_rx_rate, net_tx_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(serverId, now, 45.5, 62.3, 16000000000, 9968000000,
        JSON.stringify([{ mount_point: '/', percent: 55, total: 100000000000, used: 55000000000 }]),
        JSON.stringify([{ name: 'GTX 1080', proc: 30, mem: 40, temperature: 65 }]),
        1024000, 512000
      );

      const res = await request(app).get(`/api/v1/servers/${serverId}/glances/history`).set(auth());
      expect(res.body).toHaveLength(1);
      expect(res.body[0].cpu_percent).toBe(45.5);
      expect(res.body[0].disk_usage).toBeInstanceOf(Array);
      expect(res.body[0].gpu).toBeInstanceOf(Array);
      expect(res.body[0].gpu[0].name).toBe('GTX 1080');
    });

    it('should filter by time range', async () => {
      const old = new Date(Date.now() - 48 * 3600000).toISOString();
      const recent = new Date().toISOString();
      db.prepare('INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent) VALUES (?, ?, ?)').run(serverId, old, 10);
      db.prepare('INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent) VALUES (?, ?, ?)').run(serverId, recent, 50);

      const from = new Date(Date.now() - 3600000).toISOString();
      const res = await request(app).get(`/api/v1/servers/${serverId}/glances/history?from=${from}`).set(auth());
      expect(res.body).toHaveLength(1);
      expect(res.body[0].cpu_percent).toBe(50);
    });
  });

  describe('Glances Settings', () => {
    it('should return default settings', async () => {
      const res = await request(app).get('/api/v1/glances/settings').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.retention_hours).toBe(168);
      expect(res.body.default_poll_interval).toBe(60);
    });

    it('should update settings', async () => {
      const res = await request(app).put('/api/v1/glances/settings').set(auth()).send({
        retention_hours: 48,
        default_poll_interval: 30,
      });
      expect(res.status).toBe(200);
      expect(res.body.retention_hours).toBe(48);
      expect(res.body.default_poll_interval).toBe(30);
    });
  });
});
