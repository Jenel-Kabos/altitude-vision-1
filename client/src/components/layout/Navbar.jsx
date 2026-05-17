import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png'; // Assurez-vous que ce chemin est correct

const Navbar = () => {
  const { userInfo, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoutHandler = () => {
    logout();
    setMobileMenuOpen(false); // Fermer le menu mobile lors de la déconnexion
    navigate('/login');
  };

  // Style pour les liens actifs, appliqué par NavLink
  const activeLinkStyle = {
    color: '#1E3A8A',
    fontWeight: '600',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex-shrink-0">
            <NavLink to="/" onClick={() => setMobileMenuOpen(false)}>
              <img className="h-14 w-auto" src={logo} alt="Altitude-Vision" />
            </NavLink>
          </div>

          {/* Navigation Desktop */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-6">
              <NavLink 
                to="/altimmo" 
                style={({ isActive }) => isActive ? activeLinkStyle : undefined}
                className="text-gray-600 hover:text-primary transition-colors duration-300"
              >
                Altimmo
              </NavLink>
              <NavLink 
                to="/mila-events" 
                style={({ isActive }) => isActive ? activeLinkStyle : undefined}
                className="text-gray-600 hover:text-primary transition-colors duration-300"
              >
                Mila Events
              </NavLink>
              <NavLink 
                to="/altcom" 
                style={({ isActive }) => isActive ? activeLinkStyle : undefined}
                className="text-gray-600 hover:text-primary transition-colors duration-300"
              >
                Altcom
              </NavLink>

              {/* Section Utilisateur Desktop */}
              {userInfo ? (
                <div className="relative group ml-4">
                  <button className="flex items-center bg-primary text-white px-4 py-2 rounded-md focus:outline-none">
                    <span>{userInfo.name}</span>
                    <svg className="ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-100 scale-95 origin-top-right">
                    <NavLink to="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Tableau de bord</NavLink>
                    {userInfo.role === 'Admin' && (
                       <NavLink to="/admin/biens" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Admin</NavLink>
                    )}
                    <button onClick={logoutHandler} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Déconnexion
                    </button>
                  </div>
                </div>
              ) : (
                <NavLink to="/login" className="bg-secondary text-white font-bold px-5 py-2 rounded-md hover:bg-amber-600 transition duration-300 ml-4">
                  Connexion
                </NavLink>
              )}
            </div>
          </div>

          {/* Bouton Menu Mobile */}
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="bg-primary inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-800 focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Ouvrir le menu principal</span>
              {/* Icône Hamburger/Croix */}
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/altimmo" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Altimmo</NavLink>
            <NavLink to="/mila-events" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Mila Events</NavLink>
            <NavLink to="/altcom" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Altcom</NavLink>
          </div>
          {/* Section Utilisateur Mobile */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            {userInfo ? (
              <div className="px-2 space-y-1">
                <div className="px-3 mb-2">
                    <div className="text-base font-medium text-gray-800">{userInfo.name}</div>
                    <div className="text-sm font-medium text-gray-500">{userInfo.email}</div>
                </div>
                <NavLink to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-100">Tableau de bord</NavLink>
                {userInfo.role === 'Admin' && (
                    <NavLink to="/admin/biens" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-100">Admin</NavLink>
                )}
                <button onClick={logoutHandler} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-100">
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="px-2">
                 <NavLink to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full block bg-secondary text-white text-center font-bold px-5 py-2 rounded-md hover:bg-amber-600 transition duration-300">
                  Connexion
                </NavLink>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;