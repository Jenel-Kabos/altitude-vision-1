"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bed, CalendarDays, ImageIcon, Info, Landmark, LayoutDashboard, Pencil, PlusCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { getAccommodation } from "../../services/accommodationService";
import { getDashboardAnalytics } from "../../services/dashboardAnalyticsService";
import AccommodationPropertyForm from "../../components/dashboard/AccommodationPropertyForm";
import AccommodationReservationsPanel from "../../components/dashboard/AccommodationReservationsPanel";
import DashboardKpis from "../../components/dashboard/DashboardKpis";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";
import { formatCurrencyXAF } from "../../utils/normalizePropertyDetail";

const views = [["overview", "Vue d’ensemble", Info], ["reservations", "Réservations", LayoutDashboard], ["new", "Nouvelle réservation", PlusCircle], ["calendar", "Calendrier et blocages", CalendarDays], ["finance", "Finances", Landmark]];
const detailKpis = (data) => [
  { key: "today", label: "Réservations aujourd’hui", value: data?.kpis?.reservationsToday }, { key: "week", label: "Réservations semaine", value: data?.kpis?.reservationsWeek },
  { key: "checkins", label: "Arrivées du jour", value: data?.kpis?.checkInsToday }, { key: "checkouts", label: "Départs du jour", value: data?.kpis?.checkOutsToday },
  { key: "occupancy", label: "Occupation mensuelle", value: `${data?.kpis?.occupancyRate || 0}%` }, { key: "gross", label: "Montant encaissé", value: data?.kpis?.grossAmountCollected, format: "money" },
  { key: "remaining", label: "Solde à encaisser", value: data?.kpis?.remainingAmount, format: "money" }, { key: "refunded", label: "Remboursé", value: data?.kpis?.refundedAmount, format: "money" },
];

export default function AccommodationDetailPage({ accommodationId, ownerMode = false }) {
  const searchParams = useSearchParams(); const requested = searchParams?.get("view");
  const [view, setView] = useState(views.some(([key]) => key === requested) ? requested : "overview");
  const [accommodation, setAccommodation] = useState(null); const [analytics, setAnalytics] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [editing, setEditing] = useState(false);
  const load = async () => { setLoading(true); setError(false); try { const result = await getAccommodation(accommodationId); setAccommodation(result); } catch { setError(true); } finally { setLoading(false); } };
  const loadAnalytics = () => getDashboardAnalytics("accommodations", { accommodationId }).then(setAnalytics).catch(() => setAnalytics({ kpis: {} }));
  useEffect(() => { load(); loadAnalytics(); }, [accommodationId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <DashboardPage><DashboardState type="loading" title="Chargement de l’hébergement…"/></DashboardPage>;
  if (error || !accommodation) return <DashboardPage><DashboardState type="error" title="Hébergement inaccessible" description="Ce bien n’existe pas ou vous n’avez pas accès à sa gestion." action={<Link href="/dashboard/hebergements">Retour aux hébergements</Link>}/></DashboardPage>;
  const property = accommodation.property || {}; const capacity = (accommodation.capacity?.maxAdults || 0) + (accommodation.capacity?.maxChildren || 0);
  return <DashboardPage>
    <Link href={ownerMode ? "/mes-hotels" : "/dashboard/hebergements"} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4"/> Retour aux établissements</Link>
    <DashboardPageHeader icon={Bed} eyebrow="Gestion de l’hébergement" title={property.title || "Hébergement"} description={[property.address?.arrondissement, property.address?.city].filter(Boolean).join(", ")} actions={!ownerMode && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white"><Pencil className="h-4 w-4"/> Modifier</button>}/>
    <nav className="dashboard-toolbar" aria-label="Gestion de cet hébergement">{views.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setView(key)} aria-current={view === key ? "page" : undefined} className={`inline-flex items-center gap-2 ${view === key ? "bg-blue-700 text-white" : ""}`}><Icon className="h-4 w-4"/>{label}</button>)}</nav>
    {editing && <DashboardCard className="mb-6"><AccommodationPropertyForm accommodation={accommodation} onSuccess={() => { setEditing(false); load(); }} onCancel={() => setEditing(false)}/></DashboardCard>}
    {view === "overview" && <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]"><DashboardCard><h2 className="mb-4 text-xl font-bold">Informations générales</h2><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Tarif</dt><dd className="font-semibold">{formatCurrencyXAF(property.price).replace("FCFA", "XAF")} / nuit</dd></div><div><dt className="text-sm text-slate-500">Capacité</dt><dd className="font-semibold">{capacity ? `${capacity} personnes` : "Non renseignée"}</dd></div><div><dt className="text-sm text-slate-500">Disponibilité</dt><dd className="font-semibold">{property.availability || "Non renseignée"}</dd></div><div><dt className="text-sm text-slate-500">Publication</dt><dd className="font-semibold">Publié</dd></div></dl></DashboardCard><DashboardCard><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><ImageIcon className="h-5 w-5"/> Galerie</h2>{property.images?.length ? <div className="grid grid-cols-2 gap-2">{property.images.slice(0, 4).map((src, index) => <div key={src} className="relative aspect-video overflow-hidden rounded-lg"><Image src={src} alt={`${property.title} — photo ${index + 1}`} fill className="object-cover"/></div>)}</div> : <p className="text-sm text-slate-500">Aucune photo.</p>}</DashboardCard></div>
      <DashboardKpis items={detailKpis(analytics)} loading={!analytics} note={analytics?.occupancyFormula}/>
      <DashboardCard><h2 className="text-xl font-bold">Historique opérationnel</h2><p className="mt-2 text-sm text-slate-600">Les réservations, changements de séjour, paiements et remboursements sont consultables dans les sections dédiées de cette fiche.</p></DashboardCard>
    </div>}
    {view !== "overview" && <AccommodationReservationsPanel key={view} accommodations={[accommodation]} initialAccommodationId={accommodation._id} initialTab={view} onChanged={() => { loadAnalytics(); toast.success("Données de l’hébergement actualisées."); }}/>} 
  </DashboardPage>;
}
