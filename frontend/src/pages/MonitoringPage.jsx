import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Activity, Settings, RefreshCw, Cpu, MemoryStick, HardDrive, Wifi, Monitor, Clock, Loader2, Thermometer, X } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import GlancesConfigModal from '../components/GlancesConfigModal.jsx';
import { api } from '../api/client.js';

const TIME_RANGES = [
  { key: 'last_hour', hours: 1 },
  { key: 'last_6h', hours: 6 },
  { key: 'last_24h', hours: 24 },
  { key: 'last_7d', hours: 168 },
];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatRate(bytesPerSec) {
  if (!bytesPerSec) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const chartColors = {
  cpu: '#10b981',
  cpuTemp: '#f59e0b',
  ram: '#3b82f6',
  swap: '#8b5cf6',
  disk: '#a855f7',
  netRx: '#06b6d4',
  netTx: '#f97316',
  gpu: '#ec4899',
  gpuTemp: '#ef4444',
};

const tooltipStyle = { contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#94a3b8' } };

function MetricCard({ icon: Icon, title, children, color = 'var(--color-primary)' }) {
  return (
    <div className="rounded-xl p-5 animate-fade-in" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon size={16} style={{ color }} /> {title}
      </h3>
      {children}
    </div>
  );
}

/** Circular gauge with SVG donut. title on top, subtitle below, percentage in center. */
function CircleGauge({ title, subtitle, value, color, size = 120, strokeWidth = 8, extra, onClick }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value || 0, 0), 100);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`flex flex-col items-center gap-1${onClick ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`} onClick={onClick}>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="var(--color-surface)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold font-mono">{value != null ? `${pct.toFixed(0)}%` : '—'}</span>
        </div>
      </div>
      {subtitle && <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</span>}
      {extra}
    </div>
  );
}

