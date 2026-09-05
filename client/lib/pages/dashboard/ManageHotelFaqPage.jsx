"use client";

// PHASE-HX1 §23 — gestion professionnelle de la FAQ hôtelière (backend H3
// déjà complet, jamais un second modèle) : liste/création/édition/
// activation/suppression/réordonnancement.

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { getHotelFaqOwner, createHotelFaq, updateHotelFaq, deleteHotelFaq } from "../../services/hotelService";
import { HelpCircle } from "lucide-react";
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";

const emptyForm = () => ({ question: "", answer: "" });

const ManageHotelFaqPage = () => {
  const { hotelId } = useParams();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm());

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const list = await getHotelFaqOwner(hotelId);
      setEntries((list || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (err) {
      toast.error("Erreur lors du chargement de la FAQ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toast.error("Question et réponse sont requises."); return; }
    try {
      await createHotelFaq(hotelId, { ...form, order: entries.length });
      toast.success("Question ajoutée.");
      setCreating(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  const startEdit = (entry) => { setEditingId(entry._id); setEditForm({ question: entry.question, answer: entry.answer }); };

  const handleUpdate = async (id) => {
    try {
      await updateHotelFaq(hotelId, id, editForm);
      toast.success("Question modifiée.");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification.");
    }
  };

  const handleToggleActive = async (entry) => {
    try {
      await updateHotelFaq(hotelId, entry._id, { active: !entry.active });
      toast.success("Statut mis à jour.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement cette question ?")) return;
    try {
      await deleteHotelFaq(hotelId, id);
      toast.success("Question supprimée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  };

  // PHASE-HX1 §23 — réordonnancement : échange `order` avec le voisin,
  // persisté via l'API PATCH existante (jamais une seconde route).
  const move = async (index, direction) => {
    const target = entries[index + direction];
    const current = entries[index];
    if (!target) return;
    try {
      await Promise.all([
        updateHotelFaq(hotelId, current._id, { order: target.order ?? index + direction }),
        updateHotelFaq(hotelId, target._id, { order: current.order ?? index }),
      ]);
      load();
    } catch (err) {
      toast.error("Réordonnancement impossible.");
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement de la FAQ…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={HelpCircle} title="FAQ" description="Questions fréquentes rédigées par l'établissement (jamais générées automatiquement)." />

      {!creating && (
        <button onClick={() => setCreating(true)} className="mb-4 bg-gold text-white px-3 py-1.5 rounded text-sm">+ Nouvelle question</button>
      )}

      {creating && (
        <DashboardCard className="mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Question</label>
            <input value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} aria-label="Question" className="w-full p-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Réponse</label>
            <textarea value={form.answer} onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))} aria-label="Réponse" rows={3} className="w-full p-2 border rounded text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Enregistrer</button>
            <button onClick={() => { setCreating(false); setForm(emptyForm()); }} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </DashboardCard>
      )}

      {entries.length === 0 && !creating && <DashboardState title="Aucune question" description="Ajoutez la première question fréquente de cet établissement." />}

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <DashboardCard key={entry._id}>
            {editingId === entry._id ? (
              <div className="space-y-2">
                <input value={editForm.question} onChange={(e) => setEditForm((p) => ({ ...p, question: e.target.value }))} aria-label="Modifier la question" className="w-full p-2 border rounded text-sm" />
                <textarea value={editForm.answer} onChange={(e) => setEditForm((p) => ({ ...p, answer: e.target.value }))} aria-label="Modifier la réponse" rows={3} className="w-full p-2 border rounded text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(entry._id)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Enregistrer</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-600 text-sm">Annuler</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{entry.question}</h3>
                    <p className="text-sm text-gray-600 mt-1">{entry.answer}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded shrink-0 ${entry.active !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {entry.active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => startEdit(entry)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Modifier</button>
                  <button onClick={() => handleToggleActive(entry)} className={`px-3 py-1.5 rounded text-sm text-white ${entry.active !== false ? "bg-gray-600" : "bg-green-600"}`}>
                    {entry.active !== false ? "Désactiver" : "Activer"}
                  </button>
                  <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Monter "${entry.question}"`} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm disabled:opacity-40">↑</button>
                  <button onClick={() => move(index, 1)} disabled={index === entries.length - 1} aria-label={`Descendre "${entry.question}"`} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm disabled:opacity-40">↓</button>
                  <button onClick={() => handleDelete(entry._id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Supprimer</button>
                </div>
              </>
            )}
          </DashboardCard>
        ))}
      </div>
    </DashboardPage>
  );
};

export default ManageHotelFaqPage;
