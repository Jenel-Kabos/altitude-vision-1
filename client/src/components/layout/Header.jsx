import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Building, LogOut,
  UserCircle, Heart, MessageCircle, UserPlus, LogIn,
  ChevronDown, Home, Phone, Newspaper,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTotalUnreadCount } from '../../services/unreadCountService';
import UnreadMessagesBadge from '../messaging/UnreadMessagesBadge';

const NAV_LINKS = [
  { to: '/',            label: 'Accueil',     Icon: Home      },
  { to: '/altimmo',     label: 'Altimmo',     Icon: Building  },
  { to: '/mila-events', label: 'Mila Events', Icon: null      },
  { to: '/altcom',      label: 'Altcom',      Icon: null      },
  { to: '/actualites',  label: 'Actualités',  Icon: Newspaper },
  { to: '/contact',     label: 'Contact',     Icon: Phone     },
];

const PROFILE_LINKS = [
  { to: '/profile',  Icon: UserCircle,    label: 'Mon Profil',  color: '#2E7BB5' },
  { to: '/favoris',  Icon: Heart,         label: 'Mes Favoris', color: '#D42B2B' },
  { to: '/messages', Icon: MessageCircle, label: 'Messagerie',  color: '#C8872A' },
];

const useUnreadCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = async () => { try { setCount(await getTotalUnreadCount()); } catch { setCount(0); } };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);
  return count;
};

const S = {
  header: (scrolled) => ({
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
    height: '64px',
    padding: '0 clamp(16px, 4vw, 48px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: scrolled ? 'rgba(10,12,15,0.95)' : 'rgba(10,12,15,0.6)',
    backdropFilter: 'blur(20px)',
    borderBottom: scrolled ? '1px solid rgba(200,135,42,0.1)' : '1px solid rgba(232,228,220,0.04)',
    boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
    transition: '0.4s ease',
  }),
  logoWrap: { textDecoration: 'none', flexShrink: 0 },
  logoText: {
    display: 'block',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
    fontWeight: 600, color: '#E8E4DC',
    letterSpacing: '0.02em', lineHeight: 1.2,
  },
  logoSub: {
    display: 'block',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.5rem', letterSpacing: '0.35em',
    color: 'rgba(232,228,220,0.25)', textTransform: 'uppercase',
  },
  navLink: (isActive) => ({
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.75rem', fontWeight: 400,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: isActive ? '#E8E4DC' : 'rgba(232,228,220,0.45)',
    textDecoration: 'none', position: 'relative',
    paddingBottom: '2px', transition: 'color 0.2s',
  }),
  navUnderline: (isActive) => ({
    position: 'absolute', bottom: '-2px', left: 0, right: 0,
    height: '1px', background: '#C8872A',
    transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
    transformOrigin: 'left', transition: 'transform 0.3s ease',
  }),
  dropdown: {
    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
    width: '220px', borderRadius: '16px',
    border: '1px solid rgba(232,228,220,0.08)',
    background: 'rgba(10,12,15,0.98)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    overflow: 'hidden', zIndex: 100,
  },
  mobileMenu: {
    position: 'absolute', top: 0, left: 0, right: 0,
    background: 'rgba(10,12,15,0.98)',
    backdropFilter: 'blur(24px)',
    borderBottom: '1px solid rgba(232,228,220,0.06)',
    padding: '12px',
  },
};

