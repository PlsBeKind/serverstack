import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client.js';
import CostBadge from '../components/CostBadge.jsx';

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

export default function CostAnalysisPage() {
  const { t } = useTranslation('contracts');
  const [costs, setCosts] = useState(null);
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    Promise.all([api.getCosts(), api.getContracts()])
      .then(([c, cList]) => { setCosts(c); setContracts(cList); });
  }, []);

  if (!costs) return <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>;

  const promoContracts = contracts.filter(c => c.promo_price);
  const totalSavings = promoContracts.reduce((sum, c) => sum + ((c.regular_cost || 0) - (c.monthly_cost || 0)), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('cost_analysis')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} style={{ color: '#f59e0b' }} />
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('total_monthly')}</p>
          </div>
          <CostBadge amount={costs.total_monthly} />
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: '#06b6d4' }} />
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('total_yearly')}</p>
          </div>
          <CostBadge amount={costs.total_yearly} />
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} style={{ color: '#10b981' }} />
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('savings')}</p>
          </div>
          <CostBadge amount={totalSavings} />
        </div>
      </div>

      {costs.by_provider?.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {t('common:dashboard.cost_by_provider', 'Cost by Provider')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costs.by_provider}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {costs.by_provider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {promoContracts.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('promo_price')}</h3>
          <div className="space-y-2">
            {promoContracts.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <span>{c.server_name}</span>
                <div className="flex items-center gap-3">
                  <CostBadge amount={c.monthly_cost} promo />
                  {c.regular_cost && <span className="line-through text-xs" style={{ color: 'var(--color-text-muted)' }}><CostBadge amount={c.regular_cost} /></span>}
                  {c.promo_end_date && <span className="text-xs" style={{ color: 'var(--color-warning)' }}>{c.promo_end_date}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
