'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, LayoutDashboard, Building, LogOut,
  UserCircle, Heart, MessageCircle, UserPlus,
  LogIn, ChevronDown, Home, Phone, Newspaper, ArrowUpRight, Smartphone,
  CreditCard, Calendar, Landmark, KeyRound, Palmtree, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getConversationsUnreadCount } from '../../services/unreadCountService';
import UnreadMessagesBadge from '../messaging/UnreadMessagesBadge';
import NotificationBell from '../notifications/NotificationBell';

const NAV_LINKS = [
  { to: '/',              label: 'Accueil',     Icon: Home      },
  {
    // Sprint 0 (architecture Altimmo) — remplace l'ancien lien générique
    // "Toutes les annonces" par une navigation par intention métier. Chaque
    // route réutilise le listing existant (AltimmoAnnonces) via ?offerType=
    // (nomenclature canonique, voir audit filtrage Altimmo) — voir
    // server/docs/ARCHITECTURE_ALTIMMO_V2.md. Acheter/Louer pointent
    // directement vers le listing filtré (les anciennes routes vanity
    // /immobilier/acheter,louer n'étaient qu'une redirection serveur vers ce
    // même listing) ; Séjourner conserve sa page de contenu dédiée
    // (SejournerLandingPage), distincte d'une simple redirection.
    to: '/immobilier',    label: 'Altimmo',     Icon: Building,
    children: [
      { to: '/immobilier',                              label: 'Immobilier', Icon: LayoutGrid, desc: 'Découvrir toutes nos offres' },
      { to: '/immobilier/annonces?offerType=vente',      label: 'Acheter',    Icon: Landmark, desc: 'Maisons, appartements, terrains…' },
      { to: '/immobilier/annonces?offerType=location',   label: 'Louer',      Icon: KeyRound, desc: 'Location longue durée avec bail' },
      { to: '/immobilier/sejourner',                     label: 'Séjourner',  Icon: Palmtree, desc: 'Meublés à la nuitée & hôtels' },
      { to: '/altimmo/application',                      label: 'App Altimmo', Icon: null,    desc: "Télécharger l'app" },
    ],
  },
  { to: '/evenementiel',  label: 'Mila Events', Icon: null      },
  { to: '/communication', label: 'Altcom',      Icon: null      },
  { to: '/actualites',    label: 'Actualités',  Icon: Newspaper },
  { to: '/contact',       label: 'Contact',     Icon: Phone     },
];

const PROFILE_LINKS = [
  { to: '/profile',      Icon: UserCircle,    label: 'Mon Profil',    color: '#2E7BB5' },
  { to: '/favoris',      Icon: Heart,         label: 'Mes Favoris',   color: '#C8960C' },
  { to: '/messages',     Icon: MessageCircle, label: 'Messagerie',    color: '#C8960C' },
  { to: '/mes-paiements', Icon: CreditCard,   label: 'Mes paiements', color: '#C8960C', clientOnly: true },
];

const STAFF_ROLES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'Secretaire', 'CommunityManager', 'Communicant'];

const GOLD = '#C8960C';

const isNavLinkActive = (pathname, to) =>
  to === '/' ? pathname === '/' : pathname.startsWith(to);

const useUnreadCount = (pathname, isAuthenticated) => {
  const [count, setCount] = useState(0);
  const isOnMessagesPage  = pathname === '/messages';
  useEffect(() => {
    if (!isAuthenticated || isOnMessagesPage) { setCount(0); return; }
    const load = async () => { try { setCount(await getConversationsUnreadCount()); } catch { setCount(0); } };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, isOnMessagesPage]);
  return count;
};

const useBreakpoint = () => {
  const [bp, setBp] = useState('xl');
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setBp('xs'); else if (w < 768) setBp('sm');
      else if (w < 1024) setBp('md'); else if (w < 1440) setBp('lg'); else setBp('xl');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return bp;
};

const UserAvatar = ({ user, size = 26 }) => {
  const [imgError, setImgError] = useState(false);
  const hasPhoto = user?.photo && !imgError;
  return hasPhoto ? (
    <Image src={user.photo} alt={user.name || 'Avatar'} width={size} height={size} unoptimized
      onError={() => setImgError(true)}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid rgba(200,150,12,0.4)` }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${GOLD}, #2E7BB5)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 500, color: '#0A0C0F', flexShrink: 0,
    }}>
      {(user?.name || 'U')[0].toUpperCase()}
    </div>
  );
};

const Wordmark = ({ isMobile }) => (
  <Link href="/" className="header-wordmark" style={{ textDecoration: 'none', flexShrink: 0 }}>
    <span style={{
      display: 'block', fontFamily: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
      fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700,
      color: '#F0EDE8', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
    }}>
      Altitude<span style={{ color: GOLD }}>·</span>Vision
    </span>
    {!isMobile && (
      <span style={{
        display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.48rem',
        letterSpacing: '0.4em', color: 'rgba(240,237,232,0.28)', textTransform: 'uppercase', marginTop: '3px',
      }}>
        Agence Immobilière
      </span>
    )}
  </Link>
);

const NavItem = ({ to, label, pathname, size = 'xl' }) => {
  const active = isNavLinkActive(pathname, to);
  const isLg   = size === 'lg';
  return (
    <Link href={to} className={`header-nav-link ${active ? 'active' : ''}`} style={{
      fontFamily: "'DM Sans', sans-serif", fontSize: isLg ? '0.72rem' : '0.78rem',
      fontWeight: active ? 500 : 400, letterSpacing: '0.09em', textTransform: 'uppercase',
      color: active ? '#F0EDE8' : 'rgba(240,237,232,0.48)', textDecoration: 'none',
      position: 'relative', paddingBottom: '3px', transition: 'color 0.2s ease',
    }}>
      {label}
      <span className="nav-underline" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, ${GOLD}, transparent)`,
        transform: active ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform 0.3s ease',
      }} />
    </Link>
  );
};

