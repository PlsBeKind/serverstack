import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Cog, ExternalLink, Container } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

const CAT_COLORS = { web: '#10b981', database: '#3b82f6', monitoring: '#f59e0b', media: '#8b5cf6', other: '#6b7280' };
const CATEGORIES = ['web', 'database', 'monitoring', 'media', 'other'];

export default function ServicesPage() {
  const { t } = useTranslation('servers');
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (category) => {
    const params = {};
    if (category) params.category = category;
    api.getServices(params).then(setServices).finally(() => setLoading(false));
  };

  useEffect(() => { load(activeCategory); }, []);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.server_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.domain?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by server
  const grouped = {};
  for (const svc of filtered) {
    const key = svc.server_name || `Server #${svc.server_id}`;
    if (!grouped[key]) grouped[key] = { provider: svc.provider_name, serverId: svc.server_id, services: [] };
    grouped[key].services.push(svc);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('all_services')}</h1>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setActiveCategory(''); load(''); }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!activeCategory ? 'text-white' : 'hover:bg-white/5'}`}
          style={!activeCategory ? { background: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => { setActiveCategory(cat); load(cat); }}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={activeCategory === cat
              ? { background: `${CAT_COLORS[cat]}30`, color: CAT_COLORS[cat], border: `1px solid ${CAT_COLORS[cat]}` }
              : { color: 'var(--color-text-muted)', border: '1px solid transparent' }}>
            {t(`category_${cat}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common:actions.search')}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      </div>

      {loading ? (
        <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <Cog size={48} className="mx-auto mb-4 opacity-20" />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([serverName, data]) => (
            <div key={serverName}>
              <div className="flex items-center gap-2 mb-2">
                <Link to={`/servers/${data.serverId}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                  {serverName}
                </Link>
                {data.provider && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.provider}</span>}
              </div>
              <div className="space-y-2">
                {data.services.map(svc => (
                  <div key={svc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover-lift"
                    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                    <StatusBadge status={svc.status} />
                    <span className="font-semibold">{svc.name}</span>
                    {svc.category && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: `${CAT_COLORS[svc.category] || '#6b7280'}20`, color: CAT_COLORS[svc.category] || '#6b7280' }}>
                        {t(`category_${svc.category}`, svc.category)}
                      </span>
                    )}
                    {svc.domain && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{svc.domain}</span>}
                    {svc.port && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>:{svc.port}</span>}
                    {svc.protocol && <span className="text-[10px] uppercase" style={{ color: 'var(--color-text-muted)' }}>{svc.protocol}</span>}
                    {svc.docker ? <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: '#06469520', color: '#0ea5e9' }}>Docker</span> : null}
                    {svc.url && (
                      <a href={svc.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs hover:underline"
                        style={{ color: 'var(--color-primary)' }} onClick={e => e.stopPropagation()}>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
