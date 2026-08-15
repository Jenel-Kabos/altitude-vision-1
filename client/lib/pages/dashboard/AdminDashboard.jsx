"use client";
// src/pages/AdminDashboard.jsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, Calendar, Briefcase, LogOut, BarChart3, Globe, Users,
  CheckCircle2, ShieldCheck, Mail, Menu, X, Star, Mountain, Building,
  ClipboardList, BarChart2, Scale, Megaphone, MessageCircle, FolderOpen,
  Clock, PenLine, Calculator, FileText, CreditCard, Palmtree,
  Landmark, KeyRound, Users2, FileSignature, Wrench, Building2, History,
  ContactRound, LayoutDashboard, Network, Gauge,
  Bell,
} from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { useDashboardBadges } from '../../hooks/useDashboardBadges';
import DashboardBadge from '../../components/dashboard/DashboardBadge';
import { resolveWebDestination } from '../../navigation/navigationSdk';
import PlatformOperatorContextSwitcher from '../../components/dashboard/PlatformOperatorContextSwitcher';
import { usePlatformTenantRuntime } from '../../context/PlatformTenantRuntimeContext';
import { hasStaffCapability } from '../../utils/staffCapabilities';

const GOLD = '#C8960C';
const BLUE = '#2E7BB5';

// ─────────────────────────────────────────────────────────────
// Config de navigation
// ─────────────────────────────────────────────────────────────
// Groupes de rôles collaborateurs (miroir de server/utils/roles.js)
const ALL_STAFF     = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];
const ROLES_ESTIM   = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'Communicant'];
const ROLES_ALTIMMO = ['Admin', 'Collaborateur', 'GestionnaireImmobilier'];
const ROLES_CM      = ['Admin', 'Collaborateur', 'CommunityManager'];
const ROLES_DOCS    = ['Admin', 'Collaborateur', 'Secretaire'];
const ROLES_LITIGES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier'];
const ROLES_MOD     = ['Admin', 'Collaborateur'];
const CRM_ROUTE     = resolveWebDestination('CRM_CUSTOMERS');
const REPORTING_ROUTE = resolveWebDestination('REPORTING_EXECUTIVE');
const ORGANIZATION_ROUTE = resolveWebDestination('ORGANIZATION_ADMIN');
const API_PLATFORM_ROUTE = resolveWebDestination('API_PLATFORM_ADMIN');

