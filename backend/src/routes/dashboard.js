import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function dashboardRoutes(db) {
  const router = Router();

  router.get('/summary', (req, res) => {
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get().count;
    const activeServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'active'").get().count;
    const providerCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;
    const contractCount = db.prepare('SELECT COUNT(*) as count FROM contracts').get().count;
    const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
    const pendingAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE sent = 0').get().count;

    res.json({
      servers: { total: serverCount, active: activeServers },
      providers: providerCount,
      contracts: contractCount,
      services: serviceCount,
      pending_alerts: pendingAlerts,
    });
  });

  router.get('/costs', (req, res) => {
    const totalMonthlyCost = db.prepare('SELECT COALESCE(SUM(monthly_cost), 0) as total FROM contracts').get().total;

    const costByProvider = db.prepare(`
      SELECT p.name, COALESCE(SUM(c.monthly_cost), 0) as total
      FROM contracts c
      JOIN servers s ON c.server_id = s.id
      JOIN providers p ON s.provider_id = p.id
      GROUP BY p.id, p.name
      ORDER BY total DESC
    `).all();

    const promoSavings = db.prepare(`
      SELECT COALESCE(SUM(regular_cost - monthly_cost), 0) as savings
      FROM contracts
      WHERE promo_price = 1 AND regular_cost IS NOT NULL
    `).get().savings;

    res.json({
      total_monthly: totalMonthlyCost,
      total_yearly: totalMonthlyCost * 12,
      by_provider: costByProvider,
      promo_savings: promoSavings,
    });
  });

  router.get('/alerts', (req, res) => {
    const alerts = db.prepare(`
      SELECT a.*, s.name as server_name
      FROM alerts a
      LEFT JOIN contracts c ON a.contract_id = c.id
      LEFT JOIN servers s ON c.server_id = s.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `).all();
    res.json(alerts);
  });

  router.put('/alerts/:id/read', (req, res) => {
    db.prepare("UPDATE alerts SET sent = 1, sent_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: 'alerts.marked_read' });
  });

  router.put('/alerts/read-all', (req, res) => {
    db.prepare("UPDATE alerts SET sent = 1, sent_at = datetime('now') WHERE sent = 0").run();
    res.json({ message: 'alerts.all_marked_read' });
  });

  router.get('/resources', (req, res) => {
    const totalCores = db.prepare('SELECT COALESCE(SUM(cpu_cores), 0) as total FROM servers').get().total;
    const totalRam = db.prepare('SELECT COALESCE(SUM(ram_mb), 0) as total FROM servers').get().total;
    const totalStorage = db.prepare('SELECT COALESCE(SUM(storage_gb), 0) as total FROM servers').get().total;
    const totalIps = db.prepare('SELECT COUNT(*) as count FROM ip_addresses').get().count;

    const serversByOs = db.prepare(`
      SELECT os, COUNT(*) as count FROM servers WHERE os IS NOT NULL GROUP BY os ORDER BY count DESC
    `).all();

    const serversByLocation = db.prepare(`
      SELECT location, COUNT(*) as count FROM servers WHERE location IS NOT NULL GROUP BY location ORDER BY count DESC
    `).all();

    res.json({
      total_cores: totalCores,
      total_ram_mb: totalRam,
      total_storage_gb: totalStorage,
      total_ips: totalIps,
      by_os: serversByOs,
      by_location: serversByLocation,
    });
  });

  return router;
}
