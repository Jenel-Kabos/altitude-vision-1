"use client";

// Sprint B2 — domaine Hôtellerie. Gestion des tarifs par catégorie de
// chambres : création, historique, activation, duplication, archivage.
// Un seul tarif ACTIF par type (public/entreprise/weekend/promotion/
// haute_saison) — l'historique (tarifs archivés) reste consultable.

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getRoomCategories, getRoomCategoryRates, upsertRoomCategoryRate, archiveRoomCategoryRate,
} from "../../services/hotelService";
import { HOTEL_RATE_TYPES, HOTEL_MEAL_PLANS, HOTEL_CANCELLATION_TYPES, HOTEL_PENALTY_TYPES } from "../../constants/hotel";
import { BadgeDollarSign } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";

const ManageHotelRatesPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = params?.hotelId;
  const focusedCategoryId = searchParams?.get('category') ?? null;

  const [categories, setCategories] = useState([]);
  const [ratesByCategory, setRatesByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({});
  const [showHistory, setShowHistory] = useState({});
  const [seasonalPeriods, setSeasonalPeriods] = useState({});
  // PHASE-HX1 §13-14 — conditions commerciales H5, valeurs canoniques
  // uniquement (jamais paymentPolicy, différé). `cancellationType: ''`
  // signifie "ne pas renseigner" (jamais envoyé comme non_refundable par défaut).
  const [commercial, setCommercial] = useState({});
  const setCommercialField = (key, field, value) => setCommercial((state) => ({ ...state, [key]: { ...state[key], [field]: value } }));

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const list = await getRoomCategories(hotelId);
      setCategories(list || []);
      const rates = {};
      await Promise.all((list || []).map(async (cat) => {
        rates[cat._id] = await getRoomCategoryRates(cat._id, true);
      }));
      setRatesByCategory(rates);
    } catch (err) {
      toast.error("Erreur lors du chargement des tarifs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hotelId]);

  const handleSave = async (categoryId, rateType) => {
    const key = `${categoryId}_${rateType}`;
    const amount = Number(inputs[key]);
    if (!amount || amount <= 0) { toast.error("Montant invalide."); return; }
    const commercialForm = commercial[key] || {};
    // PHASE-HX1 — jamais un enum fabriqué : une politique d'annulation
    // n'est envoyée que si le professionnel a explicitement choisi un type ;
    // la cohérence (non_refundable sans délai/pénalité, etc.) reste validée
    // côté serveur (mission §14 : "Never make frontend the authority").
    const cancellation = commercialForm.cancellationType ? {
      type: commercialForm.cancellationType,
      ...(commercialForm.cancellationType !== 'non_refundable' ? {
        deadlineHoursBeforeCheckIn: commercialForm.deadlineHours ? Number(commercialForm.deadlineHours) : undefined,
        penaltyType: commercialForm.penaltyType || undefined,
        penaltyValue: commercialForm.penaltyValue ? Number(commercialForm.penaltyValue) : undefined,
      } : {}),
    } : undefined;
    try {
      await upsertRoomCategoryRate(categoryId, {
        rateType, amount, seasonalPeriods: seasonalPeriods[key] || [],
        mealPlan: commercialForm.mealPlan || undefined,
        cancellation,
      });
      toast.success("Tarif enregistré.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    }
  };

  const addSeason = (key) => setSeasonalPeriods((state) => ({ ...state, [key]: [...(state[key] || []), { label: '', startDate: '', endDate: '', amount: '', priority: 0 }] }));
  const updateSeason = (key, index, patch) => setSeasonalPeriods((state) => ({ ...state, [key]: (state[key] || []).map((period, position) => position === index ? { ...period, ...patch } : period) }));
  const removeSeason = (key, index) => setSeasonalPeriods((state) => ({ ...state, [key]: (state[key] || []).filter((_, position) => position !== index) }));

  const handleArchive = async (categoryId, rateId) => {
    try {
      await archiveRoomCategoryRate(categoryId, rateId);
      toast.success("Tarif archivé.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'archivage.");
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement des tarifs…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={BadgeDollarSign} title="Tarifs par catégorie" description="Configurez les tarifs publics et les périodes datées de chaque catégorie."
        actions={<Link href={`/dashboard/hotels/${hotelId}`} className="text-sm text-blue-600 underline">← Retour à l'établissement</Link>} />

      {categories.length === 0 && <DashboardState title="Aucune catégorie de chambres" description="Créez d’abord une catégorie pour pouvoir définir ses tarifs." />}

      <div className="space-y-6">
        {categories
          .filter((cat) => !focusedCategoryId || cat._id === focusedCategoryId)
          .map((cat) => {
            const rates = ratesByCategory[cat._id] || [];
            const active = rates.filter((r) => r.active);
            const archived = rates.filter((r) => !r.active);
            return (
              <DashboardCard key={cat._id}>
                <h3 className="font-semibold mb-3">{cat.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {HOTEL_RATE_TYPES.map((rt) => {
                    const currentRate = active.find((r) => r.rateType === rt.value);
                    const rateKey = `${cat._id}_${rt.value}`;
                    return (
                      <DashboardCard key={rt.value} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2"><label className="text-xs text-gray-500 w-32">{rt.label}</label>
                        {currentRate && <span className="text-sm font-medium">{currentRate.amount} {currentRate.currency}</span>}
                        <input
                          aria-label={`Tarif de base ${rt.label}`} type="number" min="0" placeholder="FCFA"
                          value={inputs[rateKey] ?? ""}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [rateKey]: e.target.value }))}
                          className="w-24 p-1.5 border rounded text-sm"
                        />
                        <button onClick={() => handleSave(cat._id, rt.value)} className="text-xs bg-gray-800 text-white px-2 py-1.5 rounded">OK</button>
                        {currentRate && (
                          <button onClick={() => handleArchive(cat._id, currentRate._id)} className="text-xs bg-red-100 text-red-700 px-2 py-1.5 rounded">
                            Archiver
                          </button>
                        )}</div>
                        {currentRate?.mealPlan && <p className="text-xs text-gray-600">Formule actuelle : {HOTEL_MEAL_PLANS.find((m) => m.value === currentRate.mealPlan)?.label}</p>}
                        {currentRate?.cancellation && <p className="text-xs text-gray-600">Annulation actuelle : {HOTEL_CANCELLATION_TYPES.find((c) => c.value === currentRate.cancellation.type)?.label}</p>}
                        {/* PHASE-HX1 §13-14 — n'expose QUE mealPlan/cancellation (H5
                            implémenté) ; jamais paymentPolicy (différé). */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select aria-label={`Plan repas ${rt.label}`} value={commercial[rateKey]?.mealPlan || ""} onChange={(e) => setCommercialField(rateKey, 'mealPlan', e.target.value)} className="border rounded p-1.5 text-xs">
                            <option value="">Plan repas (non renseigné)</option>
                            {HOTEL_MEAL_PLANS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                          <select aria-label={`Conditions d'annulation ${rt.label}`} value={commercial[rateKey]?.cancellationType || ""} onChange={(e) => setCommercialField(rateKey, 'cancellationType', e.target.value)} className="border rounded p-1.5 text-xs">
                            <option value="">Annulation (non renseignée)</option>
                            {HOTEL_CANCELLATION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        {commercial[rateKey]?.cancellationType && commercial[rateKey].cancellationType !== 'non_refundable' && (
                          <div className="grid grid-cols-3 gap-2">
                            <input aria-label={`Délai d'annulation ${rt.label} (heures)`} type="number" min="0" placeholder="Délai (h)" value={commercial[rateKey]?.deadlineHours || ""} onChange={(e) => setCommercialField(rateKey, 'deadlineHours', e.target.value)} className="border rounded p-1 text-xs" />
                            <select aria-label={`Type de pénalité ${rt.label}`} value={commercial[rateKey]?.penaltyType || ""} onChange={(e) => setCommercialField(rateKey, 'penaltyType', e.target.value)} className="border rounded p-1 text-xs">
                              <option value="">Pénalité (aucune)</option>
                              {HOTEL_PENALTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <input aria-label={`Valeur de la pénalité ${rt.label}`} type="number" min="0" placeholder="Valeur" value={commercial[rateKey]?.penaltyValue || ""} onChange={(e) => setCommercialField(rateKey, 'penaltyValue', e.target.value)} className="border rounded p-1 text-xs" />
                          </div>
                        )}
                        {(currentRate?.seasonalPeriods || []).length > 0 && <p className="text-xs text-gray-600">{currentRate.seasonalPeriods.length} période(s) datée(s) active(s).</p>}
                        {(seasonalPeriods[rateKey] || []).map((period, index) => <div key={`${rateKey}_${index}`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <input aria-label={`Nom période ${rt.label} ${index + 1}`} placeholder="Nom" value={period.label} onChange={(event) => updateSeason(rateKey, index, { label: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Début période ${rt.label} ${index + 1}`} type="date" value={period.startDate} onChange={(event) => updateSeason(rateKey, index, { startDate: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Fin période ${rt.label} ${index + 1}`} type="date" value={period.endDate} onChange={(event) => updateSeason(rateKey, index, { endDate: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Montant période ${rt.label} ${index + 1}`} type="number" min="0" placeholder="FCFA" value={period.amount} onChange={(event) => updateSeason(rateKey, index, { amount: event.target.value })} className="border rounded p-1 text-xs" />
                          <div className="flex gap-1"><input aria-label={`Priorité période ${rt.label} ${index + 1}`} type="number" min="0" value={period.priority} onChange={(event) => updateSeason(rateKey, index, { priority: event.target.value })} className="w-16 border rounded p-1 text-xs" /><button type="button" aria-label={`Supprimer période ${rt.label} ${index + 1}`} onClick={() => removeSeason(rateKey, index)} className="text-red-700">×</button></div>
                        </div>)}
                        <button type="button" onClick={() => addSeason(rateKey)} className="text-xs text-blue-700 underline">Ajouter une période datée</button>
                      </DashboardCard>
                    );
                  })}
                </div>

                {archived.length > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setShowHistory((p) => ({ ...p, [cat._id]: !p[cat._id] }))} className="text-xs text-blue-600 underline">
                      {showHistory[cat._id] ? 'Masquer' : 'Voir'} l'historique ({archived.length})
                    </button>
                    {showHistory[cat._id] && (
                      <ul className="mt-2 text-xs text-gray-500 space-y-1">
                        {archived.map((r) => (
                          <li key={r._id}>{HOTEL_RATE_TYPES.find((t) => t.value === r.rateType)?.label} — {r.amount} {r.currency} (archivé)</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </DashboardCard>
            );
          })}
      </div>
    </DashboardPage>
  );
};

export default ManageHotelRatesPage;