/** Popup modal showing a history chart for a single category */
function ChartPopup({ serverId, category, onClose, t }) {
  const [range, setRange] = useState('last_hour');
  const [data, setData] = useState([]);
  const [popupLoading, setPopupLoading] = useState(true);

  useEffect(() => {
    const hours = TIME_RANGES.find(r => r.key === range)?.hours || 1;
    const from = new Date(Date.now() - hours * 3600000).toISOString();
    setPopupLoading(true);
    api.getGlancesHistory(serverId, { from, limit: 500 })
      .then(rows => setData(rows.map(r => ({ ...r, time: formatTime(r.timestamp) })).reverse()))
      .catch(() => setData([]))
      .finally(() => setPopupLoading(false));
  }, [serverId, range]);

  const titles = {
    cpu: t('cpu_usage'),
    ram: t('ram_usage'),
    disk: t('disk'),
    network: t('network'),
    gpu: t('gpu_usage'),
  };

  const renderChart = () => {
    if (popupLoading) return <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-text-muted)' }} /></div>;
    if (data.length === 0) return <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>{t('no_data')}</p>;

    switch (category) {
      case 'cpu':
        return (
          <div className="space-y-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="popupCpuFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.cpu} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColors.cpu} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="cpu_percent" stroke={chartColors.cpu} fill="url(#popupCpuFill)" strokeWidth={2} name="CPU %" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {data.some(h => h.cpu_temp != null) && (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="°C" />
                    <Tooltip {...tooltipStyle} />
                    <Line type="monotone" dataKey="cpu_temp" stroke={chartColors.cpuTemp} strokeWidth={2} name={t('cpu_temp')} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      case 'ram':
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="popupRamFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.ram} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColors.ram} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="ram_percent" stroke={chartColors.ram} fill="url(#popupRamFill)" strokeWidth={2} name="RAM %" dot={false} />
                {data.some(h => h.swap_percent > 0) && (
                  <Area type="monotone" dataKey="swap_percent" stroke={chartColors.swap} fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="Swap %" dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      case 'disk':
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.map(h => {
                const out = { ...h };
                if (h.disk_usage?.length > 0) {
                  h.disk_usage.forEach((d, i) => { out[`disk_${i}`] = d.percent; });
                }
                return out;
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                <Tooltip {...tooltipStyle} />
                {(() => {
                  const sample = data.find(h => h.disk_usage?.length > 0);
                  if (!sample) return null;
                  const diskColors = ['#a855f7', '#7c3aed', '#6d28d9', '#c084fc', '#e879f9'];
                  return sample.disk_usage.map((d, i) => (
                    <Line key={i} type="monotone" dataKey={`disk_${i}`} stroke={diskColors[i % diskColors.length]}
                      strokeWidth={2} name={d.mnt_point || d.mount_point || d.device} dot={false} />
                  ));
                })()}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      case 'network':
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={formatRate} />
                <Tooltip {...tooltipStyle} formatter={(v) => formatRate(v)} />
                <Line type="monotone" dataKey="net_rx_rate" stroke={chartColors.netRx} strokeWidth={2} name="↓ RX" dot={false} />
                <Line type="monotone" dataKey="net_tx_rate" stroke={chartColors.netTx} strokeWidth={2} name="↑ TX" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      case 'gpu':
        return (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.map(h => {
                const gpu = h.gpu?.[0];
                return { ...h, gpu_proc: gpu?.proc, gpu_temp: gpu?.temperature };
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="gpu_proc" stroke={chartColors.gpu} strokeWidth={2} name={t('gpu_usage') + ' %'} dot={false} />
                <Line type="monotone" dataKey="gpu_temp" stroke={chartColors.gpuTemp} strokeWidth={2} name={t('gpu_temp') + ' °C'} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl rounded-xl p-6 animate-fade-in"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{titles[category] || category} — {t('history')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--color-border)' }}>
          {TIME_RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={range === r.key ? { background: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text-muted)' }}>
              {t(r.key)}
            </button>
          ))}
        </div>
        {renderChart()}
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const { t } = useTranslation('monitoring');
  const { id } = useParams();
  const [server, setServer] = useState(null);
  const [config, setConfig] = useState(null);
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState([]);
  const [timeRange, setTimeRange] = useState('live');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartPopup, setChartPopup] = useState(null);
  const refreshRef = useRef(null);

  const loadConfig = useCallback(async () => {
    try {
      const [s, cfg] = await Promise.all([api.getServer(id), api.getGlancesConfig(id)]);
      setServer(s);
      setConfig(cfg?.glances_url ? cfg : null);
    } catch { setConfig(null); }
  }, [id]);

  const loadLive = useCallback(async () => {
    try {
      const data = await api.getGlancesCurrent(id);
      if (data.ok) setLive(data.data);
    } catch { /* ignore */ }
  }, [id]);

  const loadHistory = useCallback(async () => {
    const range = TIME_RANGES.find(r => r.key === timeRange);
    const from = new Date(Date.now() - range.hours * 3600000).toISOString();
    try {
      const rows = await api.getGlancesHistory(id, { from, limit: 500 });
      setHistory(rows.map(r => ({ ...r, time: formatTime(r.timestamp) })));
    } catch { setHistory([]); }
  }, [id, timeRange]);

  const loadLatestSnapshot = useCallback(async () => {
    try {
      const rows = await api.getGlancesHistory(id, { limit: 1 });
      if (rows.length > 0) setLive(rows[0]);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadConfig().then(() => setLoading(false));
  }, [loadConfig]);

  useEffect(() => {
    if (!config) return;
    if (timeRange === 'live') {
      loadLatestSnapshot();
    } else {
      loadLive();
      loadHistory();
    }
  }, [config, timeRange, loadLive, loadHistory, loadLatestSnapshot]);

  useEffect(() => {
    if (!config || !autoRefresh || timeRange === 'live') return;
    refreshRef.current = setInterval(() => { loadLive(); loadHistory(); }, 30000);
    return () => clearInterval(refreshRef.current);
  }, [config, autoRefresh, timeRange, loadLive, loadHistory]);

  if (loading) return <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>;

  const hasGpu = live?.gpu?.length > 0 || history.some(h => h.gpu?.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link to={`/servers/${id}`} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold flex-1" style={{ fontFamily: 'var(--font-heading)' }}>
          <Activity size={22} className="inline mr-2" style={{ color: 'var(--color-primary)' }} />
          {server?.name} — {t('title')}
        </h1>
        <button onClick={() => setShowConfig(true)} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
          <Settings size={18} />
        </button>
      </div>

      {showConfig && <GlancesConfigModal serverId={id} onClose={() => setShowConfig(false)} onSaved={loadConfig} />}

      {/* Not configured */}
      {!config && (
        <div className="rounded-xl p-8 text-center animate-fade-in" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <Activity size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('not_configured')}</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{t('setup_hint')}</p>
          <button onClick={() => setShowConfig(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all"
            style={{ background: 'var(--color-primary)' }}>
            {t('configure')}
          </button>
        </div>
      )}

      {/* Controls */}
      {config && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              <button onClick={() => setTimeRange('live')}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={timeRange === 'live' ? { background: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text-muted)' }}>
                {t('live')}
              </button>
              {TIME_RANGES.map(r => (
                <button key={r.key} onClick={() => setTimeRange(r.key)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={timeRange === r.key ? { background: 'var(--color-primary)', color: 'white' } : { color: 'var(--color-text-muted)' }}>
                  {t(r.key)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              {t('auto_refresh')}
            </label>
            <button onClick={() => { if (timeRange === 'live') { loadLatestSnapshot(); } else { loadLive(); loadHistory(); } }} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Live circular gauges */}
          {live && (
            <div className="rounded-xl p-6 animate-fade-in" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <div className="flex flex-wrap gap-8 justify-center">
                {/* CPU */}
                <CircleGauge
                  title={t('cpu')}
                  subtitle={live.cpu_temp != null ? `${live.cpu_temp.toFixed(0)}°C` : null}
                  value={live.cpu_percent}
                  color={chartColors.cpu}
                  onClick={timeRange === 'live' ? () => setChartPopup('cpu') : undefined}
                  extra={live.cpu_temp != null && (
                    <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: chartColors.cpuTemp }}>
                      <Thermometer size={10} /> {live.cpu_temp.toFixed(0)}°C
                    </span>
                  )}
                />

                {/* RAM */}
                <CircleGauge
                  title={t('ram')}
                  subtitle={`${formatBytes(live.ram_used)} / ${formatBytes(live.ram_total)}`}
                  value={live.ram_percent}
                  color={chartColors.ram}
                  onClick={timeRange === 'live' ? () => setChartPopup('ram') : undefined}
                />

                {/* Swap */}
                {live.swap_percent > 0 && (
                  <CircleGauge
                    title={t('swap')}
                    subtitle={`${formatBytes(live.swap_used)} / ${formatBytes(live.swap_total)}`}
                    value={live.swap_percent}
                    color={chartColors.swap}
                    onClick={timeRange === 'live' ? () => setChartPopup('ram') : undefined}
                  />
                )}

                {/* Disk partitions */}
                {live.disk_usage?.map((d, i) => (
                  <CircleGauge key={`disk-${i}`}
                    title={d.mnt_point || d.mount_point}
                    subtitle={`${formatBytes(d.used)} / ${formatBytes(d.size || d.total)}`}
                    value={d.percent}
                    color={chartColors.disk}
                    onClick={timeRange === 'live' ? () => setChartPopup('disk') : undefined}
                  />
                ))}

                {/* GPU(s) */}
                {live.gpu?.map((g, i) => (
                  <CircleGauge key={`gpu-${i}`}
                    title={g.name || `GPU ${g.gpu_id ?? i}`}
                    subtitle={g.mem != null ? `${t('gpu_memory')}: ${g.mem.toFixed(0)}%` : null}
                    value={g.proc}
                    color={chartColors.gpu}
                    onClick={timeRange === 'live' ? () => setChartPopup('gpu') : undefined}
                    extra={g.temperature != null && (
                      <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: chartColors.gpuTemp }}>
                        <Thermometer size={10} /> {g.temperature}°C
                      </span>
                    )}
                  />
                ))}
              </div>

              {/* Network stats */}
              <div className="mt-6 pt-4 flex flex-wrap gap-6 justify-center" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className={`text-center${timeRange === 'live' ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={timeRange === 'live' ? () => setChartPopup('network') : undefined}>
                  <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: chartColors.netRx }}>{t('network')} ↓</span>
                  <span className="text-lg font-mono font-bold">{formatRate(live.net_rx_rate)}</span>
                  <span className="block text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{t('net_cumulative_rx')}: {formatBytes(live.net_cumulative_rx)}</span>
                </div>
                <div className={`text-center${timeRange === 'live' ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={timeRange === 'live' ? () => setChartPopup('network') : undefined}>
                  <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: chartColors.netTx }}>{t('network')} ↑</span>
                  <span className="text-lg font-mono font-bold">{formatRate(live.net_tx_rate)}</span>
                  <span className="block text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{t('net_cumulative_tx')}: {formatBytes(live.net_cumulative_tx)}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('uptime')}</span>
                  <span className="text-lg font-mono font-bold">{live.uptime || '—'}</span>
                  <span className="block text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {t('load')}: {live.load_1?.toFixed(2) || '—'} / {live.load_5?.toFixed(2) || '—'} / {live.load_15?.toFixed(2) || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* History Charts */}
          {timeRange !== 'live' && history.length > 0 && (
            <div className="space-y-4">
              {/* CPU usage history */}
              <MetricCard icon={Cpu} title={`${t('cpu_usage')} — ${t('history')}`} color={chartColors.cpu}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColors.cpu} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={chartColors.cpu} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                      <Tooltip {...tooltipStyle} />
                      <Area type="monotone" dataKey="cpu_percent" stroke={chartColors.cpu} fill="url(#cpuFill)" strokeWidth={2} name="CPU %" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </MetricCard>

              {/* CPU temperature history */}
              {history.some(h => h.cpu_temp != null) && (
                <MetricCard icon={Thermometer} title={`${t('cpu_temp')} — ${t('history')}`} color={chartColors.cpuTemp}>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="°C" />
                        <Tooltip {...tooltipStyle} />
                        <Line type="monotone" dataKey="cpu_temp" stroke={chartColors.cpuTemp} strokeWidth={2} name={t('cpu_temp')} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </MetricCard>
              )}

              {/* RAM history */}
              <MetricCard icon={MemoryStick} title={`${t('ram_usage')} — ${t('history')}`} color={chartColors.ram}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="ramFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColors.ram} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={chartColors.ram} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                      <Tooltip {...tooltipStyle} />
                      <Area type="monotone" dataKey="ram_percent" stroke={chartColors.ram} fill="url(#ramFill)" strokeWidth={2} name="RAM %" dot={false} />
                      {history.some(h => h.swap_percent > 0) && (
                        <Area type="monotone" dataKey="swap_percent" stroke={chartColors.swap} fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="Swap %" dot={false} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </MetricCard>

              {/* Disk usage history */}
              {history.some(h => h.disk_usage?.length > 0) && (
                <MetricCard icon={HardDrive} title={`${t('disk')} — ${t('history')}`} color={chartColors.disk}>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history.map(h => {
                        const out = { ...h };
                        if (h.disk_usage?.length > 0) {
                          h.disk_usage.forEach((d, i) => {
                            out[`disk_${i}`] = d.percent;
                            out[`disk_${i}_name`] = d.mnt_point || d.mount_point || d.device;
                          });
                        }
                        return out;
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                        <Tooltip {...tooltipStyle} />
                        {(() => {
                          const sample = history.find(h => h.disk_usage?.length > 0);
                          if (!sample) return null;
                          const diskColors = ['#a855f7', '#7c3aed', '#6d28d9', '#c084fc', '#e879f9'];
                          return sample.disk_usage.map((d, i) => (
                            <Line key={i} type="monotone" dataKey={`disk_${i}`} stroke={diskColors[i % diskColors.length]}
                              strokeWidth={2} name={d.mnt_point || d.mount_point || d.device} dot={false} />
                          ));
                        })()}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </MetricCard>
              )}

              {/* Network history */}
              <MetricCard icon={Wifi} title={`${t('network')} — ${t('history')}`} color={chartColors.netRx}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={formatRate} />
                      <Tooltip {...tooltipStyle} formatter={(v) => formatRate(v)} />
                      <Line type="monotone" dataKey="net_rx_rate" stroke={chartColors.netRx} strokeWidth={2} name="↓ RX" dot={false} />
                      <Line type="monotone" dataKey="net_tx_rate" stroke={chartColors.netTx} strokeWidth={2} name="↑ TX" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </MetricCard>

              {/* GPU history */}
              {hasGpu && history.some(h => h.gpu?.length > 0) && (
                <MetricCard icon={Monitor} title={`${t('gpu_usage')} — ${t('history')}`} color={chartColors.gpu}>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history.map(h => {
                        const gpu = h.gpu?.[0];
                        return { ...h, gpu_proc: gpu?.proc, gpu_temp: gpu?.temperature };
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip {...tooltipStyle} />
                        <Line type="monotone" dataKey="gpu_proc" stroke={chartColors.gpu} strokeWidth={2} name={t('gpu_usage') + ' %'} dot={false} />
                        <Line type="monotone" dataKey="gpu_temp" stroke={chartColors.gpuTemp} strokeWidth={2} name={t('gpu_temp') + ' °C'} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </MetricCard>
              )}
            </div>
          )}

          {!live && (timeRange === 'live' || history.length === 0) && (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('no_data')}</p>
            </div>
          )}

          {chartPopup && (
            <ChartPopup serverId={id} category={chartPopup} onClose={() => setChartPopup(null)} t={t} />
          )}
        </>
      )}
    </div>
  );
}
