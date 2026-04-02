import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function ipRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const ips = db.prepare(`
      SELECT ip.*, s.name as server_name
      FROM ip_addresses ip
      LEFT JOIN servers s ON ip.server_id = s.id
      ORDER BY ip.address
    `).all();
    res.json(ips);
  });

  router.get('/:id', (req, res) => {
    const ip = db.prepare('SELECT * FROM ip_addresses WHERE id = ?').get(req.params.id);
    if (!ip) return res.status(404).json({ error: 'ips.not_found' });
    res.json(ip);
  });

  router.post('/', (req, res) => {
    const { server_id, address, version, type, rdns, notes } = req.body;
    if (!server_id || !address) {
      return res.status(400).json({ error: 'ips.missing_fields' });
    }

    const result = db.prepare(
      'INSERT INTO ip_addresses (server_id, address, version, type, rdns, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(server_id, address, version || 'ipv4', type || 'primary', rdns || null, notes || null);

    const ip = db.prepare('SELECT * FROM ip_addresses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(ip);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM ip_addresses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'ips.not_found' });

    const { server_id, address, version, type, rdns, notes } = req.body;
    db.prepare(
      'UPDATE ip_addresses SET server_id = ?, address = ?, version = ?, type = ?, rdns = ?, notes = ? WHERE id = ?'
    ).run(
      server_id ?? existing.server_id, address ?? existing.address,
      version ?? existing.version, type ?? existing.type,
      rdns ?? existing.rdns, notes ?? existing.notes, req.params.id
    );

    const ip = db.prepare('SELECT * FROM ip_addresses WHERE id = ?').get(req.params.id);
    res.json(ip);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM ip_addresses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'ips.not_found' });

    db.prepare('DELETE FROM ip_addresses WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
