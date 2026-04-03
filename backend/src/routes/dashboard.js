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
    const upcoming = getUpcomingBilling(db);
    const upcomingBillingTotal = upcoming
      .filter(b => b.days_until !== null && b.days_until >= 0 && b.days_until <= 30)
      .reduce((sum, b) => sum + b.amount, 0);

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
    const billing = getUpcomingBilling(db);
    res.json(billing);
  });

  router.get('/cost-trend', (req, res) => {
    // Get total monthly cost for each of the last 12 months
    // Uses cost_history to reconstruct what the total was at the end of each month
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthEnd = `${year}-${month}-${String(new Date(year, d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
      const label = `${year}-${month}`;

      // Sum up the latest known cost per server as of that month-end
      const total = db.prepare(`
        SELECT COALESCE(SUM(latest_cost), 0) as total FROM (
          SELECT ch.server_id, ch.new_cost as latest_cost
          FROM cost_history ch
          WHERE ch.changed_at <= ? || ' 23:59:59'
          AND ch.id = (
            SELECT id FROM cost_history ch2
            WHERE ch2.server_id = ch.server_id
            AND ch2.changed_at <= ? || ' 23:59:59'
            ORDER BY ch2.changed_at DESC LIMIT 1
          )
          GROUP BY ch.server_id
        )
      `).get(monthEnd, monthEnd).total;

      months.push({ month: label, total });
    }
    res.json(months);
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

    // IP breakdown: single IPs vs subnets, by version
    const ipv4_single = db.prepare("SELECT COUNT(*) as count FROM ip_addresses WHERE version = 'ipv4' AND address NOT LIKE '%/%'").get().count;
    const ipv4_subnets = db.prepare("SELECT COUNT(*) as count FROM ip_addresses WHERE version = 'ipv4' AND address LIKE '%/%'").get().count;
    const ipv6_single = db.prepare("SELECT COUNT(*) as count FROM ip_addresses WHERE version = 'ipv6' AND address NOT LIKE '%/%'").get().count;
    const ipv6_subnets = db.prepare("SELECT COUNT(*) as count FROM ip_addresses WHERE version = 'ipv6' AND address LIKE '%/%'").get().count;

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
      ipv4_addresses: ipv4_single,
      ipv4_subnets: ipv4_subnets,
      ipv6_addresses: ipv6_single,
      ipv6_subnets: ipv6_subnets,
      by_os: serversByOs,
      by_location: serversByLocation,
    });
  });

  return router;
}