const Header = () => {
  const { user, logout }          = useAuth();
  const [scrolled, setScrolled]   = useState(false);
  const [mobileOpen, setMobile]   = useState(false);
  const [profileOpen, setProfile] = useState(false);
  const unreadCount               = useUnreadCount();
  const navigate                  = useNavigate();
  const location                  = useLocation();
  const profileRef                = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfile(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => { setMobile(false); setProfile(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const isAdmin = user?.role === 'Admin' || user?.role === 'Collaborateur';
  const isOwner = user?.role === 'Proprietaire';

  const navBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '40px',
    border: '1px solid rgba(232,228,220,0.1)',
    color: 'rgba(232,228,220,0.6)', fontSize: '0.72rem',
    fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase',
    transition: '0.2s', background: 'none', cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <>
      <header style={S.header(scrolled)}>
        {/* Logo */}
        <Link to="/" style={S.logoWrap}>
          <span style={S.logoText}>
            Altitude<span style={{ color: '#C8872A' }}>-</span>Vision
          </span>
          <span style={S.logoSub}>Agency</span>
        </Link>

        {/* Nav — masquée mobile */}
        <nav style={{ display: 'flex', gap: 'clamp(16px, 2.5vw, 32px)' }}
          className="hidden lg:flex">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {({ isActive }) => (
                <span style={S.navLink(isActive)}>
                  {label}
                  <span style={S.navUnderline(isActive)} />
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Actions droite — masquées mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          className="hidden lg:flex">
          {user ? (
            <>
              {isAdmin && (
                <Link to="/dashboard" style={navBtnStyle}>
                  <LayoutDashboard size={13} /> Dashboard
                </Link>
              )}
              {isOwner && (
                <Link to="/mes-biens" style={navBtnStyle}>
                  <Building size={13} /> Mes Biens
                </Link>
              )}
              <Link to="/messages" style={{
                position: 'relative', padding: '8px', borderRadius: '10px',
                color: 'rgba(232,228,220,0.5)', display: 'flex', transition: '0.2s',
              }}>
                <MessageCircle size={18} />
                <UnreadMessagesBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
              </Link>

              {/* Dropdown profil */}
              <div ref={profileRef} style={{ position: 'relative' }}>
                <button onClick={() => setProfile(!profileOpen)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 14px 7px 8px', borderRadius: '40px',
                  border: '1px solid rgba(232,228,220,0.1)',
                  background: 'transparent', color: '#E8E4DC',
                  fontSize: '0.8rem', fontWeight: 400, cursor: 'pointer',
                }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C8872A, #2E7BB5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 500, color: '#fff', flexShrink: 0,
                  }}>
                    {(user.name || 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || 'Profil'}
                  </span>
                  <ChevronDown size={12} style={{ opacity: 0.4, transform: profileOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>

                {profileOpen && (
                  <div style={S.dropdown}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(232,228,220,0.06)' }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 500, color: '#E8E4DC' }}>{user.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(232,228,220,0.35)' }}>{user.email}</p>
                    </div>
                    {PROFILE_LINKS.map(({ to, Icon, label, color }) => (
                      <Link key={to} to={to} onClick={() => setProfile(false)} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '11px 18px', color: 'rgba(232,228,220,0.55)',
                        fontSize: '0.82rem', fontWeight: 300, transition: '0.2s',
                      }}>
                        <Icon size={14} style={{ color, flexShrink: 0 }} /> {label}
                      </Link>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(232,228,220,0.06)' }} />
                    <button onClick={handleLogout} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '11px 18px',
                      color: 'rgba(232,228,220,0.4)', fontSize: '0.82rem',
                      fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <LogOut size={14} style={{ color: '#D42B2B', flexShrink: 0 }} /> Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" style={navBtnStyle}>
                <LogIn size={13} /> Connexion
              </Link>
              <Link to="/register" style={{
                ...navBtnStyle,
                background: '#C8872A', color: '#0A0C0F',
                border: 'none', fontWeight: 500,
              }}>
                <UserPlus size={13} /> S'inscrire
              </Link>
            </>
          )}
        </div>

        {/* Burger — visible mobile */}
        <button onClick={() => setMobile(!mobileOpen)}
          className="lg:hidden"
          style={{
            padding: '8px', borderRadius: '10px',
            background: 'none', border: 'none', color: '#E8E4DC',
          }}
          aria-label={mobileOpen ? 'Fermer' : 'Menu'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── MOBILE MENU ── */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, paddingTop: '64px' }}
          className="lg:hidden">
          {/* Backdrop */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobile(false)}
          />
          <div style={S.mobileMenu}>
            {/* Nav links */}
            {NAV_LINKS.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {({ isActive }) => (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '13px 14px', borderRadius: '12px', marginBottom: '2px',
                    color: isActive ? '#E8E4DC' : 'rgba(232,228,220,0.5)',
                    background: isActive ? 'rgba(232,228,220,0.05)' : 'transparent',
                    fontSize: '0.9rem', fontWeight: 300, transition: '0.2s',
                  }}>
                    {Icon && <Icon size={16} style={{ color: isActive ? '#C8872A' : undefined, flexShrink: 0 }} />}
                    {label}
                    {isActive && <span style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: '#C8872A' }} />}
                  </div>
                )}
              </NavLink>
            ))}

            <div style={{ borderTop: '1px solid rgba(232,228,220,0.06)', margin: '10px 0' }} />

            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C8872A, #2E7BB5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 500, color: '#fff', flexShrink: 0,
                  }}>
                    {(user.name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 400, color: '#E8E4DC' }}>{user.name}</p>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(232,228,220,0.35)' }}>{user.email}</p>
                  </div>
                </div>
                {isAdmin && (
                  <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', color: 'rgba(232,228,220,0.5)', fontSize: '0.9rem', fontWeight: 300 }}>
                    <LayoutDashboard size={16} style={{ color: '#2E7BB5' }} /> Dashboard
                  </Link>
                )}
                {isOwner && (
                  <Link to="/mes-biens" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', color: 'rgba(232,228,220,0.5)', fontSize: '0.9rem', fontWeight: 300 }}>
                    <Building size={16} style={{ color: '#2E7BB5' }} /> Mes Biens
                  </Link>
                )}
                {PROFILE_LINKS.map(({ to, Icon, label, color }) => (
                  <Link key={to} to={to} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', color: 'rgba(232,228,220,0.5)', fontSize: '0.9rem', fontWeight: 300 }}>
                    <Icon size={16} style={{ color, flexShrink: 0 }} /> {label}
                    {to === '/messages' && unreadCount > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: '#D42B2B', padding: '2px 7px', borderRadius: '20px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                ))}
                <button onClick={handleLogout} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  width: '100%', padding: '12px 14px', borderRadius: '12px',
                  color: 'rgba(212,43,43,0.7)', fontSize: '0.9rem',
                  fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                <Link to="/login" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '13px', borderRadius: '40px',
                  border: '1px solid rgba(232,228,220,0.12)',
                  color: 'rgba(232,228,220,0.7)', fontSize: '0.82rem',
                  fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  <LogIn size={14} /> Connexion
                </Link>
                <Link to="/register" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '13px', borderRadius: '40px',
                  background: '#C8872A', color: '#0A0C0F',
                  fontSize: '0.82rem', fontWeight: 500,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  <UserPlus size={14} /> S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;