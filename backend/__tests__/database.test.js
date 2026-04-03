import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../src/database.js';

describe('Database', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase(':memory:');
  });

  it('should create all tables (no contracts table after migration 003)', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);
    expect(tables).toContain('providers');
    expect(tables).toContain('servers');
    expect(tables).toContain('server_credentials');
    expect(tables).toContain('server_disks');
    expect(tables).toContain('ip_addresses');
    expect(tables).toContain('services');
    expect(tables).toContain('alerts');
    expect(tables).toContain('users');
    expect(tables).not.toContain('contracts');
  });

  it('should have contract fields on servers', () => {
    const cols = db.prepare("PRAGMA table_info(servers)").all().map(c => c.name);
    expect(cols).toContain('name');
    expect(cols).toContain('type');
    expect(cols).toContain('hostname');
    expect(cols).toContain('cpu_cores');
    expect(cols).toContain('ram_mb');
    expect(cols).toContain('storage_gb');
    expect(cols).toContain('contract_number');
    expect(cols).toContain('monthly_cost');
    expect(cols).toContain('regular_cost');
    expect(cols).toContain('billing_cycle');
    expect(cols).toContain('contract_period');
    expect(cols).toContain('is_cancelled');
    expect(cols).toContain('contract_notes');
  });

  it('should have correct ip_addresses columns', () => {
    const cols = db.prepare("PRAGMA table_info(ip_addresses)").all().map(c => c.name);
    expect(cols).toContain('version');
    expect(cols).toContain('type');
  });

  it('should have correct services columns', () => {
    const cols = db.prepare("PRAGMA table_info(services)").all().map(c => c.name);
    expect(cols).toContain('category');
    expect(cols).toContain('url');
    expect(cols).toContain('docker');
  });

  it('should have alerts with server_id', () => {
    const cols = db.prepare("PRAGMA table_info(alerts)").all().map(c => c.name);
    expect(cols).toContain('server_id');
    expect(cols).toContain('trigger_date');
    expect(cols).toContain('sent');
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
});
