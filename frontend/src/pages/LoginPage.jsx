import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client.js';

export default function LoginPage({ auth }) {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAuthStatus().then(data => {
      setRegistrationOpen(data.registration_open);
      if (data.registration_open) setIsRegister(true);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fn = isRegister ? api.register : api.login;
      const data = await fn({ username, password });
      auth.login(data.token, data.user);
    } catch (err) {
      const key = err.response?.data?.error || err.message;
      setError(t(`auth.${key}`, key));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-surface)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: 'linear-gradient(135deg, var(--color-primary), #06b6d4)' }}>
            <Server size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {isRegister ? t('auth.register_title') : t('auth.login_title')}
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {isRegister ? t('auth.register_subtitle') : t('auth.login_subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          {error && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#451a03', color: '#f87171', border: '1px solid #7f1d1d' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t('auth.username')}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 transition-shadow"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
              autoFocus required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t('auth.password')}</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 transition-shadow pr-10"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
                required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? t('actions.loading') : (isRegister ? t('auth.register') : t('auth.login'))}
          </button>
        </form>

        {registrationOpen && !isRegister && (
          <p className="text-center mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('auth.no_account')}{' '}
            <button onClick={() => setIsRegister(true)}
              className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
              {t('auth.register')}
            </button>
          </p>
        )}

        {isRegister && registrationOpen && (
          <p className="text-center mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('auth.has_account')}{' '}
            <button onClick={() => setIsRegister(false)}
              className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
              {t('auth.login')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
