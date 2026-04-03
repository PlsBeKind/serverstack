import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client.js';
import CostBadge from '../components/CostBadge.jsx';

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

export default function CostAnalysisPage() {
  const { t } = useTranslation('contracts');
  const [costs, setCosts] = useState(null);
  const [servers, setServers] = useState([]);
  const [costTrend, setCostTrend] = useState([]);

  useEffect(() => {
    Promise.all([api.getCosts(), api.getServers(), api.getCostTrend()])
      .then(([c, s, trend]) => { setCosts(c); setServers(s); setCostTrend(trend); });
  }, []);

  if (!costs) return <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>;

  const promoServers = servers.filter(s => s.promo_price);
  const totalSavings = promoServers.reduce((sum, s) => sum + ((s.regular_cost || 0) - (s.monthly_cost || 0)), 0);

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
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#f1f5f9' }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {costs.by_provider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {costTrend.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {t('common:dashboard.cost_trend', 'Cost Trend (12 Months)')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costTrend}>
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#f1f5f9' }} />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {promoServers.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('promo_price')}</h3>
          <div className="space-y-2">
            {promoServers.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <span>{s.name}</span>
                <div className="flex items-center gap-3">
                  <CostBadge amount={s.monthly_cost} promo />
                  {s.regular_cost && <span className="line-through text-xs" style={{ color: 'var(--color-text-muted)' }}><CostBadge amount={s.regular_cost} /></span>}
                  {s.promo_end_date && <span className="text-xs" style={{ color: 'var(--color-warning)' }}>{s.promo_end_date}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
