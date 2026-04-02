import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Network, Cog, KeyRound, Plus, X } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ServerDetailPage() {
  const { t } = useTranslation('servers');
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [services, setServices] = useState([]);
  const [ips, setIps] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [revealedPws, setRevealedPws] = useState({});
  const [showCredForm, setShowCredForm] = useState(false);
  const [credForm, setCredForm] = useState({ label: '', username: '', password: '', notes: '' });

  const loadData = () => {
    Promise.all([api.getServer(id), api.getServerServices(id), api.getServerIps(id), api.getServerCredentials(id)])
      .then(([s, svc, ipList, creds]) => { setServer(s); setServices(svc); setIps(ipList); setCredentials(creds); });
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
    ['storage_gb', server.storage_gb ? `${server.storage_gb} GB` : null],
    ['storage_type', server.storage_type],
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
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-4"><Cog size={16} style={{ color: 'var(--color-primary)' }} /> {t('services')}</h3>
        {services.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common:actions.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {services.map(svc => (
              <div key={svc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)' }}>
                <span className="font-mono font-medium">{svc.name}</span>
                {svc.port && <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>:{svc.port}</span>}
                {svc.category && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{svc.category}</span>}
                <StatusBadge status={svc.status} />
              </div>
            ))}
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
