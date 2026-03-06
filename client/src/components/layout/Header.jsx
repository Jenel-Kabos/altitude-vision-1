import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Menu, X, LayoutDashboard, Building, LogOut,
    UserCircle, Heart, MessageCircle, UserPlus,
    LogIn, ChevronDown, Home, Phone, Newspaper,
} from 'lucide-react';
import { FaFacebook, FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { getTotalUnreadCount } from '../../services/unreadCountService';
import UnreadMessagesBadge from '../messaging/UnreadMessagesBadge';

// ─────────────────────────────────────────────────────────────
// Hook — comptage messages non lus
// ─────────────────────────────────────────────────────────────
const useUnreadCount = () => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const fetch = async () => {
            try { setCount(await getTotalUnreadCount()); }
            catch { setCount(0); }
        };
        fetch();
        const id = setInterval(fetch, 30000);
        return () => clearInterval(id);
    }, []);
    return count;
};

// ─────────────────────────────────────────────────────────────
// Navigation principale
// ─────────────────────────────────────────────────────────────
const NAV_LINKS = [
    { to: '/',            label: 'Accueil',     icon: Home       },
    { to: '/altimmo',     label: 'Altimmo',     icon: Building   },
    { to: '/mila-events', label: 'Mila Events', icon: null       },
    { to: '/altcom',      label: 'Altcom',      icon: null       },
    { to: '/actualites',  label: 'Actualités',  icon: Newspaper  },
    { to: '/contact',     label: 'Contact',     icon: Phone      },
];

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const Header = () => {
    const { user, logout }          = useAuth();
    const [scrolled, setScrolled]   = useState(false);
    const [mobileOpen, setMobile]   = useState(false);
    const [profileOpen, setProfile] = useState(false);
    const unreadCount               = useUnreadCount();
    const navigate                  = useNavigate();
    const location                  = useLocation();
    const profileRef                = useRef(null);

    // ── Scroll detection ────────────────────
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // ── Fermer dropdown au clic extérieur ───
    useEffect(() => {
        const onClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target))
                setProfile(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    // ── Fermer mobile au changement de route ─
    useEffect(() => { setMobile(false); setProfile(false); }, [location.pathname]);

    const handleLogout = () => {
        logout();
        setMobile(false);
        setProfile(false);
        navigate('/login', { replace: true });
    };

    // ── Styles dynamiques selon le scroll ───
    const headerBg = scrolled
        ? 'bg-[#0D1117]/95 backdrop-blur-md shadow-xl shadow-black/20 border-b border-white/5'
        : 'bg-transparent';

    // ── Classe lien nav desktop ──────────────
    const desktopLink = (isActive) => `
        relative text-sm font-medium transition-all duration-200 py-1 px-1
        ${isActive
            ? 'text-white'
            : scrolled
                ? 'text-white/70 hover:text-white'
                : 'text-white/80 hover:text-white'
        }
    `;

    const isAdmin = user?.role === 'Admin' || user?.role === 'Collaborateur';
    const isOwner = user?.role === 'Proprietaire';

    return (
        <>
            <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerBg}`}>
                <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                    <div className="flex items-center justify-between h-16 sm:h-18">

                        {/* ── Logo ──────────────────────────── */}
                        <Link to="/" className="flex items-center flex-shrink-0">
                            <img
                                src="/logo.png"
                                alt="Altitude-Vision"
                                className="h-12 sm:h-14 object-contain drop-shadow-sm"
                            />
                        </Link>

                        {/* ── Nav desktop ───────────────────── */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {NAV_LINKS.map(({ to, label }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={to === '/'}
                                    className={({ isActive }) => desktopLink(isActive)}
                                >
                                    {({ isActive }) => (
                                        <>
                                            {label}
                                            {/* Indicateur actif — ligne dorée */}
                                            <span
                                                className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full transition-all duration-300"
                                                style={{
                                                    background:   '#C8872A',
                                                    opacity:      isActive ? 1 : 0,
                                                    transform:    isActive ? 'scaleX(1)' : 'scaleX(0)',
                                                    transformOrigin: 'left',
                                                }}
                                            />
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        {/* ── Actions droite ─────────────────── */}
                        <div className="hidden lg:flex items-center gap-2">

                            {user ? (
                                <>
                                    {/* Dashboard / Mes Biens */}
                                    {isAdmin && (
                                        <Link to="/dashboard"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/15 hover:bg-white/10 transition-all duration-200"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            <LayoutDashboard className="w-3.5 h-3.5" />
                                            Dashboard
                                        </Link>
                                    )}
                                    {isOwner && (
                                        <Link to="/mes-biens"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/15 hover:bg-white/10 transition-all duration-200"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            <Building className="w-3.5 h-3.5" />
                                            Mes Biens
                                        </Link>
                                    )}

                                    {/* Messages */}
                                    <Link to="/messages"
                                        className="relative p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                                        aria-label="Messagerie"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        <UnreadMessagesBadge
                                            count={unreadCount}
                                            className="absolute -top-0.5 -right-0.5"
                                        />
                                    </Link>

                                    {/* Dropdown profil */}
                                    <div className="relative" ref={profileRef}>
                                        <button
                                            onClick={() => setProfile(!profileOpen)}
                                            className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 border border-white/10"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}
                                        >
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #C8872A, #2E7BB5)' }}>
                                                {(user.name || 'U')[0].toUpperCase()}
                                            </div>
                                            <span className="max-w-[80px] truncate">{user.name || 'Profil'}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown */}
                                        {profileOpen && (
                                            <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/40"
                                                style={{ background: 'rgba(13,17,23,0.97)', backdropFilter: 'blur(16px)' }}>
                                                {/* Info user */}
                                                <div className="px-4 py-3 border-b border-white/8">
                                                    <p className="text-white text-sm font-semibold truncate"
                                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        {user.name}
                                                    </p>
                                                    <p className="text-white/40 text-xs truncate"
                                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                        {user.email}
                                                    </p>
                                                </div>

                                                {/* Liens */}
                                                {[
                                                    { to: '/profile', icon: UserCircle, label: 'Mon Profil',   color: '#2E7BB5' },
                                                    { to: '/favoris', icon: Heart,       label: 'Mes Favoris', color: '#D42B2B' },
                                                    { to: '/messages',icon: MessageCircle,label:'Messagerie',  color: '#C8872A' },
                                                ].map(({ to, icon: Icon, label, color }) => (
                                                    <Link key={to} to={to}
                                                        onClick={() => setProfile(false)}
                                                        className="flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/8 transition-all duration-150 text-sm"
                                                        style={{ fontFamily: "'Outfit', sans-serif" }}
                                                    >
                                                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                                                        {label}
                                                    </Link>
                                                ))}

                                                <div className="border-t border-white/8 mt-1" />
                                                <button onClick={handleLogout}
                                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-white/60 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150 text-sm"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}
                                                >
                                                    <LogOut className="w-4 h-4 flex-shrink-0 text-red-500/70" />
                                                    Déconnexion
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Link to="/login"
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white/80 hover:text-white border border-white/15 hover:bg-white/10 transition-all duration-200"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}
                                    >
                                        <LogIn className="w-4 h-4" />
                                        Connexion
                                    </Link>
                                    <Link to="/register"
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-105"
                                        style={{
                                            background:  'linear-gradient(135deg, #C8872A, #E5A84B)',
                                            boxShadow:   '0 4px 16px rgba(200,135,42,0.3)',
                                            fontFamily:  "'Outfit', sans-serif",
                                        }}
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        S'inscrire
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* ── Burger mobile ──────────────────── */}
                        <button
                            onClick={() => setMobile(!mobileOpen)}
                            className="lg:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-all"
                            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Menu mobile ──────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    style={{ paddingTop: '64px' }}
                >
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobile(false)} />

                    {/* Panel */}
                    <div className="absolute top-0 left-0 right-0 border-b border-white/10 shadow-2xl"
                        style={{ background: 'rgba(13,17,23,0.98)', backdropFilter: 'blur(20px)' }}>
                        <div className="px-4 py-4 space-y-1">

                            {/* Nav links */}
                            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                                <NavLink key={to} to={to} end={to === '/'}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                                        ${isActive
                                            ? 'text-white bg-white/10'
                                            : 'text-white/70 hover:text-white hover:bg-white/8'
                                        }
                                    `}
                                    style={{ fontFamily: "'Outfit', sans-serif" }}
                                >
                                    {({ isActive }) => (
                                        <>
                                            {Icon && <Icon className="w-4 h-4 flex-shrink-0"
                                                style={{ color: isActive ? '#C8872A' : undefined }} />}
                                            {label}
                                            {isActive && (
                                                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: '#C8872A' }} />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}

                            <div className="border-t border-white/8 my-2" />

                            {/* Auth mobile */}
                            {user ? (
                                <>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #C8872A, #2E7BB5)' }}>
                                            {(user.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                                            <p className="text-white/40 text-xs truncate">{user.email}</p>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <Link to="/dashboard"
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            <LayoutDashboard className="w-4 h-4" style={{ color: '#2E7BB5' }} />
                                            Dashboard
                                        </Link>
                                    )}
                                    {isOwner && (
                                        <Link to="/mes-biens"
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all"
                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                            <Building className="w-4 h-4" style={{ color: '#2E7BB5' }} />
                                            Mes Biens
                                        </Link>
                                    )}
                                    <Link to="/profile"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        <UserCircle className="w-4 h-4" style={{ color: '#2E7BB5' }} />
                                        Mon Profil
                                    </Link>
                                    <Link to="/favoris"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        <Heart className="w-4 h-4" style={{ color: '#D42B2B' }} />
                                        Mes Favoris
                                    </Link>
                                    <Link to="/messages"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        <MessageCircle className="w-4 h-4" style={{ color: '#C8872A' }} />
                                        Messagerie
                                        {unreadCount > 0 && (
                                            <span className="ml-auto text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
                                                style={{ background: '#D42B2B' }}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                    <button onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/8 transition-all"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        <LogOut className="w-4 h-4" />
                                        Déconnexion
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col gap-2 pt-2">
                                    <Link to="/login"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white border border-white/15 hover:bg-white/10 transition-all"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        <LogIn className="w-4 h-4" />
                                        Connexion
                                    </Link>
                                    <Link to="/register"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #C8872A, #E5A84B)',
                                            fontFamily: "'Outfit', sans-serif",
                                        }}>
                                        <UserPlus className="w-4 h-4" />
                                        S'inscrire
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;