const NavDropdown = ({ item, pathname, size = 'xl' }) => {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const isLg            = size === 'lg';
  const active          = item.children.some(c => isNavLinkActive(pathname, c.to));

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: isLg ? '0.72rem' : '0.78rem',
          fontWeight: active ? 500 : 400,
          letterSpacing: '0.09em', textTransform: 'uppercase',
          color: active ? '#F0EDE8' : 'rgba(240,237,232,0.48)',
          transition: 'color 0.2s ease', position: 'relative',
        }}
        className="header-nav-link"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {item.label}
        <ChevronDown size={11} style={{
          flexShrink: 0,
          transition: 'transform 0.22s ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          opacity: active ? 0.7 : 0.45,
        }} />
        <span style={{
          position: 'absolute', bottom: 0, left: 0,
          width: 'calc(100% - 16px)', height: '1px',
          background: `linear-gradient(90deg, ${GOLD}, transparent)`,
          transform: active ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left', transition: 'transform 0.3s ease',
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%',
          transform: 'translateX(-50%)',
          paddingTop: '14px', zIndex: 100,
        }}>
          <div style={{
            minWidth: '210px',
            borderRadius: '8px', border: '1px solid rgba(200,150,12,0.14)',
            background: 'rgba(9,11,14,0.98)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(240,237,232,0.04)',
            overflow: 'hidden', animation: 'hdr-fadeSlide 0.16s ease',
          }}>
          <div style={{ padding: '6px' }}>
            {item.children.map((child, idx) => {
              const childActive = isNavLinkActive(pathname, child.to);
              const ChildIcon   = child.Icon;
              return (
                <Link
                  key={child.to}
                  href={child.to}
                  onClick={() => setOpen(false)}
                  className="nav-dropdown-item"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '6px',
                    background: childActive ? 'rgba(200,150,12,0.08)' : 'transparent',
                    border: `1px solid ${childActive ? 'rgba(200,150,12,0.14)' : 'transparent'}`,
                    textDecoration: 'none', transition: 'background 0.15s, border-color 0.15s',
                    marginBottom: idx < item.children.length - 1 ? '3px' : 0,
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: '7px',
                    background: childActive ? 'rgba(200,150,12,0.15)' : 'rgba(240,237,232,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.15s',
                  }}>
                    {ChildIcon
                      ? <ChildIcon size={14} style={{ color: childActive ? GOLD : 'rgba(240,237,232,0.3)' }} />
                      : <Smartphone size={14} style={{ color: childActive ? GOLD : 'rgba(240,237,232,0.3)' }} />
                    }
                  </div>
                  <div>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem',
                      fontWeight: childActive ? 500 : 400,
                      color: childActive ? '#F0EDE8' : 'rgba(240,237,232,0.6)',
                      margin: 0, lineHeight: 1.2,
                    }}>
                      {child.label}
                    </p>
                    {child.desc && (
                      <p style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem',
                        color: 'rgba(240,237,232,0.26)', margin: '2px 0 0', lineHeight: 1,
                      }}>
                        {child.desc}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileDropdown = ({ user, isTablet, profileOpen, setProfile, handleLogout, isAdmin, isOwner, msgUrl }) => (
  <div style={{ position: 'relative' }}>
    <button onClick={() => setProfile(!profileOpen)} className="header-profile-btn"
      aria-expanded={profileOpen} aria-haspopup="true"
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: isTablet ? '5px 10px 5px 5px' : '6px 14px 6px 6px', borderRadius: '4px',
        border: `1px solid rgba(200,150,12,0.15)`, background: 'rgba(200,150,12,0.04)',
        color: '#F0EDE8', cursor: 'pointer', fontSize: isTablet ? '0.72rem' : '0.78rem',
        transition: 'border-color 0.2s, background 0.2s', minHeight: '44px',
      }}>
      <UserAvatar user={user} size={isTablet ? 24 : 28} />
      {!isTablet && (
        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
          {user.name || 'Profil'}
        </span>
      )}
      <ChevronDown size={12} style={{ opacity: 0.5, transform: profileOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} />
    </button>

    {profileOpen && (
      <div style={{
        position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: '240px', borderRadius: '6px',
        border: '1px solid rgba(240,237,232,0.07)', background: 'rgba(10,12,15,0.99)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)', overflow: 'hidden', zIndex: 100, animation: 'hdr-fadeSlide 0.16s ease',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(240,237,232,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <UserAvatar user={user} size={38} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 500, color: '#F0EDE8', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
            <p style={{ fontSize: '0.7rem', color: 'rgba(240,237,232,0.32)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          </div>
        </div>

        {(isAdmin || isOwner) && (
          <div style={{ padding: '8px 8px 0' }}>
            {isAdmin && (
              <Link href="/dashboard" onClick={() => setProfile(false)} className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '4px', color: 'rgba(240,237,232,0.6)', fontSize: '0.8rem', textDecoration: 'none', transition: '0.15s' }}>
                <LayoutDashboard size={14} style={{ color: '#2E7BB5', flexShrink: 0 }} /> Tableau de bord
              </Link>
            )}
            {isOwner && (
              <>
                <Link href="/mes-biens" onClick={() => setProfile(false)} className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '4px', color: 'rgba(240,237,232,0.6)', fontSize: '0.8rem', textDecoration: 'none', transition: '0.15s' }}>
                  <Building size={14} style={{ color: GOLD, flexShrink: 0 }} /> Mes Biens
                </Link>
                <Link href="/mes-biens/visites" onClick={() => setProfile(false)} className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '4px', color: 'rgba(240,237,232,0.6)', fontSize: '0.8rem', textDecoration: 'none', transition: '0.15s' }}>
                  <Calendar size={14} style={{ color: GOLD, flexShrink: 0 }} /> Rendez-vous
                </Link>
              </>
            )}
            <div style={{ height: '1px', background: 'rgba(240,237,232,0.05)', margin: '6px 0' }} />
          </div>
        )}

        <div style={{ padding: (isAdmin || isOwner) ? '0 8px' : '8px 8px 0' }}>
          {PROFILE_LINKS.filter(link => !link.clientOnly || !isAdmin).map(({ to, Icon, label, color }) => (
            <Link key={to} href={to === '/messages' ? msgUrl : to} onClick={() => setProfile(false)} className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '4px', color: 'rgba(240,237,232,0.55)', fontSize: '0.8rem', fontWeight: 300, transition: '0.15s', textDecoration: 'none' }}>
              <Icon size={14} style={{ color, flexShrink: 0 }} /> {label}
            </Link>
          ))}
        </div>

        <div style={{ height: '1px', background: 'rgba(240,237,232,0.05)', margin: '6px 8px' }} />
        <div style={{ padding: '0 8px 8px' }}>
          <button onClick={handleLogout} className="dropdown-item dropdown-logout" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', borderRadius: '4px', color: 'rgba(212,43,43,0.75)', fontSize: '0.8rem', fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer', transition: '0.15s' }}>
            <LogOut size={14} style={{ color: '#DC2626', flexShrink: 0 }} /> Déconnexion
          </button>
        </div>
      </div>
    )}
  </div>
);

