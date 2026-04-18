import { Router } from 'express';
import { encrypt, decrypt } from '../utils/crypto.js';
import { isValidGlancesUrl, checkGlancesConnection, fetchGlancesData, discoverGlancesDevices } from '../utils/glances.js';

export default function glancesRoutes(db) {
  const router = Router();

  // ---------- Glances Config per Server ----------

  /**
   * GET /servers/:id/glances/config
   * Returns glances config for a server (password excluded).
   */
  router.get('/servers/:id/glances/config', (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    const config = db.prepare(
      'SELECT id, server_id, glances_url, glances_username, poll_interval_seconds, enabled, selected_devices, created_at, updated_at FROM glances_config WHERE server_id = ?'
    ).get(req.params.id);

    if (!config) return res.json(null);

    // Parse selected_devices JSON
    try { config.selected_devices = config.selected_devices ? JSON.parse(config.selected_devices) : null; } catch { config.selected_devices = null; }

    // Indicate whether password is set without revealing it
    const hasPassword = db.prepare('SELECT glances_password_enc FROM glances_config WHERE server_id = ?').get(req.params.id);
    config.has_password = !!(hasPassword?.glances_password_enc);

    res.json(config);
  });

  /**
   * POST /servers/:id/glances/config
   * Create or update Glances config (upsert).
   */
  router.post('/servers/:id/glances/config', (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    const { glances_url, glances_username, glances_password, poll_interval_seconds, enabled, selected_devices } = req.body;

    if (!glances_url) return res.status(400).json({ error: 'glances.url_required' });
    if (!isValidGlancesUrl(glances_url)) return res.status(400).json({ error: 'glances.invalid_url' });

    const passwordEnc = glances_password ? encrypt(glances_password) : null;
    const interval = poll_interval_seconds || 60;
    const isEnabled = enabled !== undefined ? (enabled ? 1 : 0) : 1;
    const devicesJson = selected_devices ? JSON.stringify(selected_devices) : null;

    const existing = db.prepare('SELECT id FROM glances_config WHERE server_id = ?').get(req.params.id);

    if (existing) {
      // Update — only update password if provided
      if (glances_password) {
        db.prepare(
          'UPDATE glances_config SET glances_url = ?, glances_username = ?, glances_password_enc = ?, poll_interval_seconds = ?, enabled = ?, selected_devices = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?'
        ).run(glances_url, glances_username || null, passwordEnc, interval, isEnabled, devicesJson, req.params.id);
      } else {
        db.prepare(
          'UPDATE glances_config SET glances_url = ?, glances_username = ?, poll_interval_seconds = ?, enabled = ?, selected_devices = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?'
        ).run(glances_url, glances_username || null, interval, isEnabled, devicesJson, req.params.id);
      }
    } else {
      db.prepare(
        'INSERT INTO glances_config (server_id, glances_url, glances_username, glances_password_enc, poll_interval_seconds, enabled, selected_devices) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, glances_url, glances_username || null, passwordEnc, interval, isEnabled, devicesJson);
    }

    const result = db.prepare(
      'SELECT id, server_id, glances_url, glances_username, poll_interval_seconds, enabled, selected_devices, created_at, updated_at FROM glances_config WHERE server_id = ?'
    ).get(req.params.id);
    result.has_password = !!(passwordEnc || (existing && !glances_password));
    try { result.selected_devices = result.selected_devices ? JSON.parse(result.selected_devices) : null; } catch { result.selected_devices = null; }

    const response = { ...result };
    if (!result.glances_username && !passwordEnc && !(existing && !glances_password)) {
      response.warning = 'glances.no_auth_warning';
    }

    res.status(existing ? 200 : 201).json(response);
  });

  /**
   * DELETE /servers/:id/glances/config
   */
  router.delete('/servers/:id/glances/config', (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    db.prepare('DELETE FROM glances_config WHERE server_id = ?').run(req.params.id);
    db.prepare('DELETE FROM glances_snapshots WHERE server_id = ?').run(req.params.id);
    res.status(204).end();
  });

  // ---------- Connection Test ----------

  /**
   * POST /servers/:id/glances/test
   * Test connectivity to a Glances instance.
   */
  router.post('/servers/:id/glances/test', async (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    // Use body params if provided (for testing before saving), otherwise use stored config
    let url = req.body.glances_url;
    let username = req.body.glances_username ?? null;
    let password = req.body.glances_password ?? null;

    if (!url) {
      const config = db.prepare('SELECT glances_url, glances_username, glances_password_enc FROM glances_config WHERE server_id = ?').get(req.params.id);
      if (!config) return res.status(400).json({ error: 'glances.no_config' });
      url = config.glances_url;
      username = config.glances_username;
      password = config.glances_password_enc ? decrypt(config.glances_password_enc) : null;
    }

    const result = await checkGlancesConnection(url, username, password);
    res.json(result);
  });

  // ---------- Device Discovery ----------

  /**
   * POST /servers/:id/glances/discover
   * Discover available devices (network interfaces, disks, sensors, GPUs).
   */
  router.post('/servers/:id/glances/discover', async (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    let url = req.body.glances_url;
    let username = req.body.glances_username ?? null;
    let password = req.body.glances_password ?? null;

    if (!url) {
      const config = db.prepare('SELECT glances_url, glances_username, glances_password_enc FROM glances_config WHERE server_id = ?').get(req.params.id);
      if (!config) return res.status(400).json({ error: 'glances.no_config' });
      url = config.glances_url;
      username = config.glances_username;
      password = config.glances_password_enc ? decrypt(config.glances_password_enc) : null;
    }

    const result = await discoverGlancesDevices(url, username, password);
    if (!result.ok) return res.status(502).json({ error: 'glances.discovery_failed', message: result.error });
    res.json(result.devices);
  });

  // ---------- Live Data Proxy ----------

  /**
   * GET /servers/:id/glances/current
   * Fetch live metrics from the Glances instance right now.
   */
  router.get('/servers/:id/glances/current', async (req, res) => {
    const config = db.prepare('SELECT glances_url, glances_username, glances_password_enc, selected_devices FROM glances_config WHERE server_id = ?').get(req.params.id);
    if (!config) return res.status(404).json({ error: 'glances.no_config' });

    const password = config.glances_password_enc ? decrypt(config.glances_password_enc) : null;
    let selectedDevices = null;
    try { selectedDevices = config.selected_devices ? JSON.parse(config.selected_devices) : null; } catch { /* ignore */ }
    const result = await fetchGlancesData(config.glances_url, config.glances_username, password, selectedDevices);

    if (!result.ok) return res.status(502).json({ error: 'glances.fetch_failed', message: result.error });
    res.json(result.data);
  });

  // ---------- History ----------

  /**
   * GET /servers/:id/glances/history
   * Query stored snapshots. Params: from, to (ISO dates), limit (number).
   */
  router.get('/servers/:id/glances/history', (req, res) => {
    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'servers.not_found' });

    let sql = 'SELECT * FROM glances_snapshots WHERE server_id = ?';
    const params = [req.params.id];

    if (req.query.from) {
      sql += ' AND timestamp >= ?';
      params.push(req.query.from);
    }
    if (req.query.to) {
      sql += ' AND timestamp <= ?';
      params.push(req.query.to);
    }

    sql += ' ORDER BY timestamp DESC';

    if (req.query.limit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 10000);
      sql += ' LIMIT ?';
      params.push(limit);
    } else {
      sql += ' LIMIT 1000';
    }

    const snapshots = db.prepare(sql).all(...params);

    // Parse JSON columns
    for (const snap of snapshots) {
      try { snap.disk_usage = snap.disk_usage_json ? JSON.parse(snap.disk_usage_json) : []; } catch { snap.disk_usage = []; }
      try { snap.gpu = snap.gpu_json ? JSON.parse(snap.gpu_json) : null; } catch { snap.gpu = null; }
      delete snap.disk_usage_json;
      delete snap.gpu_json;
    }

    res.json(snapshots);
  });

  // ---------- Global Settings ----------

  /**
   * GET /glances/settings
   */
  router.get('/glances/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM glances_settings LIMIT 1').get();
    res.json(settings || { retention_hours: 168, default_poll_interval: 60 });
  });

  /**
   * PUT /glances/settings
   */
  router.put('/glances/settings', (req, res) => {
    const { retention_hours, default_poll_interval } = req.body;
    const retH = retention_hours || 168;
    const pollInt = default_poll_interval || 60;

    const existing = db.prepare('SELECT id FROM glances_settings LIMIT 1').get();
    if (existing) {
      db.prepare('UPDATE glances_settings SET retention_hours = ?, default_poll_interval = ? WHERE id = ?').run(retH, pollInt, existing.id);
    } else {
      db.prepare('INSERT INTO glances_settings (retention_hours, default_poll_interval) VALUES (?, ?)').run(retH, pollInt);
    }

    const settings = db.prepare('SELECT * FROM glances_settings LIMIT 1').get();
    res.json(settings);
  });

  return router;
}
