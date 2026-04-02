import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function contractRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const contracts = db.prepare(`
      SELECT c.*, s.name as server_name, p.name as provider_name
      FROM contracts c
      LEFT JOIN servers s ON c.server_id = s.id
      LEFT JOIN providers p ON s.provider_id = p.id
      ORDER BY c.end_date
    `).all();
    res.json(contracts);
  });

  router.get('/expiring', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const contracts = db.prepare(`
      SELECT c.*, s.name as server_name, p.name as provider_name
      FROM contracts c
      LEFT JOIN servers s ON c.server_id = s.id
      LEFT JOIN providers p ON s.provider_id = p.id
      WHERE c.next_cancellation_date IS NOT NULL
        AND date(c.next_cancellation_date) <= date('now', '+' || ? || ' days')
      ORDER BY c.next_cancellation_date
    `).all(days);
    res.json(contracts);
  });

  router.get('/:id', (req, res) => {
    const contract = db.prepare(`
      SELECT c.*, s.name as server_name, p.name as provider_name
      FROM contracts c
      LEFT JOIN servers s ON c.server_id = s.id
      LEFT JOIN providers p ON s.provider_id = p.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'contracts.not_found' });
    res.json(contract);
  });

  router.post('/', (req, res) => {
    const {
      server_id, contract_number, monthly_cost, regular_cost,
      billing_cycle, start_date, end_date,
      cancellation_period_days, next_cancellation_date,
      auto_renew, promo_price, promo_end_date, contract_period, is_cancelled, notes
    } = req.body;

    if (!server_id) {
      return res.status(400).json({ error: 'contracts.missing_fields' });
    }

    const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(server_id);
    if (!server) return res.status(400).json({ error: 'contracts.invalid_server' });

    const result = db.prepare(`
      INSERT INTO contracts (server_id, contract_number, monthly_cost, regular_cost, billing_cycle, start_date, end_date, cancellation_period_days, next_cancellation_date, auto_renew, promo_price, promo_end_date, contract_period, is_cancelled, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      server_id, contract_number || null,
      monthly_cost || 0, regular_cost || null,
      billing_cycle || 'monthly', start_date || null, end_date || null,
      cancellation_period_days || 30, next_cancellation_date || null,
      auto_renew !== undefined ? (auto_renew ? 1 : 0) : 1,
      promo_price ? 1 : 0, promo_end_date || null,
      contract_period || null, is_cancelled ? 1 : 0, notes || null
    );

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contract);
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'contracts.not_found' });

    const {
      server_id, contract_number, monthly_cost, regular_cost,
      billing_cycle, start_date, end_date,
      cancellation_period_days, next_cancellation_date,
      auto_renew, promo_price, promo_end_date, contract_period, is_cancelled, notes
    } = req.body;

    db.prepare(`
      UPDATE contracts SET
        server_id = ?, contract_number = ?, monthly_cost = ?, regular_cost = ?,
        billing_cycle = ?, start_date = ?, end_date = ?,
        cancellation_period_days = ?, next_cancellation_date = ?,
        auto_renew = ?, promo_price = ?, promo_end_date = ?,
        contract_period = ?, is_cancelled = ?, notes = ?
      WHERE id = ?
    `).run(
      server_id ?? existing.server_id, contract_number ?? existing.contract_number,
      monthly_cost ?? existing.monthly_cost, regular_cost ?? existing.regular_cost,
      billing_cycle ?? existing.billing_cycle, start_date ?? existing.start_date,
      end_date ?? existing.end_date, cancellation_period_days ?? existing.cancellation_period_days,
      next_cancellation_date ?? existing.next_cancellation_date,
      auto_renew !== undefined ? (auto_renew ? 1 : 0) : existing.auto_renew,
      promo_price !== undefined ? (promo_price ? 1 : 0) : existing.promo_price,
      promo_end_date ?? existing.promo_end_date,
      contract_period ?? existing.contract_period,
      is_cancelled !== undefined ? (is_cancelled ? 1 : 0) : existing.is_cancelled,
      notes ?? existing.notes,
      req.params.id
    );

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    res.json(contract);
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'contracts.not_found' });

    db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
