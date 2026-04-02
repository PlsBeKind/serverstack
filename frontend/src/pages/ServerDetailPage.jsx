import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Network, Cog } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ServerDetailPage() {
  const { t } = useTranslation('servers');
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [services, setServices] = useState([]);
  const [ips, setIps] = useState([]);
  const [password, setPassword] = useState(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    Promise.all([api.getServer(id), api.getServerServices(id), api.getServerIps(id)])
      .then(([s, svc, ipList]) => { setServer(s); setServices(svc); setIps(ipList); });
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(t('confirm_delete'))) return;
    await api.deleteServer(id);
    navigate('/servers');
  };

  const revealPassword = async () => {
    if (showPw) { setShowPw(false); return; }
    const data = await api.getServerPassword(id);
    setPassword(data.password);
    setShowPw(true);
  };

  if (!server) return <div className="text-center py-16 opacity-50">{t('common:actions.loading')}</div>;

  const fields = [
    ['name', server.name], ['type', server.type], ['hostname', server.hostname],
    ['provider', server.provider_name], ['location', server.location], ['os', server.os],
    ['cpu_cores', server.cpu_cores], ['ram_mb', server.ram_mb ? `${server.ram_mb} MB` : null],
    ['storage_gb', server.storage_gb ? `${server.storage_gb} GB` : null],
    ['storage_type', server.storage_type],
    ['ssh_user', server.ssh_user], ['ssh_port', server.ssh_port], ['login_user', server.login_user],
  ].filter(([_, v]) => v != null);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/servers" className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold flex-1" style={{ fontFamily: 'var(--font-heading)' }}>{server.name}</h1>
        <StatusBadge status={server.status} />
        <Link to={`/servers/${id}/edit`} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-primary)' }}><Edit size={18} /></Link>
        <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={18} /></button>
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(([key, val]) => (
            <div key={key}>
              <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t(key)}</p>
              <p className="text-sm font-mono">{val}</p>
            </div>
          ))}
        </div>

        {server.has_password && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('login_password')}</p>
              <button onClick={revealPassword} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                {showPw ? <><EyeOff size={12} /> {t('hide_password')}</> : <><Eye size={12} /> {t('reveal_password')}</>}
              </button>
            </div>
            {showPw && <p className="mt-1 text-sm font-mono px-3 py-2 rounded" style={{ background: 'var(--color-surface)' }}>{password}</p>}
          </div>
        )}

        {server.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t('notes')}</p>
            <p className="text-sm whitespace-pre-wrap">{server.notes}</p>
          </div>
        )}
      </div>

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
