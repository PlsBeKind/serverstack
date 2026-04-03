import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Building2, DollarSign, HardDrive, Cpu, Network, Bell, TrendingUp, CalendarClock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import CostBadge from '../components/CostBadge.jsx';

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

function StatCard({ icon: Icon, label, value, sub, color = 'var(--color-primary)' }) {
  return (
    <div className="rounded-xl p-5 hover-lift" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15`, color }}><Icon size={20} /></div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const [summary, setSummary] = useState(null);
  const [costs, setCosts] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [resources, setResources] = useState(null);
  const [billing, setBilling] = useState([]);

  useEffect(() => {
    Promise.all([api.getSummary(), api.getCosts(), api.getAlerts(), api.getResources(), api.getUpcomingBilling()])
      .then(([s, c, a, r, b]) => { setSummary(s); setCosts(c); setAlerts(a); setResources(r); setBilling(b); });
  }, []);

  if (!summary) return <div className="flex items-center justify-center h-64 opacity-50">{t('common:actions.loading')}</div>;

  const markAllRead = async () => {
    await api.markAllAlertsRead();
    setAlerts(alerts.map(a => ({ ...a, sent: 1 })));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label={t('total_servers')} value={summary.servers.total} sub={`${summary.servers.active} ${t('active_servers').toLowerCase()}`} />
        <StatCard icon={Building2} label={t('providers')} value={summary.providers} color="#06b6d4" />
        <StatCard icon={DollarSign} label={t('total_monthly')} value={<CostBadge amount={costs?.total_monthly} />}
          sub={summary.next_billing ? `${t('next_charge')}: ${summary.next_billing.billing_date}` : null} color="#f59e0b" />
        <StatCard icon={TrendingUp} label={t('promo_savings')} value={<CostBadge amount={costs?.promo_savings} />} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('cost_by_provider')}</h3>
          {costs?.by_provider?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costs.by_provider} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {costs.by_provider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }} itemStyle={{ color: '#f1f5f9' }} labelStyle={{ color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {costs?.by_provider?.map((p, i) => (
              <span key={p.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('resources')}</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Cpu size={18} style={{ color: '#06b6d4' }} />
              <div className="flex-1">
                <p className="text-sm">{t('total_cores')}</p>
                <p className="text-lg font-bold font-mono">{resources?.total_cores || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive size={18} style={{ color: '#8b5cf6' }} />
              <div className="flex-1">
                <p className="text-sm">{t('total_ram')}</p>
                <p className="text-lg font-bold font-mono">{resources?.total_ram_mb ? `${(resources.total_ram_mb / 1024).toFixed(1)} GB` : '0'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive size={18} style={{ color: '#f59e0b' }} />
              <div className="flex-1">
                <p className="text-sm">{t('total_storage')}</p>
                <p className="text-lg font-bold font-mono">{resources?.total_storage_gb || 0} GB</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Network size={18} style={{ color: '#10b981' }} />
              <div className="flex-1">
                <p className="text-sm">{t('total_ips')}</p>
                <p className="text-lg font-bold font-mono">{resources?.total_ips || 0}</p>
                {resources && (resources.ipv4_addresses > 0 || resources.ipv6_addresses > 0) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {resources.ipv4_addresses > 0 && <span>{resources.ipv4_addresses} {t('ipv4_addresses')}</span>}
                    {resources.ipv4_subnets > 0 && <span>{resources.ipv4_subnets} {t('ipv4_subnets')}</span>}
                    {resources.ipv6_addresses > 0 && <span>{resources.ipv6_addresses} {t('ipv6_addresses')}</span>}
                    {resources.ipv6_subnets > 0 && <span>{resources.ipv6_subnets} {t('ipv6_subnets')}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>{t('recent_alerts')}</h3>
            {alerts.some(a => !a.sent) && (
              <button onClick={markAllRead} className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>{t('mark_all_read')}</button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('no_alerts')}</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 10).map(alert => (
                <div key={alert.id} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${alert.sent ? 'opacity-50' : ''}`}
                  style={{ background: 'var(--color-surface)' }}>
                  <Bell size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
                  <span className="line-clamp-2">
                    {alert.type === 'cancellation' && alert.server_name
                      ? t('alert_cancellation', { name: alert.server_name, date: alert.trigger_date })
                      : alert.type === 'promo_end' && alert.server_name
                        ? t('alert_promo_end', { name: alert.server_name, date: alert.trigger_date })
                        : alert.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="rounded-xl p-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          <CalendarClock size={16} style={{ color: '#f59e0b' }} /> {t('upcoming_events')}
        </h3>
        {billing.length === 0 ? (
          <p className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('no_upcoming')}</p>
        ) : (
          <div className="space-y-2">
            {billing.map((b, i) => {
              const isDone = b.status === 'cancelled';
              const isStillBilled = b.is_cancelled && !isDone;
              const isPriceChange = b.status === 'price_change';
              const isExpired = b.status === 'expired';
              const isDueSoon = b.status === 'due_soon';
              const isUnknown = b.status === 'unknown_date';
              const color = isPriceChange ? '#f59e0b' : isDone ? '#6b7280' : isDueSoon ? '#f59e0b' : isUnknown ? '#6b7280' : 'var(--color-text-muted)';

              let timeLabel;
              if (isPriceChange) {
                timeLabel = t('price_change_on', { date: b.billing_date });
              } else if (isDone) {
                if (b.days_until !== null && b.days_until >= 0) timeLabel = t('ends_in_days', { count: b.days_until });
                else if (b.date) timeLabel = t('ends_on', { date: b.date });
                else timeLabel = '';
              }
              else if (isExpired) timeLabel = t('expired');
              else if (isUnknown) timeLabel = t('date_unknown');
              else if (b.days_until === 0) timeLabel = t('today');
              else if (b.days_until === 1) timeLabel = t('in_1_day');
              else if (b.days_until !== null) timeLabel = t('in_days', { count: b.days_until });
              else timeLabel = b.label;

              return (
                <Link key={i} to={`/servers/${b.server_id}/edit`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                  style={{ background: 'var(--color-surface)' }}>
                  <div className="flex items-center gap-2">
                    {isUnknown && <AlertTriangle size={12} style={{ color: '#6b7280' }} />}
                    {(isDone || isStillBilled) && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#7f1d1d', color: '#f87171' }}>{t('contracts:is_cancelled')}</span>}
                    {isPriceChange && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#92400e20', color: '#f59e0b' }}>⬆</span>}
                    <span className="font-semibold">{b.server_name}</span>
                    {b.provider_name && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{b.provider_name}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {isPriceChange && b.old_cost ? (
                      <span className="font-mono text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}><CostBadge amount={b.old_cost} /></span>
                        <span style={{ color: '#f59e0b' }}> → <CostBadge amount={b.amount} /></span>
                      </span>
                    ) : b.amount > 0 && <CostBadge amount={b.amount} />}
                    <span className="text-xs font-mono" style={{ color }}>{timeLabel}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
