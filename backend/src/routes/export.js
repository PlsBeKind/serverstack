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
      contracts: db.prepare('SELECT * FROM contracts').all(),
      ip_addresses: db.prepare('SELECT * FROM ip_addresses').all(),
      services: db.prepare('SELECT * FROM services').all(),
      exported_at: new Date().toISOString(),
      version: '1.0.0',
    };
    data.servers = data.servers.map(({ login_password_enc, ...rest }) => rest);
    res.json(data);
  });

  router.post('/import', (req, res) => {
    const { providers, servers, contracts, ip_addresses, services } = req.body;

    if (!providers || !servers) {
      return res.status(400).json({ error: 'export.invalid_format' });
    }

    const importData = db.transaction(() => {
      const providerMap = {};
      const serverMap = {};
      let importedCount = { providers: 0, servers: 0, contracts: 0, ip_addresses: 0, services: 0 };

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
          INSERT INTO servers (provider_id, name, type, hostname, location, os, cpu_cores, ram_mb, storage_gb, storage_type, status, notes, ssh_user, ssh_port, ssh_public_key, ssh_host_key, login_user)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mappedProviderId, s.name, s.type, s.hostname, s.location, s.os,
          s.cpu_cores, s.ram_mb, s.storage_gb, s.storage_type, s.status, s.notes,
          s.ssh_user, s.ssh_port, s.ssh_public_key, s.ssh_host_key, s.login_user
        );
        serverMap[s.id] = result.lastInsertRowid;
        importedCount.servers++;
      }

      if (contracts) {
        for (const c of contracts) {
          const mappedServerId = serverMap[c.server_id];
          if (!mappedServerId) continue;
          db.prepare(`
            INSERT INTO contracts (server_id, contract_number, monthly_cost, regular_cost, billing_cycle, start_date, end_date, cancellation_period_days, next_cancellation_date, auto_renew, promo_price, promo_end_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            mappedServerId, c.contract_number, c.monthly_cost, c.regular_cost,
            c.billing_cycle, c.start_date, c.end_date,
            c.cancellation_period_days, c.next_cancellation_date,
            c.auto_renew, c.promo_price, c.promo_end_date, c.notes
          );
          importedCount.contracts++;
        }
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

      return importedCount;
    });

    const result = importData();
    res.json({ message: 'export.import_success', imported: result });
  });

  return router;
}