const NAV_SECTIONS = [
  {
    label: null,
    links: [
      { to: '/dashboard',                    end: true,  Icon: BarChart3,    label: 'Tableau de bord',    accent: BLUE,      roles: ALL_STAFF },
      // ERP-CORE-1 — Centre d'Administration Global, réservé à la Direction
      // (même périmètre que la route serveur /api/erp) : orchestration pure,
      // ne remplace aucun des dashboards listés ci-dessous.
      { to: '/dashboard/erp',                end: true,  Icon: Gauge,           label: "Centre d'Administration", accent: GOLD, roles: ['Admin'] },
      // TENANT-CORE-1 — administration SaaS multi-tenant, réservée Admin
      // (même périmètre que /api/platform-tenants). Nommé « Multi-Tenant »
      // dans l'UI pour rester sans ambiguïté avec l'espace locataire
      // existant (Gestion locative → Locataires).
      { to: '/dashboard/tenants',            end: true,  Icon: Building2,       label: 'Multi-Tenant (SaaS)', accent: BLUE, roles: ['Admin'] },
      // REPORTING-1 — Centre de Pilotage, réservé à la Direction (même
      // périmètre que la route serveur /api/reporting).
      { to: REPORTING_ROUTE,                 end: true,  Icon: LayoutDashboard, label: 'Centre de Pilotage', accent: GOLD,   roles: ['Admin', 'GestionnaireImmobilier'] },
      // ORGANIZATION-1 — administration de la hiérarchie organisationnelle,
      // réservée Admin (même périmètre que la route serveur /api/organization).
      { to: ORGANIZATION_ROUTE,              end: true,  Icon: Network,         label: 'Organisation',        accent: BLUE,   roles: ['Admin'] },
      // API-PUBLIC-1 — portail développeur (clés API, webhooks, journal
      // d'appels), réservé Admin (émission de clé = action sensible).
      { to: API_PLATFORM_ROUTE,              end: true,  Icon: KeyRound,        label: 'API publique',        accent: GOLD,   roles: ['Admin'] },
    ],
  },
  {
    // Domaine 1 — Immobilier : Vente/Location/Hébergement en tant qu'annonces
    // (publication). La gestion des baux actifs vit dans le domaine séparé
    // "Gestion locative" ci-dessous — voir ARCHITECTURE_ALTIMMO_V2.md.
    label: 'Immobilier',
    links: [
      { to: '/dashboard/properties',               end: true,  Icon: Home,       label: 'Tous les biens', accent: BLUE, roles: ROLES_ALTIMMO },
      { to: '/dashboard/sales',              end: true,  Icon: Landmark,   label: 'Ventes',               accent: BLUE, roles: ROLES_ALTIMMO },
      { to: '/dashboard/rentals',            end: true,  Icon: KeyRound,   label: 'Locations',            accent: BLUE, roles: ROLES_ALTIMMO },
      { to: '/dashboard/dossiers-immobiliers', end: true, Icon: ClipboardList, label: 'Offres & candidatures', accent: BLUE, roles: ['Admin', 'Collaborateur', 'GestionnaireImmobilier'] },
      { to: '/dashboard/hebergements',       end: true,  Icon: Palmtree,   label: 'Hébergements',         accent: GOLD, roles: ROLES_ALTIMMO },
      { to: '/dashboard/estimations',        end: false, Icon: Calculator, label: 'Estimations',  accent: GOLD, roles: ROLES_ESTIM, badge: 'estimations' },
      { to: '/dashboard/devis',              end: false, Icon: FileText,   label: 'Devis locatif', accent: GOLD, roles: ROLES_ESTIM },
      { to: '/dashboard/visites', end: false, Icon: Calendar, label: 'Visites', accent: GOLD, capability: 'visits.read', badge: 'visites' },
      { to: '/dashboard/paiements', end: false, Icon: CreditCard, label: 'Paiements visites', accent: GOLD, capability: 'visits.read' },
      { to: '/dashboard/proprietaires',      end: false, Icon: Users2,     label: 'Propriétaires', accent: BLUE, roles: ROLES_ALTIMMO },
    ],
  },
  {
    // Domaine 2 — Gestion locative : bail actif uniquement (locataire, loyer,
    // préavis, sortie, maintenance) — jamais la publication d'une annonce.
    // Une annonce Location n'y apparaît que si managementActivated === true
    // (voir RentalManagement, server/docs/PROPERTY_TRANSACTION_ARCHITECTURE.md).
    label: 'Gestion locative',
    links: [
      { to: '/dashboard/gestion-locative', end: true, Icon: Building, label: "Vue d'ensemble", accent: BLUE, capability: 'rental.read' },
      { to: '/dashboard/gestion-locative/baux', end: false, Icon: FileSignature, label: 'Baux', accent: BLUE, capability: 'leases.read' },
      { to: '/dashboard/gestion-locative/regularisation', end: false, Icon: History, label: 'Régularisation', accent: '#B45309', roles: ['Admin', 'GestionnaireImmobilier', 'Collaborateur'] },
      { to: '/dashboard/gestion-locative/locataires', end: false, Icon: Users, label: 'Locataires', accent: BLUE, capability: 'tenants.read' },
      { to: '/dashboard/gestion-locative/paiements', end: false, Icon: CreditCard, label: 'Paiements', accent: BLUE, capability: 'payments.read' },
      { to: '/dashboard/gestion-locative/preavis', end: false, Icon: Clock, label: 'Préavis', accent: BLUE, capability: 'notice.read' },
      { to: '/dashboard/gestion-locative/maintenance', end: false, Icon: Wrench, label: 'Maintenance', accent: BLUE, capability: 'maintenance.read' },
      // DOC-ARCH-1 — un seul Centre documentaire pour toute la plateforme :
      // ce point d'entrée ouvre désormais /dashboard/documents déjà filtré
      // (pole=Altimmo&service=gestion_locative), jamais un écran séparé.
      { to: '/dashboard/documents', end: false, Icon: FolderOpen, label: 'Documents', accent: GOLD, capability: 'documents.read' },
    ],
  },
  {
    // Domaine 3 — Hôtellerie : établissement (Hotel), pas une chambre.
    // RoomType/réservations hors périmètre — voir ARCHITECTURE_ALTIMMO_V2.md.
    label: 'Hôtellerie',
    links: [
      // Sprint B2 — Catégories de chambres et Tarifs sont gérés PAR
      // établissement (depuis sa fiche, /dashboard/hotels/[hotelId]/...),
      // jamais comme des listes plates globales : un seul lien de nav.
      { to: '/dashboard/etablissements',        end: true,  Icon: Building2, label: 'Établissements',         accent: GOLD, roles: [...ROLES_ALTIMMO, 'Proprietaire'] },
      { to: '/dashboard/hotel-reservations',    end: true,  Icon: Calendar,  label: 'Réservations hôtelières', accent: GOLD, roles: ROLES_ALTIMMO },
      // Sprint D — vue globale des chambres (libre/occupée/nettoyage/
      // inspection), tous établissements confondus (mission §18).
      { to: '/dashboard/hotel-rooms',           end: true,  Icon: KeyRound,  label: 'Chambres (vue globale)', accent: GOLD, roles: ROLES_ALTIMMO },
      { to: '/dashboard/hotel-finance',         end: true,  Icon: CreditCard, label: 'Finance hôtelière', accent: GOLD, roles: ['Admin'] },
      // Sprint E — housekeeping/inspection/maintenance (mission §10-11).
      { to: '/dashboard/housekeeping',          end: true,  Icon: Wrench,    label: 'Ménage',                 accent: GOLD, roles: ROLES_ALTIMMO },
      { to: '/dashboard/maintenance',           end: true,  Icon: Wrench,    label: 'Interventions techniques', accent: GOLD, roles: ROLES_ALTIMMO },
    ],
  },
  {
    label: null,
    links: [
      { to: '/dashboard/events', end: false, Icon: Calendar, label: 'Mila Events', accent: '#D42B2B', capability: 'events.read' },
      { to: '/dashboard/altcom', end: false, Icon: Briefcase, label: 'Altcom', accent: GOLD, capability: 'altcom.read' },
      // MARKETING-AUTOMATION-1 — même périmètre rôles qu'Altcom (ROLES_CM) :
      // segments, modèles, campagnes, journal d'envoi.
      { to: '/dashboard/altcom/marketing',   end: false, Icon: Megaphone,    label: 'Marketing Automation', accent: GOLD,      roles: ROLES_CM   },
    ],
  },
  {
    label: 'Modération',
    links: [
      { to: '/dashboard/moderation/properties',  end: false, Icon: CheckCircle2, label: 'Modération Biens',       accent: '#7C3AED', roles: ROLES_MOD, badge: 'moderation' },
      { to: '/dashboard/moderation/hebergement', end: false, Icon: Palmtree,     label: 'Modération Hébergement', accent: GOLD,      roles: ROLES_MOD },
      { to: '/dashboard/moderation/hotellerie',  end: false, Icon: Building2,    label: 'Modération Hôtellerie',  accent: GOLD,      roles: ROLES_MOD },
      { to: '/dashboard/moderation/reviews',     end: false, Icon: Star,         label: 'Modération Avis',        accent: '#6366F1', roles: ROLES_MOD },
    ],
  },
  {
    label: 'CRM 360°',
    links: [
      { to: CRM_ROUTE, end: false, Icon: ContactRound, label: 'Customers & pipeline', accent: '#0F766E', roles: ALL_STAFF },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/dashboard/users',            end: false, Icon: Users,         label: 'Utilisateurs',       accent: '#0D9488', roles: ['Admin'] },
      { to: '/dashboard/notifications',    end: false, Icon: Bell,          label: 'Notifications',      accent: BLUE,      roles: ['Admin'] },
      { to: '/dashboard/active-sessions',  end: false, Icon: ShieldCheck,   label: 'Sessions Actives',   accent: '#DC2626', roles: ['Admin'] },
      { to: '/dashboard/historique',       end: false, Icon: ClipboardList, label: 'Historique',         accent: '#7C3AED', roles: ['Admin'] },
      { to: '/dashboard/export-marketing', end: false, Icon: BarChart2,     label: 'Export Marketing',   accent: GOLD,      roles: ['Admin'] },
      { to: '/dashboard/litiges',          end: false, Icon: Scale,         label: 'Litiges',             accent: '#DC2626', roles: ROLES_LITIGES, badge: 'litiges' },
    ],
  },
  {
    label: 'Communications',
    links: [
      { to: '/dashboard/messages',       end: false, Icon: Mail,          label: 'Boîte de Réception',  accent: GOLD,      roles: ALL_STAFF, badge: 'internalMails' },
      { to: '/dashboard/contact-messages', end: false, Icon: Mail,        label: 'Messages contact',    accent: GOLD,      roles: ALL_STAFF, badge: 'contacts' },
      { to: '/dashboard/conversations',  end: false, Icon: MessageCircle, label: 'Messages clients',    accent: GOLD,      roles: ALL_STAFF, badge: 'conversations' },
      { to: '/dashboard/emails',         end: false, Icon: ShieldCheck,   label: 'Gestion des Emails',  accent: '#F59E0B', roles: ROLES_DOCS },
      { to: '/dashboard/publicites',     end: false, Icon: Megaphone,     label: 'Publicités',          accent: GOLD,      roles: ['Admin']  },
    ],
  },
];

