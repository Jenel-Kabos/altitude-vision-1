"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getMyProperties } from "../../services/propertyService";
import {
  getMyAccommodations,
  createAccommodation,
  updateAccommodation,
  submitAccommodation,
  upsertAccommodationRate,
} from "../../services/accommodationService";
import { ACCOMMODATION_TYPES } from "../../constants/accommodation";

const PUBLICATION_LABELS = {
  brouillon: { label: "Brouillon", className: "bg-gray-100 text-gray-700" },
  soumis: { label: "En attente de validation", className: "bg-yellow-100 text-yellow-800" },
  publie: { label: "Publié", className: "bg-green-100 text-green-800" },
  rejete: { label: "Rejeté", className: "bg-red-100 text-red-700" },
};

function emptyAccommodationForm() {
  return {
    accommodationType: "appartement_meuble",
    maxAdults: 2,
    maxChildren: 0,
    beds: 1,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    minimumStay: 1,
    securityDeposit: 0,
    cleaningFee: 0,
  };
}

const RATE_MODES = [
  { value: "nightly", label: "Tarif / nuit" },
  { value: "weekly", label: "Tarif / semaine" },
  { value: "monthly", label: "Tarif / mois" },
];

const MyAccommodationsPage = () => {
  const [properties, setProperties] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState(null); // propertyId
  const [createForm, setCreateForm] = useState(emptyAccommodationForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyAccommodationForm());
  const [rateInputs, setRateInputs] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const [props, accs] = await Promise.all([getMyProperties(), getMyAccommodations()]);
      setProperties((props || []).filter((p) => p.status === "hebergement"));
      setAccommodations(accs || []);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement de vos hébergements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const accommodationForProperty = (propertyId) =>
    accommodations.find((a) => (a.property?._id || a.property) === propertyId);

  const handleCreate = async (propertyId) => {
    try {
      await createAccommodation({
        property: propertyId,
        accommodationType: createForm.accommodationType,
        capacity: { maxAdults: Number(createForm.maxAdults) || 1, maxChildren: Number(createForm.maxChildren) || 0 },
        beds: Number(createForm.beds) || 0,
        checkInTime: createForm.checkInTime,
        checkOutTime: createForm.checkOutTime,
        minimumStay: Number(createForm.minimumStay) || 1,
        securityDeposit: Number(createForm.securityDeposit) || 0,
        cleaningFee: Number(createForm.cleaningFee) || 0,
      });
      toast.success("Profil hébergement créé.");
      setCreatingFor(null);
      setCreateForm(emptyAccommodationForm());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  const startEdit = (acc) => {
    setEditingId(acc._id);
    setEditForm({
      accommodationType: acc.accommodationType,
      maxAdults: acc.capacity?.maxAdults ?? 2,
      maxChildren: acc.capacity?.maxChildren ?? 0,
      beds: acc.beds ?? 0,
      checkInTime: acc.checkInTime || "14:00",
      checkOutTime: acc.checkOutTime || "11:00",
      minimumStay: acc.minimumStay ?? 1,
      securityDeposit: acc.securityDeposit ?? 0,
      cleaningFee: acc.cleaningFee ?? 0,
    });
  };

  const handleUpdate = async (id) => {
    try {
      await updateAccommodation(id, {
        accommodationType: editForm.accommodationType,
        capacity: { maxAdults: Number(editForm.maxAdults) || 1, maxChildren: Number(editForm.maxChildren) || 0 },
        beds: Number(editForm.beds) || 0,
        checkInTime: editForm.checkInTime,
        checkOutTime: editForm.checkOutTime,
        minimumStay: Number(editForm.minimumStay) || 1,
        securityDeposit: Number(editForm.securityDeposit) || 0,
        cleaningFee: Number(editForm.cleaningFee) || 0,
      });
      toast.success("Hébergement mis à jour.");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la mise à jour.");
    }
  };

  const handleSubmit = async (id) => {
    try {
      await submitAccommodation(id);
      toast.success("Hébergement soumis pour validation.");
      load();
    } catch (err) {
      const readiness = err.response?.data?.readiness;
      const msg = readiness?.missingFields?.length
        ? `Champs manquants : ${readiness.missingFields.join(", ")}`
        : (err.response?.data?.message || "Erreur lors de la soumission.");
      toast.error(msg);
    }
  };

  const handleRateSave = async (accId, mode) => {
    const amount = Number(rateInputs[`${accId}_${mode}`]);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    try {
      await upsertAccommodationRate(accId, { mode, amount });
      toast.success("Tarif enregistré.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du tarif.");
    }
  };

  if (loading) return <p className="text-center mt-10">Chargement...</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-2">Mes hébergements</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configurez le type de logement, la capacité d'accueil et les tarifs de vos biens en Hébergement.
        Les hébergements meublés entiers uniquement sont pris en charge cette étape (pas de gestion de chambres).
      </p>

      {properties.length === 0 && (
        <p className="text-gray-500">
          Aucun bien en Hébergement pour le moment. Créez ou modifiez un bien avec le type de transaction
          « Hébergement (meublé) » pour le retrouver ici.
        </p>
      )}

      {properties.map((property) => {
        const acc = accommodationForProperty(property._id);
        return (
          <div key={property._id} className="border rounded p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-semibold">{property.title}</h3>
                <p className="text-sm text-gray-500">{property.address_city || property.address?.city}</p>
              </div>
              {acc && (
                <span className={`text-xs font-semibold px-2 py-1 rounded ${PUBLICATION_LABELS[acc.publicationStatus]?.className || "bg-gray-100"}`}>
                  {PUBLICATION_LABELS[acc.publicationStatus]?.label || acc.publicationStatus}
                </span>
              )}
            </div>

            {!acc && creatingFor !== property._id && (
              <button
                onClick={() => { setCreatingFor(property._id); setCreateForm(emptyAccommodationForm()); }}
                className="mt-3 bg-gold text-white px-3 py-1.5 rounded text-sm"
              >
                Configurer l'hébergement
              </button>
            )}

            {!acc && creatingFor === property._id && (
              <div className="mt-4 bg-gray-50 border rounded p-3 space-y-3">
                <p className="text-xs text-gray-500">
                  Chambres, salles de bain et équipements se règlent depuis « Mes biens » — ce formulaire
                  ne couvre que les informations propres à l'hébergement (capacité, horaires, tarifs).
                </p>
                <AccommodationFields form={createForm} setForm={setCreateForm} />
                <div className="flex gap-2">
                  <button onClick={() => handleCreate(property._id)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
                    Enregistrer
                  </button>
                  <button onClick={() => setCreatingFor(null)} className="text-gray-600 text-sm">Annuler</button>
                </div>
              </div>
            )}

            {acc && editingId !== acc._id && (
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <p>Type : {ACCOMMODATION_TYPES.find((t) => t.value === acc.accommodationType)?.label || acc.accommodationType}</p>
                <p>Capacité : {acc.capacity?.maxAdults || 0} adulte(s), {acc.capacity?.maxChildren || 0} enfant(s)</p>
                <p>
                  Chambres : {acc.property?.bedrooms ?? '—'} · Salles de bain : {acc.property?.bathrooms ?? '—'}
                  <span className="text-xs text-gray-400"> (modifiable depuis « Mes biens »)</span>
                </p>
                {acc.publicationStatus === "rejete" && acc.rejectionReason && (
                  <p className="text-red-600">Motif du rejet : {acc.rejectionReason}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => startEdit(acc)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Modifier</button>
                  {(acc.publicationStatus === "brouillon" || acc.publicationStatus === "rejete") && (
                    <button onClick={() => handleSubmit(acc._id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
                      Soumettre pour validation
                    </button>
                  )}
                </div>

                <div className="mt-3 border-t pt-3">
                  <p className="font-semibold mb-2">Tarifs</p>
                  <div className="flex flex-wrap gap-3">
                    {RATE_MODES.map((m) => (
                      <div key={m.value} className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">{m.label}</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="FCFA"
                          value={rateInputs[`${acc._id}_${m.value}`] ?? ""}
                          onChange={(e) => setRateInputs((prev) => ({ ...prev, [`${acc._id}_${m.value}`]: e.target.value }))}
                          className="w-28 p-1.5 border rounded text-sm"
                        />
                        <button onClick={() => handleRateSave(acc._id, m.value)} className="text-xs bg-gray-800 text-white px-2 py-1.5 rounded">
                          OK
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {acc && editingId === acc._id && (
              <div className="mt-4 bg-gray-50 border rounded p-3 space-y-3">
                <AccommodationFields form={editForm} setForm={setEditForm} />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(acc._id)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
                    Enregistrer
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-600 text-sm">Annuler</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const AccommodationFields = ({ form, setForm }) => {
  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium mb-1">Type d'hébergement</label>
        <select value={form.accommodationType} onChange={set("accommodationType")} className="w-full p-2 border rounded text-sm">
          {ACCOMMODATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Séjour minimum (nuits)</label>
        <input type="number" min="1" value={form.minimumStay} onChange={set("minimumStay")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Adultes max</label>
        <input type="number" min="1" value={form.maxAdults} onChange={set("maxAdults")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Enfants max</label>
        <input type="number" min="0" value={form.maxChildren} onChange={set("maxChildren")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Lits</label>
        <input type="number" min="0" value={form.beds} onChange={set("beds")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div />
      <div>
        <label className="block text-xs font-medium mb-1">Heure d'arrivée</label>
        <input type="time" value={form.checkInTime} onChange={set("checkInTime")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Heure de départ</label>
        <input type="time" value={form.checkOutTime} onChange={set("checkOutTime")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Caution de séjour (FCFA)</label>
        <input type="number" min="0" value={form.securityDeposit} onChange={set("securityDeposit")} className="w-full p-2 border rounded text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Frais de ménage (FCFA)</label>
        <input type="number" min="0" value={form.cleaningFee} onChange={set("cleaningFee")} className="w-full p-2 border rounded text-sm" />
      </div>
    </div>
  );
};

export default MyAccommodationsPage;
