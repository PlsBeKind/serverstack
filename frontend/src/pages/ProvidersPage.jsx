import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, Pencil, Trash2, X, ExternalLink, TrendingUp } from 'lucide-react';
import { api } from '../api/client.js';

export default function ProvidersPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [surgeProvider, setSurgeProvider] = useState(null);
  const [surgeForm, setSurgeForm] = useState({ percentage: '', effective_date: '' });
  const [surgeResult, setSurgeResult] = useState(null);
  const [form, setForm] = useState({ name: '', website: '', support_email: '', support_phone: '', notes: '' });
  const [error, setError] = useState('');

  const load = () => api.getProviders().then(setProviders);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) { await api.updateProvider(editing.id, form); }
      else { await api.createProvider(form); }
      setShowForm(false); setEditing(null);
      setForm({ name: '', website: '', support_email: '', support_phone: '', notes: '' });
      load();
    } catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, website: p.website || '', support_email: p.support_email || '', support_phone: p.support_phone || '', notes: p.notes || '' });
    setShowForm(true);
  };

  const handleDelete = async (p) => {
    if (!confirm(`${t('actions.delete')} "${p.name}"?`)) return;
    try { await api.deleteProvider(p.id); load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  };

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('nav.providers')}</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', website: '', support_email: '', support_phone: '', notes: '' }); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all"
          style={{ background: 'var(--color-primary)' }}>
          <Plus size={16} /> {t('actions.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-4 animate-fade-in"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? t('actions.edit') : t('actions.add')}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded"><X size={16} /></button>
          </div>
          {error && <div className="px-3 py-2 rounded text-sm" style={{ background: '#451a03', color: '#f87171' }}>{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              placeholder={t('nav.providers')} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <input name="website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="https://..." className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="support_email" value={form.support_email} onChange={e => setForm({ ...form, support_email: e.target.value })}
              placeholder="support@..." className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <input name="support_phone" value={form.support_phone} onChange={e => setForm({ ...form, support_phone: e.target.value })}
              placeholder="+49..." className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-white/5"
              style={{ color: 'var(--color-text-muted)' }}>{t('actions.cancel')}</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:scale-[1.02] transition-all"
              style={{ background: 'var(--color-primary)' }}>{t('actions.save')}</button>
          </div>
        </form>
      )}

      {providers.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={48} className="mx-auto mb-4 opacity-20" />
          <p style={{ color: 'var(--color-text-muted)' }}>{t('actions.no_data')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id}>
              <div className="rounded-xl p-4 flex items-center gap-4 hover-lift"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: surgeProvider === p.id ? '12px 12px 0 0' : undefined }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.name}</p>
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noreferrer"
                      className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                      {p.website} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <button onClick={() => { setSurgeProvider(surgeProvider === p.id ? null : p.id); setSurgeResult(null); setSurgeForm({ percentage: '', effective_date: '' }); }}
                  className="p-2 rounded-lg hover:bg-white/5" style={{ color: '#f59e0b' }} title={t('providers_page.price_surge')}>
                  <TrendingUp size={14} />
                </button>
                <button onClick={() => handleEdit(p)} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-text-muted)' }}><Pencil size={14} /></button>
                <button onClick={() => handleDelete(p)} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
              </div>

              {surgeProvider === p.id && (
                <div className="p-4 animate-fade-in rounded-b-xl" style={{ background: 'var(--color-surface-raised)', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                  {surgeResult ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {t('providers_page.surge_applied', { count: surgeResult.affected_servers })}
                      </p>
                      {surgeResult.servers.map(s => (
                        <div key={s.server_id} className="flex items-center justify-between px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-surface)' }}>
                          <span>{s.server_name}</span>
                          <span className="font-mono" style={{ color: '#f59e0b' }}>€{s.old_cost.toFixed(2)} → €{s.new_cost.toFixed(2)}</span>
                        </div>
                      ))}
                      <button onClick={() => { setSurgeProvider(null); setSurgeResult(null); }}
                        className="text-xs mt-2 hover:underline" style={{ color: 'var(--color-text-muted)' }}>{t('actions.confirm')}</button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('providers_page.percentage')}</label>
                        <input type="text" inputMode="decimal" value={surgeForm.percentage} onChange={e => setSurgeForm(f => ({ ...f, percentage: e.target.value }))}
                          placeholder="+18.51" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('providers_page.effective_date')}</label>
                        <input type="date" value={surgeForm.effective_date} onChange={e => setSurgeForm(f => ({ ...f, effective_date: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      </div>
                      <button onClick={async () => {
                        if (!surgeForm.percentage || !surgeForm.effective_date) return;
                        const result = await api.applyPriceSurge(p.id, { percentage: surgeForm.percentage, effective_date: surgeForm.effective_date, reason: 'price_increase' });
                        setSurgeResult(result);
                      }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all"
                        style={{ background: '#f59e0b' }}>
                        {t('providers_page.apply_surge')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
