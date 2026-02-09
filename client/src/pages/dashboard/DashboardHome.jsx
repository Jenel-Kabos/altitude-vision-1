// src/pages/dashboard/DashboardHome.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { 
  Building2, Calendar, Megaphone, FileText, 
  Loader2, AlertCircle, ChevronLeft, ChevronRight,
  LayoutDashboard, TrendingUp, CheckCircle, Clock
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { getDashboardStats } from "../../services/dashboardService";
import { getAllQuotes } from "../../services/quoteService";

const DashboardHome = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS ---
  const [stats, setStats] = useState({ Altimmo: 0, MilaEvents: 0, Altcom: 0 });
  const [quotesStats, setQuotesStats] = useState({ total: 0, nouveau: 0, enCours: 0, converti: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // État de sélection : null = Afficher la liste / 'id' = Afficher le détail
  const [selectedSection, setSelectedSection] = useState(null); 

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    if (authLoading) return;
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [dashboardData, quotesData] = await Promise.all([
          getDashboardStats(),
          getAllQuotes()
        ]);

        setStats(dashboardData);
        setQuotesStats({
          total: quotesData.length,
          nouveau: quotesData.filter(q => q.status === 'Nouveau').length,
          enCours: quotesData.filter(q => q.status === 'En cours').length,
          converti: quotesData.filter(q => q.status === 'Converti').length,
        });
        
        // Optionnel : Sur Grand Écran, on sélectionne "overview" par défaut
        // Sur Mobile, on laisse à null pour voir la liste
        if (window.innerWidth >= 768) {
            setSelectedSection('overview');
        }

      } catch (err) {
        console.error("Erreur Dashboard:", err);
        if (err.response?.status === 401) {
            navigate("/login");
        } else {
            setError("Impossible de charger les données.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [authLoading, navigate]);

  const chartData = [
    { name: "Altimmo", Annonces: stats.Altimmo },
    { name: "MilaEvents", Annonces: stats.MilaEvents },
    { name: "Altcom", Annonces: stats.Altcom },
  ];

  if (authLoading || loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  // Configuration des cartes de la liste
  const masterItems = [
    { 
      id: 'overview', 
      label: "Vue d'ensemble", 
      icon: <LayoutDashboard size={20} />, 
      value: stats.Altimmo + stats.MilaEvents + stats.Altcom,
      sub: "Publications totales",
      color: "bg-indigo-50 text-indigo-600"
    },
    { 
      id: 'quotes', 
      label: "Gestion des Devis", 
      icon: <FileText size={20} />, 
      value: quotesStats.total,
      sub: "Demandes reçues",
      color: "bg-purple-50 text-purple-600"
    },
    { 
      id: 'altimmo', 
      label: "Altimmo", 
      icon: <Building2 size={20} />, 
      value: stats.Altimmo,
      sub: "Biens immobiliers",
      color: "bg-blue-50 text-blue-600"
    },
    { 
      id: 'mila', 
      label: "MilaEvents", 
      icon: <Calendar size={20} />, 
      value: stats.MilaEvents,
      sub: "Événements à venir",
      color: "bg-pink-50 text-pink-600"
    },
    { 
      id: 'altcom', 
      label: "Altcom", 
      icon: <Megaphone size={20} />, 
      value: stats.Altcom,
      sub: "Campagnes actives",
      color: "bg-green-50 text-green-600"
    },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      
      {/* =======================================================
          COLONNE 1 : MASTER (LA LISTE)
          - Mobile : Caché si selectedSection existe (hidden)
          - Desktop : Toujours visible (md:flex)
      ======================================================== */}
      <div className={`
          w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 flex-col
          ${selectedSection ? 'hidden md:flex' : 'flex'} 
      `}>
        {/* Header de la liste */}
        <div className="p-5 border-b bg-gray-50">
          <h1 className="text-xl font-bold text-gray-800">Tableau de Bord</h1>
          <p className="text-sm text-gray-500 mt-1">Bienvenue, {user?.name}</p>
        </div>

        {/* Liste des éléments */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {masterItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedSection(item.id)}
              className={`
                group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border
                ${selectedSection === item.id 
                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}
              `}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className={`font-semibold ${selectedSection === item.id ? 'text-blue-900' : 'text-gray-700'}`}>
                    {item.label}
                  </h3>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* =======================================================
          COLONNE 2 : DETAIL (LE CONTENU)
          - Mobile : Caché si RIEN n'est sélectionné (hidden)
          - Desktop : Toujours visible (md:flex)
      ======================================================== */}
      <div className={`
          w-full md:w-2/3 lg:w-3/4 bg-gray-50 flex-col
          ${selectedSection ? 'flex' : 'hidden md:flex'}
      `}>
        {selectedSection ? (
          <>
            {/* Header du détail (Avec bouton retour mobile) */}
            <div className="bg-white border-b p-4 flex items-center gap-3 shadow-sm z-10 sticky top-0">
              <button 
                onClick={() => setSelectedSection(null)}
                className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                {masterItems.find(i => i.id === selectedSection)?.icon}
                {masterItems.find(i => i.id === selectedSection)?.label}
              </h2>
            </div>

            {/* Contenu dynamique */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              
              {/* --- VUE: GESTION DES DEVIS --- */}
              {selectedSection === 'quotes' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <QuoteDetailCard label="Nouveaux" value={quotesStats.nouveau} icon={<Clock />} color="blue" />
                        <QuoteDetailCard label="En Cours" value={quotesStats.enCours} icon={<TrendingUp />} color="yellow" />
                        <QuoteDetailCard label="Convertis" value={quotesStats.converti} icon={<CheckCircle />} color="green" />
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Actions Rapides</h3>
                        <p className="text-gray-500 mb-6">Gérez vos demandes et transformez-les en projets.</p>
                        <button 
                            onClick={() => navigate('/dashboard/quotes')}
                            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 font-semibold"
                        >
                            Accéder à la liste complète
                        </button>
                    </div>
                </div>
              )}

              {/* --- VUE: VUE D'ENSEMBLE & AUTRES --- */}
              {selectedSection !== 'quotes' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                    {/* Carte Résumé Spécifique */}
                    {selectedSection !== 'overview' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4">
                             <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                                {masterItems.find(i => i.id === selectedSection)?.icon}
                             </div>
                             <div>
                                 <p className="text-gray-500 text-sm font-medium">Total actuel</p>
                                 <p className="text-4xl font-bold text-gray-900">
                                     {masterItems.find(i => i.id === selectedSection)?.value}
                                 </p>
                             </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Répartition par Pôle" type="bar" data={chartData} />
                        <ChartCard title="Tendance Mensuelle" type="line" data={chartData} />
                    </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* État vide Desktop */
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
             <div className="bg-white p-8 rounded-full shadow-sm mb-4">
                <LayoutDashboard size={48} className="text-gray-300" />
             </div>
             <p className="text-lg font-medium">Sélectionnez une section à gauche</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SOUS-COMPOSANTS ---

const QuoteDetailCard = ({ label, value, icon, color }) => {
    const colors = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
        green: "bg-green-50 text-green-600 border-green-100",
    };
    return (
        <div className={`p-6 rounded-2xl border ${colors[color]} flex flex-col items-center justify-center text-center shadow-sm`}>
            <div className="mb-3 opacity-80 scale-125">{icon}</div>
            <span className="text-4xl font-bold mb-1">{value}</span>
            <span className="text-xs font-bold uppercase tracking-widest opacity-70">{label}</span>
        </div>
    );
};

const ChartCard = ({ title, type, data }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
    <h3 className="text-lg font-semibold text-gray-800 mb-6">{title}</h3>
    <div className="h-[250px] w-full text-xs">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Bar dataKey="Annonces" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Line type="monotone" dataKey="Annonces" stroke="#10b981" strokeWidth={3} dot={{r:4, fill:'#10b981'}} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

const LoadingScreen = () => (
    <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
    </div>
);

const ErrorScreen = ({ error }) => (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-lg">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Erreur</h3>
            <p className="text-gray-600">{error}</p>
        </div>
    </div>
);

export default DashboardHome;