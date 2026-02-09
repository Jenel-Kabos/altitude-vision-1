import React, { useState } from 'react';
import { FaPlus, FaBullhorn } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, ChevronRight, Home } from 'lucide-react';

const quickLinks = [
  {
    id: 'altimmo',
    to: "/soumettre-propriete",
    bgColor: "bg-blue-600",
    hoverColor: "hover:bg-blue-700",
    borderColor: "border-blue-200",
    Icon: FaPlus,
    title: "Ajouter un Bien",
    description: "Créer une nouvelle annonce Altimmo",
    category: "Immobilier"
  },
  {
    id: 'events',
    to: "/admin/evenements/creer",
    bgColor: "bg-green-500",
    hoverColor: "hover:bg-green-600",
    borderColor: "border-green-200",
    Icon: FaPlus,
    title: "Créer un Événement",
    description: "Organiser un nouvel événement Mila Events",
    category: "Événements"
  },
  {
    id: 'altcom',
    to: "/admin/projets/creer",
    bgColor: "bg-indigo-500",
    hoverColor: "hover:bg-indigo-600",
    borderColor: "border-indigo-200",
    Icon: FaPlus,
    title: "Lancer un Projet",
    description: "Démarrer un nouveau projet Altcom",
    category: "Communication"
  },
  {
    id: 'quotes',
    to: "/admin/devis",
    bgColor: "bg-yellow-500",
    hoverColor: "hover:bg-yellow-600",
    borderColor: "border-yellow-200",
    Icon: FaBullhorn,
    title: "Voir les Devis",
    description: "Consulter les nouvelles demandes",
    category: "Gestion"
  },
];

const QuickAccessCard = ({ to, bgColor, hoverColor, Icon, title, description }) => (
  <Link 
    to={to} 
    className={`${bgColor} ${hoverColor} text-white p-6 rounded-lg shadow-lg flex flex-col items-center justify-center text-center transition-transform transform hover:-translate-y-1`}
  >
    <Icon className="text-4xl mb-3" />
    <h3 className="text-xl font-semibold">{title}</h3>
    <p className="mt-1 text-sm opacity-90">{description}</p>
  </Link>
);

const MobileQuickAccessItem = ({ to, bgColor, hoverColor, borderColor, Icon, title, description, category, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`
      w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border bg-white
      hover:bg-gray-50 hover:${borderColor} hover:shadow-md
    `}
  >
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${bgColor} text-white`}>
        <Icon className="text-xl" />
      </div>
      <div className="text-left">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
    <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
  </Link>
);

const DashboardWelcome = () => {
  const { userInfo } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);

  const handleMobileItemClick = (linkId) => {
    setSelectedAction(linkId);
    setShowMobileMenu(false);
  };

  const handleToggleMenu = () => {
    setShowMobileMenu(true);
    setSelectedAction(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      
      {/* =======================================================
          PANNEAU MOBILE : Menu des actions rapides
          - Mobile : Occupe tout l'écran quand showMobileMenu = true
          - Desktop : Caché, on affiche directement la grille
      ======================================================== */}
      <aside className={`
        ${showMobileMenu ? 'flex' : 'hidden'} 
        md:hidden flex-col w-full bg-white overflow-y-auto
        fixed inset-0 z-40
      `}>
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Home size={24} />
            <h1 className="text-xl font-bold">Accueil</h1>
          </div>
          <p className="text-sm opacity-90">Bienvenue, {userInfo?.name || 'Admin'} !</p>
        </div>

        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
            Actions Rapides
          </h2>
          <nav className="space-y-2">
            {quickLinks.map((link) => (
              <MobileQuickAccessItem 
                key={link.id} 
                {...link}
                onClick={() => handleMobileItemClick(link.id)}
              />
            ))}
          </nav>
        </div>

        <div className="p-4 mt-auto border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Utilisez le menu de navigation pour accéder aux autres sections
          </p>
        </div>
      </aside>

      {/* =======================================================
          CONTENU PRINCIPAL
          - Mobile : Caché quand showMobileMenu = true, avec bouton menu
          - Desktop : Toujours visible, affichage classique en grille
      ======================================================== */}
      <main className={`
        ${showMobileMenu ? 'hidden' : 'flex'} 
        md:flex flex-1 flex-col overflow-hidden
        fixed md:relative inset-0 z-30 md:z-auto bg-gray-50
      `}>
        {/* Header Mobile avec bouton Menu */}
        <div className="md:hidden bg-white border-b p-4 flex items-center gap-3 shadow-sm">
          <button 
            onClick={handleToggleMenu}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-bold text-gray-800">
            Accueil
          </h2>
        </div>

        {/* Contenu Défilant */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fadeIn">
            
            {/* En-tête de bienvenue */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-l-4 border-primary">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                Bienvenue, {userInfo?.name || 'Admin'} !
              </h1>
              <p className="text-gray-600 mt-2 text-sm md:text-base">
                Ceci est votre centre de contrôle. Utilisez les liens rapides ou le menu de gauche pour naviguer.
              </p>
            </div>
            
            {/* Titre Section */}
            <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-6">
              Accès Rapide
            </h2>

            {/* Grille des cartes - Visible uniquement sur desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickLinks.map((link) => (
                <QuickAccessCard key={link.to} {...link} />
              ))}
            </div>

            {/* Section supplémentaire pour améliorer l'UI */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                💡 Astuce du jour
              </h3>
              <p className="text-gray-600 text-sm">
                Utilisez les raccourcis ci-dessus pour accéder rapidement aux fonctionnalités les plus utilisées de votre plateforme.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardWelcome;