import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon, Logo } from '../components/Icon';
import { AppBanners } from '../components/Shell';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/lessons', label: 'Lessons', icon: 'book' },
  { to: '/admin/challenges', label: 'Challenges', icon: 'trophy' },
  { to: '/admin/ai', label: 'AI coach', icon: 'cpu' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/audit', label: 'Audit log', icon: 'list' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <div className="admin">
      <div className="admin-top">
        <Logo size={30} />
        <button className="icon-btn dark" aria-label="Menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>
      <aside className={`admin-side ${open ? 'open' : ''}`}>
        <div style={{ padding: '4px 8px 18px' }}>
          <Logo size={32} />
          <span className="tiny" style={{ color: '#8fa3a6', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Admin console</span>
        </div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={l.icon} size={20} />
            {l.label}
          </NavLink>
        ))}
        <div className="grow" />
        <div style={{ padding: '10px 12px', fontSize: 13, color: '#b9cbce' }}>
          <div style={{ fontWeight: 800, color: '#fff' }}>{user?.name}</div>
          <div>{user?.email}</div>
        </div>
        <a
          href="/welcome"
          onClick={async (e) => {
            e.preventDefault();
            await logout();
            nav('/welcome', { replace: true });
          }}
        >
          <Icon name="logout" size={20} /> Log out
        </a>
      </aside>
      <main className="admin-main">
        <AppBanners />
        <Outlet />
      </main>
    </div>
  );
}