const TOPBAR_TITLES = [
  [CRM_ROUTE, 'CRM 360°'],
  ['/dashboard/moderation', 'Modération'],
  ['/dashboard/gestion-locative', 'Gestion Locative'],
  ['/dashboard/conversations', 'Messages clients'],
  ['/dashboard/messages', 'Boîte de Réception'],
  ['/dashboard/properties', 'Gestion des biens'],
  ['/dashboard/estimations', 'Estimations'],
  ['/dashboard/visites', 'Visites'],
  ['/dashboard/paiements', 'Paiements'],
  ['/dashboard/litiges', 'Litiges'],
];

// ─────────────────────────────────────────────────────────────
const AdminDashboard = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (to, end = false) => end ? pathname === to : pathname.startsWith(to);
  const { logout, user, isCollaborateur, activeWrites, timeLeft } = useAuth();
  const { tenantReady, tenantRequired, selectedTenantId } = usePlatformTenantRuntime();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const tenantScopedReady = tenantReady && (!tenantRequired || Boolean(selectedTenantId));
  const { badges } = useDashboardBadges(!!user && tenantScopedReady);

  const activeWriteCount = Object.keys(activeWrites).length;
  // Plus petit temps restant parmi toutes les fenêtres actives
  const minTimeLeft = activeWriteCount > 0
    ? Math.min(...Object.keys(activeWrites).map(id => timeLeft(id)))
    : 0;
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const close = () => setSidebarOpen(false);

  const activePageTitle = TOPBAR_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1]
    || NAV_SECTIONS.flatMap(section => section.links)
      .find(link => isActive(link.to, link.end))?.label
    || 'Tableau de bord';

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

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab' && sidebarRef.current) {
        const focusable = [...sidebarRef.current.querySelectorAll('a[href], button:not([disabled])')];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const menuButton = menuButtonRef.current;
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      menuButton?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className="dashboard-shell flex min-h-screen">

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
        id="dashboard-navigation"
        aria-label="Navigation du tableau de bord"
        aria-hidden={isMobileViewport && !sidebarOpen}
        inert={isMobileViewport && !sidebarOpen ? true : undefined}
      >

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
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.6rem', letterSpacing: '0.22em' }}>
                  ADMINISTRATION
                </span>
              </div>
            </div>
            <button onClick={close}
              ref={closeButtonRef}
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
                {(user.name || 'A')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>{user.name || 'Admin'}</p>
                <p className="text-white/35 text-xs truncate"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>{
                  {
                    Admin: 'Administrateur', Collaborateur: 'Collaborateur',
                    Secretaire: 'Secrétaire', GestionnaireImmobilier: 'Gest. Immobilier',
                    CommunityManager: 'Community Manager', Communicant: 'Communicant',
                  }[user.role] || user.role || 'Collaborateur'
                }</p>
              </div>
            </div>
          )}

          {/* ── Fenêtre d'écriture collaborateur ─────────── */}
          {isCollaborateur && (
            <div className="mx-3 my-2 rounded-lg px-3 py-2.5"
              style={{
                background:   activeWriteCount > 0 ? 'rgba(200,150,12,0.12)' : 'rgba(255,255,255,0.04)',
                border:       `1px solid ${activeWriteCount > 0 ? 'rgba(200,150,12,0.30)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <div className="flex items-center gap-2">
                {activeWriteCount > 0
                  ? <PenLine size={12} style={{ color: GOLD, flexShrink: 0 }} />
                  : <Clock    size={12} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                }
                <div className="min-w-0 flex-1">
                  {activeWriteCount > 0 ? (
                    <>
                      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.62rem', color: GOLD, fontWeight: 600, lineHeight: 1 }}>
                        Fenêtre active — {fmtTime(minTimeLeft)}
                      </p>
                      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.58rem', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>
                        {activeWriteCount} ressource{activeWriteCount > 1 ? 's' : ''} modifiable{activeWriteCount > 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.62rem', color:'rgba(255,255,255,0.30)', lineHeight: 1.3 }}>
                      Mode lecture seule
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PLATFORM-ADMIN-1 — invisible pour tout utilisateur qui n'est pas
              un PlatformOperator actif (voir le composant lui-même). */}
          {user?.role === 'Admin' && (
            <div className="px-3 pt-3">
              <PlatformOperatorContextSwitcher />
            </div>
          )}

          {/* Nav */}
          <nav className="px-3 py-3 space-y-0.5 overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - 220px)' }}>
            {NAV_SECTIONS.map((section, si) => {
              const visibleLinks = section.links.filter(link => (
                link.capability ? hasStaffCapability(user, link.capability) : (!link.roles || link.roles.includes(user?.role))
              ));
              // Une section dont aucun lien n'est visible pour le rôle
              // courant ne doit jamais afficher un en-tête "orphelin" sans
              // rien en dessous (bug pré-existant, révélé par les nouveaux
              // domaines Gestion locative/Hôtellerie — Sprint 0).
              if (visibleLinks.length === 0) return null;
              return (
              <div key={si}>
                {section.label && (
                  <p className="px-3 pt-3 pb-1 text-white/25 text-xs font-semibold uppercase tracking-widest"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {section.label}
                  </p>
                )}
                {visibleLinks
                  .map(({ to, end, Icon, label, accent, badge }) => (
                  <Link key={to} href={to} onClick={close}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                      isActive(to, end)
                        ? 'text-white'
                        : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                    }`}
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      background: isActive(to, end) ? `${accent}18` : undefined,
                      borderLeft: isActive(to, end) ? `2px solid ${accent}` : '2px solid transparent',
                      paddingLeft: '10px',
                    }}>
                    <Icon size={15} style={{ color: isActive(to, end) ? accent : 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <span>{label}</span>
                    {badge && <DashboardBadge count={badges[badge]} />}
                    {isActive(to, end) && !badges[badge] && (
                      <span className="ml-auto w-1 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: accent }} />
                    )}
                  </Link>
                ))}
              </div>
              );
            })}
          </nav>
        </div>

        {/* Footer sidebar */}
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
      <main className="dashboard-content flex-1 flex flex-col min-h-screen">

        {/* Topbar mobile */}
        <div className="dashboard-mobile-topbar md:hidden grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)}
            ref={menuButtonRef}
            className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-gray-600 transition-all"
            aria-label="Ouvrir le menu"
            aria-controls="dashboard-navigation"
            aria-expanded={sidebarOpen}>
            <Menu size={22} />
          </button>
          <span className="min-w-0 truncate text-center text-sm font-bold text-gray-800"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {activePageTitle}
          </span>
          <div className="w-11" aria-hidden="true" />
        </div>

        <div className="dashboard-content-inner flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
