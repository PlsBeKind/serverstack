import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function serviceRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { category, domain } = req.query;

    let sql = `
      SELECT svc.*, s.name as server_name, p.name as provider_name
      FROM services svc
      LEFT JOIN servers s ON svc.server_id = s.id
      LEFT JOIN providers p ON s.provider_id = p.id
    `;
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('svc.category = ?');
      params.push(category);
    }
    if (domain) {
      conditions.push('svc.domain LIKE ?');
      params.push(`%${domain}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.name, svc.name';

    const services = db.prepare(sql).all(...params);
    res.json(services);
  });

  router.get('/:id', (req, res) => {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!service) return res.status(404).json({ error: 'services.not_found' });
    res.json(service);
  });

  router.post('/', (req, res) => {
    const { server_id, name, category, port, url, domain, protocol, docker, status, notes } = req.body;
    if (!server_id || !name) {
      return res.status(400).json({ error: 'services.missing_fields' });
    }

    const result = db.prepare(
      'INSERT INTO services (server_id, name, category, port, url, domain, protocol, docker, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(server_id, name, category || null, port || null, url || null, domain || null, protocol || 'tcp', docker ? 1 : 0, status || 'running', notes || null);

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(service);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'services.not_found' });

    const { server_id, name, category, port, url, domain, protocol, docker, status, notes } = req.body;
    db.prepare(
      'UPDATE services SET server_id = ?, name = ?, category = ?, port = ?, url = ?, domain = ?, protocol = ?, docker = ?, status = ?, notes = ? WHERE id = ?'
    ).run(
      server_id ?? existing.server_id, name ?? existing.name,
      category ?? existing.category, port ?? existing.port,
      url ?? existing.url, domain ?? existing.domain,
      protocol ?? existing.protocol,
      docker !== undefined ? (docker ? 1 : 0) : existing.docker,
      status ?? existing.status, notes ?? existing.notes, req.params.id
    );

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    res.json(service);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'services.not_found' });

    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
