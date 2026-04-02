import { useTranslation } from 'react-i18next';

const statusColors = {
  active: { bg: '#064e3b', text: '#10b981', dot: '#10b981' },
  inactive: { bg: '#451a03', text: '#f59e0b', dot: '#f59e0b' },
  suspended: { bg: '#4c1d95', text: '#a78bfa', dot: '#a78bfa' },
  running: { bg: '#064e3b', text: '#10b981', dot: '#10b981' },
  stopped: { bg: '#7f1d1d', text: '#f87171', dot: '#f87171' },
  unknown: { bg: '#1e293b', text: '#94a3b8', dot: '#94a3b8' },
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const colors = statusColors[status] || statusColors.unknown;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: colors.bg, color: colors.text }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: colors.dot }} />
      {t(`status.${status}`, status)}
    </span>
  );
}
