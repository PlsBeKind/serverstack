import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('title')}</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.loading')}</p>
    </div>
  );
}
