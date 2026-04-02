import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client.js';

export default function ContractFormPage() {
  const { t } = useTranslation('contracts');
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [servers, setServers] = useState([]);
  const [form, setForm] = useState({
    server_id: '', contract_number: '', monthly_cost: '', regular_cost: '',
    billing_cycle: 'monthly', start_date: '', end_date: '',
    promo_price: false, promo_end_date: '', cancellation_period_days: '30',
    next_cancellation_date: '', auto_renew: true, notes: '',
  });
  const [providerName, setProviderName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getServers().then(setServers);
    if (isEdit) {
      api.getContract(id).then(c => {
        setForm(prev => ({
          ...prev, ...c,
          promo_price: !!c.promo_price,
          auto_renew: !!c.auto_renew,
          monthly_cost: c.monthly_cost || '',
          regular_cost: c.regular_cost || '',
          cancellation_period_days: c.cancellation_period_days || '30',
        }));
        setProviderName(c.provider_name || '');
      });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newForm = { ...form, [name]: type === 'checkbox' ? checked : value };

    // Auto-fill provider when server is selected
    if (name === 'server_id' && value) {
      const selected = servers.find(s => s.id === Number(value));
      setProviderName(selected?.provider_name || '');
    }

    setForm(newForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const body = {
      ...form,
      server_id: Number(form.server_id),
      monthly_cost: Number(form.monthly_cost) || 0,
      regular_cost: form.regular_cost ? Number(form.regular_cost) : null,
      cancellation_period_days: Number(form.cancellation_period_days) || 30,
    };

    try {
      if (isEdit) { await api.updateContract(id, body); }
      else { await api.createContract(body); }
      navigate('/contracts');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/contracts" className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{isEdit ? t('edit_contract') : t('add_contract')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-5" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {error && <div className="px-3 py-2 rounded text-sm" style={{ background: '#451a03', color: '#f87171' }}>{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('server')}</label>
            <select name="server_id" value={form.server_id} onChange={handleChange} required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
              <option value="">—</option>
              {servers.map(s => <option key={s.id} value={s.id}>{s.name}{s.hostname ? ` (${s.hostname})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('provider')}</label>
            <input type="text" value={providerName} readOnly disabled
              className="w-full px-3 py-2 rounded-lg text-sm outline-none opacity-60" style={inputStyle} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contract_number')}</label>
          <input name="contract_number" value={form.contract_number || ''} onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('monthly_cost')}</label>
            <input name="monthly_cost" type="number" step="0.01" value={form.monthly_cost} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('regular_cost')}</label>
            <input name="regular_cost" type="number" step="0.01" value={form.regular_cost} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('billing_cycle')}</label>
            <select name="billing_cycle" value={form.billing_cycle} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="prepaid">Prepaid</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('start_date')}</label>
            <input name="start_date" type="date" value={form.start_date || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('end_date')}</label>
            <input name="end_date" type="date" value={form.end_date || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="promo_price" checked={form.promo_price} onChange={handleChange} className="w-4 h-4 rounded" />
            {t('promo_price')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="auto_renew" checked={form.auto_renew} onChange={handleChange} className="w-4 h-4 rounded" />
            {t('auto_renew')}
          </label>
        </div>

        {form.promo_price && (
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('promo_end_date')}</label>
            <input name="promo_end_date" type="date" value={form.promo_end_date || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('cancellation_period')}</label>
            <input name="cancellation_period_days" type="number" value={form.cancellation_period_days} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('next_cancellation')}</label>
            <input name="next_cancellation_date" type="date" value={form.next_cancellation_date || ''} onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2" style={inputStyle} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('notes')}</label>
          <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y focus:ring-2" style={inputStyle} />
        </div>

        <div className="flex gap-3 justify-end">
          <Link to="/contracts" className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}>
            {t('common:actions.cancel')}
          </Link>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? t('common:actions.loading') : t('common:actions.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
