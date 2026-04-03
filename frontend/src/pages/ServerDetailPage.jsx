import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Network, Cog, KeyRound, HardDrive, Plus, X, FileText, Tag, DollarSign } from 'lucide-react';
import CostBadge from '../components/CostBadge.jsx';
import TagPill from '../components/TagPill.jsx';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ServerDetailPage() {
  const { t } = useTranslation('servers');
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [services, setServices] = useState([]);
  const [ips, setIps] = useState([]);
  const [disks, setDisks] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [revealedPws, setRevealedPws] = useState({});
  const [allTags, setAllTags] = useState([]);
  const [costHistory, setCostHistory] = useState([]);
  const [showPriceChange, setShowPriceChange] = useState(false);
  const [priceForm, setPriceForm] = useState({ new_cost: '', reason: 'price_increase' });
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: '', category: '', port: '', url: '', domain: '', protocol: 'tcp', docker: false, notes: '' });
  const [showCredForm, setShowCredForm] = useState(false);
  const [credForm, setCredForm] = useState({ label: '', username: '', password: '', notes: '' });

  const loadData = () => {
    Promise.all([api.getServer(id), api.getServerServices(id), api.getServerIps(id), api.getServerDisks(id), api.getServerCredentials(id), api.getTags(), api.getCostHistory(id)])
      .then(([s, svc, ipList, diskList, creds, tags, history]) => { setServer(s); setServices(svc); setIps(ipList); setDisks(diskList); setCredentials(creds); setAllTags(tags); setCostHistory(history); });
  };

  useEffect(() => { loadData(); }, [id]);

  const handleDelete = async () => {
    if (!confirm(t('confirm_delete'))) return;
    await api.deleteServer(id);
    navigate('/servers');
  };

  const revealPassword = async (credId) => {
    if (revealedPws[credId]) {
      setRevealedPws(prev => { const next = { ...prev }; delete next[credId]; return next; });
      return;
    }
    const data = await api.getCredentialPassword(id, credId);
    setRevealedPws(prev => ({ ...prev, [credId]: data.password }));
  };

  const handleAddCred = async (e) => {
    e.preventDefault();
    await api.createCredential(id, credForm);
    setCredForm({ label: '', username: '', password: '', notes: '' });
    setShowCredForm(false);
    loadData();
  };

  const handleDeleteCred = async (credId) => {
    await api.deleteCredential(id, credId);
    loadData();
  };

  if (!server) return <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>;

  const fields = [
    ['name', server.name], ['type', server.type], ['hostname', server.hostname],
    ['provider', server.provider_name], ['location', server.location], ['os', server.os],
    ['cpu_cores', server.cpu_cores], ['ram_mb', server.ram_mb ? `${server.ram_mb} MB` : null],
    ['ssh_user', server.ssh_user], ['ssh_port', server.ssh_port],
  ].filter(([_, v]) => v != null);

  const inputStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/servers" className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold flex-1" style={{ fontFamily: 'var(--font-heading)' }}>{server.name}</h1>
        <StatusBadge status={server.status} />
        <Link to={`/servers/${id}/edit`} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-primary)' }}><Edit size={18} /></Link>
        <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={18} /></button>
      </div>

      {/* Server info */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(([key, val]) => (
            <div key={key}>
              <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t(key)}</p>
              <p className="text-sm font-mono">{val}</p>
            </div>
          ))}
        </div>
        {server.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('notes')}</p>
            <p className="text-sm whitespace-pre-wrap">{server.notes}</p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3"><Tag size={16} style={{ color: 'var(--color-primary)' }} /> {t('tags')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {server.tags?.map(tag => (
            <TagPill key={tag.id} tag={tag} onRemove={async (tagId) => { await api.removeTag(id, tagId); loadData(); }} />
          ))}
          {(() => {
            const assignedIds = new Set(server.tags?.map(t => t.id) || []);
            const available = allTags.filter(t => !assignedIds.has(t.id));
            if (available.length === 0) return null;
            return (
              <select onChange={async (e) => { if (e.target.value) { await api.assignTag(id, Number(e.target.value)); loadData(); e.target.value = ''; } }}
                className="px-2 py-1 rounded-lg text-xs outline-none" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <option value="">+ {t('add_tag')}</option>
                {available.map(tg => <option key={tg.id} value={tg.id}>{tg.is_preset ? t(`tag_${tg.name}`, tg.name) : tg.name}</option>)}
              </select>
            );
          })()}
        </div>
      </div>

      {/* Contract info */}
      {(server.monthly_cost > 0 || server.contract_number || server.contract_start_date) && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><FileText size={16} style={{ color: '#f59e0b' }} /> {t('contracts:title', 'Contract')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {server.monthly_cost > 0 && (
              <div>
                <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:monthly_cost')}</p>
                <CostBadge amount={server.monthly_cost} promo={!!server.promo_price} />
              </div>
            )}
            {server.regular_cost && (
              <div>
                <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:regular_cost')}</p>
                <CostBadge amount={server.regular_cost} />
              </div>
            )}
            {server.billing_cycle && (
              <div>
                <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:billing_cycle')}</p>
                <p className="text-sm capitalize">{server.billing_cycle}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {server.contract_number && (
              <div><p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:contract_number')}</p><p className="text-sm font-mono">{server.contract_number}</p></div>
            )}
            {server.contract_period && (
              <div><p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:contract_period')}</p><p className="text-sm">{server.contract_period}</p></div>
            )}
            {server.contract_start_date && (
              <div><p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:start_date')}</p><p className="text-sm">{server.contract_start_date}</p></div>
            )}
            {server.next_cancellation_date && (
              <div><p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('contracts:next_cancellation')}</p><p className="text-sm">{server.next_cancellation_date}</p></div>
            )}
          </div>
          <div className="flex gap-3 mt-3">
            {server.is_cancelled ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#7f1d1d', color: '#f87171' }}>{t('contracts:is_cancelled')}</span> : null}
            {server.auto_renew ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#10b981' }}>{t('contracts:auto_renew')}</span> : null}
          </div>

          {/* Smart billing + contract status */}
          {server.monthly_cost > 0 && (
            <div className="mt-4 pt-4 space-y-2 text-sm" style={{ borderTop: '1px solid var(--color-border)' }}>
              {!server.is_cancelled && (() => {
                const now = new Date(); now.setHours(0, 0, 0, 0);
                const addM = (date, m) => { const r = new Date(date); const od = r.getDate(); r.setDate(1); r.setMonth(r.getMonth() + m); const ld = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate(); r.setDate(Math.min(od, ld)); return r; };
                const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
                const daysTo = (d) => Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                const timeStr = (d) => { const n = daysTo(d); return n === 0 ? t('dashboard:today') : n === 1 ? t('dashboard:in_1_day') : t('dashboard:in_days', { count: n }); };
                const cm = { monthly: 1, quarterly: 3, 'semi-annual': 6, yearly: 12, biennial: 24 }[server.billing_cycle] || null;
                const billingAmount = server.monthly_cost * (cm || 1);

                // Prepaid: end_date is the renewal date
                if (server.billing_cycle === 'prepaid') {
                  if (!server.contract_end_date) return <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:prepaid')} — {t('contracts:no_billing_data')}</p>;
                  const end = parse(server.contract_end_date);
                  const d = daysTo(end);
                  if (d < 0) return <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:prepaid')} — {t('dashboard:expired')} {server.contract_end_date}</p>;
                  return <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:prepaid')} — {server.contract_end_date} ({timeStr(end)})</p>;
                }

                // Recurring: calculate from start_date, fallback to end_date day
                if (cm) {
                  let refDate = server.contract_start_date || server.contract_end_date;
                  if (refDate) {
                    let ref = parse(refDate);
                    // If ref is in the future (derived from end_date), walk backwards first
                    while (ref > now) ref = addM(ref, -cm);
                    let next = new Date(ref);
                    while (next <= now) next = addM(next, cm);
                    const d = daysTo(next);
                    const color = d <= 7 ? '#f59e0b' : 'var(--color-text)';
                    return <p><span style={{ color: 'var(--color-text-muted)' }}>{t('contracts:next_billing')}: </span><CostBadge amount={billingAmount} /><span style={{ color }}> {fmt(next)} ({timeStr(next)})</span></p>;
                  }
                }

                return <p style={{ color: '#6b7280' }}><CostBadge amount={billingAmount} /> — {t('contracts:no_billing_data')}</p>;
              })()}

              {/* Contract status */}
              {server.contract_end_date ? (() => {
                const d = Math.ceil((new Date(...server.contract_end_date.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
                if (server.auto_renew) return <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:contract_renews')}: {server.contract_end_date}</p>;
                if (d < 0) return <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:contract_expires')}: {server.contract_end_date} — {t('dashboard:expired')}</p>;
                return <p style={{ color: d <= 30 ? '#f59e0b' : 'var(--color-text-muted)' }}>{t('contracts:contract_expires')}: {server.contract_end_date} ({t('dashboard:in_days', { count: d })})</p>;
              })() : <p style={{ color: 'var(--color-text-muted)' }}>{t('contracts:contract_indefinite')}</p>}
            </div>
          )}
        </div>
      )}

      {/* Disks */}
      {disks.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <HardDrive size={16} style={{ color: '#8b5cf6' }} /> {t('disks')}
            <span className="ml-auto text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {disks.reduce((s, d) => s + (d.size_gb || 0), 0)} GB
            </span>
          </h3>
          <div className="space-y-2">
            {disks.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                {d.label && <span className="font-medium">{d.label}</span>}
                <span className="font-mono">{d.size_gb} GB</span>
                <span className="text-xs px-1.5 py-0.5 rounded uppercase" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)' }}>{d.type}</span>
                {d.monthly_cost && <span className="text-xs font-mono" style={{ color: 'var(--color-warning)' }}>+{d.monthly_cost}/mo</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost History */}
      {(costHistory.length > 0 || server.monthly_cost > 0) && (
        <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><DollarSign size={16} style={{ color: '#f59e0b' }} /> {t('cost_history')}</h3>
            <button onClick={() => setShowPriceChange(!showPriceChange)}
              className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
              {showPriceChange ? <X size={12} /> : <Plus size={12} />} {t('price_change')}
            </button>
          </div>

          {showPriceChange && (
            <div className="mb-4 p-4 rounded-lg space-y-3 animate-fade-in" style={{ background: 'var(--color-surface)' }}>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" inputMode="decimal" placeholder={t('new_price')} value={priceForm.new_cost}
                  onChange={e => setPriceForm(f => ({ ...f, new_cost: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm outline-none font-mono" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                <select value={priceForm.reason} onChange={e => setPriceForm(f => ({ ...f, reason: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="price_increase">{t('reason_price_increase')}</option>
                  <option value="promo_start">{t('reason_promo_start')}</option>
                  <option value="promo_end">{t('reason_promo_end')}</option>
                  <option value="manual">{t('reason_manual')}</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button onClick={async () => {
                  if (!priceForm.new_cost) return;
                  await api.priceChange(id, priceForm);
                  setPriceForm({ new_cost: '', reason: 'price_increase' });
                  setShowPriceChange(false);
                  loadData();
                }} className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:scale-[1.02] transition-all"
                  style={{ background: 'var(--color-primary)' }}>{t('common:actions.save')}</button>
              </div>
            </div>
          )}

          {costHistory.length > 0 ? (
            <div className="space-y-2">
              {costHistory.map(entry => {
                const reasonColors = { price_increase: '#ef4444', promo_start: '#10b981', promo_end: '#f59e0b', manual: '#6b7280' };
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{entry.changed_at?.split(' ')[0] || '—'}</span>
                    <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {entry.old_cost != null ? <CostBadge amount={entry.old_cost} /> : '—'}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                    <CostBadge amount={entry.new_cost} />
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto"
                      style={{ background: `${reasonColors[entry.reason] || '#6b7280'}20`, color: reasonColors[entry.reason] || '#6b7280' }}>
                      {t(`reason_${entry.reason}`, entry.reason)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
          )}
        </div>
      )}

      {/* Credentials */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} style={{ color: '#f59e0b' }} /> {t('credentials')}</h3>
          <button onClick={() => setShowCredForm(!showCredForm)} className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
            {showCredForm ? <X size={12} /> : <Plus size={12} />} {showCredForm ? t('common:actions.cancel') : t('add_credential')}
          </button>
        </div>

        {showCredForm && (
          <form onSubmit={handleAddCred} className="mb-4 p-4 rounded-lg space-y-3 animate-fade-in" style={{ background: 'var(--color-surface)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder={t('credential_label')} value={credForm.label} onChange={e => setCredForm(f => ({ ...f, label: e.target.value }))} required
                className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              <input placeholder={t('credential_username')} value={credForm.username} onChange={e => setCredForm(f => ({ ...f, username: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <input type="password" placeholder={t('credential_password')} value={credForm.password} onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:scale-[1.02] transition-all"
                style={{ background: 'var(--color-primary)' }}>{t('common:actions.save')}</button>
            </div>
          </form>
        )}

        {credentials.length === 0 && !showCredForm ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {credentials.map(cred => (
              <div key={cred.id} className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{cred.label}</span>
                  {cred.username && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{cred.username}</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => revealPassword(cred.id)} className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                      {revealedPws[cred.id] ? <><EyeOff size={12} className="inline" /> {t('hide_password')}</> : <><Eye size={12} className="inline" /> {t('reveal_password')}</>}
                    </button>
                    <button onClick={() => handleDeleteCred(cred.id)} className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                  </div>
                </div>
                {revealedPws[cred.id] && (
                  <p className="mt-1.5 font-mono text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-surface-raised)' }}>{revealedPws[cred.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Services */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Cog size={16} style={{ color: 'var(--color-primary)' }} /> {t('services')}</h3>
          <button onClick={() => setShowSvcForm(!showSvcForm)} className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
            {showSvcForm ? <X size={12} /> : <Plus size={12} />} {showSvcForm ? t('common:actions.cancel') : t('add_service')}
          </button>
        </div>

        {showSvcForm && (
          <div className="mb-4 p-4 rounded-lg space-y-3 animate-fade-in" style={{ background: 'var(--color-surface)' }}>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={t('service_name')} value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              <select value={svcForm.category} onChange={e => setSvcForm(f => ({ ...f, category: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="">{t('service_category')}</option>
                <option value="web">{t('category_web')}</option>
                <option value="database">{t('category_database')}</option>
                <option value="monitoring">{t('category_monitoring')}</option>
                <option value="media">{t('category_media')}</option>
                <option value="other">{t('category_other')}</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input placeholder={t('service_domain')} value={svcForm.domain} onChange={e => setSvcForm(f => ({ ...f, domain: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
              <input type="number" placeholder={t('service_port')} value={svcForm.port} onChange={e => setSvcForm(f => ({ ...f, port: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
              <select value={svcForm.protocol} onChange={e => setSvcForm(f => ({ ...f, protocol: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={svcForm.docker} onChange={e => setSvcForm(f => ({ ...f, docker: e.target.checked }))} className="w-4 h-4 rounded" />
                {t('service_docker')}
              </label>
            </div>
            <div className="flex justify-end">
              <button onClick={async () => {
                if (!svcForm.name) return;
                await api.createService({ server_id: Number(id), ...svcForm, port: svcForm.port ? Number(svcForm.port) : null });
                setSvcForm({ name: '', category: '', port: '', url: '', domain: '', protocol: 'tcp', docker: false, notes: '' });
                setShowSvcForm(false); loadData();
              }} className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:scale-[1.02] transition-all"
                style={{ background: 'var(--color-primary)' }}>{t('common:actions.save')}</button>
            </div>
          </div>
        )}

        {services.length === 0 && !showSvcForm ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {services.map(svc => {
              const catColors = { web: '#10b981', database: '#3b82f6', monitoring: '#f59e0b', media: '#8b5cf6', other: '#6b7280' };
              return (
                <div key={svc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                  <StatusBadge status={svc.status} />
                  <span className="font-semibold">{svc.name}</span>
                  {svc.category && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: `${catColors[svc.category] || '#6b7280'}20`, color: catColors[svc.category] || '#6b7280' }}>
                      {t(`category_${svc.category}`, svc.category)}
                    </span>
                  )}
                  {svc.domain && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{svc.domain}</span>}
                  {svc.port && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>:{svc.port}</span>}
                  {svc.protocol && <span className="text-[10px] uppercase" style={{ color: 'var(--color-text-muted)' }}>{svc.protocol}</span>}
                  {svc.docker ? <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: '#06469520', color: '#0ea5e9' }}>Docker</span> : null}
                  <button onClick={async () => { await api.deleteService(svc.id); loadData(); }}
                    className="ml-auto p-1 rounded hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IPs */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><Network size={16} style={{ color: '#06b6d4' }} /> {t('ip_addresses')}</h3>
        {ips.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {ips.map(ip => (
              <div key={ip.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <span className="font-mono">{ip.address}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-muted)' }}>{ip.version}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#064e3b', color: '#10b981' }}>{ip.type}</span>
                {ip.rdns && <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{ip.rdns}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
