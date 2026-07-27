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
import { HOTEL_RATE_TYPES } from "../../constants/hotel";

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
    const amount = Number(inputs[`${categoryId}_${rateType}`]);
    if (!amount || amount <= 0) { toast.error("Montant invalide."); return; }
    try {
      await upsertRoomCategoryRate(categoryId, { rateType, amount, seasonalPeriods: seasonalPeriods[`${categoryId}_${rateType}`] || [] });
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

  if (loading) return <p className="text-center mt-10">Chargement...</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Tarifs par catégorie</h2>
        <Link href={`/dashboard/hotels/${hotelId}`} className="text-sm text-blue-600 underline">← Retour à l'établissement</Link>
      </div>

      {categories.length === 0 && <p className="text-gray-500">Aucune catégorie de chambres — créez-en une d'abord.</p>}

      <div className="space-y-6">
        {categories
          .filter((cat) => !focusedCategoryId || cat._id === focusedCategoryId)
          .map((cat) => {
            const rates = ratesByCategory[cat._id] || [];
            const active = rates.filter((r) => r.active);
            const archived = rates.filter((r) => !r.active);
            return (
              <div key={cat._id} className="border rounded p-4">
                <h3 className="font-semibold mb-3">{cat.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {HOTEL_RATE_TYPES.map((rt) => {
                    const currentRate = active.find((r) => r.rateType === rt.value);
                    const rateKey = `${cat._id}_${rt.value}`;
                    return (
                      <div key={rt.value} className="rounded border p-3 space-y-2">
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
                        {(currentRate?.seasonalPeriods || []).length > 0 && <p className="text-xs text-gray-600">{currentRate.seasonalPeriods.length} période(s) datée(s) active(s).</p>}
                        {(seasonalPeriods[rateKey] || []).map((period, index) => <div key={`${rateKey}_${index}`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <input aria-label={`Nom période ${rt.label} ${index + 1}`} placeholder="Nom" value={period.label} onChange={(event) => updateSeason(rateKey, index, { label: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Début période ${rt.label} ${index + 1}`} type="date" value={period.startDate} onChange={(event) => updateSeason(rateKey, index, { startDate: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Fin période ${rt.label} ${index + 1}`} type="date" value={period.endDate} onChange={(event) => updateSeason(rateKey, index, { endDate: event.target.value })} className="border rounded p-1 text-xs" />
                          <input aria-label={`Montant période ${rt.label} ${index + 1}`} type="number" min="0" placeholder="FCFA" value={period.amount} onChange={(event) => updateSeason(rateKey, index, { amount: event.target.value })} className="border rounded p-1 text-xs" />
                          <div className="flex gap-1"><input aria-label={`Priorité période ${rt.label} ${index + 1}`} type="number" min="0" value={period.priority} onChange={(event) => updateSeason(rateKey, index, { priority: event.target.value })} className="w-16 border rounded p-1 text-xs" /><button type="button" aria-label={`Supprimer période ${rt.label} ${index + 1}`} onClick={() => removeSeason(rateKey, index)} className="text-red-700">×</button></div>
                        </div>)}
                        <button type="button" onClick={() => addSeason(rateKey)} className="text-xs text-blue-700 underline">Ajouter une période datée</button>
                      </div>
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
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ManageHotelRatesPage;
