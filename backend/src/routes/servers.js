import { Router } from 'express';
import { encrypt, decrypt } from '../utils/crypto.js';

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
    res.json(servers);
  });

  router.get('/expiring', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const servers = db.prepare(`
      SELECT s.*, p.name as provider_name
      FROM servers s
      LEFT JOIN providers p ON s.provider_id = p.id
      WHERE s.next_cancellation_date IS NOT NULL
        AND date(s.next_cancellation_date) <= date('now', '+' || ? || ' days')
      ORDER BY s.next_cancellation_date
    `).all(days);
    res.json(servers);
  });

  router.get('/:id', (req, res) => {
    const server = db.prepare(`
      SELECT s.*, p.name as provider_name
      FROM servers s
      LEFT JOIN providers p ON s.provider_id = p.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });
    res.json(server);
  });

  router.get('/:id/services', (req, res) => {
    const services = db.prepare('SELECT * FROM services WHERE server_id = ?').all(req.params.id);
    res.json(services);
  });

  router.get('/:id/ips', (req, res) => {
    const ips = db.prepare('SELECT * FROM ip_addresses WHERE server_id = ?').all(req.params.id);
    res.json(ips);
  });

  // --- Credentials sub-routes ---

  router.get('/:id/credentials', (req, res) => {
    const creds = db.prepare('SELECT id, server_id, label, username, notes, created_at FROM server_credentials WHERE server_id = ?').all(req.params.id);
    res.json(creds);
  });

  router.get('/:id/credentials/:credId/password', (req, res) => {
    const cred = db.prepare('SELECT password_enc FROM server_credentials WHERE id = ? AND server_id = ?').get(req.params.credId, req.params.id);
    if (!cred) return res.status(404).json({ error: 'credentials.not_found' });
    if (!cred.password_enc) return res.json({ password: null });
    res.json({ password: decrypt(cred.password_enc) });
  });

  router.post('/:id/credentials', (req, res) => {
    const { label, username, password, notes } = req.body;
    if (!label) return res.status(400).json({ error: 'credentials.label_required' });

    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    const passwordEnc = password ? encrypt(password) : null;
    const result = db.prepare(
      'INSERT INTO server_credentials (server_id, label, username, password_enc, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, label, username || null, passwordEnc, notes || null);

    const cred = db.prepare('SELECT id, server_id, label, username, notes, created_at FROM server_credentials WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(cred);
  });

  router.put('/:id/credentials/:credId', (req, res) => {
    const existing = db.prepare('SELECT * FROM server_credentials WHERE id = ? AND server_id = ?').get(req.params.credId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'credentials.not_found' });

    const { label, username, password, notes } = req.body;
    const passwordEnc = password !== undefined
      ? (password ? encrypt(password) : null)
      : existing.password_enc;

    db.prepare('UPDATE server_credentials SET label = ?, username = ?, password_enc = ?, notes = ? WHERE id = ?')
      .run(label || existing.label, username ?? existing.username, passwordEnc, notes ?? existing.notes, req.params.credId);

    const cred = db.prepare('SELECT id, server_id, label, username, notes, created_at FROM server_credentials WHERE id = ?').get(req.params.credId);
    res.json(cred);
  });

  router.delete('/:id/credentials/:credId', (req, res) => {
    const existing = db.prepare('SELECT id FROM server_credentials WHERE id = ? AND server_id = ?').get(req.params.credId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'credentials.not_found' });

    db.prepare('DELETE FROM server_credentials WHERE id = ?').run(req.params.credId);
    res.status(204).end();
  });

  // --- Server CRUD (includes contract fields) ---

  router.post('/', (req, res) => {
    const {
      provider_id, name, type, hostname, location, os,
      cpu_cores, ram_mb, storage_gb, storage_type, status, notes,
      ssh_user, ssh_port, ssh_public_key, ssh_host_key,
      contract_number, monthly_cost, regular_cost, billing_cycle,
      contract_start_date, contract_end_date, cancellation_period_days,
      next_cancellation_date, auto_renew, promo_price, promo_end_date,
      contract_period, is_cancelled, contract_notes
    } = req.body;

    if (!provider_id || !name) {
      return res.status(400).json({ error: 'servers.missing_fields' });
    }

    const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(provider_id);
    if (!provider) return res.status(400).json({ error: 'servers.invalid_provider' });

    const result = db.prepare(`
      INSERT INTO servers (
        provider_id, name, type, hostname, location, os,
        cpu_cores, ram_mb, storage_gb, storage_type, status, notes,
        ssh_user, ssh_port, ssh_public_key, ssh_host_key,
        contract_number, monthly_cost, regular_cost, billing_cycle,
        contract_start_date, contract_end_date, cancellation_period_days,
        next_cancellation_date, auto_renew, promo_price, promo_end_date,
        contract_period, is_cancelled, contract_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider_id, name, type || null, hostname || null, location || null, os || null,
      cpu_cores || null, ram_mb || null, storage_gb || null, storage_type || null,
      status || 'active', notes || null,
      ssh_user || null, ssh_port || 22, ssh_public_key || null, ssh_host_key || null,
      contract_number || null, monthly_cost || 0, regular_cost || null,
      billing_cycle || null, contract_start_date || null, contract_end_date || null,
      cancellation_period_days || 30, next_cancellation_date || null,
      auto_renew !== undefined ? (auto_renew ? 1 : 0) : 1,
      promo_price ? 1 : 0, promo_end_date || null,
      contract_period || null, is_cancelled ? 1 : 0, contract_notes || null
    );

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(server);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'servers.not_found' });

    const {
      provider_id, name, type, hostname, location, os,
      cpu_cores, ram_mb, storage_gb, storage_type, status, notes,
      ssh_user, ssh_port, ssh_public_key, ssh_host_key,
      contract_number, monthly_cost, regular_cost, billing_cycle,
      contract_start_date, contract_end_date, cancellation_period_days,
      next_cancellation_date, auto_renew, promo_price, promo_end_date,
      contract_period, is_cancelled, contract_notes
    } = req.body;

    db.prepare(`
      UPDATE servers SET
        provider_id = ?, name = ?, type = ?, hostname = ?, location = ?, os = ?,
        cpu_cores = ?, ram_mb = ?, storage_gb = ?, storage_type = ?,
        status = ?, notes = ?,
        ssh_user = ?, ssh_port = ?, ssh_public_key = ?, ssh_host_key = ?,
        contract_number = ?, monthly_cost = ?, regular_cost = ?, billing_cycle = ?,
        contract_start_date = ?, contract_end_date = ?, cancellation_period_days = ?,
        next_cancellation_date = ?, auto_renew = ?, promo_price = ?, promo_end_date = ?,
        contract_period = ?, is_cancelled = ?, contract_notes = ?,
        updated_at = datetime('now')
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
      contract_number ?? existing.contract_number,
      monthly_cost ?? existing.monthly_cost,
      regular_cost ?? existing.regular_cost,
      billing_cycle ?? existing.billing_cycle,
      contract_start_date ?? existing.contract_start_date,
      contract_end_date ?? existing.contract_end_date,
      cancellation_period_days ?? existing.cancellation_period_days,
      next_cancellation_date ?? existing.next_cancellation_date,
      auto_renew !== undefined ? (auto_renew ? 1 : 0) : existing.auto_renew,
      promo_price !== undefined ? (promo_price ? 1 : 0) : existing.promo_price,
      promo_end_date ?? existing.promo_end_date,
      contract_period ?? existing.contract_period,
      is_cancelled !== undefined ? (is_cancelled ? 1 : 0) : existing.is_cancelled,
      contract_notes ?? existing.contract_notes,
      req.params.id
    );

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    res.json(server);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'servers.not_found' });

    db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
