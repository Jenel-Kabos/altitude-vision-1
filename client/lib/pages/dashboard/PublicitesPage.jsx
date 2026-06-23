"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  PlusCircle, X, Edit, Trash2, Megaphone, Search, Loader2,
  AlertTriangle, Eye, EyeOff, Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getAllPublicites, createPublicite, updatePublicite, deletePublicite,
  uploadToCloudinary,
} from "../../services/publiciteService";

const POLES = ["Altimmo", "MilaEvents", "Altcom"];

const emptyForm = {
  titre: "",
  media: "",
  type:  "image",
  lien:  "",
  actif: true,
  ordre: 0,
  pole:  "Altimmo",
};

const PublicitesPage = () => {
  const { user } = useAuth();

  const [publicites, setPublicites]       = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [searchTerm, setSearchTerm]       = useState("");
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [notification, setNotif]          = useState({ show: false, message: "", type: "success" });
  const [confirmState, setConfirm]        = useState({ isOpen: false, message: "", onConfirm: () => {} });
  const [loadingSubmit, setSubmit]        = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    setFiltered(
      searchTerm
        ? publicites.filter(p => p.titre?.toLowerCase().includes(searchTerm.toLowerCase()))
        : publicites
    );
  }, [searchTerm, publicites]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getAllPublicites();
      setPublicites(res);
    } catch {
      showNotif("Erreur lors du chargement des publicités.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotif = (message, type = "success") => {
    setNotif({ show: true, message, type });
    setTimeout(() => setNotif({ show: false, message: "", type: "success" }), 4000);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setFile(null);
    setPreview(null);
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingId(null);
  };

  const handleEdit = (pub) => {
    setEditingId(pub._id);
    setFormData({
      titre: pub.titre || "",
      media: pub.media || "",
      type:  pub.type  || "image",
      lien:  pub.lien  || "",
      actif: pub.actif !== false,
      ordre: pub.ordre ?? 0,
      pole:  pub.pole  || "Altimmo",
    });
    setFile(null);
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmit(true);
    try {
      let mediaUrl = formData.media;
      if (file) {
        mediaUrl = await uploadToCloudinary(file);
      }
      if (!mediaUrl) {
        showNotif("Veuillez sélectionner une image.", "error");
        setSubmit(false);
        return;
      }
      const payload = { ...formData, media: mediaUrl, ordre: Number(formData.ordre) || 0 };

      if (editingId) {
        const updated = await updatePublicite(editingId, payload);
        setPublicites(arr => arr.map(p => p._id === editingId ? updated : p));
        showNotif("Publicité modifiée !");
      } else {
        const created = await createPublicite(payload);
        setPublicites(arr => [...arr, created]);
        showNotif("Publicité ajoutée !");
      }
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement";
      showNotif(msg, "error");
    } finally {
      setSubmit(false);
    }
  };

  const handleToggleActif = async (pub) => {
    try {
      const updated = await updatePublicite(pub._id, { actif: !pub.actif });
      setPublicites(arr => arr.map(p => p._id === pub._id ? updated : p));
    } catch {
      showNotif("Erreur lors du basculement actif/inactif", "error");
    }
  };

  const handleOrdreBlur = async (pub, newValue) => {
    const v = Number(newValue);
    if (Number.isNaN(v) || v === pub.ordre) return;
    try {
      const updated = await updatePublicite(pub._id, { ordre: v });
      setPublicites(arr => arr.map(p => p._id === pub._id ? updated : p));
    } catch {
      showNotif("Erreur lors de la mise à jour de l'ordre", "error");
    }
  };

  const handleDelete = (id) => {
    setConfirm({
      isOpen: true,
      message: "Êtes-vous sûr de vouloir supprimer cette publicité ?",
      onConfirm: async () => {
        try {
          await deletePublicite(id);
          setPublicites(arr => arr.filter(p => p._id !== id));
          showNotif("Publicité supprimée !");
        } catch {
          showNotif("Erreur lors de la suppression", "error");
        } finally {
          setConfirm({ isOpen: false, message: "", onConfirm: () => {} });
        }
      },
    });
  };

  if (user && user.role !== "Admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">Accès réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">Chargement des publicités…</p>
        </div>
      </div>
    );
  }

  const ConfirmDialog = () => {
    if (!confirmState.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmation Requise</h3>
          <p className="text-gray-600 text-center mb-6">{confirmState.message}</p>
          <div className="flex gap-4 w-full">
            <button onClick={() => setConfirm({ isOpen: false, message: "", onConfirm: () => {} })}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">Annuler</button>
            <button onClick={confirmState.onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition shadow-md">Confirmer</button>
          </div>
        </div>
      </div>
    );
  };

  const PubliciteCard = ({ pub }) => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 animate-slideUp flex flex-col">
      <div className="relative h-40 bg-gray-100">
        {pub.media ? (
          <Image src={pub.media} alt={pub.titre} fill className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <Megaphone className="w-10 h-10" />
          </div>
        )}
        <button onClick={() => handleToggleActif(pub)}
          className={`absolute top-2 right-2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-lg transition ${
            pub.actif
              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
              : "bg-gray-400 text-white hover:bg-gray-500"
          }`}>
          {pub.actif ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {pub.actif ? "Actif" : "Inactif"}
        </button>
        <span className="absolute top-2 left-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
          {pub.pole}
        </span>
        {pub.type === "gif" && (
          <span className="absolute bottom-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded">GIF</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1">{pub.titre}</h3>
        {pub.lien ? (
          <a href={pub.lien} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 hover:underline truncate mb-2">{pub.lien}</a>
        ) : (
          <p className="text-xs text-gray-400 mb-2 italic">Sans lien</p>
        )}
        <div className="flex items-center gap-2 mb-3 mt-auto">
          <label className="text-xs text-gray-600 font-medium">Ordre :</label>
          <input
            type="number"
            defaultValue={pub.ordre}
            onBlur={(e) => handleOrdreBlur(pub, e.target.value)}
            className="w-20 px-2 py-1 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleEdit(pub)}
            className="flex-1 p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center" title="Modifier">
            <Edit className="w-5 h-5" />
          </button>
          <button onClick={() => handleDelete(pub._id)}
            className="flex-1 p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-xl transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center" title="Supprimer">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Titre *</label>
        <input type="text" required value={formData.titre}
          onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
          placeholder="Ex : Promotion Noël 2026"
          className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Image / GIF {editingId ? "(laisser vide pour conserver l'actuelle)" : "*"}
        </label>
        <input type="file" accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
        {(preview || formData.media) && (
          <div className="relative w-48 h-32 mt-3 border-2 border-gray-200 rounded-lg overflow-hidden">
            <Image src={preview || formData.media} alt="Aperçu" fill
              className="object-cover" sizes="192px" unoptimized />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Type</label>
          <select value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
            <option value="image">Image</option>
            <option value="gif">GIF</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Pôle</label>
          <select value={formData.pole}
            onChange={(e) => setFormData({ ...formData, pole: e.target.value })}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
            {POLES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Ordre</label>
          <input type="number" value={formData.ordre}
            onChange={(e) => setFormData({ ...formData, ordre: e.target.value })}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-3 bg-gray-50 rounded-lg w-full border-2 border-gray-200 hover:border-blue-500 transition">
            <input type="checkbox" checked={formData.actif}
              onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
              className="w-5 h-5 accent-blue-600" />
            <span className="text-sm font-medium text-gray-700">Active dans le carrousel</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Lien (optionnel)</label>
        <input type="text" value={formData.lien}
          onChange={(e) => setFormData({ ...formData, lien: e.target.value })}
          placeholder="URL ou laisser vide"
          className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
      </div>

      <button type="submit" disabled={loadingSubmit}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-cyan-700 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loadingSubmit ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {loadingSubmit ? "Enregistrement…" : (editingId ? "Mettre à jour" : "Créer la publicité")}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-4 sm:p-10 font-sans">
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn  { animation: fadeIn  0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>

      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white animate-slideUp ${
          notification.type === "success"
            ? "bg-gradient-to-r from-emerald-500 to-green-600"
            : "bg-gradient-to-r from-red-500 to-pink-600"
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-slideUp flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg">
            <Megaphone className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
              Gestion des Publicités
            </h1>
            <p className="text-lg text-gray-600 font-medium mt-1">
              Gérez le carrousel publicitaire de l'application mobile
            </p>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Rechercher une publicité…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
            <button onClick={() => { setFormData(emptyForm); setFile(null); setShowAddModal(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all hover:scale-105">
              <PlusCircle className="w-5 h-5" /> Ajouter
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                <Megaphone className="w-12 h-12" />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucune publicité</p>
            <p className="text-sm text-gray-500">
              Cliquez sur <span className="font-semibold text-blue-600">Ajouter</span> pour créer la première.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {filtered.map(pub => <PubliciteCard key={pub._id} pub={pub} />)}
          </div>
        )}

        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-10 max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white/95 z-20 rounded-t-2xl relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
                    {showEditModal ? <Edit className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {showEditModal ? "Modifier la publicité" : "Nouvelle publicité"}
                  </h2>
                </div>
                <button onClick={resetForm} disabled={loadingSubmit}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-grow">
                {renderForm()}
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
};

export default PublicitesPage;
