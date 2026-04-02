import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client.js';

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
    ssh_host_key: '', login_user: '', login_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getProviders().then(setProviders);
    if (isEdit) {
      api.getServer(id).then(s => setForm(prev => ({
        ...prev, ...s,
        cpu_cores: s.cpu_cores || '', ram_mb: s.ram_mb || '',
        storage_gb: s.storage_gb || '', ssh_port: s.ssh_port || '22',
        login_password: '',
      })));
    }
  }, [id, isEdit]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
    if (!body.login_password) delete body.login_password;

    try {
      if (isEdit) {
        await api.updateServer(id, body);
        navigate(`/servers/${id}`);
      } else {
        const created = await api.createServer(body);
        navigate(`/servers/${created.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  const Field = ({ name, label, type = 'text', ...rest }) => (
    <div>
      <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <input type={type} name={name} value={form[name] || ''} onChange={handleChange}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} {...rest} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to={isEdit ? `/servers/${id}` : '/servers'} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{isEdit ? t('edit_server') : t('add_server')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {error && <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#451a03', color: '#f87171' }}>{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="name" label={t('name')} required />
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
          <Field name="hostname" label={t('hostname')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="location" label={t('location')} />
          <Field name="os" label={t('os')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Field name="cpu_cores" label={t('cpu_cores')} type="number" />
          <Field name="ram_mb" label={t('ram_mb')} type="number" />
          <Field name="storage_gb" label={t('storage_gb')} type="number" />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="ssh_user" label={t('ssh_user')} />
          <Field name="ssh_port" label={t('ssh_port')} type="number" />
        </div>
        <Field name="ssh_public_key" label={t('ssh_public_key')} />
        <Field name="ssh_host_key" label={t('ssh_host_key')} />

        <hr style={{ borderColor: 'var(--color-border)' }} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="login_user" label={t('login_user')} />
          <Field name="login_password" label={t('login_password')} type="password" placeholder={isEdit ? '(unchanged)' : ''} />
        </div>

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
