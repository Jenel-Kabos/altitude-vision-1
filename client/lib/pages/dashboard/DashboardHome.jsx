"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  Building2, Calendar, Megaphone, FileText,
  Loader2, AlertCircle, ChevronRight, LayoutDashboard,
  TrendingUp, CheckCircle, Clock, Menu, Star, Briefcase,
  Activity, Home, Zap, Eye,
} from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { getDashboardStats } from "../../services/dashboardService";
import { getAllQuotes } from "../../services/quoteService";
import { getAllEvents } from "../../services/eventService";
import { getAlertesPaiements } from "../../services/gestionLocativeService";
import { getAllUsers } from "../../services/userService";

const BLUE  = '#2E7BB5';
const GOLD  = '#C8872A';
const RED   = '#D42B2B';
const GREEN = '#16A34A';
const FONT  = "'Outfit', sans-serif";

// ── Helpers ──────────────────────────────────────────────────

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
};

const statusColor = (s) => {
  if (!s) return '#94A3B8';
  const map = {
    'Validée': GREEN, 'Validé': GREEN, 'Publié': GREEN, 'Terminé': GREEN,
    'En attente': GOLD, 'Brouillon': GOLD, 'En cours': BLUE, 'Accepté': BLUE,
    'Rejetée': RED, 'Refusé': RED, 'Archivé': '#94A3B8',
  };
  return map[s] || '#94A3B8';
};

