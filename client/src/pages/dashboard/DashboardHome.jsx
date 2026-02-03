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
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {authLoading ? "Vérification de la session..." : "Chargement des statistiques..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-md max-w-md">
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Tableau de Bord – Altitude-Vision
        </h1>
        <p className="text-gray-600 mt-2">
          Bienvenue, <span className="font-semibold">{user?.name || "Utilisateur"}</span> !
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Altimmo" 
          icon={<Building2 className="text-blue-500" />} 
          value={stats.Altimmo} 
          subtitle="Biens immobiliers" 
        />
        <StatCard 
          title="MilaEvents" 
          icon={<Calendar className="text-pink-500" />} 
          value={stats.MilaEvents} 
          subtitle="Événements" 
        />
        <StatCard 
          title="Altcom" 
          icon={<Megaphone className="text-green-500" />} 
          value={stats.Altcom} 
          subtitle="Campagnes" 
        />
        <StatCard 
          title="Devis" 
          icon={<FileText className="text-purple-500" />} 
          value={quotesStats.total} 
          subtitle="Demandes totales"
          clickable
          onClick={() => navigate('/dashboard/quotes')}
        />
      </div>

      {/* Section Devis détaillée */}
      <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Gestion des Devis</h2>
          <button
            onClick={() => navigate('/dashboard/quotes')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Voir tous les devis
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuoteStatCard
            icon={<Clock className="w-6 h-6 text-blue-500" />}
            label="Nouveaux"
            value={quotesStats.nouveau}
            color="bg-blue-50"
            textColor="text-blue-700"
          />
          <QuoteStatCard
            icon={<Clock className="w-6 h-6 text-yellow-500" />}
            label="En cours"
            value={quotesStats.enCours}
            color="bg-yellow-50"
            textColor="text-yellow-700"
          />
          <QuoteStatCard
            icon={<CheckCircle className="w-6 h-6 text-green-500" />}
            label="Convertis"
            value={quotesStats.converti}
            color="bg-green-50"
            textColor="text-green-700"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Activité Globale</h2>
          <Users className="text-purple-500" />
        </div>
        <p className="text-4xl font-bold mt-4 text-gray-800">{total}</p>
        <p className="text-sm text-gray-500">Publications totales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard title="Répartition par Pôle" type="bar" data={chartData} />
        <ChartCard title="Tendance Mensuelle" type="line" data={chartData} />
      </div>
    </div>
  );
};

// --- Sous-composants ---
const StatCard = ({ title, icon, value, subtitle, clickable, onClick }) => (
  <div 
    className={`bg-white p-6 rounded-2xl shadow hover:shadow-md transition ${clickable ? 'cursor-pointer hover:scale-105' : ''}`}
    onClick={clickable ? onClick : undefined}
  >
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
      {icon}
    </div>
    <p className="text-3xl font-bold mt-4">{value}</p>
    <p className="text-sm text-gray-500">{subtitle}</p>
  </div>
);

const QuoteStatCard = ({ icon, label, value, color, textColor }) => (
  <div className={`${color} p-4 rounded-xl`}>
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <span className={`text-sm font-medium ${textColor}`}>{label}</span>
    </div>
    <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
  </div>
);

const ChartCard = ({ title, type, data }) => (
  <div className="bg-white p-6 rounded-2xl shadow">
    <h2 className="text-lg font-semibold mb-4">{title}</h2>
    <ResponsiveContainer width="100%" height={250}>
      {type === "bar" ? (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="Annonces" fill="#3b82f6" radius={[8, 8, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="Annonces" stroke="#10b981" strokeWidth={3} />
        </LineChart>
      )}
    </ResponsiveContainer>
  </div>
);

export default DashboardHome;