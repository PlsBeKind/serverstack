import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Wifi, WifiOff, AlertTriangle, Check, Loader2, Search, HardDrive, Cpu, Monitor } from 'lucide-react';
import { api } from '../api/client.js';

function DeviceCategory({ title, icon: Icon, items, idKey, labelFn, selected, onToggle, onToggleAll, t }) {
  if (!items || items.length === 0) return null;
  const allSelected = items.every(item => selected.includes(item[idKey]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          <Icon size={13} /> {title}
          <span className="font-normal ml-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
            ({t('devices_selected', { count: selected.length })})
          </span>
        </h4>
        <button type="button" className="text-[10px] font-medium hover:underline" style={{ color: 'var(--color-primary)' }}
          onClick={() => onToggleAll(!allSelected)}>
          {allSelected ? t('deselect_all') : t('select_all')}
        </button>
      </div>
      <div className="grid gap-1.5">
        {items.map(item => {
          const id = item[idKey];
          const checked = selected.includes(id);
          return (
            <label key={id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--color-border)', background: checked ? 'var(--color-primary)10' : 'transparent' }}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(id)} className="w-3.5 h-3.5 rounded" />
              <span className="text-sm font-mono flex-1 truncate">{labelFn(item)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function GlancesConfigModal({ serverId, onClose, onSaved }) {
  const { t } = useTranslation('monitoring');
  const [form, setForm] = useState({ glances_url: '', glances_username: '', glances_password: '', poll_interval_seconds: 60, enabled: true });
  const [hasExisting, setHasExisting] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [selectedDevices, setSelectedDevices] = useState({ network_interfaces: [], disk_partitions: [], sensors: [], gpus: [] });

  useEffect(() => {
    api.getGlancesConfig(serverId).then(config => {
      if (config && config.glances_url) {
        setForm({
          glances_url: config.glances_url,
          glances_username: config.glances_username || '',
          glances_password: '',
          poll_interval_seconds: config.poll_interval_seconds || 60,
          enabled: config.enabled !== 0,
        });
        setHasExisting(true);
        setHasPassword(!!config.has_password);
        if (config.selected_devices) {
          setSelectedDevices({
            network_interfaces: config.selected_devices.network_interfaces || [],
            disk_partitions: config.selected_devices.disk_partitions || [],
            sensors: config.selected_devices.sensors || [],
            gpus: config.selected_devices.gpus || [],
          });
        }
      }
    }).catch(() => {});
  }, [serverId]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setDevices(null);
    setDiscoveryError(null);
    try {
      const payload = { glances_url: form.glances_url };
      if (form.glances_username) payload.glances_username = form.glances_username;
      if (form.glances_password) payload.glances_password = form.glances_password;
      const result = await api.testGlancesConnection(serverId, payload);
      setTestResult(result);
      if (result.ok) {
        await handleDiscover(payload);
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
    }
    setTesting(false);
  };

  const handleDiscover = async (payload) => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const p = payload || { glances_url: form.glances_url };
      if (!payload && form.glances_username) p.glances_username = form.glances_username;
      if (!payload && form.glances_password) p.glances_password = form.glances_password;
      const result = await api.discoverGlancesDevices(serverId, p);
      setDevices(result);
      // If no previous selection, select all by default
      if (!hasExisting || !selectedDevices.network_interfaces.length && !selectedDevices.disk_partitions.length && !selectedDevices.sensors.length && !selectedDevices.gpus.length) {
        setSelectedDevices({
          network_interfaces: (result.network_interfaces || []).map(i => i.name),
          disk_partitions: (result.disk_partitions || []).map(d => d.mnt_point),
          sensors: (result.sensors || []).map(s => s.label),
          gpus: (result.gpus || []).map(g => g.gpu_id),
        });
      }
    } catch (err) {
      setDiscoveryError(err.response?.data?.message || err.message);
    }
    setDiscovering(false);
  };

  const toggleDevice = (category, id) => {
    setSelectedDevices(prev => {
      const list = prev[category];
      return { ...prev, [category]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
    });
  };

  const toggleAllDevices = (category, items, idKey, selectAll) => {
    setSelectedDevices(prev => ({
      ...prev,
      [category]: selectAll ? items.map(i => i[idKey]) : [],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, selected_devices: selectedDevices };
      if (!payload.glances_password && hasPassword) {
        delete payload.glances_password;
      }
      await api.saveGlancesConfig(serverId, payload);
      onSaved?.();
      onClose();
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!confirm(t('confirm_remove'))) return;
    await api.deleteGlancesConfig(serverId);
    onSaved?.();
    onClose();
  };

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('configure_glances')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{t('glances_url')}</label>
            <input type="url" required value={form.glances_url} placeholder={t('glances_url_placeholder')}
              onChange={e => setForm(f => ({ ...f, glances_url: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{t('username')}</label>
              <input type="text" value={form.glances_username}
                onChange={e => setForm(f => ({ ...f, glances_username: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{t('password')}</label>
              <input type="password" value={form.glances_password}
                placeholder={hasPassword ? '••••••••' : ''}
                onChange={e => setForm(f => ({ ...f, glances_password: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          {!form.glances_username && !form.glances_password && !hasPassword && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#78350f30', color: '#f59e0b' }}>
              <AlertTriangle size={14} /> {t('no_auth_warning')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{t('poll_interval')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min="10" max="3600" value={form.poll_interval_seconds}
                  onChange={e => setForm(f => ({ ...f, poll_interval_seconds: Number(e.target.value) }))}
                  className="w-24 px-3 py-2 rounded-lg text-sm font-mono outline-none" style={inputStyle} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('seconds')}</span>
              </div>
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                {t('enabled')}
              </label>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm`}
              style={testResult.ok ? { background: '#064e3b', color: '#10b981' } : { background: '#451a03', color: '#f87171' }}>
              {testResult.ok ? <Check size={14} /> : <WifiOff size={14} />}
              {testResult.ok ? `${t('connection_ok')} (v${testResult.version})` : `${t('connection_failed')}: ${testResult.error}`}
            </div>
          )}

          {/* Device discovery section */}
          {discovering && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              <Loader2 size={14} className="animate-spin" /> {t('discovering')}
            </div>
          )}

          {discoveryError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#451a03', color: '#f87171' }}>
              <WifiOff size={14} /> {t('discovery_failed')}: {discoveryError}
            </div>
          )}

          {devices && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2">
                <Search size={14} style={{ color: 'var(--color-primary)' }} />
                <h3 className="text-sm font-semibold">{t('device_selection')}</h3>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{t('device_selection_hint')}</p>

              <DeviceCategory title={t('network_interfaces')} icon={Wifi} items={devices.network_interfaces}
                idKey="name" labelFn={i => `${i.name}${i.alias ? ` (${i.alias})` : ''}${i.speed ? ` — ${i.speed} Mbps` : ''}`}
                selected={selectedDevices.network_interfaces}
                onToggle={id => toggleDevice('network_interfaces', id)}
                onToggleAll={sel => toggleAllDevices('network_interfaces', devices.network_interfaces, 'name', sel)} t={t} />

              <DeviceCategory title={t('disk_partitions')} icon={HardDrive} items={devices.disk_partitions}
                idKey="mnt_point" labelFn={d => `${d.mnt_point} (${d.device}${d.fs_type ? ', ' + d.fs_type : ''})`}
                selected={selectedDevices.disk_partitions}
                onToggle={id => toggleDevice('disk_partitions', id)}
                onToggleAll={sel => toggleAllDevices('disk_partitions', devices.disk_partitions, 'mnt_point', sel)} t={t} />

              <DeviceCategory title={t('sensors')} icon={Cpu} items={devices.sensors}
                idKey="label" labelFn={s => `${s.label} (${s.type}${s.value != null ? ` — ${s.value}${s.unit}` : ''})`}
                selected={selectedDevices.sensors}
                onToggle={id => toggleDevice('sensors', id)}
                onToggleAll={sel => toggleAllDevices('sensors', devices.sensors, 'label', sel)} t={t} />

              <DeviceCategory title={t('gpus')} icon={Monitor} items={devices.gpus}
                idKey="gpu_id" labelFn={g => `${g.name || `GPU ${g.gpu_id}`}${g.proc != null ? ` — ${g.proc}%` : ''}`}
                selected={selectedDevices.gpus}
                onToggle={id => toggleDevice('gpus', id)}
                onToggleAll={sel => toggleAllDevices('gpus', devices.gpus, 'gpu_id', sel)} t={t} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleTest} disabled={!form.glances_url || testing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 disabled:opacity-40"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              {testing ? t('testing') : t('test_connection')}
            </button>
            <button type="submit" disabled={saving || !form.glances_url}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}>
              {t('save_config')}
            </button>
          </div>

          {hasExisting && (
            <button type="button" onClick={handleRemove}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5"
              style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
              {t('remove_config')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