// ─────────────────────────────────────────────────────────────
const DashboardHome = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats]           = useState({ Altimmo: 0, MilaEvents: 0, Altcom: 0 });
  const [kpis, setKpis]             = useState(null);
  const [activity, setActivity]     = useState(null);
  const [perf, setPerf]             = useState(null);
  const [quotesStats, setQuotesStats] = useState({ total: 0, nouveau: 0, enCours: 0, converti: 0 });
  const [quotesRaw, setQuotesRaw]       = useState([]);
  const [milaCount, setMilaCount]       = useState(0);
  const [contratsActifs, setContrats]   = useState(0);
  const [alertesGL, setAlertesGL]       = useState({ nbImpayes:0, nbPenalites:0, totalPenalites:0, bailsExpiration:0 });
  const [teamStats, setTeamStats]       = useState({ admins:0, collaborateurs:0, utilisateurs:0 });
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
        const [dashboardData, quotesData, eventsData, alertesData, usersData] = await Promise.all([
          getDashboardStats(),
          getAllQuotes(),
          getAllEvents(),
          getAlertesPaiements().catch(() => null),
          getAllUsers().catch(() => []),
        ]);
        const dsStats = dashboardData.stats || { Altimmo: 0, MilaEvents: 0, Altcom: 0 };
        const events  = Array.isArray(eventsData) ? eventsData : [];
        setStats(dsStats);
        setMilaCount(events.length > 0 ? events.length : (dsStats.MilaEvents || 0));
        setKpis(dashboardData.kpis   || null);
        setContrats(dashboardData.contratsActifs || 0);
        if (alertesData) setAlertesGL(alertesData);
        if (Array.isArray(usersData) && usersData.length > 0) {
          setTeamStats({
            admins:        usersData.filter(u => u.role === 'Admin').length,
            collaborateurs: usersData.filter(u => u.role === 'Collaborateur').length,
            utilisateurs:  usersData.filter(u => !['Admin','Collaborateur'].includes(u.role)).length,
          });
        }
        setActivity(dashboardData.activity  || null);
        setPerf(dashboardData.performance   || null);
        const quotes = quotesData || [];
        setQuotesRaw(quotes);
        setQuotesStats({
          total:    quotes.length,
          nouveau:  quotes.filter(q => q.status === 'Nouveau').length,
          enCours:  quotes.filter(q => q.status === 'En cours').length,
          converti: quotes.filter(q => q.status === 'Converti').length,
        });
      } catch (err) {
        if (err.response?.status === 401) router.push("/login");
        else setError("Impossible de charger les données du dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authLoading, router]);

  const menuItems = [
    { id:'overview', label:"Vue d'ensemble",    Icon:LayoutDashboard, count:stats.Altimmo+milaCount+stats.Altcom+quotesStats.total, color: BLUE  },
    { id:'quotes',   label:"Devis",             Icon:FileText,        count:quotesStats.total,                           color:'#7C3AED'},
    { id:'altimmo',  label:"Altimmo",           Icon:Building2,       count:stats.Altimmo,                               color: BLUE  },
    { id:'mila',     label:"Mila Events",       Icon:Calendar,        count:milaCount,                                   color: RED   },
    { id:'altcom',   label:"Altcom",            Icon:Megaphone,       count:stats.Altcom,                                color: GOLD  },
  ];

  const getChartData = () => {
    if (activeTab === 'altimmo') return [{ name:"Altimmo", Annonces:stats.Altimmo }];
    if (activeTab === 'mila')    return [{ name:"MilaEvents", Annonces:stats.MilaEvents }];
    if (activeTab === 'altcom')  return [{ name:"Altcom", Annonces:stats.Altcom }];
    return [
      { name:"Altimmo",    Annonces:stats.Altimmo },
      { name:"MilaEvents", Annonces:stats.MilaEvents },
      { name:"Altcom",     Annonces:stats.Altcom },
    ];
  };

  const getPieData = () => [
    { name:'Altimmo',    value:stats.Altimmo,    color:BLUE },
    { name:'MilaEvents', value:stats.MilaEvents, color:RED  },
    { name:'Altcom',     value:stats.Altcom,     color:GOLD },
  ].filter(d => d.value > 0);

  const handleTab = (id) => { setActiveTab(id); setMobileMenu(false); };

  if (authLoading || loading) return <LoadingScreen />;
  if (error)                   return <ErrorScreen error={error} />;

  const active = menuItems.find(i => i.id === activeTab);

  // Fusion des activités récentes — 3 pôles + devis
  const recentItems = (() => {
    const items = [];
    if (activity) {
      (activity.properties || []).forEach(p => items.push({
        id: p._id, type: 'altimmo', icon: Home,
        label: p.title || 'Bien immobilier', status: p.statusAdmin || p.status,
        date: p.createdAt, color: BLUE,
      }));
      (activity.events || []).forEach(e => items.push({
        id: e._id, type: 'mila', icon: Calendar,
        label: e.name || 'Événement', status: e.status,
        date: e.createdAt, color: RED,
      }));
      (activity.projects || []).forEach(p => items.push({
        id: p._id, type: 'altcom', icon: Briefcase,
        label: p.projectName || p.companyName || 'Projet', status: p.status,
        date: p.createdAt, color: GOLD,
      }));
    }
    quotesRaw.slice(0, 5).forEach(q => items.push({
      id: q._id, type: 'quote', icon: FileText,
      label: `Devis — ${q.name || q.eventType || 'Nouveau devis'}`, status: q.status,
      date: q.createdAt, color: '#7C3AED',
    }));
    return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  })();

  return (
    <>
      {user?.role === 'Collaborateur' && (
        <div className="flex items-center gap-3 px-6 py-2.5 text-sm" style={{ background:'#EFF6FF', borderBottom:'1px solid #BFDBFE', fontFamily:FONT }}>
          <span>👤</span>
          <p className="text-blue-700">Vous êtes connecté en tant que <strong>Collaborateur</strong> — Vous pouvez ajouter du contenu mais pas le modifier ou le supprimer.</p>
        </div>
      )}
    <div className="flex h-[calc(100vh-64px)] md:h-screen overflow-hidden" style={{ background:'#F8FAFC' }}>

      {/* ── Menu latéral ──────────────────────────────────── */}
      <aside className={`
        ${mobileMenuOpen ? 'flex' : 'hidden'} md:flex
        flex-col w-full md:w-72 bg-white border-r border-gray-100 overflow-y-auto
        fixed md:relative inset-0 z-40 md:z-auto
      `}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base" style={{ fontFamily:FONT }}>Statistiques</h2>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily:FONT }}>
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
                  style={{ fontFamily:FONT }}>{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color: activeTab===id ? color : '#94A3B8', background: activeTab===id ? `${color}15` : '#F1F5F9' }}>
                  {count}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </button>
          ))}
        </nav>

        {/* Score global dans le sidebar */}
        {perf && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500" style={{ fontFamily:FONT }}>Score global</span>
              <span className="text-sm font-extrabold" style={{ color: perf.globalScore >= 70 ? GREEN : perf.globalScore >= 40 ? GOLD : RED, fontFamily:FONT }}>
                {perf.globalScore}/100
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${perf.globalScore}%`, background: perf.globalScore >= 70 ? GREEN : perf.globalScore >= 40 ? GOLD : RED }} />
            </div>
          </div>
        )}
      </aside>

      {/* ── Contenu principal ─────────────────────────────── */}
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
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily:FONT }}>{active?.label}</h2>
          </div>
          <div className="ml-auto text-xs font-semibold px-3 py-1 rounded-full"
            style={{ color:active?.color, background:`${active?.color}12`, fontFamily:FONT }}>
            {active?.count} éléments
          </div>
        </div>

        {/* Zone scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ══════════════════════════════════════════════ */}
            {/* Vue Devis                                      */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'quotes' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Nouveaux"  value={quotesStats.nouveau}  color={BLUE}    Icon={Clock}       />
                  <StatCard label="En Cours"  value={quotesStats.enCours}  color={GOLD}    Icon={TrendingUp}  />
                  <StatCard label="Convertis" value={quotesStats.converti} color={GREEN}   Icon={CheckCircle} />
                </div>
                {quotesStats.total > 0 && (
                  <ChartCard title="Répartition des Devis">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={[
                          { name:'Nouveaux', value:quotesStats.nouveau, color:BLUE },
                          { name:'En Cours', value:quotesStats.enCours, color:GOLD },
                          { name:'Convertis',value:quotesStats.converti,color:GREEN},
                        ].filter(d=>d.value>0)}
                          cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {[{color:BLUE},{color:GOLD},{color:GREEN}].map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius:'12px',border:'none',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
                <ActionCard label="Toutes les demandes" description="Consultez, traitez et convertissez vos prospects."
                  btnLabel="Ouvrir la liste des devis" color="#7C3AED"
                  onClick={() => router.push('/dashboard/quotes')} />
              </>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* Vue d'ensemble — overview                      */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-5">

                {/* Résumé global — 4 chiffres clés */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Biens Altimmo"  value={stats.Altimmo}      color={BLUE}     Icon={Building2}  />
                  <StatCard label="Événements"     value={milaCount}          color={RED}      Icon={Calendar}   />
                  <StatCard label="Portfolio"      value={stats.Altcom}       color={GOLD}     Icon={Megaphone}  />
                  <StatCard label="Devis reçus"    value={quotesStats.total}  color='#7C3AED'  Icon={FileText}   />
                </div>

                {/* KPIs détaillés 3 pôles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Altimmo */}
                  <PoleKpiCard
                    title="Altimmo" Icon={Building2} color={BLUE}
                    kpis={kpis ? [
                      { label:'Biens actifs',      value: kpis.altimmo.actives,    icon: CheckCircle },
                      { label:'En attente',         value: kpis.altimmo.pending,    icon: Clock       },
                      { label:'Ajouts ce mois',     value: kpis.altimmo.leadsMonth, icon: TrendingUp  },
                      { label:'Contrats actifs',    value: contratsActifs,          icon: Home        },
                    ] : null}
                    fallback={stats.Altimmo}
                  />
                  {/* Mila Events */}
                  <PoleKpiCard
                    title="Mila Events" Icon={Calendar} color={RED}
                    kpis={kpis ? [
                      { label:'Événements à venir',  value: kpis.milaEvents.upcoming,  icon: Calendar   },
                      { label:'Publiés',             value: kpis.milaEvents.published, icon: CheckCircle },
                      { label:'Total',               value: kpis.milaEvents.total,     icon: Eye        },
                    ] : null}
                    fallback={milaCount}
                  />
                  {/* Altcom */}
                  <PoleKpiCard
                    title="Altcom" Icon={Megaphone} color={GOLD}
                    kpis={kpis ? [
                      { label:'Projets en cours',  value: kpis.altcom.projetsEnCours, icon: Briefcase  },
                      { label:'Services actifs',   value: kpis.altcom.servicesActifs, icon: Zap        },
                      { label:'Avis reçus',        value: kpis.altcom.avisRecus,      icon: Star       },
                    ] : null}
                    fallback={stats.Altcom}
                  />
                </div>

                {/* Widget Alertes Gestion Locative */}
                {(alertesGL.nbImpayes > 0 || alertesGL.nbPenalites > 0 || alertesGL.bailsExpiration > 0) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-base">🔔</span>
                      <h3 className="font-bold text-gray-900 text-sm flex-1" style={{ fontFamily:FONT }}>
                        Alertes Gestion Locative
                      </h3>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-full"
                        style={{ background:`${RED}15`, color:RED, fontFamily:FONT }}>
                        {alertesGL.nbImpayes + (alertesGL.bailsExpiration > 0 ? 1 : 0)}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {alertesGL.nbImpayes > 0 && (
                        <div className="flex items-center gap-3 px-5 py-3">
                          <span>❌</span>
                          <span className="text-sm text-gray-700" style={{ fontFamily:FONT }}>
                            <strong>{alertesGL.nbImpayes}</strong> loyer{alertesGL.nbImpayes > 1 ? 's' : ''} impayé{alertesGL.nbImpayes > 1 ? 's' : ''} (&gt; 5 jours)
                          </span>
                        </div>
                      )}
                      {alertesGL.nbPenalites > 0 && (
                        <div className="flex items-center gap-3 px-5 py-3">
                          <span>⚠️</span>
                          <span className="text-sm text-gray-700" style={{ fontFamily:FONT }}>
                            <strong>{alertesGL.nbPenalites}</strong> pénalité{alertesGL.nbPenalites > 1 ? 's' : ''} appliquée{alertesGL.nbPenalites > 1 ? 's' : ''} :{' '}
                            <strong style={{ color:GOLD }}>{Number(alertesGL.totalPenalites).toLocaleString('fr-FR')} FCFA</strong>
                          </span>
                        </div>
                      )}
                      {alertesGL.bailsExpiration > 0 && (
                        <div className="flex items-center gap-3 px-5 py-3">
                          <span>📅</span>
                          <span className="text-sm text-gray-700" style={{ fontFamily:FONT }}>
                            <strong>{alertesGL.bailsExpiration}</strong> bail{alertesGL.bailsExpiration > 1 ? 's' : ''} expire{alertesGL.bailsExpiration > 1 ? 'nt' : ''} dans 30 jours
                          </span>
                        </div>
                      )}
                      <div className="px-5 py-3">
                        <a href="/dashboard/gestion-locative"
                          className="text-xs font-semibold hover:underline" style={{ color:BLUE, fontFamily:FONT }}>
                          Voir les détails →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Widget Équipe — Admin uniquement */}
                {user?.role === 'Admin' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-base">👥</span>
                      <h3 className="font-bold text-gray-900 text-sm flex-1" style={{ fontFamily:FONT }}>Équipe</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      <div className="flex items-center gap-3 px-5 py-3">
                        <span>🔴</span>
                        <span className="text-sm text-gray-700 flex-1" style={{ fontFamily:FONT }}>
                          <strong>{teamStats.admins}</strong> Administrateur{teamStats.admins > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-3">
                        <span>🟡</span>
                        <span className="text-sm text-gray-700 flex-1" style={{ fontFamily:FONT }}>
                          <strong>{teamStats.collaborateurs}</strong> Collaborateur{teamStats.collaborateurs > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-3">
                        <span>⚪</span>
                        <span className="text-sm text-gray-700 flex-1" style={{ fontFamily:FONT }}>
                          <strong>{teamStats.utilisateurs}</strong> Utilisateur{teamStats.utilisateurs > 1 ? 's' : ''} inscrit{teamStats.utilisateurs > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="px-5 py-3">
                        <a href="/dashboard/users"
                          className="text-xs font-semibold hover:underline" style={{ color:BLUE, fontFamily:FONT }}>
                          Gérer l'équipe →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activité récente + Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* Widget Activité récente */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <Activity size={15} style={{ color:BLUE }} />
                      <h3 className="font-bold text-gray-900 text-sm" style={{ fontFamily:FONT }}>Activité récente</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {recentItems.length === 0 ? (
                        <p className="p-5 text-sm text-gray-400 text-center" style={{ fontFamily:FONT }}>Aucune activité récente</p>
                      ) : recentItems.map((item, i) => (
                        <div key={`${item.id}-${i}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:`${item.color}15` }}>
                            <item.icon size={13} style={{ color:item.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate" style={{ fontFamily:FONT }}>{item.label}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                style={{ color: statusColor(item.status), background:`${statusColor(item.status)}15`, fontFamily:FONT }}>
                                {item.status || '—'}
                              </span>
                              <span className="text-xs text-gray-400" style={{ fontFamily:FONT }}>{timeAgo(item.date)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Indicateur de performance global */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <TrendingUp size={15} style={{ color:GREEN }} />
                      <h3 className="font-bold text-gray-900 text-sm" style={{ fontFamily:FONT }}>Performance globale</h3>
                      {perf && (
                        <div className="ml-auto text-xs font-extrabold px-2.5 py-1 rounded-full"
                          style={{ color: perf.globalScore >= 70 ? GREEN : perf.globalScore >= 40 ? GOLD : RED,
                                   background: perf.globalScore >= 70 ? `${GREEN}15` : perf.globalScore >= 40 ? `${GOLD}15` : `${RED}15`,
                                   fontFamily:FONT }}>
                          {perf.globalScore}/100
                        </div>
                      )}
                    </div>
                    <div className="p-5 space-y-4">
                      {perf ? (
                        <>
                          <PerfBar label="Taux de validation (Altimmo)" value={perf.validationRate} color={BLUE} unit="%" />
                          <PerfBar label="Activité événements"           value={perf.eventsScore}    color={RED}  />
                          <PerfBar label="Portfolio Altcom"              value={perf.portfolioScore} color={GOLD} />
                          <PerfBar label="Engagement (avis)"            value={perf.reviewScore}    color={GREEN}/>
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-xs font-semibold text-gray-600" style={{ fontFamily:FONT }}>Score global pondéré</span>
                              <span className="text-sm font-extrabold"
                                style={{ color: perf.globalScore >= 70 ? GREEN : perf.globalScore >= 40 ? GOLD : RED, fontFamily:FONT }}>
                                {perf.globalScore}/100
                              </span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width:`${perf.globalScore}%`,
                                  background: perf.globalScore >= 70 ? `linear-gradient(to right, ${GREEN}, #22C55E)` :
                                              perf.globalScore >= 40 ? `linear-gradient(to right, ${GOLD}, #F59E0B)` :
                                                                       `linear-gradient(to right, ${RED}, #EF4444)` }} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4" style={{ fontFamily:FONT }}>Données non disponibles</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Graphiques de répartition */}
                {getPieData().length > 0 && (
                  <ChartCard title="Répartition par Pôle">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={getPieData()} cx="50%" cy="50%" outerRadius={100}
                          dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {getPieData().map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius:'12px',border:'none',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Actions rapides */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-4" style={{ fontFamily:FONT }}>Actions Rapides</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => router.push('/dashboard/properties')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, boxShadow:`0 4px 16px ${BLUE}30`, fontFamily:FONT }}>
                      <Building2 size={16} /> Voir toutes les annonces
                    </button>
                    <button onClick={() => router.push('/dashboard/moderation/properties')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:'linear-gradient(135deg, #5B21B6, #7C3AED)', boxShadow:'0 4px 16px rgba(124,58,237,0.25)', fontFamily:FONT }}>
                      <CheckCircle size={16} /> Modération
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* Vue pôle (altimmo / mila / altcom)            */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab !== 'quotes' && activeTab !== 'overview' && (
              <div className="space-y-5" key={activeTab}>

                {/* KPIs réels par pôle */}
                {activeTab === 'altimmo' && kpis && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="Biens actifs"   value={kpis.altimmo.actives}    color={BLUE}  Icon={CheckCircle} />
                    <StatCard label="En attente"      value={kpis.altimmo.pending}    color={GOLD}  Icon={Clock}       />
                    <StatCard label="Ajouts ce mois"  value={kpis.altimmo.leadsMonth} color={GREEN} Icon={TrendingUp}  />
                  </div>
                )}
                {activeTab === 'mila' && kpis && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="À venir"    value={kpis.milaEvents.upcoming}  color={RED}   Icon={Calendar}    />
                    <StatCard label="Publiés"    value={kpis.milaEvents.published} color={BLUE}  Icon={CheckCircle} />
                    <StatCard label="Total"      value={kpis.milaEvents.total}     color={GOLD}  Icon={Eye}         />
                  </div>
                )}
                {activeTab === 'altcom' && kpis && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="Projets en cours"  value={kpis.altcom.projetsEnCours} color={BLUE}  Icon={Briefcase} />
                    <StatCard label="Services actifs"   value={kpis.altcom.servicesActifs} color={GOLD}  Icon={Zap}       />
                    <StatCard label="Avis reçus"        value={kpis.altcom.avisRecus}      color={GREEN} Icon={Star}      />
                  </div>
                )}

                {/* Graphiques bar + line */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ChartCard title="Annonces par Pôle">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={getChartData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={8} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <Tooltip cursor={{ fill:'#F8FAFC' }} contentStyle={{ borderRadius:'12px',border:'none',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}} />
                        <Bar dataKey="Annonces" fill={active?.color || BLUE} radius={[6,6,0,0]} barSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Évolution">
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={getChartData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={8} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94A3B8', fontSize:12 }} />
                        <Tooltip contentStyle={{ borderRadius:'12px',border:'none',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}} />
                        <Line type="monotone" dataKey="Annonces" stroke={GOLD} strokeWidth={3}
                          dot={{ r:5, fill:GOLD, strokeWidth:2, stroke:'white' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {/* Actions rapides */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-4" style={{ fontFamily:FONT }}>Actions Rapides</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => router.push('/dashboard/properties')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:`linear-gradient(135deg, #1A5A8A, ${BLUE})`, boxShadow:`0 4px 16px ${BLUE}30`, fontFamily:FONT }}>
                      <Building2 size={16} /> Voir toutes les annonces
                    </button>
                    <button onClick={() => router.push('/dashboard/moderation/properties')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
                      style={{ background:'linear-gradient(135deg, #5B21B6, #7C3AED)', boxShadow:'0 4px 16px rgba(124,58,237,0.25)', fontFamily:FONT }}>
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
    </>
  );
};

// ── Sous-composants ──────────────────────────────────────────

const StatCard = ({ label, value, color, Icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center transition-transform hover:scale-105">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:`${color}15` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <span className="text-3xl font-extrabold text-gray-900 mb-1" style={{ fontFamily:FONT }}>{value}</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400" style={{ fontFamily:FONT }}>{label}</span>
  </div>
);

const PoleKpiCard = ({ title, Icon, color, kpis, fallback }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-gray-50" style={{ background:`${color}08` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:`${color}18` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span className="text-sm font-bold text-gray-800" style={{ fontFamily:FONT }}>{title}</span>
    </div>
    <div className="p-4">
      {kpis ? (
        <div className="space-y-3">
          {kpis.map(({ label, value, icon: KpiIcon }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KpiIcon size={13} style={{ color }} />
                <span className="text-xs text-gray-500" style={{ fontFamily:FONT }}>{label}</span>
              </div>
              <span className="text-sm font-extrabold" style={{ color, fontFamily:FONT }}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-2">
          <span className="text-3xl font-extrabold" style={{ color, fontFamily:FONT }}>{fallback}</span>
          <p className="text-xs text-gray-400 mt-1" style={{ fontFamily:FONT }}>éléments</p>
        </div>
      )}
    </div>
  </div>
);

const PerfBar = ({ label, value, color, unit = '' }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-xs text-gray-500" style={{ fontFamily:FONT }}>{label}</span>
      <span className="text-xs font-bold" style={{ color, fontFamily:FONT }}>{value}{unit}</span>
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width:`${Math.min(value,100)}%`, background:color }} />
    </div>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <h3 className="font-bold text-gray-800 text-sm mb-4" style={{ fontFamily:FONT }}>{title}</h3>
    {children}
  </div>
);

const ActionCard = ({ label, description, btnLabel, color, onClick }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
    <h3 className="font-bold text-gray-900 mb-1" style={{ fontFamily:FONT }}>{label}</h3>
    <p className="text-sm text-gray-500 mb-5">{description}</p>
    <button onClick={onClick}
      className="px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
      style={{ background:`linear-gradient(135deg, ${color}CC, ${color})`, boxShadow:`0 4px 16px ${color}40`, fontFamily:FONT }}>
      {btnLabel}
    </button>
  </div>
);

const LoadingScreen = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="text-center">
      <Loader2 className="animate-spin w-10 h-10 mx-auto mb-3" style={{ color:BLUE }} />
      <p className="text-sm text-gray-500" style={{ fontFamily:FONT }}>Chargement des statistiques…</p>
    </div>
  </div>
);

const ErrorScreen = ({ error }) => (
  <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
    <div className="text-center max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-red-100">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily:FONT }}>Erreur de chargement</h3>
      <p className="text-sm text-gray-500 mb-5">{error}</p>
      <button onClick={() => window.location.reload()}
        className="px-6 py-2 text-white text-sm font-semibold rounded-xl transition-all hover:scale-105"
        style={{ background:'linear-gradient(135deg, #1A5A8A, #2E7BB5)', fontFamily:FONT }}>
        Réessayer
      </button>
    </div>
  </div>
);

export default DashboardHome;
