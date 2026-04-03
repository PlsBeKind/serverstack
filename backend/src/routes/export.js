import { Router } from 'express';

/**
 * @param {import('better-sqlite3').Database} db
 */
export default function exportRoutes(db) {
  const router = Router();

  router.get('/export', (req, res) => {
    const data = {
      providers: db.prepare('SELECT * FROM providers').all(),
      servers: db.prepare('SELECT * FROM servers').all(),
      ip_addresses: db.prepare('SELECT * FROM ip_addresses').all(),
      services: db.prepare('SELECT * FROM services').all(),
      server_credentials: db.prepare('SELECT id, server_id, label, username, notes, created_at FROM server_credentials').all(),
      exported_at: new Date().toISOString(),
      version: '1.1.0',
    };
    res.json(data);
  });

  router.post('/import', (req, res) => {
    const { providers, servers, ip_addresses, services, server_credentials } = req.body;

    if (!providers || !servers) {
      return res.status(400).json({ error: 'export.invalid_format' });
    }

    const importData = db.transaction(() => {
      const providerMap = {};
      const serverMap = {};
      let importedCount = { providers: 0, servers: 0, ip_addresses: 0, services: 0, server_credentials: 0 };

      for (const p of providers) {
        const existing = db.prepare('SELECT id FROM providers WHERE name = ?').get(p.name);
        if (existing) {
          providerMap[p.id] = existing.id;
        } else {
          const result = db.prepare('INSERT INTO providers (name, website, support_email, support_phone, notes) VALUES (?, ?, ?, ?, ?)')
            .run(p.name, p.website, p.support_email, p.support_phone, p.notes);
          providerMap[p.id] = result.lastInsertRowid;
          importedCount.providers++;
        }
      }

      for (const s of servers) {
        const mappedProviderId = providerMap[s.provider_id];
        if (!mappedProviderId) continue;
        const result = db.prepare(`
          INSERT INTO servers (provider_id, name, type, hostname, location, os, cpu_cores, ram_mb, storage_gb, storage_type, status, notes, ssh_user, ssh_port, ssh_public_key, ssh_host_key, contract_number, monthly_cost, regular_cost, billing_cycle, contract_start_date, contract_end_date, cancellation_period_days, next_cancellation_date, auto_renew, promo_price, promo_end_date, contract_period, is_cancelled, contract_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mappedProviderId, s.name, s.type, s.hostname, s.location, s.os,
          s.cpu_cores, s.ram_mb, s.storage_gb, s.storage_type, s.status, s.notes,
          s.ssh_user, s.ssh_port, s.ssh_public_key, s.ssh_host_key,
          s.contract_number, s.monthly_cost, s.regular_cost, s.billing_cycle,
          s.contract_start_date, s.contract_end_date, s.cancellation_period_days,
          s.next_cancellation_date, s.auto_renew, s.promo_price, s.promo_end_date,
          s.contract_period, s.is_cancelled, s.contract_notes
        );
        serverMap[s.id] = result.lastInsertRowid;
        importedCount.servers++;
      }

      if (ip_addresses) {
        for (const ip of ip_addresses) {
          const mappedServerId = serverMap[ip.server_id];
          if (!mappedServerId) continue;
          db.prepare('INSERT INTO ip_addresses (server_id, address, version, type, rdns, notes) VALUES (?, ?, ?, ?, ?, ?)')
            .run(mappedServerId, ip.address, ip.version, ip.type, ip.rdns, ip.notes);
          importedCount.ip_addresses++;
        }
      }

      if (services) {
        for (const svc of services) {
          const mappedServerId = serverMap[svc.server_id];
          if (!mappedServerId) continue;
          db.prepare('INSERT INTO services (server_id, name, category, port, url, docker, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(mappedServerId, svc.name, svc.category, svc.port, svc.url, svc.docker, svc.status, svc.notes);
          importedCount.services++;
        }
      }

      if (server_credentials) {
        for (const cred of server_credentials) {
          const mappedServerId = serverMap[cred.server_id];
          if (!mappedServerId) continue;
          db.prepare('INSERT INTO server_credentials (server_id, label, username, notes) VALUES (?, ?, ?, ?)')
            .run(mappedServerId, cred.label, cred.username, cred.notes);
          importedCount.server_credentials++;
        }
      }

      return importedCount;
    });

    const result = importData();
    res.json({ message: 'export.import_success', imported: result });
  });

  return router;
}
