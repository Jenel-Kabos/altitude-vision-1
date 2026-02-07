// src/pages/dashboard/DashboardHome.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Building2, Calendar, Megaphone, Users, Loader2, AlertCircle, FileText, Clock, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getDashboardStats } from "../../services/dashboardService";
import { getAllQuotes } from "../../services/quoteService";

const DashboardHome = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ Altimmo: 0, MilaEvents: 0, Altcom: 0 });
  const [quotesStats, setQuotesStats] = useState({ total: 0, nouveau: 0, enCours: 0, converti: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Charger les stats du dashboard
        const data = await getDashboardStats();
        setStats(data);

        // Charger les stats des devis
        const quotes = await getAllQuotes();
        const quotesStatsData = {
          total: quotes.length,
          nouveau: quotes.filter(q => q.status === 'Nouveau').length,
          enCours: quotes.filter(q => q.status === 'En cours').length,
          converti: quotes.filter(q => q.status === 'Converti').length,
        };
        setQuotesStats(quotesStatsData);
      } catch (err) {
        console.error("❌ Erreur lors du chargement des stats :", err);

        if (err.response?.status === 401) {
          setError("Session expirée. Redirection...");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setTimeout(() => navigate("/login", { replace: true }), 1500);
        } else {
          setError(err.response?.data?.message || "Erreur lors du chargement des statistiques.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-6">
          <Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600 text-lg animate-pulse">
            {authLoading ? "Vérification de la session..." : "Chargement des statistiques..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-md max-w-md w-full">
          <div className="flex items-center mb-2">
            <AlertCircle className="text-red-500 w-6 h-6 mr-3" />
            <h3 className="text-lg font-semibold text-red-800">Erreur</h3>
          </div>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const total = stats.Altimmo + stats.MilaEvents + stats.Altcom;
  const chartData = [
    { name: "Altimmo", Annonces: stats.Altimmo },
    { name: "MilaEvents", Annonces: stats.MilaEvents },
    { name: "Altcom", Annonces: stats.Altcom },
  ];

  return (
    // PADDING RESPONSIVE : p-4 sur mobile, p-6 sur desktop
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      
      {/* HEADER : Taille de texte adaptative */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Tableau de Bord
        </h1>
        <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
          Bienvenue, <span className="font-semibold">{user?.name || "Utilisateur"}</span> !
        </p>
      </div>

      {/* GRID : 1 col mobile, 2 cols tablette (sm), 4 cols desktop (lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <StatCard 
          title="Altimmo" 
          icon={<Building2 className="text-blue-500 w-6 h-6 md:w-8 md:h-8" />} 
          value={stats.Altimmo} 
          subtitle="Biens immobiliers" 
        />
        <StatCard 
          title="MilaEvents" 
          icon={<Calendar className="text-pink-500 w-6 h-6 md:w-8 md:h-8" />} 
          value={stats.MilaEvents} 
          subtitle="Événements" 
        />
        <StatCard 
          title="Altcom" 
          icon={<Megaphone className="text-green-500 w-6 h-6 md:w-8 md:h-8" />} 
          value={stats.Altcom} 
          subtitle="Campagnes" 
        />
        <StatCard 
          title="Devis" 
          icon={<FileText className="text-purple-500 w-6 h-6 md:w-8 md:h-8" />} 
          value={quotesStats.total} 
          subtitle="Demandes totales"
          clickable
          onClick={() => navigate('/dashboard/quotes')}
        />
      </div>

      {/* SECTION DEVIS */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-gray-700">Gestion des Devis</h2>
          {/* BOUTON : Pleine largeur sur mobile pour faciliter le clic */}
          <button
            onClick={() => navigate('/dashboard/quotes')}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition font-semibold text-sm md:text-base text-center"
          >
            Voir tous les devis
          </button>
        </div>
        
        {/* GRID STATS DEVIS : 1 col mobile, 3 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <QuoteStatCard
            icon={<Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />}
            label="Nouveaux"
            value={quotesStats.nouveau}
            color="bg-blue-50"
            textColor="text-blue-700"
          />
          <QuoteStatCard
            icon={<Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />}
            label="En cours"
            value={quotesStats.enCours}
            color="bg-yellow-50"
            textColor="text-yellow-700"
          />
          <QuoteStatCard
            icon={<CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500" />}
            label="Convertis"
            value={quotesStats.converti}
            color="bg-green-50"
            textColor="text-green-700"
          />
        </div>
      </div>

      {/* ACTIVITÉ GLOBALE */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Activité Globale</h2>
          <Users className="text-purple-500 w-6 h-6" />
        </div>
        <p className="text-3xl md:text-4xl font-bold mt-2 md:mt-4 text-gray-800">{total}</p>
        <p className="text-xs md:text-sm text-gray-500">Publications totales</p>
      </div>

      {/* GRAPHIQUES : 1 col sur mobile/tablette, 2 cols sur grand écran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <ChartCard title="Répartition par Pôle" type="bar" data={chartData} />
        <ChartCard title="Tendance Mensuelle" type="line" data={chartData} />
      </div>
    </div>
  );
};

// --- Sous-composants optimisés ---

const StatCard = ({ title, icon, value, subtitle, clickable, onClick }) => (
  <div 
    className={`
      bg-white p-5 rounded-2xl shadow transition-all duration-200
      ${clickable ? 'cursor-pointer hover:shadow-lg active:scale-95 md:hover:scale-105' : ''}
    `}
    onClick={clickable ? onClick : undefined}
  >
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base md:text-lg font-semibold text-gray-700 truncate">{title}</h2>
      {icon}
    </div>
    <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
    <p className="text-xs md:text-sm text-gray-500 mt-1">{subtitle}</p>
  </div>
);

const QuoteStatCard = ({ icon, label, value, color, textColor }) => (
  <div className={`${color} p-4 rounded-xl flex items-center justify-between sm:block`}>
    <div className="flex items-center gap-3 sm:mb-2">
      {icon}
      <span className={`text-sm md:text-base font-medium ${textColor}`}>{label}</span>
    </div>
    <p className={`text-2xl md:text-3xl font-bold ${textColor}`}>{value}</p>
  </div>
);

const ChartCard = ({ title, type, data }) => (
  <div className="bg-white p-4 md:p-6 rounded-2xl shadow overflow-hidden">
    <h2 className="text-base md:text-lg font-semibold mb-4 text-gray-700">{title}</h2>
    <div className="w-full h-[250px] text-xs">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
            <Tooltip 
              cursor={{fill: '#f3f4f6'}}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
            />
            <Bar dataKey="Annonces" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
            <Tooltip 
               contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Line type="monotone" dataKey="Annonces" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

export default DashboardHome;