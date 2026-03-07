// src/pages/AdminDashboard.jsx
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home, Calendar, Briefcase, LogOut, BarChart3, Globe, Users,
  CheckCircle2, ShieldCheck, Mail, Menu, X, Star, Mountain,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const GOLD = '#C8872A';
const BLUE = '#2E7BB5';

// ─────────────────────────────────────────────────────────────
// Config de navigation
// ─────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
    links: [
      { to: '/dashboard',             end: true, Icon: BarChart3,    label: 'Tableau de bord',   accent: BLUE },
      { to: '/dashboard/properties',  end: false, Icon: Home,         label: 'Altimmo',           accent: BLUE },
      { to: '/dashboard/events',      end: false, Icon: Calendar,     label: 'Mila Events',       accent: '#D42B2B' },
      { to: '/dashboard/altcom',      end: false, Icon: Briefcase,    label: 'Altcom',            accent: GOLD },
    ],
  },
  {
    label: 'Modération',
    links: [
      { to: '/dashboard/moderation/properties', end: false, Icon: CheckCircle2, label: 'Modération Biens', accent: '#7C3AED' },
      { to: '/dashboard/moderation/reviews',    end: false, Icon: Star,         label: 'Modération Avis',  accent: '#6366F1' },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/dashboard/users',           end: false, Icon: Users,      label: 'Utilisateurs',      accent: '#0D9488' },
      { to: '/dashboard/active-sessions', end: false, Icon: ShieldCheck, label: 'Sessions Actives', accent: '#DC2626' },
    ],
  },
  {
    label: 'Communications',
    links: [
      { to: '/dashboard/messages', end: false, Icon: Mail,       label: 'Boîte de Réception', accent: GOLD },
      { to: '/dashboard/emails',   end: false, Icon: ShieldCheck, label: 'Gestion des Emails', accent: '#F59E0B' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const close = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={close} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`
        w-64 flex flex-col justify-between
        fixed md:sticky top-0 h-screen z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: '#0D1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Header sidebar */}
        <div>
          {/* Brand */}
          <div className="px-5 py-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, #A06820, ${GOLD})` }}>
                <Mountain className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
              </div>
              <div className="leading-none">
                <span className="block text-white font-bold"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem' }}>
                  Altitude<span style={{ color: GOLD }}>-</span>Vision
                </span>
                <span className="block text-white/30"
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.52rem', letterSpacing: '0.2em' }}>
                  ADMIN
                </span>
              </div>
            </div>
            <button onClick={close}
              className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Fermer">
              <X size={18} />
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${GOLD}, ${BLUE})` }}>
                {(user.name || 'A')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>{user.name || 'Admin'}</p>
                <p className="text-white/35 text-xs truncate"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>{user.role || 'Administrateur'}</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="px-3 py-3 space-y-0.5 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {NAV_SECTIONS.map((section, si) => (
              <div key={si}>
                {section.label && (
                  <p className="px-3 pt-3 pb-1 text-white/25 text-xs font-semibold uppercase tracking-widest"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {section.label}
                  </p>
                )}
                {section.links.map(({ to, end, Icon, label, accent }) => (
                  <NavLink key={to} to={to} end={end} onClick={close}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                        isActive
                          ? 'text-white bg-white/10'
                          : 'text-white/50 hover:text-white hover:bg-white/6'
                      }`
                    }
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {({ isActive }) => (
                      <>
                        <Icon size={16} style={{ color: isActive ? accent : undefined, flexShrink: 0 }} />
                        <span>{label}</span>
                        {isActive && (
                          <span className="ml-auto w-1 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: accent }} />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer sidebar */}
        <div className="px-3 py-3 space-y-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { navigate('/'); close(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/6 transition-all"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            <Globe size={16} className="flex-shrink-0" />
            Accueil du site
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-all"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            <LogOut size={16} className="flex-shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen">

        {/* Topbar mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-600 transition-all"
            aria-label="Menu">
            <Menu size={22} />
          </button>
          <span className="text-sm font-bold text-gray-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Dashboard Admin
          </span>
          <div className="w-8" />
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;