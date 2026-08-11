"use client";

// Sprint B2 — domaine Hôtellerie côté propriétaire. Liste des hôtels du
// propriétaire connecté + création (HotelPropertyForm, scope="owner") +
// actions de cycle de vie (dupliquer/désactiver/supprimer/soumettre).

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  getMyHotels, submitHotel, deactivateHotel, reactivateHotel, duplicateHotel, deleteHotel,
} from "../../services/hotelService";
import { HOTEL_PUBLICATION_STATUSES } from "../../constants/hotel";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import { Archive, BedDouble, Copy, Edit3, Hotel, Send, Trash2 } from "lucide-react";
import { DashboardActionMenu, DashboardBadge, DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from "../../components/dashboard/DashboardUI";

const STATUS_CLASSES = {
  brouillon: "bg-gray-100 text-gray-700",
  soumis: "bg-yellow-100 text-yellow-800",
  publie: "bg-green-100 text-green-800",
  suspendu: "bg-orange-100 text-orange-800",
  rejete: "bg-red-100 text-red-700",
};

const MyHotelsPage = () => {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getMyHotels();
      setHotels(list || []);
    } catch (err) {
      toast.error("Erreur lors du chargement de vos hôtels.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (id) => {
    try {
      await submitHotel(id);
      toast.success("Hôtel soumis pour validation.");
      load();
    } catch (err) {
      const comp = err.response?.data?.completion;
      toast.error(comp ? `Incomplet (${comp.score}%).` : (err.response?.data?.message || "Erreur."));
    }
  };

  const handleToggleActive = async (hotel) => {
    try {
      if (hotel.active === false) { await reactivateHotel(hotel._id); toast.success("Hôtel réactivé."); }
      else { await deactivateHotel(hotel._id); toast.success("Hôtel désactivé."); }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur.");
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateHotel(id);
      toast.success("Hôtel dupliqué en brouillon.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la duplication.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement cet hôtel ? Cette action est irréversible.")) return;
    try {
      await deleteHotel(id);
      toast.success("Hôtel supprimé.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression.");
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement de vos hôtels…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Hotel} title="Mes hôtels" description="Gérez vos établissements, leurs catégories et leurs tarifs."
        actions={!creating && !editingHotel && (
          <button onClick={() => setCreating(true)} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
            + Ajouter un hôtel
          </button>
        )} />

      {creating && (
        <DashboardCard className="mb-6">
          <HotelPropertyForm
            scope="owner"
            onSuccess={() => { setCreating(false); load(); }}
            onCancel={() => setCreating(false)}
          />
        </DashboardCard>
      )}

      {editingHotel && (
        <DashboardCard className="mb-6">
          <HotelPropertyForm
            scope="owner"
            hotelId={editingHotel._id}
            accommodationType={editingHotel.accommodationType || 'hotel'}
            initialProperty={editingHotel.property}
            initialHotel={editingHotel}
            existingImages={editingHotel.property?.images || editingHotel.gallery || []}
            completion={editingHotel.completion}
            onSuccess={() => { setEditingHotel(null); load(); }}
            onCancel={() => setEditingHotel(null)}
          />
        </DashboardCard>
      )}

      {hotels.length === 0 && !creating && !editingHotel && (
        <DashboardState title="Aucun hôtel" description="Ajoutez votre premier établissement pour commencer." />
      )}

      <div className="space-y-3">
        {hotels.map((hotel) => (
          <DashboardCard key={hotel._id}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-semibold">{hotel.name}</h3>
                <p className="text-sm text-gray-500">{hotel.property?.address?.city}</p>
              </div>
              <div className="flex items-center gap-2">
                {hotel.active === false && <DashboardBadge>Désactivé</DashboardBadge>}
                <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_CLASSES[hotel.publicationStatus] || "bg-gray-100"}`}>
                  {HOTEL_PUBLICATION_STATUSES.find((s) => s.value === hotel.publicationStatus)?.label || hotel.publicationStatus}
                </span>
                {hotel.completion && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${hotel.completion.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    Complétude {hotel.completion.score}%
                  </span>
                )}
              </div>
            </div>

            {hotel.publicationStatus === "rejete" && hotel.rejectionReason && (
              <p className="text-red-600 text-sm mt-2">Motif du rejet : {hotel.rejectionReason}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button onClick={() => { setCreating(false); setEditingHotel(hotel); }} className="bg-gold text-white px-3 py-1.5 rounded text-sm">
                Modifier la fiche
              </button>
              <Link href={`/dashboard/hotels/${hotel._id}/room-categories`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
                Catégories
              </Link>
              <DashboardActionMenu label={`Actions pour ${hotel.name}`} items={[
                { label: "Tarifs", icon: BedDouble, href: `/dashboard/hotels/${hotel._id}/rates` },
                (hotel.publicationStatus === "brouillon" || hotel.publicationStatus === "rejete") && { label: "Soumettre pour validation", icon: Send, onSelect: () => handleSubmit(hotel._id) },
                hotel.publicationStatus === "publie" && { label: hotel.active === false ? "Réactiver" : "Désactiver", icon: Archive, onSelect: () => handleToggleActive(hotel) },
                { label: "Dupliquer", icon: Copy, onSelect: () => handleDuplicate(hotel._id) },
                { label: "Modifier", icon: Edit3, onSelect: () => { setCreating(false); setEditingHotel(hotel); } },
                { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => handleDelete(hotel._id) },
              ].filter(Boolean)} />
            </div>
          </DashboardCard>
        ))}
      </div>
    </DashboardPage>
  );
};

export default MyHotelsPage;
