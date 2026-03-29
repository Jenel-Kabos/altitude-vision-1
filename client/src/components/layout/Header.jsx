import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Building, LogOut,
  UserCircle, Heart, MessageCircle, UserPlus,
  LogIn, ChevronDown, Home, Phone, Newspaper,
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
    const load = async () => {
      try { setCount(await getTotalUnreadCount()); } catch { setCount(0); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);
  return count;
};

const useBreakpoint = () => {
  const [bp, setBp] = useState('lg');
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480)       setBp('xs');
      else if (w < 768)  setBp('sm');
      else if (w < 1024) setBp('md');
      else               setBp('lg');
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
    <img
      src={user.photo}
      alt={user.name || 'Avatar'}
      onError={() => setImgError(true)}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
        border: '1.5px solid rgba(200,135,42,0.4)',
      }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #C8872A, #2E7BB5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 500, color: '#fff', flexShrink: 0,
    }}>
      {(user?.name || 'U')[0].toUpperCase()}
    </div>
  );
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
  const bp                        = useBreakpoint();

  const isDesktop = bp === 'lg';
  const isTablet  = bp === 'md';
  const isMobile  = bp === 'xs' || bp === 'sm';

  const headerHeight  = isMobile ? '60px' : isTablet ? '66px' : '72px';
  const headerHeightPx = isMobile ? 60 : isTablet ? 66 : 72;
  const headerPadding = isMobile ? '0 16px' : isTablet ? '0 28px' : '0 48px';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = e => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setProfile(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => { setMobile(false); setProfile(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout(); setMobile(false); setProfile(false);
    navigate('/login', { replace: true });
  };

  const isAdmin = user?.role === 'Admin' || user?.role === 'Collaborateur';
  const isOwner = user?.role === 'Proprietaire';

  return (
    <>
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: headerHeight, padding: headerPadding,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'rgba(10,12,15,0.95)' : 'rgba(10,12,15,0.6)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: scrolled ? '1px solid rgba(200,135,42,0.1)' : '1px solid rgba(232,228,220,0.04)',
          boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        {/* WORDMARK */}
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            display: 'block', fontFamily: "'Cormorant Garamond', serif",
            fontSize: isMobile ? '1.1rem' : isTablet ? '1.2rem' : '1.3rem',
            fontWeight: 600, color: '#E8E4DC', letterSpacing: '0.02em', lineHeight: 1.2,
          }}>
            Altitude<span style={{ color: '#C8872A' }}>-</span>Vision
          </span>
          {!isMobile && (
            <span style={{
              display: 'block', fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.5rem', letterSpacing: '0.35em',
              color: 'rgba(232,228,220,0.3)', textTransform: 'uppercase',
            }}>
              Agency
            </span>
          )}
        </Link>

        {/* NAV DESKTOP */}
        {isDesktop && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                style={({ isActive }) => ({
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem',
                  fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: isActive ? '#E8E4DC' : 'rgba(232,228,220,0.45)',
                  textDecoration: 'none', transition: 'color 0.2s',
                  position: 'relative', paddingBottom: '2px',
                })}>
                {({ isActive }) => (
                  <>
                    {label}
                    <span style={{
                      position: 'absolute', bottom: '-2px', left: 0, right: 0,
                      height: '1px', background: '#C8872A',
                      transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left', transition: 'transform 0.3s ease',
                    }} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        {/* NAV TABLETTE */}
        {isTablet && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {NAV_LINKS.slice(0, 4).map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                style={({ isActive }) => ({
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem',
                  fontWeight: 400, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: isActive ? '#E8E4DC' : 'rgba(232,228,220,0.4)',
                  textDecoration: 'none', position: 'relative', paddingBottom: '2px',
                })}>
                {({ isActive }) => (
                  <>
                    {label}
                    <span style={{
                      position: 'absolute', bottom: '-2px', left: 0, right: 0,
                      height: '1px', background: '#C8872A',
                      transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left', transition: 'transform 0.3s ease',
                    }} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        {/* ACTIONS DROITE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          {!isMobile && user ? (
            <>
              {isAdmin && (
                <Link to="/dashboard" style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: isTablet ? '7px 12px' : '8px 16px', borderRadius: '40px',
                  border: '1px solid rgba(232,228,220,0.1)', color: 'rgba(232,228,220,0.6)',
                  fontSize: isTablet ? '0.68rem' : '0.72rem', fontWeight: 400,
                  letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  <LayoutDashboard size={13} />
                  {!isTablet && 'Dashboard'}
                </Link>
              )}
              {isOwner && (
                <Link to="/mes-biens" style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: isTablet ? '7px 12px' : '8px 16px', borderRadius: '40px',
                  border: '1px solid rgba(232,228,220,0.1)', color: 'rgba(232,228,220,0.6)',
                  fontSize: isTablet ? '0.68rem' : '0.72rem', fontWeight: 400,
                  letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  <Building size={13} />
                  {!isTablet && 'Mes Biens'}
                </Link>
              )}

              <Link to="/messages" style={{
                position: 'relative', padding: '8px', borderRadius: '10px',
                color: 'rgba(232,228,220,0.5)', display: 'flex',
              }}>
                <MessageCircle size={isTablet ? 16 : 18} />
                <UnreadMessagesBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
              </Link>

              {/* DROPDOWN PROFIL */}
              <div ref={profileRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfile(!profileOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: isTablet ? '5px 10px 5px 5px' : '5px 12px 5px 5px',
                    borderRadius: '40px', border: '1px solid rgba(232,228,220,0.1)',
                    background: 'transparent', color: '#E8E4DC',
                    fontSize: isTablet ? '0.74rem' : '0.8rem', cursor: 'pointer',
                  }}
                >
                  <UserAvatar user={user} size={isTablet ? 24 : 28} />
                  {!isTablet && (
                    <span style={{
                      maxWidth: '80px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {user.name || 'Profil'}
                    </span>
                  )}
                  <ChevronDown size={12} style={{
                    opacity: 0.4,
                    transform: profileOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: '0.2s',
                  }} />
                </button>

                {profileOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '230px', borderRadius: '16px',
                    border: '1px solid rgba(232,228,220,0.08)',
                    background: 'rgba(10,12,15,0.98)',
                    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    overflow: 'hidden', zIndex: 100,
                    animation: 'fadeSlideDown 0.18s ease',
                  }}>
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(232,228,220,0.06)',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <UserAvatar user={user} size={40} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.88rem', fontWeight: 500,
                          color: '#E8E4DC', marginBottom: '2px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {user.name}
                        </p>
                        <p style={{
                          fontSize: '0.72rem', color: 'rgba(232,228,220,0.35)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {PROFILE_LINKS.map(({ to, Icon, label, color }) => (
                      <Link key={to} to={to} onClick={() => setProfile(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 20px', color: 'rgba(232,228,220,0.55)',
                          fontSize: '0.82rem', fontWeight: 300,
                          transition: '0.2s', textDecoration: 'none',
                        }}>
                        <Icon size={15} style={{ color, flexShrink: 0 }} />
                        {label}
                      </Link>
                    ))}

                    <div style={{ borderTop: '1px solid rgba(232,228,220,0.06)', margin: '4px 0' }} />
                    <button onClick={handleLogout} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      width: '100%', padding: '12px 20px',
                      color: 'rgba(232,228,220,0.4)', fontSize: '0.82rem', fontWeight: 300,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <LogOut size={15} style={{ color: '#D42B2B', flexShrink: 0 }} />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : !isMobile && !user ? (
            <>
              <Link to="/login" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: isTablet ? '8px 14px' : '9px 20px', borderRadius: '40px',
                border: '1px solid rgba(232,228,220,0.12)', color: 'rgba(232,228,220,0.6)',
                fontSize: isTablet ? '0.7rem' : '0.75rem', fontWeight: 400,
                letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                <LogIn size={13} />
                {!isTablet && 'Connexion'}
              </Link>
              <Link to="/register" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: isTablet ? '8px 14px' : '9px 20px', borderRadius: '40px',
                background: '#C8872A', color: '#0A0C0F',
                fontSize: isTablet ? '0.7rem' : '0.75rem', fontWeight: 500,
                letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                <UserPlus size={13} />
                {!isTablet && "S'inscrire"}
              </Link>
            </>
          ) : null}

          {isMobile && user && (
            <Link to="/messages" style={{
              position: 'relative', padding: '8px', borderRadius: '10px',
              color: 'rgba(232,228,220,0.5)', display: 'flex',
            }}>
              <MessageCircle size={18} />
              <UnreadMessagesBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
            </Link>
          )}

          {!isDesktop && (
            <button onClick={() => setMobile(!mobileOpen)}
              style={{
                padding: '8px', borderRadius: '10px',
                background: mobileOpen ? 'rgba(232,228,220,0.06)' : 'none',
                border: 'none', color: '#E8E4DC', cursor: 'pointer', transition: '0.2s',
                minWidth: '44px', minHeight: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </header>

      {/* ── MENU MOBILE / TABLETTE ─────────────────────────────────
          ✅ FIX : le panneau commence SOUS le header (top = headerHeight)
          et non pas depuis le haut de l'écran avec paddingTop.
          Avant : position fixed inset:0 + paddingTop → le contenu démarrait
                  avec un padding mais le div overlay commençait à top:0,
                  ce qui masquait les premiers liens derrière le header.
          Après : le panneau de contenu a top = headerHeight directement,
                  et maxHeight = 100vh - headerHeight pour ne pas déborder.
      ═══════════════════════════════════════════════════════════ */}
      {mobileOpen && !isDesktop && (
        <>
          {/* Fond semi-transparent derrière le menu */}
          <div
            onClick={() => setMobile(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 38,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              animation: 'fadeIn 0.2s ease',
              top: headerHeight, // ✅ commence sous le header, pas depuis le haut
            }}
          />

          {/* Panneau de navigation */}
          <div style={{
            position: 'fixed',
            top: headerHeight,    // ✅ commence exactement sous le header
            left: 0, right: 0,
            zIndex: 39,
            background: 'rgba(8,10,13,0.99)',
            backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
            borderBottom: '1px solid rgba(232,228,220,0.06)',
            padding: isMobile ? '12px 12px 20px' : '16px 24px 24px',
            animation: 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1)',
            maxHeight: `calc(100vh - ${headerHeightPx}px)`,
            overflowY: 'auto',
          }}>

            {/* Grille nav — TOUS les liens visibles sans scroll */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '6px', marginBottom: '12px',
            }}>
              {NAV_LINKS.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: isMobile ? 'center' : 'flex-start',
                    gap: '8px', padding: isMobile ? '12px 14px' : '14px 16px',
                    borderRadius: '12px',
                    color: isActive ? '#E8E4DC' : 'rgba(232,228,220,0.5)',
                    background: isActive ? 'rgba(200,135,42,0.08)' : 'rgba(232,228,220,0.03)',
                    border: `1px solid ${isActive ? 'rgba(200,135,42,0.15)' : 'rgba(232,228,220,0.04)'}`,
                    fontSize: isMobile ? '0.82rem' : '0.78rem', fontWeight: 300,
                    textDecoration: 'none', transition: '0.2s', letterSpacing: '0.04em',
                    // ✅ Zone tactile minimum 44px
                    minHeight: '44px',
                  })}>
                  {({ isActive }) => (
                    <>
                      {Icon && <Icon size={isMobile ? 14 : 16}
                        style={{ color: isActive ? '#C8872A' : 'rgba(232,228,220,0.25)', flexShrink: 0 }} />}
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <div style={{ height: '1px', background: 'rgba(232,228,220,0.06)', margin: '4px 0 12px' }} />

            {user ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '12px',
                  background: 'rgba(232,228,220,0.03)', marginBottom: '8px',
                }}>
                  <UserAvatar user={user} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.88rem', fontWeight: 400, color: '#E8E4DC',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{user.name}</p>
                    <p style={{
                      fontSize: '0.72rem', color: 'rgba(232,228,220,0.35)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{user.email}</p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: '6px', marginBottom: '8px',
                }}>
                  {PROFILE_LINKS.map(({ to, Icon, label, color }) => (
                    <Link key={to} to={to} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '11px 14px', borderRadius: '12px',
                      background: 'rgba(232,228,220,0.03)',
                      border: '1px solid rgba(232,228,220,0.04)',
                      color: 'rgba(232,228,220,0.5)', fontSize: '0.82rem',
                      fontWeight: 300, textDecoration: 'none', transition: '0.2s',
                      minHeight: '44px',
                    }}>
                      <Icon size={15} style={{ color, flexShrink: 0 }} />
                      {label}
                    </Link>
                  ))}
                </div>

                {(isAdmin || isOwner) && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {isAdmin && (
                      <Link to="/dashboard" style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '8px',
                        padding: '11px 14px', borderRadius: '12px',
                        border: '1px solid rgba(232,228,220,0.08)',
                        color: 'rgba(232,228,220,0.5)', fontSize: '0.78rem',
                        fontWeight: 300, textDecoration: 'none',
                        minHeight: '44px',
                      }}>
                        <LayoutDashboard size={14} /> Dashboard
                      </Link>
                    )}
                    {isOwner && (
                      <Link to="/mes-biens" style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '8px',
                        padding: '11px 14px', borderRadius: '12px',
                        border: '1px solid rgba(232,228,220,0.08)',
                        color: 'rgba(232,228,220,0.5)', fontSize: '0.78rem',
                        fontWeight: 300, textDecoration: 'none',
                        minHeight: '44px',
                      }}>
                        <Building size={14} /> Mes Biens
                      </Link>
                    )}
                  </div>
                )}

                <button onClick={handleLogout} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '12px 14px', borderRadius: '12px',
                  color: 'rgba(212,43,43,0.75)', fontSize: '0.82rem', fontWeight: 300,
                  background: 'rgba(212,43,43,0.05)', border: '1px solid rgba(212,43,43,0.08)',
                  cursor: 'pointer', minHeight: '44px',
                }}>
                  <LogOut size={15} style={{ color: '#D42B2B' }} /> Déconnexion
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link to="/login" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '40px',
                  border: '1px solid rgba(232,228,220,0.12)',
                  color: 'rgba(232,228,220,0.7)', fontSize: '0.82rem',
                  fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
                  minHeight: '44px',
                }}>
                  <LogIn size={14} /> Connexion
                </Link>
                <Link to="/register" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '40px',
                  background: '#C8872A', color: '#0A0C0F',
                  fontSize: '0.82rem', fontWeight: 500,
                  letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
                  minHeight: '44px',
                }}>
                  <UserPlus size={14} /> S'inscrire
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn        { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown     { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px);  } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
};

export default Header;