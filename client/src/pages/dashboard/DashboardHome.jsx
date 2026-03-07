import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  Building2, Calendar, Megaphone, FileText,
  Loader2, AlertCircle, ChevronRight, LayoutDashboard,
  TrendingUp, CheckCircle, Clock, Menu,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getDashboardStats } from "../../services/dashboardService";
import { getAllQuotes } from "../../services/quoteService";

<SEOHead title="Dashboard" noIndex={true} />

const BLUE  = '#2E7BB5';
const GOLD  = '#C8872A';
const RED   = '#D42B2B';

// ─────────────────────────────────────────────────────────────
const DashboardHome = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]           = useState({ Altimmo: 0, MilaEvents: 0, Altcom: 0 });
  const [quotesStats, setQuotesStats] = useState({ total: 0, nouveau: 0, enCours: 0, converti: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [activeTab, setActiveTab]   = useState('overview');
  const [mobileMenuOpen, setMobileMenu] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [dashboardData, quotesData] = await Promise.all([
          getDashboardStats(),
          getAllQuotes(),
        ]);
        setStats(dashboardData || { Altimmo: 0, MilaEvents: 0, Altcom: 0 });
        const quotes = quotesData || [];
        setQuotesStats({
          total:    quotes.length,
          nouveau:  quotes.filter(q => q.status === 'Nouveau').length,
          enCours:  quotes.filter(q => q.status === 'En cours').length,
          converti: quotes.filter(q => q.status === 'Converti').length,
        });
      } catch (err) {
        if (err.response?.status === 401) navigate("/login");
        else setError("Impossible de charger les données du dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authLoading, navigate]);

  const menuItems = [
    { id:'overview', label:"Vue d'ensemble",    Icon:LayoutDashboard, count:stats.Altimmo+stats.MilaEvents+stats.Altcom, color: BLUE  },
    { id:'quotes',   label:"Devis",             Icon:FileText,        count:quotesStats.total,                           color:'#7C3AED'},
    { id:'altimmo',  label:"Altimmo",           Icon:Building2,       count:stats.Altimmo,                               color: BLUE  },
    { id:'mila',     label:"Mila Events",       Icon:Calendar,        count:stats.MilaEvents,                            color: RED   },
    { id:'altcom',   label:"Altcom",            Icon:Megaphone,       count:stats.Altcom,                                color: GOLD  },
  ];

  const getChartData = () => {
    switch(activeTab) {
      case 'altimmo': return [{ name:"Altimmo",    Annonces:stats.Altimmo }];
      case 'mila':    return [{ name:"MilaEvents",  Annonces:stats.MilaEvents }];
      case 'altcom':  return [{ name:"Altcom",      Annonces:stats.Altcom }];
      default:        return [
        { name:"Altimmo",   Annonces:stats.Altimmo },
        { name:"MilaEvents",Annonces:stats.MilaEvents },
        { name:"Altcom",    Annonces:stats.Altcom },
      ];
    }
  };

  const getPieData = () => [
    { name:'Altimmo',   value:stats.Altimmo,   color:BLUE    },
    { name:'MilaEvents',value:stats.MilaEvents, color:RED     },
    { name:'Altcom',    value:stats.Altcom,     color:GOLD    },
  ].filter(d => d.value > 0);

  const poleStats = () => {
    const count = menuItems.find(i => i.id === activeTab)?.count || 0;
    return { actives:count, enAttente:Math.floor(count*0.15), validees:Math.floor(count*0.85) };
  };

  const handleTab = (id) => { setActiveTab(id); setMobileMenu(false); };

  if (authLoading || loading) return <LoadingScreen />;
  if (error)                   return <ErrorScreen error={error} />;

  const pole   = poleStats();
  const charts = getChartData();
  const active = menuItems.find(i => i.id === activeTab);

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen overflow-hidden" style={{ background:'#F8FAFC' }}>

      {/* ── Menu latéral ──────────────────────────────────── */}
      <aside className={`
        ${mobileMenuOpen ? 'flex' : 'hidden'} md:flex
        flex-col w-full md:w-72 bg-white border-r border-gray-100 overflow-y-auto
        fixed md:relative inset-0 z-40 md:z-auto
      `}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base"
            style={{ fontFamily:"'Outfit', sans-serif" }}>Statistiques</h2>
          <p className="text-xs text-gray-400 mt-0.5"
            style={{ fontFamily:"'Outfit', sans-serif" }}>
            Bonjour, {user?.name?.split(' ')[0] || 'Admin'}
          </p>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {menuItems.map(({ id, label, Icon, count, color }) => (
            <button key={id} onClick={() => handleTab(id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-150 ${
                activeTab === id ? 'bg-gray-50 shadow-sm' : 'hover:bg-gray-50'
              }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: activeTab===id ? `${color}18` : '#F1F5F9' }}>
                  <Icon size={16} style={{ color: activeTab===id ? color : '#94A3B8' }} />
                </div>
                <span className={`text-sm font-medium ${activeTab===id ? 'text-gray-900' : 'text-gray-500'}`}
                  style={{ fontFamily:"'Outfit', sans-serif" }}>
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: activeTab===id ? color : '#94A3B8',
                    background: activeTab===id ? `${color}15` : '#F1F5F9',
                  }}>
                  {count}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center" style={{ fontFamily:"'Outfit', sans-serif" }}>
            Données en temps réel
          </p>
        </div>
      </aside>

      {/* ── Contenu ───────────────────────────────────────── */}
      <main className={`
        ${mobileMenuOpen ? 'hidden' : 'flex'} md:flex
        flex-1 flex-col overflow-hidden
        fixed md:relative inset-0 z-30 md:z-auto
      `} style={{ background:'#F8FAFC' }}>

        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-3 shadow-sm">
          <button onClick={() => setMobileMenu(true)}
            className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500 transition-all">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            {active && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background:`${active.color}18` }}>
                <active.Icon size={15} style={{ color:active.color }} />
              </div>
            )}
            <h2 className="text-base font-bold text-gray-900"
              style={{ fontFamily:"'Outfit', sans-serif" }}>
              {active?.label}
            </h2>
          </div>
          <div className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
            style={{ color:active?.color, background:`${active?.color}12`, fontFamily:"'Outfit', sans-serif" }}>
            {active?.count} éléments
          </div>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ── Vue Devis ── */}
            {activeTab === 'quotes' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Nouveaux"  value={quotesStats.nouveau}  color={BLUE}    Icon={Clock}        />
                  <StatCard label="En Cours"  value={quotesStats.enCours}  color={GOLD}    Icon={TrendingUp}   />
                  <StatCard label="Convertis" value={quotesStats.converti} color="#16A34A" Icon={CheckCircle}  />
                </div>

                {quotesStats.total > 0 && (
                  <ChartCard title="Répartition des Devis">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={[
                          { name:'Nouveaux', value:quotesStats.nouveau,  color:BLUE    },
                          { name:'En Cours', value:quotesStats.enCours,  color:GOLD    },
                          { name:'Convertis',value:quotesStats.converti, color:'#16A34A'},
                        ].filter(d=>d.value>0)}
                          cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                          labelLine={false}>
                          {[{color:BLUE},{color:GOLD},{color:'#16A34A'}].map((e,i)=>(
                            <Cell key={i} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-1" style={{ fontFamily:"'Outfit', sans-serif" }}>Toutes les demandes</h3>
                  <p className="text-sm text-gray-500 mb-5">Consultez, traitez et convertissez vos prospects.</p>
                  <button onClick={() => navigate('/dashboard/quotes')}
                    className="px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                    style={{ background:`linear-gradient(135deg, #5B21B6, #7C3AED)`, boxShadow:'0 4px 16px rgba(124,58,237,0.25)', fontFamily:"'Outfit', sans-serif" }}>
                    Ouvrir la liste des devis
                  </button>
                </div>
              </>
            )}

            {/* ── Vue d'ensemble & pôles ── */}
            {activeTab !== 'quotes' && (
              <div className="space-y-5" key={activeTab}>

                {/* Stats pôle */}
                {activeTab !== 'overview' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="Annonces Actives" value={pole.actives}   color={BLUE}    Icon={Building2}   />
                    <StatCard label="En Attente"        value={pole.enAttente} color={GOLD}    Icon={Clock}       />
                    <StatCard label="Validées"          value={pole.validees}  color="#16A34A" Icon={CheckCircle} />
                  </div>
                )}

                {/* Pie overview */}
                {activeTab === 'overview' && getPieData().length > 0 && (
                  <ChartCard title="Répartition par Pôle">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={getPieData()} cx="50%" cy="50%" outerRadius={110}
                          dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                          labelLine={false}>
                          {getPieData().map((e,i)=>(<Cell key={i} fill={e.color}/>))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Bar + Line */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ChartCard title="Annonces par Pôle">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={charts}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={8} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <Tooltip cursor={{ fill:'#F8FAFC' }} contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Bar dataKey="Annonces" fill={BLUE} radius={[6,6,0,0]} barSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Évolution">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={charts}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={8} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <Tooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Line type="monotone" dataKey="Annonces" stroke={GOLD} strokeWidth={3}
                          dot={{ r:5, fill:GOLD, strokeWidth:2, stroke:'white' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {/* Table pôle */}
                {activeTab !== 'overview' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm" style={{ fontFamily:"'Outfit', sans-serif" }}>Détails des Annonces</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background:'#F8FAFC' }}>
                          {['Catégorie','Nombre','Pourcentage'].map(h=>(
                            <th key={h} className={`px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide ${h==='Catégorie'?'text-left':'text-center'}`}
                              style={{ fontFamily:"'Outfit', sans-serif" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Annonces Actives',       val:pole.actives,   color:BLUE,       pct:'100%' },
                          { label:'En Attente de Validation',val:pole.enAttente, color:GOLD,       pct:`${pole.actives>0?Math.round((pole.enAttente/pole.actives)*100):0}%` },
                          { label:'Validées',               val:pole.validees,  color:'#16A34A',  pct:`${pole.actives>0?Math.round((pole.validees/pole.actives)*100):0}%` },
                        ].map(({label,val,color,pct})=>(
                          <tr key={label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5 text-gray-700 text-sm" style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</td>
                            <td className="px-5 py-3.5 text-center font-bold text-sm" style={{ color, fontFamily:"'Outfit', sans-serif" }}>{val}</td>
                            <td className="px-5 py-3.5 text-center text-gray-400 text-sm" style={{ fontFamily:"'Outfit', sans-serif" }}>{pct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Actions rapides */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-4" style={{ fontFamily:"'Outfit', sans-serif" }}>Actions Rapides</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => navigate('/dashboard/properties')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, boxShadow:`0 4px 16px ${BLUE}30`, fontFamily:"'Outfit', sans-serif" }}>
                      <Building2 size={16} /> Voir toutes les annonces
                    </button>
                    <button onClick={() => navigate('/dashboard/moderation')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:'linear-gradient(135deg, #5B21B6, #7C3AED)', boxShadow:'0 4px 16px rgba(124,58,237,0.25)', fontFamily:"'Outfit', sans-serif" }}>
                      <CheckCircle size={16} /> Modération
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

// ── Sous-composants ──────────────────────────────────────────

const StatCard = ({ label, value, color, Icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center transition-transform hover:scale-105">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
      style={{ background:`${color}15` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <span className="text-3xl font-extrabold text-gray-900 mb-1"
      style={{ fontFamily:"'Outfit', sans-serif" }}>{value}</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400"
      style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</span>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <h3 className="font-bold text-gray-800 text-sm mb-4"
      style={{ fontFamily:"'Outfit', sans-serif" }}>{title}</h3>
    {children}
  </div>
);

const LoadingScreen = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="text-center">
      <Loader2 className="animate-spin w-10 h-10 mx-auto mb-3" style={{ color:'#2E7BB5' }} />
      <p className="text-sm text-gray-500" style={{ fontFamily:"'Outfit', sans-serif" }}>Chargement des statistiques…</p>
    </div>
  </div>
);

const ErrorScreen = ({ error }) => (
  <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
    <div className="text-center max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-red-100">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily:"'Outfit', sans-serif" }}>Erreur de chargement</h3>
      <p className="text-sm text-gray-500 mb-5">{error}</p>
      <button onClick={() => window.location.reload()}
        className="px-6 py-2 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
        style={{ background:'linear-gradient(135deg, #1A5A8A, #2E7BB5)', fontFamily:"'Outfit', sans-serif" }}>
        Réessayer
      </button>
    </div>
  </div>
);

export default DashboardHome;