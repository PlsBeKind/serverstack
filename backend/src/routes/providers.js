import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function providerRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const providers = db.prepare('SELECT * FROM providers ORDER BY name').all();
    res.json(providers);
  });

  router.get('/:id', (req, res) => {
    const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
    if (!provider) return res.status(404).json({ error: 'providers.not_found' });
    res.json(provider);
  });

  router.post('/', (req, res) => {
    const { name, website, support_email, support_phone, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'providers.name_required' });

    try {
      const result = db.prepare(
        'INSERT INTO providers (name, website, support_email, support_phone, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(name, website || null, support_email || null, support_phone || null, notes || null);
      const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(provider);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'providers.already_exists' });
      }
      throw err;
    }
  });

  router.put('/:id', (req, res) => {
    const { name, website, support_email, support_phone, notes } = req.body;
    const existing = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'providers.not_found' });

    db.prepare(`UPDATE providers SET name = ?, website = ?, support_email = ?, support_phone = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(name || existing.name, website ?? existing.website, support_email ?? existing.support_email, support_phone ?? existing.support_phone, notes ?? existing.notes, req.params.id);

    const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
    res.json(provider);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'providers.not_found' });

    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers WHERE provider_id = ?').get(req.params.id).count;
    if (serverCount > 0) {
      return res.status(409).json({ error: 'providers.has_servers' });
    }

    db.prepare('DELETE FROM providers WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
