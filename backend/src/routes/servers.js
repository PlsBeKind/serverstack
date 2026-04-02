import { Router } from 'express';
import { encrypt } from '../utils/crypto.js';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function serverRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const servers = db.prepare(`
      SELECT s.*, p.name as provider_name
      FROM servers s
      LEFT JOIN providers p ON s.provider_id = p.id
      ORDER BY s.name
    `).all();
    const safe = servers.map(({ login_password_enc, ...rest }) => rest);
    res.json(safe);
  });

  router.get('/:id', (req, res) => {
    const server = db.prepare(`
      SELECT s.*, p.name as provider_name
      FROM servers s
      LEFT JOIN providers p ON s.provider_id = p.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    const { login_password_enc, ...safe } = server;
    safe.has_password = !!login_password_enc;
    res.json(safe);
  });

  router.get('/:id/password', (req, res) => {
    const server = db.prepare('SELECT login_password_enc FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });
    if (!server.login_password_enc) return res.json({ password: null });

    import('../utils/crypto.js').then(({ decrypt }) => {
      res.json({ password: decrypt(server.login_password_enc) });
    });
  });

  router.get('/:id/services', (req, res) => {
    const services = db.prepare('SELECT * FROM services WHERE server_id = ?').all(req.params.id);
    res.json(services);
  });

  router.get('/:id/ips', (req, res) => {
    const ips = db.prepare('SELECT * FROM ip_addresses WHERE server_id = ?').all(req.params.id);
    res.json(ips);
  });

  router.post('/', (req, res) => {
    const {
      provider_id, name, type, hostname, location, os,
      cpu_cores, ram_mb, storage_gb, storage_type, status, notes,
      ssh_user, ssh_port, ssh_public_key, ssh_host_key,
      login_user, login_password
    } = req.body;

    if (!provider_id || !name) {
      return res.status(400).json({ error: 'servers.missing_fields' });
    }

    const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(provider_id);
    if (!provider) return res.status(400).json({ error: 'servers.invalid_provider' });

    const passwordEnc = login_password ? encrypt(login_password) : null;

    const result = db.prepare(`
      INSERT INTO servers (provider_id, name, type, hostname, location, os, cpu_cores, ram_mb, storage_gb, storage_type, status, notes, ssh_user, ssh_port, ssh_public_key, ssh_host_key, login_user, login_password_enc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider_id, name, type || null, hostname || null, location || null, os || null,
      cpu_cores || null, ram_mb || null, storage_gb || null, storage_type || null,
      status || 'active', notes || null,
      ssh_user || null, ssh_port || 22, ssh_public_key || null, ssh_host_key || null,
      login_user || null, passwordEnc
    );

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    const { login_password_enc, ...safe } = server;
    res.status(201).json(safe);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'servers.not_found' });

    const {
      provider_id, name, type, hostname, location, os,
      cpu_cores, ram_mb, storage_gb, storage_type, status, notes,
      ssh_user, ssh_port, ssh_public_key, ssh_host_key,
      login_user, login_password
    } = req.body;

    const passwordEnc = login_password !== undefined
      ? (login_password ? encrypt(login_password) : null)
      : existing.login_password_enc;

    db.prepare(`
      UPDATE servers SET
        provider_id = ?, name = ?, type = ?, hostname = ?, location = ?, os = ?,
        cpu_cores = ?, ram_mb = ?, storage_gb = ?, storage_type = ?,
        status = ?, notes = ?,
        ssh_user = ?, ssh_port = ?, ssh_public_key = ?, ssh_host_key = ?,
        login_user = ?, login_password_enc = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      provider_id ?? existing.provider_id, name || existing.name,
      type ?? existing.type, hostname ?? existing.hostname,
      location ?? existing.location, os ?? existing.os,
      cpu_cores ?? existing.cpu_cores, ram_mb ?? existing.ram_mb,
      storage_gb ?? existing.storage_gb, storage_type ?? existing.storage_type,
      status ?? existing.status, notes ?? existing.notes,
      ssh_user ?? existing.ssh_user, ssh_port ?? existing.ssh_port,
      ssh_public_key ?? existing.ssh_public_key, ssh_host_key ?? existing.ssh_host_key,
      login_user ?? existing.login_user, passwordEnc,
      req.params.id
    );

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    const { login_password_enc, ...safe } = server;
    res.json(safe);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'servers.not_found' });

    db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
