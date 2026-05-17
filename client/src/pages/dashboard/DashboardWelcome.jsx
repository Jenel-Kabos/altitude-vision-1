import React from 'react';
import { FaPlus, FaBullhorn } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const quickLinks = [
  {
    to: "/soumettre-propriete",
    bgColor: "bg-blue-600",
    hoverColor: "hover:bg-blue-700",
    Icon: FaPlus,
    title: "Ajouter un Bien",
    description: "Créer une nouvelle annonce Altimmo",
  },
  {
    to: "/admin/evenements/creer",
    bgColor: "bg-green-500",
    hoverColor: "hover:bg-green-600",
    Icon: FaPlus,
    title: "Créer un Événement",
    description: "Organiser un nouvel événement Mila Events",
  },
  {
    to: "/admin/projets/creer",
    bgColor: "bg-indigo-500",
    hoverColor: "hover:bg-indigo-600",
    Icon: FaPlus,
    title: "Lancer un Projet",
    description: "Démarrer un nouveau projet Altcom",
  },
  {
    to: "/admin/devis",
    bgColor: "bg-yellow-500",
    hoverColor: "hover:bg-yellow-600",
    Icon: FaBullhorn,
    title: "Voir les Devis",
    description: "Consulter les nouvelles demandes",
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

const DashboardWelcome = () => {
  const { userInfo } = useAuth();

  return (
    <div className="animate-fadeIn">
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-l-4 border-primary">
        <h1 className="text-3xl font-bold text-gray-800">Bienvenue, {userInfo?.name || 'Admin'} !</h1>
        <p className="text-gray-600 mt-2">Ceci est votre centre de contrôle. Utilisez les liens rapides ou le menu de gauche pour naviguer.</p>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-700 mb-6">Accès Rapide</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickLinks.map((link) => (
          <QuickAccessCard key={link.to} {...link} />
        ))}
      </div>
    </div>
  );
};

export default DashboardWelcome;