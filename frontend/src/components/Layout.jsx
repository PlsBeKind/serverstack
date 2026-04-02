import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Server, Building2, FileText, BarChart3,
  Settings, LogOut, Menu, X, ChevronRight
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/servers', icon: Server, labelKey: 'nav.servers' },
  { path: '/providers', icon: Building2, labelKey: 'nav.providers' },
  { path: '/contracts', icon: FileText, labelKey: 'nav.contracts' },
  { path: '/costs', icon: BarChart3, labelKey: 'nav.costs' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Layout({ auth, children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-surface)' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        transform transition-transform duration-200 ease-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: 'var(--color-surface-raised)', borderRight: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
               style={{ background: 'linear-gradient(135deg, var(--color-primary), #06b6d4)' }}>
            SS
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('app_name')}
          </span>
          <button className="ml-auto lg:hidden p-1 rounded hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, labelKey }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link key={path} to={path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${active ? 'text-white' : 'hover:bg-white/5'}`}
                style={active ? { background: 'var(--color-primary-muted)', color: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
                <Icon size={18} className={active ? '' : 'group-hover:scale-110 transition-transform'} />
                {t(labelKey)}
                {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                 style={{ background: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
              {auth.user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium truncate">{auth.user?.username}</span>
          </div>
          <button onClick={auth.logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-muted)' }}>
            <LogOut size={16} /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3"
                style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu size={20} />
          </button>
          <span className="font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{t('app_name')}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
