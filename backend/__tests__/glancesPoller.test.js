import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestApp, seedProvider, seedServer } from './helpers.js';
import { encrypt } from '../src/utils/crypto.js';

// Mock the glances utility
vi.mock('../src/utils/glances.js', () => ({
  fetchGlancesData: vi.fn(),
  isValidGlancesUrl: vi.fn(() => true),
  checkGlancesConnection: vi.fn(),
}));

import { fetchGlancesData } from '../src/utils/glances.js';
import { pollGlances } from '../src/jobs/glancesPoller.js';

describe('Glances Poller', () => {
  let db;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!!';
    ({ db } = await createTestApp());
    vi.clearAllMocks();
  });

  it('should do nothing when no configs exist', async () => {
    await pollGlances(db);
    expect(fetchGlancesData).not.toHaveBeenCalled();
  });

  it('should poll enabled servers', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Polled Server');

    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, poll_interval_seconds, enabled)
      VALUES (?, ?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 60, 1);

    fetchGlancesData.mockResolvedValue({
      ok: true,
      data: {
        cpu_percent: 45.2,
        cpu_temp: 55,
        ram_total: 16000000000,
        ram_used: 8000000000,
        ram_percent: 50,
        swap_total: 4000000000,
        swap_used: 1000000000,
        swap_percent: 25,
        net_rx_rate: 102400,
        net_tx_rate: 51200,
        net_cumulative_rx: 1000000000,
        net_cumulative_tx: 500000000,
        disk_usage: [{ mount_point: '/', percent: 60, total: 100000000000, used: 60000000000 }],
        gpu: [],
        uptime: '5 days',
        load_1: 1.5,
        load_5: 1.2,
        load_15: 0.9,
      },
    });

    await pollGlances(db);

    expect(fetchGlancesData).toHaveBeenCalledWith('http://10.0.0.1:61208', null, null, null);

    const snapshots = db.prepare('SELECT * FROM glances_snapshots WHERE server_id = ?').all(serverId);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].cpu_percent).toBe(45.2);
    expect(snapshots[0].ram_percent).toBe(50);
    expect(snapshots[0].uptime).toBe('5 days');
  });

  it('should skip disabled servers', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Disabled');

    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, enabled)
      VALUES (?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 0);

    await pollGlances(db);
    expect(fetchGlancesData).not.toHaveBeenCalled();
  });

  it('should skip servers polled recently', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Recent');

    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, poll_interval_seconds, enabled)
      VALUES (?, ?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 300, 1);

    // Insert a recent snapshot
    db.prepare('INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent) VALUES (?, ?, ?)').run(
      serverId, new Date().toISOString(), 20
    );

    await pollGlances(db);
    expect(fetchGlancesData).not.toHaveBeenCalled();
  });

  it('should decrypt password for authenticated servers', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Auth Server');

    const encPw = encrypt('glances-pass');
    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, glances_username, glances_password_enc, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 'admin', encPw, 1);

    fetchGlancesData.mockResolvedValue({ ok: true, data: { cpu_percent: 10 } });

    await pollGlances(db);
    expect(fetchGlancesData).toHaveBeenCalledWith('http://10.0.0.1:61208', 'admin', 'glances-pass', null);
  });

  it('should continue on fetch failure', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Fail Server');

    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, enabled)
      VALUES (?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 1);

    fetchGlancesData.mockResolvedValue({ ok: false, error: 'Connection refused' });

    await pollGlances(db);

    const snapshots = db.prepare('SELECT * FROM glances_snapshots WHERE server_id = ?').all(serverId);
    expect(snapshots).toHaveLength(0);
  });

  it('should clean up old snapshots based on retention', async () => {
    const providerId = seedProvider(db);
    const serverId = seedServer(db, providerId, 'Cleanup');

    // Need an enabled config so poller doesn't skip
    db.prepare(`
      INSERT INTO glances_config (server_id, glances_url, poll_interval_seconds, enabled)
      VALUES (?, ?, ?, ?)
    `).run(serverId, 'http://10.0.0.1:61208', 99999, 1);

    // Insert a very recent snapshot so polling is skipped (interval = 99999s)
    const recent = new Date().toISOString();
    db.prepare('INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent) VALUES (?, ?, ?)').run(serverId, recent, 50);

    // Set short retention
    db.prepare('UPDATE glances_settings SET retention_hours = 1').run();

    // Insert old snapshot
    const old = new Date(Date.now() - 2 * 3600000).toISOString();
    db.prepare('INSERT INTO glances_snapshots (server_id, timestamp, cpu_percent) VALUES (?, ?, ?)').run(serverId, old, 10);

    await pollGlances(db);

    const remaining = db.prepare('SELECT * FROM glances_snapshots WHERE server_id = ?').all(serverId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].cpu_percent).toBe(50);
  });
});
