import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function tagRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const tags = db.prepare('SELECT * FROM tags ORDER BY is_preset DESC, name').all();
    res.json(tags);
  });

  router.post('/', (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'tags.name_required' });

    try {
      const result = db.prepare('INSERT INTO tags (name, color, is_preset) VALUES (?, ?, 0)')
        .run(name, color || '#6b7280');
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(tag);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'tags.already_exists' });
      }
      throw err;
    }
  });

  router.delete('/:id', (req, res) => {
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    if (!tag) return res.status(404).json({ error: 'tags.not_found' });
    if (tag.is_preset) return res.status(403).json({ error: 'tags.cannot_delete_preset' });

    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
