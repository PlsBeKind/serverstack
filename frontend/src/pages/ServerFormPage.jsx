import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Network } from 'lucide-react';
import { api } from '../api/client.js';

const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

function Field({ name, label, value, onChange, type = 'text', ...rest }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <input type={type} name={name} value={value || ''} onChange={onChange}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} {...rest} />
    </div>
  );
}

export default function ServerFormPage() {
  const { t } = useTranslation('servers');
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({
    provider_id: '', name: '', type: '', hostname: '', location: '', os: '',
    cpu_cores: '', ram_mb: '', storage_gb: '', storage_type: '', status: 'active',
    notes: '', ssh_user: '', ssh_port: '22', ssh_public_key: '',
    ssh_host_key: '',
  });
  const [ips, setIps] = useState([]);
  const [existingIps, setExistingIps] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getProviders().then(setProviders);
    if (isEdit) {
      api.getServer(id).then(s => setForm(prev => ({
        ...prev, ...s,
        cpu_cores: s.cpu_cores || '', ram_mb: s.ram_mb || '',
        storage_gb: s.storage_gb || '', ssh_port: s.ssh_port || '22',
      })));
      api.getServerIps(id).then(setExistingIps);
    }
  }, [id, isEdit]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addIpRow = () => {
    setIps([...ips, { address: '', version: 'ipv4', type: 'primary', rdns: '' }]);
  };

  const updateIpRow = (index, field, value) => {
    setIps(ips.map((ip, i) => i === index ? { ...ip, [field]: value } : ip));
  };

  const removeIpRow = (index) => {
    setIps(ips.filter((_, i) => i !== index));
  };

  const deleteExistingIp = async (ipId) => {
    await api.deleteIp(ipId);
    setExistingIps(existingIps.filter(ip => ip.id !== ipId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body = {
      ...form,
      provider_id: Number(form.provider_id),
      cpu_cores: form.cpu_cores ? Number(form.cpu_cores) : null,
      ram_mb: form.ram_mb ? Number(form.ram_mb) : null,
      storage_gb: form.storage_gb ? Number(form.storage_gb) : null,
      ssh_port: form.ssh_port ? Number(form.ssh_port) : 22,
    };

    try {
      let serverId;
      if (isEdit) {
        await api.updateServer(id, body);
        serverId = Number(id);
      } else {
        const created = await api.createServer(body);
        serverId = created.id;
      }

      // Save new IPs
      const validIps = ips.filter(ip => ip.address.trim());
      for (const ip of validIps) {
        await api.createIp({ server_id: serverId, ...ip });
      }

      navigate(`/servers/${serverId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to={isEdit ? `/servers/${id}` : '/servers'} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{isEdit ? t('edit_server') : t('add_server')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {error && <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#451a03', color: '#f87171' }}>{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="name" label={t('name')} value={form.name} onChange={handleChange} required />
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('provider')}</label>
            <select name="provider_id" value={form.provider_id} onChange={handleChange} required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
              <option value="">—</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('type')}</label>
            <select name="type" value={form.type || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
              <option value="">—</option>
              <option value="root_server">{t('type_root_server')}</option>
              <option value="vps">{t('type_vps')}</option>
              <option value="dedicated">{t('type_dedicated')}</option>
              <option value="cloud">{t('type_cloud')}</option>
            </select>
          </div>
          <Field name="hostname" label={t('hostname')} value={form.hostname} onChange={handleChange} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="location" label={t('location')} value={form.location} onChange={handleChange} />
          <Field name="os" label={t('os')} value={form.os} onChange={handleChange} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Field name="cpu_cores" label={t('cpu_cores')} value={form.cpu_cores} onChange={handleChange} type="number" />
          <Field name="ram_mb" label={t('ram_mb')} value={form.ram_mb} onChange={handleChange} type="number" />
          <Field name="storage_gb" label={t('storage_gb')} value={form.storage_gb} onChange={handleChange} type="number" />
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('storage_type')}</label>
            <select name="storage_type" value={form.storage_type || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
              <option value="">—</option>
              <option value="nvme">NVMe</option>
              <option value="ssd">SSD</option>
              <option value="hdd">HDD</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('status')}</label>
          <select name="status" value={form.status} onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
            <option value="active">{t('common:status.active')}</option>
            <option value="inactive">{t('common:status.inactive')}</option>
            <option value="suspended">{t('common:status.suspended')}</option>
          </select>
        </div>

        <hr style={{ borderColor: 'var(--color-border)' }} />

        {/* IP Addresses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Network size={16} style={{ color: '#06b6d4' }} /> {t('ip_addresses')}
            </h3>
            <button type="button" onClick={addIpRow}
              className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
              <Plus size={12} /> {t('add_ip')}
            </button>
          </div>

          {/* Existing IPs (edit mode) */}
          {existingIps.map(ip => (
            <div key={ip.id} className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
              <span className="font-mono flex-1">{ip.address}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)' }}>{ip.version}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#10b981' }}>{ip.type}</span>
              {ip.rdns && <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{ip.rdns}</span>}
              <button type="button" onClick={() => deleteExistingIp(ip.id)}
                className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--color-danger)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* New IP rows */}
          {ips.map((ip, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-2 mb-2 items-end">
              <div>
                {i === 0 && <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('ip_address')}</label>}
                <input value={ip.address} onChange={(e) => updateIpRow(i, 'address', e.target.value)}
                  placeholder="10.0.0.1 or 10.0.0.0/24" className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 font-mono" style={inputStyle} />
              </div>
              <div>
                {i === 0 && <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('ip_version')}</label>}
                <select value={ip.version} onChange={(e) => updateIpRow(i, 'version', e.target.value)}
                  className="px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                  <option value="ipv4">IPv4</option>
                  <option value="ipv6">IPv6</option>
                </select>
              </div>
              <div>
                {i === 0 && <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('ip_type')}</label>}
                <select value={ip.type} onChange={(e) => updateIpRow(i, 'type', e.target.value)}
                  className="px-2 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                  <option value="primary">Primary</option>
                  <option value="additional">Additional</option>
                  <option value="floating">Floating</option>
                </select>
              </div>
              <div>
                {i === 0 && <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('ip_rdns')}</label>}
                <input value={ip.rdns} onChange={(e) => updateIpRow(i, 'rdns', e.target.value)}
                  placeholder="srv1.example.com" className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 font-mono" style={inputStyle} />
              </div>
              <button type="button" onClick={() => removeIpRow(i)}
                className="p-2 rounded-lg hover:bg-white/5 mb-0.5" style={{ color: 'var(--color-danger)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {ips.length === 0 && existingIps.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
          )}
        </div>

        <hr style={{ borderColor: 'var(--color-border)' }} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="ssh_user" label={t('ssh_user')} value={form.ssh_user} onChange={handleChange} />
          <Field name="ssh_port" label={t('ssh_port')} value={form.ssh_port} onChange={handleChange} type="number" />
        </div>
        <Field name="ssh_public_key" label={t('ssh_public_key')} value={form.ssh_public_key} onChange={handleChange} />
        <Field name="ssh_host_key" label={t('ssh_host_key')} value={form.ssh_host_key} onChange={handleChange} />

        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('notes')}</label>
          <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 resize-y" style={inputStyle} />
        </div>

        <div className="flex gap-3 justify-end">
          <Link to={isEdit ? `/servers/${id}` : '/servers'}
            className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
            {t('common:actions.cancel')}
          </Link>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? t('common:actions.loading') : t('common:actions.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
