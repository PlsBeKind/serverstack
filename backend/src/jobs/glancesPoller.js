import { decrypt } from '../utils/crypto.js';
import { fetchGlancesData } from '../utils/glances.js';

/**
 * Poll all enabled Glances instances and store snapshots.
 * Called periodically from the cron scheduler.
 * @param {import('better-sqlite3').Database} db
 */
export async function pollGlances(db) {
  const configs = db.prepare(
    'SELECT gc.*, s.name as server_name FROM glances_config gc JOIN servers s ON gc.server_id = s.id WHERE gc.enabled = 1'
  ).all();

  if (configs.length === 0) return;

  const now = new Date();

  for (const config of configs) {
    try {
      // Check if enough time has passed since last snapshot
      const lastSnapshot = db.prepare(
        'SELECT timestamp FROM glances_snapshots WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(config.server_id);

      if (lastSnapshot) {
        const lastTime = new Date(lastSnapshot.timestamp).getTime();
        const elapsed = (now.getTime() - lastTime) / 1000;
        if (elapsed < config.poll_interval_seconds) continue;
      }

      const password = config.glances_password_enc ? decrypt(config.glances_password_enc) : null;
      let selectedDevices = null;
      try { selectedDevices = config.selected_devices ? JSON.parse(config.selected_devices) : null; } catch { /* ignore */ }
      const result = await fetchGlancesData(config.glances_url, config.glances_username, password, selectedDevices);

      if (!result.ok) {
        console.warn(`Glances poll failed for server "${config.server_name}" (${config.glances_url}): ${result.error}`);
        continue;
      }

      const d = result.data;
      db.prepare(`
        INSERT INTO glances_snapshots (
          server_id, timestamp, cpu_percent, cpu_temp,
          ram_total, ram_used, ram_percent,
          swap_total, swap_used, swap_percent,
          net_rx_rate, net_tx_rate, net_cumulative_rx, net_cumulative_tx,
          disk_usage_json, gpu_json,
          uptime, load_1, load_5, load_15
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        config.server_id,
        now.toISOString(),
        d.cpu_percent,
        d.cpu_temp,
        d.ram_total,
        d.ram_used,
        d.ram_percent,
        d.swap_total,
        d.swap_used,
        d.swap_percent,
        d.net_rx_rate,
        d.net_tx_rate,
        d.net_cumulative_rx,
        d.net_cumulative_tx,
        d.disk_usage ? JSON.stringify(d.disk_usage) : null,
        d.gpu ? JSON.stringify(d.gpu) : null,
        d.uptime,
        d.load_1,
        d.load_5,
        d.load_15
      );
    } catch (err) {
      console.error(`Glances poller error for server_id=${config.server_id}:`, err.message);
    }
  }

  // Cleanup old snapshots based on retention settings
  try {
    const settings = db.prepare('SELECT retention_hours FROM glances_settings LIMIT 1').get();
    const retentionHours = settings?.retention_hours || 168;
    const cutoff = new Date(now.getTime() - retentionHours * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM glances_snapshots WHERE timestamp < ?').run(cutoff);
  } catch (err) {
    console.error('Glances retention cleanup error:', err.message);
  }
}
