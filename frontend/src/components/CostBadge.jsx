function getDefaultCurrency() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('currency') || 'EUR';
  }
  return 'EUR';
}

export default function CostBadge({ amount, currency, promo = false }) {
  const cur = currency || getDefaultCurrency();
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(amount || 0);

  return (
    <span className={`font-mono text-sm font-semibold ${promo ? 'text-emerald-400' : 'text-slate-200'}`}>
      {formatted}
      {promo && (
        <span className="ml-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: '#064e3b', color: '#10b981' }}>
          PROMO
        </span>
      )}
    </span>
  );
}
