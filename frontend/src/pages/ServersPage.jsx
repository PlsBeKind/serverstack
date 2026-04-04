import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Server, ExternalLink, Copy, Check, Cpu, HardDrive } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import CostBadge from '../components/CostBadge.jsx';
import TagPill from '../components/TagPill.jsx';

export default function ServersPage() {
  const { t } = useTranslation('servers');
  const [servers, setServers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [activeTag, setActiveTag] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadServers = (tag) => {
    const url = tag ? `?tag=${tag}` : '';
    api.getServers().then(data => {
      setServers(tag ? data.filter(s => s.tags?.some(t => t.name === tag)) : data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadServers(activeTag);
    api.getTags().then(setAllTags);
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

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => { setActiveTag(''); loadServers(''); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${!activeTag ? 'text-white' : 'hover:bg-white/5'}`}
            style={!activeTag ? { background: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag.id} onClick={() => { setActiveTag(tag.name); loadServers(tag.name); }}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={activeTag === tag.name
                ? { background: `${tag.color}30`, color: tag.color, border: `1px solid ${tag.color}` }
                : { color: 'var(--color-text-muted)', border: '1px solid transparent' }}>
              {tag.is_preset ? t(`tag_${tag.name}`, tag.name) : tag.name}
            </button>
          ))}
        </div>
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(server => (
            <Link key={server.id} to={`/servers/${server.id}`}
              className="rounded-xl p-5 group hover-lift flex flex-col"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm group-hover:text-emerald-400 transition-colors truncate">{server.name}</h3>
                  {server.hostname && <p className="font-mono text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{server.hostname}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {server.monthly_cost > 0 && <CostBadge amount={server.monthly_cost} />}
                  <StatusBadge status={server.status} />
                </div>
              </div>

              {/* Primary IPv4 with copy */}
              {server.primary_ipv4 && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-surface)' }}>
                  <span className="font-mono text-xs flex-1 truncate" style={{ color: 'var(--color-text)' }}>{server.primary_ipv4}</span>
                  <button onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    const text = server.primary_ipv4;
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard.writeText(text);
                    } else {
                      const ta = document.createElement('textarea');
                      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                      document.body.removeChild(ta);
                    }
                    setCopiedId(server.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-all shrink-0"
                    style={{ color: copiedId === server.id ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                    {copiedId === server.id ? <><Check size={12} /><span className="text-[10px] font-medium">{t('common:actions.copied', 'Copied')}</span></> : <Copy size={12} />}
                  </button>
                </div>
              )}

              <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {server.provider_name && <p>{t('provider')}: {server.provider_name}</p>}
                {server.type && <p className="capitalize">{t(`type_${server.type}`, server.type)}</p>}
                {server.os && <p>{server.os}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {server.cpu_cores > 0 && (
                    <span className="flex items-center gap-1 font-mono">
                      <Cpu size={12} style={{ color: '#06b6d4' }} />
                      {server.cpu_cores} {server.cpu_cores === 1 ? t('cpu_core_one') : t('cpu_core_other')}
                    </span>
                  )}
                  {server.ram_mb > 0 && (
                    <span className="flex items-center gap-1 font-mono">
                      <HardDrive size={12} style={{ color: '#8b5cf6' }} />
                      {server.ram_mb >= 1024 && server.ram_mb % 1024 === 0 ? `${server.ram_mb / 1024} GB` : `${server.ram_mb} MB`}
                    </span>
                  )}
                  {server.total_disk_gb > 0 && (
                    <span className="flex items-center gap-1 font-mono">
                      <HardDrive size={12} style={{ color: '#f59e0b' }} />
                      {server.total_disk_gb >= 1024 && server.total_disk_gb % 1024 === 0 ? `${server.total_disk_gb / 1024} TB` : `${server.total_disk_gb} GB`}
                    </span>
                  )}
                </div>
              </div>
              {server.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 pb-1">
                  {server.tags.map(tag => <TagPill key={tag.id} tag={tag} />)}
                </div>
              )}
              <div className="mt-auto pt-3 text-xs" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-2">
                    {server.location && <span>{server.location}</span>}
                    {server.billing_cycle && server.monthly_cost > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                        {t(`contracts:cycle_${server.billing_cycle}`, server.billing_cycle)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary)' }}>
                    <ExternalLink size={12} /> {t('server_detail')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
