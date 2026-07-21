"use client";

// Sprint B2 — domaine Hôtellerie. Gestion des catégories de chambres d'un
// hôtel (Standard/Deluxe/Suite…) — jamais de chambre physique individuelle.

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getRoomCategories, createRoomCategory, updateRoomCategory, deleteRoomCategory,
  duplicateRoomCategory, activateRoomCategory, deactivateRoomCategory,
} from "../../services/hotelService";
import { ROOM_CATEGORY_SUGGESTIONS } from "../../constants/hotel";

const emptyForm = () => ({
  name: "", description: "", maxAdults: 2, maxChildren: 0, beds: 1, surface: "", unitsAvailable: 1,
});

const ManageRoomCategoriesPage = () => {
  const params = useParams();
  const hotelId = params?.hotelId;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm());

  const load = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const list = await getRoomCategories(hotelId);
      setCategories(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des catégories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [hotelId]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Le nom de la catégorie est requis."); return; }
    try {
      await createRoomCategory(hotelId, {
        name: form.name, description: form.description,
        capacity: { maxAdults: Number(form.maxAdults) || 1, maxChildren: Number(form.maxChildren) || 0 },
        beds: Number(form.beds) || 1,
        surface: form.surface !== "" ? Number(form.surface) : null,
        unitsAvailable: Number(form.unitsAvailable) || 1,
      });
      toast.success("Catégorie créée.");
      setCreating(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la création.");
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat._id);
    setEditForm({
      name: cat.name, description: cat.description || "",
      maxAdults: cat.capacity?.maxAdults ?? 2, maxChildren: cat.capacity?.maxChildren ?? 0,
      beds: cat.beds ?? 1, surface: cat.surface ?? "", unitsAvailable: cat.unitsAvailable ?? 1,
    });
  };

  const handleUpdate = async (id) => {
    try {
      await updateRoomCategory(id, {
        name: editForm.name, description: editForm.description,
        capacity: { maxAdults: Number(editForm.maxAdults) || 1, maxChildren: Number(editForm.maxChildren) || 0 },
        beds: Number(editForm.beds) || 1,
        surface: editForm.surface !== "" ? Number(editForm.surface) : null,
        unitsAvailable: Number(editForm.unitsAvailable) || 1,
      });
      toast.success("Catégorie modifiée.");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement cette catégorie ?")) return;
    try {
      await deleteRoomCategory(id);
      toast.success("Catégorie supprimée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateRoomCategory(id);
      toast.success("Catégorie dupliquée.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la duplication.");
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      if (cat.status === 'actif') await deactivateRoomCategory(cat._id);
      else await activateRoomCategory(cat._id);
      toast.success("Statut mis à jour.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur.");
    }
  };

  if (loading) return <p className="text-center mt-10">Chargement...</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Catégories de chambres</h2>
        <Link href={`/dashboard/hotels/${hotelId}`} className="text-sm text-blue-600 underline">← Retour à l'établissement</Link>
      </div>

      {!creating && (
        <button onClick={() => setCreating(true)} className="mb-4 bg-gold text-white px-3 py-1.5 rounded text-sm">
          + Nouvelle catégorie
        </button>
      )}

      {creating && (
        <div className="bg-gray-50 border rounded p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Nom de la catégorie</label>
            <input list="room-category-suggestions" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              aria-label="Nom de la catégorie" className="w-full p-2 border rounded text-sm" />
            <datalist id="room-category-suggestions">
              {ROOM_CATEGORY_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              aria-label="Description de la catégorie" className="w-full p-2 border rounded text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Adultes max</label>
              <input type="number" min="1" value={form.maxAdults} onChange={(e) => setForm((p) => ({ ...p, maxAdults: e.target.value }))} className="w-full p-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Enfants max</label>
              <input type="number" min="0" value={form.maxChildren} onChange={(e) => setForm((p) => ({ ...p, maxChildren: e.target.value }))} className="w-full p-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Lits</label>
              <input type="number" min="0" value={form.beds} onChange={(e) => setForm((p) => ({ ...p, beds: e.target.value }))} className="w-full p-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Surface (m²)</label>
              <input type="number" min="0" value={form.surface} onChange={(e) => setForm((p) => ({ ...p, surface: e.target.value }))} className="w-full p-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unités disponibles</label>
              <input type="number" min="0" value={form.unitsAvailable} onChange={(e) => setForm((p) => ({ ...p, unitsAvailable: e.target.value }))} className="w-full p-2 border rounded text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Enregistrer</button>
            <button onClick={() => { setCreating(false); setForm(emptyForm()); }} className="text-gray-600 text-sm">Annuler</button>
          </div>
        </div>
      )}

      {categories.length === 0 && !creating && <p className="text-gray-500">Aucune catégorie pour cet hôtel.</p>}

      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat._id} className="border rounded p-4">
            {editingId === cat._id ? (
              <div className="space-y-2">
                <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} aria-label="Nom" className="w-full p-2 border rounded text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(cat._id)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">Enregistrer</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-600 text-sm">Annuler</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{cat.name}</h3>
                    <p className="text-xs text-gray-500">
                      {cat.capacity?.maxAdults || 0} adulte(s) · {cat.beds} lit(s) · {cat.unitsAvailable} unité(s) disponible(s)
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${cat.status === 'actif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {cat.status === 'actif' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => startEdit(cat)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Modifier</button>
                  <Link href={`/dashboard/hotels/${hotelId}/rates?category=${cat._id}`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Tarifs</Link>
                  <button onClick={() => handleDuplicate(cat._id)} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm">Dupliquer</button>
                  <button onClick={() => handleToggleStatus(cat)} className={`px-3 py-1.5 rounded text-sm text-white ${cat.status === 'actif' ? 'bg-gray-600' : 'bg-green-600'}`}>
                    {cat.status === 'actif' ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDelete(cat._id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">Supprimer</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageRoomCategoriesPage;
