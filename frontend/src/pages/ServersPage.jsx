import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Server, ExternalLink } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ServersPage() {
  const { t } = useTranslation('servers');
  const [servers, setServers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getServers().then(setServers).finally(() => setLoading(false));
  }, []);

  const filtered = servers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.hostname?.toLowerCase().includes(search.toLowerCase()) ||
    s.provider_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('title')}</h1>
        <Link to="/servers/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02]"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> {t('add_server')}
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common:actions.search')}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      {loading ? (
        <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Server size={48} className="mx-auto mb-4 opacity-20" />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(server => (
            <Link key={server.id} to={`/servers/${server.id}`}
              className="rounded-xl p-5 group hover-lift block"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-emerald-400 transition-colors">{server.name}</h3>
                  {server.hostname && <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{server.hostname}</p>}
                </div>
                <StatusBadge status={server.status} />
              </div>
              <div className="space-y-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {server.provider_name && <p>{t('provider')}: {server.provider_name}</p>}
                {server.type && <p className="capitalize">{t(`type_${server.type}`, server.type)}</p>}
                {server.os && <p>{server.os}</p>}
                <div className="flex gap-4 pt-2">
                  {server.cpu_cores && <span className="font-mono">{server.cpu_cores} {t('cpu_cores')}</span>}
                  {server.ram_mb && <span className="font-mono">{server.ram_mb} MB</span>}
                  {server.storage_gb && <span className="font-mono">{server.storage_gb} GB</span>}
                </div>
              </div>
              <div className="mt-3 pt-3 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                <ExternalLink size={12} /> {t('server_detail')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
