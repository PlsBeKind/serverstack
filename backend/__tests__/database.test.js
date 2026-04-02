import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../src/database.js';

describe('Database', () => {
  let db;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('should create all tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);
    expect(tables).toContain('providers');
    expect(tables).toContain('servers');
    expect(tables).toContain('contracts');
    expect(tables).toContain('ip_addresses');
    expect(tables).toContain('services');
    expect(tables).toContain('alerts');
    expect(tables).toContain('users');
  });

  it('should have correct servers columns', () => {
    const cols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
    expect(cols).toContain('name');
    expect(cols).toContain('type');
    expect(cols).toContain('hostname');
    expect(cols).toContain('cpu_cores');
    expect(cols).toContain('ram_mb');
    expect(cols).toContain('storage_gb');
    expect(cols).toContain('storage_type');
    expect(cols).toContain('ssh_user');
    expect(cols).toContain('ssh_port');
    expect(cols).toContain('ssh_public_key');
    expect(cols).toContain('ssh_host_key');
    expect(cols).toContain('login_user');
    expect(cols).toContain('login_password_enc');
  });

  it('should have correct contracts columns (no provider_id)', () => {
    const cols = db.prepare("PRAGMA table_info(contracts)").all().map(c => c.name);
    expect(cols).toContain('server_id');
    expect(cols).toContain('contract_number');
    expect(cols).toContain('monthly_cost');
    expect(cols).toContain('regular_cost');
    expect(cols).toContain('promo_price');
    expect(cols).toContain('promo_end_date');
    expect(cols).not.toContain('provider_id');
    expect(cols).not.toContain('currency');
  });

  it('should have correct ip_addresses columns (version + type)', () => {
    const cols = db.prepare("PRAGMA table_info(ip_addresses)").all().map(c => c.name);
    expect(cols).toContain('version');
    expect(cols).toContain('type');
    expect(cols).not.toContain('is_primary');
  });

  it('should have correct services columns (category, url, docker)', () => {
    const cols = db.prepare("PRAGMA table_info(services)").all().map(c => c.name);
    expect(cols).toContain('category');
    expect(cols).toContain('url');
    expect(cols).toContain('docker');
    expect(cols).not.toContain('protocol');
  });

  it('should have correct alerts columns (trigger_date, days_before, sent)', () => {
    const cols = db.prepare("PRAGMA table_info(alerts)").all().map(c => c.name);
    expect(cols).toContain('contract_id');
    expect(cols).toContain('trigger_date');
    expect(cols).toContain('days_before');
    expect(cols).toContain('sent');
    expect(cols).toContain('sent_at');
    expect(cols).not.toContain('server_id');
    expect(cols).not.toContain('severity');
    expect(cols).not.toContain('is_read');
  });

  it('should enforce foreign key constraints', () => {
    expect(() => {
      db.prepare('INSERT INTO servers (provider_id, name) VALUES (999, ?)').run('test');
    }).toThrow();
  });

  it('should cascade delete servers when provider is deleted', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    db.prepare('INSERT INTO servers (provider_id, name) VALUES (?, ?)').run(pid, 'srv1');
    db.prepare('DELETE FROM providers WHERE id = ?').run(pid);
    const count = db.prepare('SELECT COUNT(*) as c FROM servers').get().c;
    expect(count).toBe(0);
  });

  it('should cascade delete contracts when server is deleted', () => {
    const pid = db.prepare('INSERT INTO providers (name) VALUES (?)').run('Test').lastInsertRowid;
    const sid = db.prepare('INSERT INTO servers (provider_id, name) VALUES (?, ?)').run(pid, 'srv1').lastInsertRowid;
    db.prepare('INSERT INTO contracts (server_id, monthly_cost) VALUES (?, ?)').run(sid, 10);
    db.prepare('DELETE FROM servers WHERE id = ?').run(sid);
    const count = db.prepare('SELECT COUNT(*) as c FROM contracts').get().c;
    expect(count).toBe(0);
  });
});
