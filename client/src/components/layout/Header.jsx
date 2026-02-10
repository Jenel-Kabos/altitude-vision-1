import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    FaSignInAlt,
    FaUserPlus,
    FaTachometerAlt,
    FaBuilding,
    FaSignOutAlt,
    FaUserCircle,
    FaBars,
    FaTimes,
    FaHeart,
    FaCommentDots,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { getTotalUnreadCount } from '../../services/unreadCountService';
import UnreadMessagesBadge from '../messaging/UnreadMessagesBadge';

// --- LOGIQUE DYNAMIQUE DE COMPTAGE DES MESSAGES NON LUS ---
// ✅ Utilise le nouveau service unifié qui compte emails internes + conversations
const useUnreadCount = () => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                // ✅ Utilise le service unifié qui combine emails internes ET conversations
                const count = await getTotalUnreadCount();
                setUnreadCount(count);
                
            } catch (error) {
                console.error("Erreur lors de la récupération du compte non lu :", error);
                setUnreadCount(0); // Afficher 0 en cas d'erreur
            }
        };

        // 1. Récupération immédiate
        fetchUnreadCount();

        // 2. Rafraîchissement périodique (toutes les 30 secondes)
        const intervalId = setInterval(fetchUnreadCount, 30000); 

        // 3. Nettoyage
        return () => clearInterval(intervalId);
    }, []);

    return unreadCount;
};
// ------------------------------------------------------------------------

const Header = () => {
    const { user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    // 🆕 Récupération du nombre de messages non lus (dynamique)
    const unreadCount = useUnreadCount();

    const handleLogout = () => {
        logout();
        setMobileOpen(false);
        setProfileOpen(false);
        navigate('/login', { replace: true });
    };

    const navLinkClass = ({ isActive }) =>
        `block text-white hover:bg-orange-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            isActive ? 'bg-orange-500' : ''
        }`;

    const renderAuthButtons = () => {
        if (user) {
            const isAdmin = user.role === 'Admin' || user.role === 'Collaborateur';
            const isOwner = user.role === 'Propriétaire';

            return (
                <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0">
                    {isAdmin && (
                        <NavLink
                            to="/dashboard"
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                            onClick={() => setMobileOpen(false)}
                        >
                            <FaTachometerAlt className="mr-2" /> Dashboard
                        </NavLink>
                    )}

                    {isOwner && (
                        <NavLink
                            to="/mes-biens"
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                            onClick={() => setMobileOpen(false)}
                        >
                            <FaBuilding className="mr-2" /> Mes Biens
                        </NavLink>
                    )}

                    {/* 🟢 BLOC MESSAGERIE avec badge dynamique */}
                    <NavLink
                        to="/messages" 
                        className="relative p-2 rounded-full text-white hover:bg-orange-700 transition-colors duration-200"
                        title="Messagerie"
                        onClick={() => setMobileOpen(false)}
                    >
                        <FaCommentDots size={24} /> 
                        
                        {/* ✅ Badge avec comptage unifié (emails + conversations) */}
                        <UnreadMessagesBadge 
                            count={unreadCount}
                            className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2" 
                        />
                    </NavLink>

                    {/* 🆕 MENU DÉROULANT PROFIL */}
                    <div className="relative hidden md:block">
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                        >
                            <FaUserCircle className="mr-2" /> {user.name || 'Profil'}
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-10 z-50 animate-fadeIn">
                                <NavLink
                                    to="/profile"
                                    className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                                    onClick={() => setProfileOpen(false)}
                                >
                                    <FaUserCircle className="mr-2 text-orange-500" /> Mon Profil
                                </NavLink>

                                <NavLink
                                    to="/favoris"
                                    className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                                    onClick={() => setProfileOpen(false)}
                                >
                                    <FaHeart className="mr-2 text-pink-500" /> Favoris
                                </NavLink>

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100"
                                >
                                    <FaSignOutAlt className="mr-2 text-red-500" /> Déconnexion
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bouton Déconnexion visible uniquement sur mobile */}
                    <button
                        onClick={handleLogout}
                        title="Déconnexion"
                        className="md:hidden bg-red-500 hover:bg-red-600 text-white p-2 rounded-full flex items-center justify-center transition-colors duration-200"
                    >
                        <FaSignOutAlt size={18} />
                    </button>
                </div>
            );
        }

        // --- Non connecté ---
        return (
            <div className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-2 md:space-y-0">
                <NavLink
                    to="/login"
                    className="bg-white hover:bg-gray-200 text-orange-600 font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                    onClick={() => setMobileOpen(false)}
                >
                    <FaSignInAlt className="mr-2" /> Connexion
                </NavLink>
                <NavLink
                    to="/register"
                    className="bg-gray-200 hover:bg-gray-300 text-orange-600 font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                    onClick={() => setMobileOpen(false)}
                >
                    <FaUserPlus className="mr-2" /> Inscription
                </NavLink>
            </div>
        );
    };

    return (
        <header className="bg-orange-600 shadow-md sticky top-0 z-40">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <NavLink to="/" className="flex items-center">
                        <img
                            className="h-14 sm:h-16 object-contain"
                            src="/logo.png"
                            alt="Logo Altitude-Vision"
                        />
                    </NavLink>

                    {/* Menu Desktop */}
                    <nav className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <NavLink to="/" className={navLinkClass}>
                                Accueil
                            </NavLink>
                            <NavLink to="/altimmo" className={navLinkClass}>
                                Altimmo
                            </NavLink>
                            <NavLink to="/mila-events" className={navLinkClass}>
                                Mila Events
                            </NavLink>
                            <NavLink to="/altcom" className={navLinkClass}>
                                Altcom
                            </NavLink>
                            <NavLink to="/contact" className={navLinkClass}>
                                Contact
                            </NavLink>
                        </div>
                    </nav>

                    {/* Boutons Auth Desktop */}
                    <div className="hidden md:flex items-center space-x-4">
                        {renderAuthButtons()}
                    </div>

                    {/* Bouton menu mobile */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="text-white p-2 rounded-md focus:outline-none md:hidden"
                        aria-label="Ouvrir le menu mobile"
                    >
                        {mobileOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
                    </button>
                </div>

                {/* Menu mobile */}
                {mobileOpen && (
                    <div className="md:hidden mt-2 bg-orange-500 rounded-lg p-4 space-y-2 shadow-lg animate-fadeIn">
                        <NavLink
                            to="/"
                            className={navLinkClass}
                            onClick={() => setMobileOpen(false)}
                        >
                            Accueil
                        </NavLink>
                        <NavLink
                            to="/altimmo"
                            className={navLinkClass}
                            onClick={() => setMobileOpen(false)}
                        >
                            Altimmo
                        </NavLink>
                        <NavLink
                            to="/mila-events"
                            className={navLinkClass}
                            onClick={() => setMobileOpen(false)}
                        >
                            Mila Events
                        </NavLink>
                        <NavLink
                            to="/altcom"
                            className={navLinkClass}
                            onClick={() => setMobileOpen(false)}
                        >
                            Altcom
                        </NavLink>
                        <NavLink
                            to="/contact"
                            className={navLinkClass}
                            onClick={() => setMobileOpen(false)}
                        >
                            Contact
                        </NavLink>

                        <div className="border-t border-orange-400 my-2" />
                        {renderAuthButtons()}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;