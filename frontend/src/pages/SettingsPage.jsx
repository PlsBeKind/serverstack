import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Lock, Download, Upload, Check, AlertCircle, DollarSign } from 'lucide-react';
import { api } from '../api/client.js';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK'];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'EUR');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const changeCurrency = (cur) => {
    setCurrency(cur);
    localStorage.setItem('currency', cur);
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    setPwMsg(''); setPwError('');
    try {
      await api.changePassword(pwForm);
      setPwMsg(t('auth.password_changed'));
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      const key = err.response?.data?.error || err.message;
      setPwError(t(`auth.${key}`, key));
    }
  };

  const handleExport = async () => {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `serverstack-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(''); setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.importData(data);
      setImportMsg(`${t('settings.import_success')}: ${JSON.stringify(result.imported)}`);
    } catch (err) {
      setImportError(t('settings.import_error') + ': ' + (err.response?.data?.error || err.message));
    }
    e.target.value = '';
  };

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };
  const cardStyle = { background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('settings.title')}</h1>

      <div className="rounded-xl p-6" style={cardStyle}>
        <h3 className="flex items-center gap-2 font-semibold mb-4"><Globe size={18} style={{ color: 'var(--color-primary)' }} /> {t('settings.language')}</h3>
        <div className="flex gap-2">
          {['en', 'de'].map(lng => (
            <button key={lng} onClick={() => changeLanguage(lng)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${i18n.language === lng ? 'text-white' : 'hover:bg-white/5'}`}
              style={i18n.language === lng ? { background: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
              {t(`language.${lng}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-6" style={cardStyle}>
        <h3 className="flex items-center gap-2 font-semibold mb-4"><DollarSign size={18} style={{ color: '#f59e0b' }} /> {t('settings.currency')}</h3>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map(cur => (
            <button key={cur} onClick={() => changeCurrency(cur)}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-mono transition-all ${currency === cur ? 'text-white' : 'hover:bg-white/5'}`}
              style={currency === cur ? { background: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
              {cur}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-6" style={cardStyle}>
        <h3 className="flex items-center gap-2 font-semibold mb-4"><Lock size={18} style={{ color: '#8b5cf6' }} /> {t('settings.change_password')}</h3>
        <form onSubmit={handleChangePw} className="space-y-3">
          {pwMsg && <div className="flex items-center gap-2 px-3 py-2 rounded text-sm" style={{ background: '#064e3b', color: '#10b981' }}><Check size={14} /> {pwMsg}</div>}
          {pwError && <div className="flex items-center gap-2 px-3 py-2 rounded text-sm" style={{ background: '#451a03', color: '#f87171' }}><AlertCircle size={14} /> {pwError}</div>}
          <input type="password" placeholder={t('auth.current_password')} value={pwForm.currentPassword}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <input type="password" placeholder={t('auth.new_password')} value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:scale-[1.02] transition-all"
            style={{ background: 'var(--color-primary)' }}>{t('auth.change_password')}</button>
        </form>
      </div>

      <div className="rounded-xl p-6" style={cardStyle}>
        <h3 className="flex items-center gap-2 font-semibold mb-4"><Download size={18} style={{ color: '#06b6d4' }} /> {t('settings.export_import')}</h3>
        {importMsg && <div className="flex items-center gap-2 px-3 py-2 rounded text-sm mb-3" style={{ background: '#064e3b', color: '#10b981' }}><Check size={14} /> {importMsg}</div>}
        {importError && <div className="flex items-center gap-2 px-3 py-2 rounded text-sm mb-3" style={{ background: '#451a03', color: '#f87171' }}><AlertCircle size={14} /> {importError}</div>}
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            <Download size={16} /> {t('settings.export_desc')}
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            <Upload size={16} /> {t('settings.import_desc')}
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>
    </div>
  );
}
