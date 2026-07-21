"use client";
// src/pages/dashboard/OwnerDashboard.jsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  User, LogOut, Globe, ShieldCheck, Menu, X, Building, Mountain, Calendar,
  MessageCircle, Palmtree, Landmark, KeyRound, Building2, CreditCard, BookOpenCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from '../../context/AuthContext';
import { getOwnerVisitesUnreadCount } from '../../services/visiteService';

const BLUE  = '#2E7BB5';
const GOLD  = '#C8960C';
const GREEN = '#16A34A';

// Sprint 0 (architecture Altimmo) — "Mes annonces" regroupe Vente/Location
// (toujours sur /mes-biens, formulaire generique inchangé — voir
// ARCHITECTURE_ALTIMMO_V2.md, la séparation par formulaire dédié
// SalePropertyForm/RentalPropertyForm reste un flux admin uniquement pour
// l'instant) et Hébergement (page propriétaire déjà dédiée). "Mes hôtels"
// et "Mes paiements" préparent la navigation uniquement (pages vides).
const NAV_LINKS = [
  { to: '/mes-biens',                    end: true,  Icon: Building,      label: 'Toutes mes annonces', accent: BLUE, section: 'Mes annonces' },
  { to: '/mes-biens?status=vente',       end: false, Icon: Landmark,      label: 'Vente',                accent: BLUE, section: 'Mes annonces' },
  { to: '/mes-biens?status=location',    end: false, Icon: KeyRound,      label: 'Location',             accent: BLUE, section: 'Mes annonces' },
  { to: '/mes-hebergements',             end: true,  Icon: Palmtree,      label: 'Hébergement',          accent: GOLD, section: 'Mes annonces' },
  { to: '/mes-hotels',                   end: true,  Icon: Building2,     label: 'Mes hôtels',           accent: GOLD, section: null },
  { to: '/mes-hotels/reservations',       end: true,  Icon: BookOpenCheck, label: 'Mes réservations',     accent: GOLD, section: null },
  { to: '/mes-biens/visites',            end: false, Icon: Calendar,      label: 'Mes rendez-vous',      accent: GOLD, section: null },
  { to: '/mes-biens/paiements',          end: false, Icon: CreditCard,    label: 'Mes paiements',        accent: GOLD, section: null },
  { to: '/messages',                     end: false, Icon: MessageCircle, label: 'Mes messages',         accent: BLUE, section: null },
  { to: '/profile',                      end: false, Icon: User,          label: 'Mon profil',           accent: GOLD, section: null },
  { to: '/mes-biens/securite',           end: false, Icon: ShieldCheck,   label: 'Sécurité',              accent: GREEN, section: null },
];

const OwnerDashboard = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (to, end = false) => end ? pathname === to : pathname.startsWith(to);
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rendezVousBadge, setRendezVousBadge] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const refreshBadge = () => getOwnerVisitesUnreadCount().then(setRendezVousBadge).catch(() => setRendezVousBadge(0));
    refreshBadge();
    window.addEventListener('altitude:owner-visites:read', refreshBadge);
    return () => window.removeEventListener('altitude:owner-visites:read', refreshBadge);
  }, [user, pathname]);

  const handleLogout = () => {
    logout();
    toast.success("Déconnexion réussie.");
    router.push("/login");
  };

  const close = () => setSidebarOpen(false);
  const activeTitle = NAV_LINKS.find(link => isActive(link.to, link.end))?.label || 'Espace Propriétaire';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab' && sidebarRef.current) {
        const focusable = [...sidebarRef.current.querySelectorAll('a[href], button:not([disabled])')];
        if (!focusable.length) return;
        const [first] = focusable;
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={close} aria-hidden="true" />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`
        w-64 flex flex-col justify-between
        fixed md:sticky top-0 h-[100dvh] z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: '#0D1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        ref={sidebarRef}
        id="owner-navigation"
        aria-label="Navigation propriétaire"
        aria-hidden={isMobileViewport && !sidebarOpen}
        inert={isMobileViewport && !sidebarOpen ? '' : undefined}
      >

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
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.52rem', letterSpacing: '0.2em' }}>
                  PROPRIÉTAIRE
                </span>
              </div>
            </div>
            <button onClick={close} ref={closeButtonRef}
              className="md:hidden min-h-11 min-w-11 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-all"
              aria-label="Fermer le menu">
              <X size={18} />
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${GOLD}, ${BLUE})` }}>
                {(user.name || 'P')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>{user.name || 'Propriétaire'}</p>
                <p className="text-white/35 text-xs truncate"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>Espace Propriétaire</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="px-3 py-3 space-y-0.5">
            {NAV_LINKS.map(({ to, end, Icon, label, accent, section }, index) => (
              <React.Fragment key={to}>
                {section && section !== NAV_LINKS[index - 1]?.section && (
                  <p className="px-3 pt-3 pb-1 text-white/25 text-xs font-semibold uppercase tracking-widest"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {section}
                  </p>
                )}
              <Link href={to} onClick={close}
                aria-current={isActive(to, end) ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive(to, end)
                    ? 'text-white bg-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/6'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <Icon size={16} style={{ color: isActive(to, end) ? accent : undefined, flexShrink: 0 }} />
                <span>{label}</span>
                {to === '/mes-biens/visites' && rendezVousBadge > 0 && !isActive(to, end) && (
                  <span className="ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-black" style={{ background: GOLD }}>
                    <span className="sr-only">Nouveaux rendez-vous : </span>
                    {rendezVousBadge > 99 ? '99+' : rendezVousBadge}
                  </span>
                )}
                {isActive(to, end) && (
                  <span className="ml-auto w-1 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: accent }} />
                )}
              </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 space-y-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { router.push('/'); close(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/6 transition-all"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Globe size={16} className="flex-shrink-0" />
            Accueil du site
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-all"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <LogOut size={16} className="flex-shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen">

        {/* Topbar mobile */}
        <div className="md:hidden grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)}
            ref={menuButtonRef}
            className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-gray-600 transition-all"
            aria-label="Ouvrir le menu"
            aria-controls="owner-navigation"
            aria-expanded={sidebarOpen}>
            <Menu size={22} />
          </button>
          <span className="min-w-0 truncate text-center text-sm font-bold text-gray-800"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {activeTitle}
          </span>
          <div className="w-11" aria-hidden="true" />
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default OwnerDashboard;
