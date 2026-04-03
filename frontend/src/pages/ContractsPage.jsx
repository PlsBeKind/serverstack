import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../api/client.js';
import CostBadge from '../components/CostBadge.jsx';

export default function ContractsPage() {
  const { t } = useTranslation('contracts');
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getServers().then(data => {
      setServers(data.filter(s => s.monthly_cost > 0 || s.contract_number));
    }).finally(() => setLoading(false));
  }, []);

  const isExpiringSoon = (server) => {
    if (!server.is_cancelled || !server.next_cancellation_date) return false;
    const diff = (new Date(server.next_cancellation_date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const totalMonthly = servers.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('total_monthly')}</p>
          <CostBadge amount={totalMonthly} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('total_yearly')}</p>
          <CostBadge amount={totalMonthly * 12} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('expiring_soon')}</p>
          <p className="text-lg font-bold font-mono">{servers.filter(s => isExpiringSoon(s)).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>
      ) : servers.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(s => (
            <Link key={s.id} to={`/servers/${s.id}`}
              className="block rounded-xl p-5 hover-lift"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{s.name}</p>
                    {isExpiringSoon(s) && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#451a03', color: '#f59e0b' }}>
                        <AlertTriangle size={10} /> {t('expiring_soon')}
                      </span>
                    )}
                    {s.promo_price ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#10b981' }}>PROMO</span> : null}
                    {s.is_cancelled ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#7f1d1d', color: '#f87171' }}>{t('is_cancelled')}</span> : null}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {s.provider_name}{s.contract_period ? ` · ${s.contract_period}` : ''}{s.contract_number ? ` · #${s.contract_number}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CostBadge amount={s.monthly_cost} promo={!!s.promo_price} />
                  {s.billing_cycle && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{s.billing_cycle}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <div className="flex gap-4">
                  {s.contract_start_date && <span>{t('start_date')}: {s.contract_start_date}</span>}
                  {s.next_cancellation_date && <span>{t('next_cancellation')}: {s.next_cancellation_date}</span>}
                </div>
                <span className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                  <ExternalLink size={10} /> {t('common:actions.edit')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
