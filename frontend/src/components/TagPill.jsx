import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function TagPill({ tag, onRemove }) {
  const { t } = useTranslation('servers');

  // Preset tags get translated, custom tags show as-is
  const label = tag.is_preset ? t(`tag_${tag.name}`, tag.name) : tag.name;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all"
      style={{ background: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
      {label}
      {onRemove && (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(tag.id); }}
          className="ml-0.5 hover:opacity-70 transition-opacity"><X size={10} /></button>
      )}
    </span>
  );
}
