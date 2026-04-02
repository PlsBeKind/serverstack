import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../api/client.js';
import CostBadge from '../components/CostBadge.jsx';

export default function ContractsPage() {
  const { t } = useTranslation('contracts');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.getContracts().then(setContracts).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (c) => {
    if (!confirm(t('confirm_delete'))) return;
    await api.deleteContract(c.id);
    load();
  };

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const totalMonthly = contracts.reduce((sum, c) => sum + (c.monthly_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('title')}</h1>
        <Link to="/contracts/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> {t('add_contract')}
        </Link>
      </div>

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
          <p className="text-lg font-bold font-mono">{contracts.filter(c => isExpiringSoon(c.next_cancellation_date)).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => (
            <div key={c.id} className="rounded-xl p-5 hover-lift"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{c.server_name || `Server #${c.server_id}`}</p>
                    {isExpiringSoon(c.next_cancellation_date) && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#451a03', color: '#f59e0b' }}>
                        <AlertTriangle size={10} /> {t('expiring_soon')}
                      </span>
                    )}
                    {c.promo_price ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#10b981' }}>PROMO</span> : null}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.provider_name}</p>
                  {c.contract_number && <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>#{c.contract_number}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <CostBadge amount={c.monthly_cost} promo={!!c.promo_price} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{c.billing_cycle || 'mo'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <div className="flex gap-4">
                  {c.start_date && <span>{t('start_date')}: {c.start_date}</span>}
                  {c.next_cancellation_date && <span>{t('next_cancellation')}: {c.next_cancellation_date}</span>}
                </div>
                <div className="flex gap-1">
                  <Link to={`/contracts/${c.id}/edit`} className="p-1.5 rounded hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}><Pencil size={13} /></Link>
                  <button onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
