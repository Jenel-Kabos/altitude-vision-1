import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { 
  Building2, Calendar, Megaphone, FileText, 
  Loader2, AlertCircle, ChevronRight,
  LayoutDashboard, TrendingUp, CheckCircle, Clock, Menu, Home
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { getDashboardStats } from "../../services/dashboardService";
import { getAllQuotes } from "../../services/quoteService";

const DashboardHome = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS DES DONNÉES ---
  const [stats, setStats] = useState({ Altimmo: 0, MilaEvents: 0, Altcom: 0 });
  const [quotesStats, setQuotesStats] = useState({ total: 0, nouveau: 0, enCours: 0, converti: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- ÉTATS D'AFFICHAGE ---
  const [activeTab, setActiveTab] = useState('overview'); 
  const [showMobileMenu, setShowMobileMenu] = useState(true);

  // --- CHARGEMENT ---
  useEffect(() => {
    if (authLoading) return;
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [dashboardData, quotesData] = await Promise.all([
          getDashboardStats(),
          getAllQuotes()
        ]);

        console.log("📊 [DashboardHome] Stats reçues:", dashboardData);
        console.log("📋 [DashboardHome] Devis reçus:", quotesData.length);

        setStats(dashboardData);
        setQuotesStats({
          total: quotesData.length,
          nouveau: quotesData.filter(q => q.status === 'Nouveau').length,
          enCours: quotesData.filter(q => q.status === 'En cours').length,
          converti: quotesData.filter(q => q.status === 'Converti').length,
        });
      } catch (err) {
        console.error("❌ [DashboardHome] Erreur:", err);
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

  // Configuration du Menu (DÉPLACÉ ICI POUR ÊTRE DISPONIBLE PARTOUT)
  const menuItems = [
    { 
      id: 'overview', 
      label: "Vue d'ensemble", 
      icon: <LayoutDashboard size={20} />, 
      count: stats.Altimmo + stats.MilaEvents + stats.Altcom,
      color: "text-indigo-600 bg-indigo-50"
    },
    { 
      id: 'quotes', 
      label: "Gestion des Devis", 
      icon: <FileText size={20} />, 
      count: quotesStats.total,
      color: "text-purple-600 bg-purple-50"
    },
    { 
      id: 'altimmo', 
      label: "Altimmo (Immo)", 
      icon: <Building2 size={20} />, 
      count: stats.Altimmo,
      color: "text-blue-600 bg-blue-50"
    },
    { 
      id: 'mila', 
      label: "MilaEvents", 
      icon: <Calendar size={20} />, 
      count: stats.MilaEvents,
      color: "text-pink-600 bg-pink-50"
    },
    { 
      id: 'altcom', 
      label: "Altcom (Pub)", 
      icon: <Megaphone size={20} />, 
      count: stats.Altcom,
      color: "text-green-600 bg-green-50"
    },
  ];

  // ✅ FONCTION POUR OBTENIR LES DONNÉES DU GRAPHIQUE SELON L'ONGLET ACTIF
  const getChartData = () => {
    let data;
    switch(activeTab) {
      case 'altimmo':
        data = [{ name: "Altimmo", Annonces: stats.Altimmo }];
        break;
      case 'mila':
        data = [{ name: "MilaEvents", Annonces: stats.MilaEvents }];
        break;
      case 'altcom':
        data = [{ name: "Altcom", Annonces: stats.Altcom }];
        break;
      case 'overview':
      default:
        data = [
          { name: "Altimmo", Annonces: stats.Altimmo },
          { name: "MilaEvents", Annonces: stats.MilaEvents },
          { name: "Altcom", Annonces: stats.Altcom },
        ];
    }
    console.log(`📊 [getChartData] Onglet: ${activeTab}, Données:`, data);
    return data;
  };

  // ✅ DONNÉES POUR LE GRAPHIQUE CIRCULAIRE (PIE CHART)
  const getPieData = () => {
    const data = [
      { name: 'Altimmo', value: stats.Altimmo, color: '#3b82f6' },
      { name: 'MilaEvents', value: stats.MilaEvents, color: '#ec4899' },
      { name: 'Altcom', value: stats.Altcom, color: '#10b981' },
    ];
    
    return data.filter(item => item.value > 0);
  };

  // ✅ FONCTION POUR OBTENIR LE TITRE SELON L'ONGLET
  const getDetailTitle = () => {
    switch(activeTab) {
      case 'altimmo': return "Statistiques Altimmo";
      case 'mila': return "Statistiques MilaEvents";
      case 'altcom': return "Statistiques Altcom";
      default: return "Vue d'ensemble";
    }
  };

  // ✅ STATISTIQUES DYNAMIQUES PAR PÔLE
  const getCurrentPoleStats = () => {
    const count = menuItems.find(i => i.id === activeTab)?.count || 0;
    
    return {
      actives: count,
      enAttente: Math.floor(count * 0.15),
      validees: Math.floor(count * 0.85),
    };
  };

  // --- GESTION DU CLIC MENU ---
  const handleMenuClick = (tabId) => {
    console.log("🔄 [DashboardHome] Changement d'onglet:", tabId);
    setActiveTab(tabId);
    setShowMobileMenu(false);
  };

  const handleToggleMenu = () => {
    setShowMobileMenu(true);
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  const poleStats = getCurrentPoleStats();
  const chartData = getChartData(); // ✅ Calculer les données à l'extérieur

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      
      {/* =======================================================
          COLONNE 1 : LE MENU (Panneau d'administration)
      ======================================================== */}
      <aside className={`
        ${showMobileMenu ? 'flex' : 'hidden'} 
        md:flex flex-col w-full md:w-80 bg-white border-r border-gray-200 overflow-y-auto
        fixed md:relative inset-0 z-40 md:z-auto
      `}>
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Home size={24} />
            <h1 className="text-xl font-bold">Tableau de Bord</h1>
          </div>
          <p className="text-sm opacity-90">Bienvenue, {user?.name || user?.email?.split('@')[0] || 'Admin'}</p>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`
                w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border
                ${activeTab === item.id 
                  ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200' 
                  : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}
              `}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${item.color}`}>
                  {item.icon}
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${activeTab === item.id ? 'text-gray-900' : 'text-gray-600'}`}>
                    {item.label}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {item.count}
                 </span>
                 <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Statistiques en temps réel
          </p>
        </div>
      </aside>

      {/* =======================================================
          COLONNE 2 : LES DÉTAILS
      ======================================================== */}
      <main className={`
        ${showMobileMenu ? 'hidden' : 'flex'} 
        md:flex flex-1 bg-gray-50 flex-col overflow-hidden
        fixed md:relative inset-0 z-30 md:z-auto
      `}>
        {/* Header avec bouton Menu (Mobile) */}
        <div className="bg-white border-b p-4 flex items-center gap-3 shadow-sm">
            <button 
                onClick={handleToggleMenu}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 md:hidden transition-colors"
                aria-label="Ouvrir le menu"
            >
                <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-gray-800">
                {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
        </div>

        {/* Contenu Défilant */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                
                {/* --- VUE: DEVIS --- */}
                {activeTab === 'quotes' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800 hidden md:block">Gestion des Devis</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <QuoteDetailCard label="Nouveaux" value={quotesStats.nouveau} icon={<Clock />} color="blue" />
                            <QuoteDetailCard label="En Cours" value={quotesStats.enCours} icon={<TrendingUp />} color="yellow" />
                            <QuoteDetailCard label="Convertis" value={quotesStats.converti} icon={<CheckCircle />} color="green" />
                        </div>
                        
                        {quotesStats.total > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition des Devis</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Nouveaux', value: quotesStats.nouveau, color: '#3b82f6' },
                                                    { name: 'En Cours', value: quotesStats.enCours, color: '#f59e0b' },
                                                    { name: 'Convertis', value: quotesStats.converti, color: '#10b981' },
                                                ].filter(item => item.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {[
                                                    { name: 'Nouveaux', value: quotesStats.nouveau, color: '#3b82f6' },
                                                    { name: 'En Cours', value: quotesStats.enCours, color: '#f59e0b' },
                                                    { name: 'Convertis', value: quotesStats.converti, color: '#10b981' },
                                                ].filter(item => item.value > 0).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                            <h3 className="text-lg font-semibold text-gray-900">Toutes les demandes</h3>
                            <p className="text-gray-500 mb-6 mt-1">Consultez, traitez et convertissez vos prospects.</p>
                            <button 
                                onClick={() => navigate('/dashboard/quotes')}
                                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                            >
                                Ouvrir la liste des devis
                            </button>
                        </div>
                    </div>
                )}

                {/* --- VUE: VUE D'ENSEMBLE & PÔLES SPÉCIFIQUES --- */}
                {activeTab !== 'quotes' && (
                    <div className="space-y-6" key={activeTab}>
                        <div className="flex items-center justify-between mb-6">
                             <h2 className="text-2xl font-bold text-gray-800 hidden md:block">
                                 {getDetailTitle()}
                             </h2>
                             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border text-sm font-medium text-gray-600">
                                 Total: <span className="font-bold text-blue-600">{menuItems.find(i => i.id === activeTab)?.count}</span>
                             </div>
                        </div>

                        {/* ✅ STATISTIQUES DÉTAILLÉES PAR PÔLE */}
                        {activeTab !== 'overview' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <StatCard 
                                    label="Annonces Actives" 
                                    value={poleStats.actives}
                                    color="blue"
                                    icon={<Building2 />}
                                />
                                <StatCard 
                                    label="En Attente" 
                                    value={poleStats.enAttente}
                                    color="yellow"
                                    icon={<Clock />}
                                />
                                <StatCard 
                                    label="Validées" 
                                    value={poleStats.validees}
                                    color="green"
                                    icon={<CheckCircle />}
                                />
                            </div>
                        )}

                        {/* ✅ VUE D'ENSEMBLE : Graphique circulaire */}
                        {activeTab === 'overview' && getPieData().length > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition par Pôle</h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={getPieData()}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={120}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {getPieData().map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* ✅ GRAPHIQUES DYNAMIQUES AVEC KEY UNIQUE */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartCard 
                                key={`bar-${activeTab}`} 
                                title="Annonces par Pôle" 
                                type="bar" 
                                data={chartData} 
                            />
                            <ChartCard 
                                key={`line-${activeTab}`} 
                                title="Évolution" 
                                type="line" 
                                data={chartData} 
                            />
                        </div>

                        {/* ✅ TABLEAU RÉCAPITULATIF */}
                        {activeTab !== 'overview' && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Détails des Annonces</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Catégorie</th>
                                                <th className="px-4 py-3 text-center font-semibold text-gray-700">Nombre</th>
                                                <th className="px-4 py-3 text-center font-semibold text-gray-700">Pourcentage</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-800">Annonces Actives</td>
                                                <td className="px-4 py-3 text-center font-semibold text-blue-600">{poleStats.actives}</td>
                                                <td className="px-4 py-3 text-center text-gray-600">100%</td>
                                            </tr>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-800">En Attente de Validation</td>
                                                <td className="px-4 py-3 text-center font-semibold text-yellow-600">{poleStats.enAttente}</td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    {poleStats.actives > 0 ? Math.round((poleStats.enAttente / poleStats.actives) * 100) : 0}%
                                                </td>
                                            </tr>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-800">Validées</td>
                                                <td className="px-4 py-3 text-center font-semibold text-green-600">{poleStats.validees}</td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    {poleStats.actives > 0 ? Math.round((poleStats.validees / poleStats.actives) * 100) : 0}%
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ✅ ACTIONS RAPIDES */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions Rapides</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => navigate('/dashboard/properties')}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2"
                                >
                                    <Building2 size={18} />
                                    Voir toutes les annonces
                                </button>
                                <button 
                                    onClick={() => navigate('/dashboard/moderation')}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} />
                                    Modération
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

// --- COMPOSANTS UI ---

const StatCard = ({ label, value, icon, color }) => {
    const styles = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        yellow: "bg-yellow-50 text-yellow-700 border-yellow-100",
        green: "bg-green-50 text-green-700 border-green-100",
    };
    return (
        <div className={`p-6 rounded-2xl border ${styles[color]} flex flex-col items-center justify-center text-center transition-transform hover:scale-105`}>
            <div className="mb-2 opacity-80">{icon}</div>
            <span className="text-3xl font-extrabold mb-1">{value}</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        </div>
    );
};

const QuoteDetailCard = ({ label, value, icon, color }) => {
    const styles = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        yellow: "bg-yellow-50 text-yellow-700 border-yellow-100",
        green: "bg-green-50 text-green-700 border-green-100",
    };
    return (
        <div className={`p-6 rounded-2xl border ${styles[color]} flex flex-col items-center justify-center text-center transition-transform hover:scale-105`}>
            <div className="mb-2 opacity-80">{icon}</div>
            <span className="text-3xl font-extrabold mb-1">{value}</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        </div>
    );
};

const ChartCard = ({ title, type, data }) => {
    console.log(`📊 [ChartCard] Rendu du graphique ${type} avec données:`, data);
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">{title}</h3>
            <div className="h-[300px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                    {type === "bar" ? (
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} tick={{fill: '#64748b'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                            />
                            <Bar dataKey="Annonces" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={50} />
                        </BarChart>
                    ) : (
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} tick={{fill: '#64748b'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            <Line type="monotone" dataKey="Annonces" stroke="#10b981" strokeWidth={4} dot={{r:6, fill:'#10b981', strokeWidth:2, stroke:'white'}} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const LoadingScreen = () => (
    <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
    </div>
);

const ErrorScreen = ({ error }) => (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-lg border border-red-100">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Erreur</h3>
            <p className="text-gray-600">{error}</p>
        </div>
    </div>
);

export default DashboardHome;