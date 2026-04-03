import { Router } from 'express';
import { getUpcomingBilling } from '../utils/billing.js';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function dashboardRoutes(db) {
  const router = Router();

  router.get('/summary', (req, res) => {
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get().count;
    const activeServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'active'").get().count;
    const providerCount = db.prepare('SELECT COUNT(*) as count FROM providers').get().count;
    const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
    const pendingAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE sent = 0').get().count;
    const upcoming = getUpcomingBilling(db, 30);
    const upcomingBillingTotal = upcoming.reduce((sum, b) => sum + b.amount, 0);

    res.json({
      servers: { total: serverCount, active: activeServers },
      providers: providerCount,
      services: serviceCount,
      pending_alerts: pendingAlerts,
      upcoming_billing_total: upcomingBillingTotal,
      next_billing: upcoming[0] || null,
    });
  });

  router.get('/upcoming-billing', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const billing = getUpcomingBilling(db, days);
    res.json(billing);
  });

  router.get('/costs', (req, res) => {
    const totalMonthlyCost = db.prepare('SELECT COALESCE(SUM(monthly_cost), 0) as total FROM servers WHERE monthly_cost > 0').get().total;

    const costByProvider = db.prepare(`
      SELECT p.name, COALESCE(SUM(s.monthly_cost), 0) as total
      FROM servers s
      JOIN providers p ON s.provider_id = p.id
      WHERE s.monthly_cost > 0
      GROUP BY p.id, p.name
      ORDER BY total DESC
    `).all();

    const promoSavings = db.prepare(`
      SELECT COALESCE(SUM(regular_cost - monthly_cost), 0) as savings
      FROM servers
      WHERE promo_price = 1 AND regular_cost IS NOT NULL
    `).get().savings;

    const extraDiskCosts = db.prepare('SELECT COALESCE(SUM(monthly_cost), 0) as total FROM server_disks WHERE monthly_cost IS NOT NULL').get().total;
    const totalWithDisks = totalMonthlyCost + extraDiskCosts;

    res.json({
      total_monthly: totalWithDisks,
      total_yearly: totalWithDisks * 12,
      by_provider: costByProvider,
      promo_savings: promoSavings,
    });
  });

  router.get('/alerts', (req, res) => {
    const alerts = db.prepare(`
      SELECT a.*, s.name as server_name
      FROM alerts a
      LEFT JOIN servers s ON a.server_id = s.id
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
    const totalStorage = db.prepare('SELECT COALESCE(SUM(size_gb), 0) as total FROM server_disks').get().total;
    const diskCosts = db.prepare('SELECT COALESCE(SUM(monthly_cost), 0) as total FROM server_disks WHERE monthly_cost IS NOT NULL').get().total;
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
      disk_monthly_costs: diskCosts,
      total_ips: totalIps,
      by_os: serversByOs,
      by_location: serversByLocation,
    });
  });

  return router;
}
