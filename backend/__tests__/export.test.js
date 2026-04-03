import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getAuthToken, seedProvider, seedServer } from './helpers.js';

describe('Export/Import Routes', () => {
  let app, db, token;

  beforeEach(async () => {
    ({ app, db } = await createTestApp());
    token = await getAuthToken(request, app);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('should export data', async () => {
    const providerId = seedProvider(db);
    seedServer(db, providerId);

    const res = await request(app).get('/api/v1/export').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.servers).toHaveLength(1);
    expect(res.body.version).toBe('1.2.0');
    expect(res.body.contracts).toBeUndefined();
  });

  it('should export credentials without passwords', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId);
    db.prepare("INSERT INTO server_credentials (server_id, label, username, password_enc) VALUES (?, ?, ?, ?)").run(serverId, 'root', 'root', 'encrypted');

    const res = await request(app).get('/api/v1/export').set(auth());
    expect(res.body.server_credentials).toHaveLength(1);
    expect(res.body.server_credentials[0].password_enc).toBeUndefined();
  });

  it('should import data', async () => {
    const exportData = {
      providers: [{ id: 1, name: 'ImportedProvider', website: null, support_email: null, support_phone: null, notes: null }],
      servers: [{ id: 1, provider_id: 1, name: 'Imported VPS', type: 'vps', hostname: 'imported.example.com', location: null, os: null, cpu_cores: null, ram_mb: 8192, storage_gb: 50, storage_type: null, status: 'active', notes: null, ssh_user: null, ssh_port: 22, ssh_public_key: null, ssh_host_key: null, monthly_cost: 15, contract_number: 'X-99' }],
      ip_addresses: [],
      services: [],
    };

    const res = await request(app).post('/api/v1/import').set(auth()).send(exportData);
    expect(res.status).toBe(200);
    expect(res.body.imported.providers).toBe(1);
    expect(res.body.imported.servers).toBe(1);
  });

  it('should reject invalid import format', async () => {
    const res = await request(app).post('/api/v1/import').set(auth()).send({ invalid: true });
    expect(res.status).toBe(400);
  });
});