const Header = () => {
  const { user, logout }          = useAuth();
  const [scrolled, setScrolled]   = useState(false);
  const [mobileOpen, setMobile]   = useState(false);
  const [profileOpen, setProfile] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const pathname                  = usePathname();
  const router                    = useRouter();
  const unreadCount               = useUnreadCount(pathname, !!user);
  const profileRef                = useRef(null);
  const bp                        = useBreakpoint();

  useEffect(() => { setMounted(true); }, []);

  const isXL      = bp === 'xl';
  const isDesktop = bp === 'lg' || bp === 'xl';
  const isTablet  = bp === 'md';
  const isMobile  = bp === 'xs' || bp === 'sm';

  const headerHeight   = isMobile ? '58px' : isTablet ? '64px' : isXL ? '76px' : '68px';
  const headerHeightPx = isMobile ? 58 : isTablet ? 64 : isXL ? 76 : 68;
  const headerPadding  = isMobile ? '0 16px' : isTablet ? '0 28px' : isXL ? '0 80px' : '0 48px';

  const isAdmin = STAFF_ROLES.includes(user?.role);
  const isOwner = user?.role === 'Proprietaire';
  // Le staff a sa propre boîte partagée ; les autres utilisateurs ont leur messagerie perso
  const msgUrl  = isAdmin ? '/dashboard/conversations' : '/messages';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = e => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfile(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => { setMobile(false); setProfile(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    setMobile(false);
    setProfile(false);
    router.replace('/login');
  };

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: headerHeight, padding: headerPadding,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(9,11,14,0.97)' : 'rgba(9,11,14,0.55)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: scrolled ? `1px solid rgba(200,150,12,0.12)` : '1px solid rgba(240,237,232,0.04)',
        boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.5)' : 'none',
        transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
      }}>
        <Wordmark isMobile={isMobile} />

        {isDesktop && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: isXL ? '36px' : '22px' }}>
            {NAV_LINKS.map((link) =>
              link.children
                ? <NavDropdown key={link.to} item={link} pathname={pathname} size={bp} />
                : <NavItem key={link.to} to={link.to} label={link.label} pathname={pathname} size={bp} />
            )}
          </nav>
        )}

        {isTablet && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {NAV_LINKS.map((link) =>
              link.children
                ? <NavDropdown key={link.to} item={link} pathname={pathname} size="md" />
                : <NavItem key={link.to} to={link.to} label={link.label} pathname={pathname} size="md" />
            )}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          {mounted && !isMobile && user && (
            <>
              {isAdmin && (
                <Link href="/dashboard" className="header-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isTablet ? '7px 12px' : '8px 16px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.1)', color: 'rgba(240,237,232,0.55)', fontSize: isTablet ? '0.66rem' : '0.72rem', fontWeight: 400, letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', minHeight: '44px' }}>
                  <LayoutDashboard size={13} />{!isTablet && 'Dashboard'}
                </Link>
              )}
              {isOwner && (
                <Link href="/mes-biens" className="header-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isTablet ? '7px 12px' : '8px 16px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.1)', color: 'rgba(240,237,232,0.55)', fontSize: isTablet ? '0.66rem' : '0.72rem', fontWeight: 400, letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', minHeight: '44px' }}>
                  <Building size={13} />{!isTablet && 'Mes Biens'}
                </Link>
              )}
              <Link href={msgUrl} className="header-icon-btn" style={{ position: 'relative', padding: '10px', borderRadius: '4px', color: 'rgba(240,237,232,0.45)', display: 'flex', border: '1px solid transparent', minHeight: '44px', minWidth: '44px', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={isTablet ? 16 : 18} />
                <UnreadMessagesBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
              </Link>
              <div style={{ color: 'rgba(240,237,232,0.55)' }}>
                <NotificationBell isAuthenticated={!!user} />
              </div>
              <div ref={profileRef}>
                <ProfileDropdown user={user} isTablet={isTablet} profileOpen={profileOpen} setProfile={setProfile} handleLogout={handleLogout} isAdmin={isAdmin} isOwner={isOwner} msgUrl={msgUrl} />
              </div>
            </>
          )}

          {mounted && !isMobile && !user && (
            <>
              <Link href="/immobilier" className="header-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isTablet ? '8px 14px' : '9px 20px', borderRadius: '4px', border: '1px solid rgba(200,150,12,0.2)', color: `rgba(200,150,12,0.75)`, fontSize: isTablet ? '0.68rem' : isXL ? '0.76rem' : '0.72rem', fontWeight: 400, letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', minHeight: '44px' }}>
                {!isTablet && <Building size={13} />}{!isTablet ? 'Publier un bien' : 'Publier'}
              </Link>
              <Link href="/login" className="header-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isTablet ? '8px 14px' : '9px 20px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.14)', color: 'rgba(240,237,232,0.6)', fontSize: isTablet ? '0.68rem' : isXL ? '0.76rem' : '0.72rem', fontWeight: 400, letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', minHeight: '44px' }}>
                <LogIn size={isXL ? 14 : 13} />{!isTablet && 'Connexion'}
              </Link>
              <Link href="/register" className="header-cta-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: isTablet ? '8px 14px' : '9px 22px', borderRadius: '4px', background: GOLD, color: '#0A0C0F', fontSize: isTablet ? '0.68rem' : isXL ? '0.76rem' : '0.72rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', minHeight: '44px' }}>
                <UserPlus size={isXL ? 14 : 13} />{!isTablet && "S'inscrire"}
              </Link>
            </>
          )}

          {mounted && isMobile && user && (
            <Link href={msgUrl} className="header-icon-btn" style={{ position: 'relative', padding: '10px', borderRadius: '4px', color: 'rgba(240,237,232,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', minWidth: '44px' }}>
              <MessageCircle size={18} />
              <UnreadMessagesBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
            </Link>
          )}

          {!isDesktop && (
            <button onClick={() => setMobile(!mobileOpen)} className="header-icon-btn"
              style={{ padding: '10px', borderRadius: '4px', background: mobileOpen ? 'rgba(240,237,232,0.06)' : 'none', border: 'none', color: '#F0EDE8', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </header>

      {mobileOpen && !isDesktop && (
        <>
          <div onClick={() => setMobile(false)} style={{ position: 'fixed', inset: 0, zIndex: 38, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'hdr-fadeIn 0.2s ease', top: headerHeight }} />
          <div style={{ position: 'fixed', top: headerHeight, left: 0, right: 0, zIndex: 39, background: 'rgba(9,11,14,0.99)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', borderBottom: '1px solid rgba(240,237,232,0.06)', padding: isMobile ? '16px 12px 24px' : '20px 24px 28px', animation: 'hdr-slideDown 0.25s cubic-bezier(0.16,1,0.3,1)', maxHeight: `calc(100vh - ${headerHeightPx}px)`, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {NAV_LINKS.map(({ to, label, Icon, children }) => {
                const active = isNavLinkActive(pathname, to) ||
                  (children?.some(c => isNavLinkActive(pathname, c.to)));

                if (children) {
                  return (
                    <div key={to}>
                      <p style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.68rem',
                        fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'rgba(240,237,232,0.28)', margin: '6px 0 4px 2px',
                      }}>
                        {label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {children.map(child => {
                          const childActive = isNavLinkActive(pathname, child.to);
                          const ChildIcon   = child.Icon;
                          return (
                            <Link
                              key={child.to}
                              href={child.to}
                              onClick={() => setMobile(false)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 14px', borderRadius: '6px',
                                color: childActive ? '#F0EDE8' : 'rgba(240,237,232,0.48)',
                                background: childActive ? 'rgba(200,150,12,0.08)' : 'rgba(240,237,232,0.02)',
                                border: `1px solid ${childActive ? 'rgba(200,150,12,0.18)' : 'rgba(240,237,232,0.05)'}`,
                                fontSize: '0.82rem', fontWeight: childActive ? 500 : 300,
                                letterSpacing: '0.04em', textDecoration: 'none',
                                minHeight: '44px', transition: '0.2s',
                              }}
                            >
                              {ChildIcon
                                ? <ChildIcon size={14} style={{ color: childActive ? GOLD : 'rgba(240,237,232,0.22)', flexShrink: 0 }} />
                                : <Smartphone size={14} style={{ color: childActive ? GOLD : 'rgba(240,237,232,0.22)', flexShrink: 0 }} />
                              }
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={to}
                    href={to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '13px 14px', borderRadius: '4px',
                      color: active ? '#F0EDE8' : 'rgba(240,237,232,0.48)',
                      background: active ? 'rgba(200,150,12,0.08)' : 'rgba(240,237,232,0.02)',
                      border: `1px solid ${active ? 'rgba(200,150,12,0.18)' : 'rgba(240,237,232,0.05)'}`,
                      fontSize: '0.82rem', fontWeight: active ? 500 : 300,
                      letterSpacing: '0.04em', textDecoration: 'none',
                      minHeight: '44px', transition: '0.2s',
                    }}
                  >
                    {Icon && <Icon size={14} style={{ color: active ? GOLD : 'rgba(240,237,232,0.22)', flexShrink: 0 }} />}
                    {label}
                  </Link>
                );
              })}
            </div>
            <div style={{ height: '1px', background: 'rgba(240,237,232,0.06)', margin: '0 0 16px' }} />
            {mounted && user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '4px', background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.05)', marginBottom: '10px' }}>
                  <UserAvatar user={user} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.88rem', fontWeight: 500, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(240,237,232,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isAdmin ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {PROFILE_LINKS.filter(link => !link.clientOnly || !isAdmin).map(({ to, Icon, label, color }) => (
                    <Link key={to} href={to === '/messages' ? msgUrl : to} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '4px', background: 'rgba(240,237,232,0.02)', border: '1px solid rgba(240,237,232,0.05)', color: 'rgba(240,237,232,0.5)', fontSize: '0.82rem', fontWeight: 300, textDecoration: 'none', minHeight: '44px' }}>
                      <Icon size={15} style={{ color, flexShrink: 0 }} />{label}
                    </Link>
                  ))}
                </div>
                {(isAdmin || isOwner) && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {isAdmin && <Link href="/dashboard" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 14px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.08)', color: 'rgba(240,237,232,0.5)', fontSize: '0.78rem', fontWeight: 300, textDecoration: 'none', minHeight: '44px' }}><LayoutDashboard size={14} /> Dashboard</Link>}
                    {isOwner && <Link href="/mes-biens" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 14px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.08)', color: 'rgba(240,237,232,0.5)', fontSize: '0.78rem', fontWeight: 300, textDecoration: 'none', minHeight: '44px' }}><Building size={14} /> Mes Biens</Link>}
                    {isOwner && <Link href="/mes-biens/visites" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 14px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.08)', color: 'rgba(240,237,232,0.5)', fontSize: '0.78rem', fontWeight: 300, textDecoration: 'none', minHeight: '44px' }}><Calendar size={14} /> Rendez-vous</Link>}
                  </div>
                )}
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 14px', borderRadius: '4px', color: 'rgba(220,38,38,0.8)', fontSize: '0.82rem', fontWeight: 300, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.1)', cursor: 'pointer', minHeight: '44px' }}>
                  <LogOut size={15} style={{ color: '#DC2626' }} /> Déconnexion
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/immobilier" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '4px', border: `1px solid rgba(200,150,12,0.25)`, color: `rgba(200,150,12,0.8)`, fontSize: '0.82rem', fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', minHeight: '44px' }}>
                  <Building size={14} /> Publier un bien
                </Link>
                <Link href="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '4px', border: '1px solid rgba(240,237,232,0.14)', color: 'rgba(240,237,232,0.65)', fontSize: '0.82rem', fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', minHeight: '44px' }}>
                  <LogIn size={14} /> Connexion
                </Link>
                <Link href="/register" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '4px', background: GOLD, color: '#0A0C0F', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', minHeight: '44px' }}>
                  <UserPlus size={14} /> S'inscrire
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes hdr-fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hdr-slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes hdr-fadeSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .header-nav-link:hover { color: #F0EDE8 !important; }
        .header-nav-link:hover .nav-underline { transform: scaleX(1) !important; }
        .header-nav-link.active { color: #F0EDE8 !important; }
        .header-ghost-btn:hover { border-color: rgba(240,237,232,0.25) !important; color: rgba(240,237,232,0.85) !important; }
        .header-cta-btn:hover { background: #DCA815 !important; box-shadow: 0 4px 20px rgba(200,150,12,0.3) !important; }
        .header-icon-btn:hover { background: rgba(240,237,232,0.06) !important; color: rgba(240,237,232,0.8) !important; }
        .header-profile-btn:hover { border-color: rgba(200,150,12,0.3) !important; background: rgba(200,150,12,0.08) !important; }
        .header-wordmark:hover span:first-child { color: rgba(240,237,232,0.85) !important; }
        .dropdown-item:hover { background: rgba(240,237,232,0.05) !important; color: rgba(240,237,232,0.8) !important; }
        .dropdown-logout:hover { background: rgba(220,38,38,0.08) !important; color: rgba(220,38,38,0.9) !important; }
        .nav-dropdown-item:hover { background: rgba(240,237,232,0.05) !important; border-color: rgba(240,237,232,0.07) !important; }
      `}</style>
    </>
  );
};

export default Header;
