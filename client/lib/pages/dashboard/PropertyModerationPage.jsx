"use client";

// src/pages/dashboard/PropertyModerationPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Filter, CheckCircle2, XCircle, Eye, MapPin, Tag } from 'lucide-react';
import toast from '@/lib/utils/toast';
import Image from 'next/image';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState, DashboardToolbar } from '../../components/dashboard/DashboardUI';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}/${url.replace(/\\/g, "/").replace(/^\//, "")}`;
};

const PropertyModerationPage = () => {
  const [properties, setProperties]           = useState([]);
  const [filteredProperties, setFiltered]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedPole, setSelectedPole]       = useState('Tous');
  const [stats, setStats]                     = useState({ total: 0, Altimmo: 0, MilaEvents: 0, Altcom: 0 });

  const poles = ['Tous', 'Altimmo', 'MilaEvents', 'Altcom'];

  const POLE_COLORS = {
    Altimmo:    { bg: 'bg-green-500',  text: 'text-green-600',  light: 'bg-green-50'  },
    MilaEvents: { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50' },
    Altcom:     { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await api.get('/properties/status/pending');
      const props = res.data.data.properties;
      setProperties(props);
      setFiltered(props);
      setStats({
        total:      props.length,
        Altimmo:    props.filter(p => p.pole === 'Altimmo').length,
        MilaEvents: props.filter(p => p.pole === 'MilaEvents').length,
        Altcom:     props.filter(p => p.pole === 'Altcom').length,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Impossible de charger les annonces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  useEffect(() => {
    setFiltered(
      selectedPole === 'Tous'
        ? properties
        : properties.filter(p => p.pole === selectedPole)
    );
  }, [selectedPole, properties]);

  const handleModeration = async (id, action) => {
    try {
      await api.patch(`/properties/admin/${id}/${action}`);
      const updated = properties.filter(p => p._id !== id);
      const removed = properties.find(p => p._id === id);
      setProperties(updated);
      if (removed) {
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          [removed.pole]: prev[removed.pole] - 1,
        }));
      }
      setSelectedProperty(null);
      window.dispatchEvent(new CustomEvent('altitude:dashboard-badges:refresh'));
      toast.success(`Annonce ${action === 'validate' ? 'validée' : 'rejetée'} avec succès !`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Une erreur est survenue.");
    }
  };

  if (loading) return <DashboardState type="loading" title="Chargement des annonces en attente…" />;

  if (error) return <DashboardState type="error" title="Annonces indisponibles" description={error} />;

  if (properties.length === 0) return <DashboardState title="Aucune annonce en attente" description="Toutes les annonces ont été traitées." />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={CheckCircle2} title="Modération des biens immobiliers" description="Examinez et traitez les annonces en attente de validation." />
      <div className="mb-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Total',      value:stats.total,      from:'from-blue-500',   to:'to-blue-600'   },
            { label:'Altimmo',    value:stats.Altimmo,    from:'from-green-500',  to:'to-green-600'  },
            { label:'MilaEvents', value:stats.MilaEvents, from:'from-purple-500', to:'to-purple-600' },
            { label:'Altcom',     value:stats.Altcom,     from:'from-orange-500', to:'to-orange-600' },
          ].map(({ label, value, from, to }) => (
            <div key={label} className={`bg-gradient-to-br ${from} ${to} text-white p-4 rounded-lg shadow`}>
              <p className="text-sm opacity-90">{label}</p>
              <p className="text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <DashboardToolbar>
          <Filter className="text-gray-600" size={20} />
          <span className="text-gray-600 font-medium">Filtrer par pôle :</span>
          {poles.map(pole => (
            <button key={pole} onClick={() => setSelectedPole(pole)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedPole === pole
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              {pole}
              {pole !== 'Tous' && (
                <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs">
                  {stats[pole]}
                </span>
              )}
            </button>
          ))}
        </DashboardToolbar>
      </div>

      {/* Liste */}
      {filteredProperties.length === 0 ? (
        <DashboardState title="Aucune annonce" description={`Aucune annonce ${selectedPole !== 'Tous' ? `pour ${selectedPole} ` : ''}en attente.`} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map(property => {
            const pole = POLE_COLORS[property.pole] || POLE_COLORS.Altimmo;
            return (
              <DashboardCard key={property._id} onClick={() => setSelectedProperty(property)} className="flex flex-col cursor-pointer">
                <div className="relative mb-3 h-48">
                  <Image src={getImageUrl(property.images?.[0]) || '/placeholder.png'} alt={property.title} fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover rounded" />
                  <span className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold text-white ${pole.bg}`}>
                    {property.pole}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">{property.title}</h2>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{property.description}</p>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center text-gray-700">
                    <Tag className="w-4 h-4 mr-2 text-blue-500" />
                    <strong>Type :</strong><span className="ml-1">{property.type}</span>
                  </p>
                  <p className="text-gray-700">
                    <strong>Prix :</strong><span className="ml-1">{property.price?.toLocaleString()} FCFA</span>
                  </p>
                </div>
                <button className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                  <Eye size={18} /> Voir les détails
                </button>
              </DashboardCard>
            );
          })}
        </div>
      )}

      {/* ── Modal Détails ── */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Fermer */}
            <button onClick={() => setSelectedProperty(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-red-600 transition text-xl font-bold">
              &times;
            </button>

            {/* Badge pôle */}
            {(() => {
              const pole = POLE_COLORS[selectedProperty.pole] || POLE_COLORS.Altimmo;
              return (
                <span className={`inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-bold text-white ${pole.bg}`}>
                  {selectedProperty.pole}
                </span>
              );
            })()}

            {/* Titre & description */}
            <h2 className="text-2xl font-bold mb-2 text-gray-900">{selectedProperty.title}</h2>
            <p className="mb-5 text-gray-700 leading-relaxed">{selectedProperty.description}</p>

            {/* Détails — textes lisibles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Colonne gauche */}
              <div className="space-y-3">
                <DetailRow label="Type"   value={selectedProperty.type} />
                <DetailRow label="Statut" value={selectedProperty.status} />
                <DetailRow label="Prix"   value={`${selectedProperty.price?.toLocaleString()} FCFA`} />
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Adresse</span>
                    <p className="text-gray-900 font-medium text-sm mt-0.5">
                      {[selectedProperty.address?.street, selectedProperty.address?.arrondissement, selectedProperty.address?.city]
                        .filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Colonne droite */}
              <div className="space-y-3">
                {selectedProperty.bedrooms  > 0 && <DetailRow label="Chambres"      value={selectedProperty.bedrooms} />}
                {selectedProperty.bathrooms > 0 && <DetailRow label="Salles de bain" value={selectedProperty.bathrooms} />}
                {selectedProperty.surface   > 0 && <DetailRow label="Surface"        value={`${selectedProperty.surface} m²`} />}
                {selectedProperty.livingRooms > 0 && <DetailRow label="Salons"       value={selectedProperty.livingRooms} />}
                {selectedProperty.constructionType && (
                  <DetailRow label="Construction" value={selectedProperty.constructionType} />
                )}
                <div>
                  <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Commodités</span>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">
                    {selectedProperty.amenities?.length > 0
                      ? selectedProperty.amenities.join(', ')
                      : <span className="text-gray-400 italic">Aucune</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Propriétaire */}
            {selectedProperty.owner && (
              <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Propriétaire</p>
                <div className="flex items-center gap-3">
                  {selectedProperty.owner.photo ? (
                    <Image src={selectedProperty.owner.photo} alt={selectedProperty.owner.name}
                      width={40} height={40} unoptimized className="rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {selectedProperty.owner.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{selectedProperty.owner.name}</p>
                    <p className="text-gray-500 text-xs">{selectedProperty.owner.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Images */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 text-lg mb-3">
                Images ({selectedProperty.images?.length || 0})
              </h3>
              {selectedProperty.images?.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedProperty.images.map((img, idx) => (
                    <div key={idx} className="relative h-36">
                      <Image src={getImageUrl(img)} fill
                        alt={`${selectedProperty.title} ${idx + 1}`}
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover rounded-lg shadow hover:shadow-xl transition" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">Aucune image disponible.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 flex-wrap border-t border-gray-100 pt-5">
              <button onClick={() => handleModeration(selectedProperty._id, 'validate')}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow">
                <CheckCircle2 size={18} /> Valider
              </button>
              <button onClick={() => handleModeration(selectedProperty._id, 'reject')}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg transition font-semibold shadow">
                <XCircle size={18} /> Rejeter
              </button>
              <button onClick={() => setSelectedProperty(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2.5 rounded-lg transition font-semibold">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardPage>
  );
};

// ── Composant utilitaire pour une ligne de détail ────────────
const DetailRow = ({ label, value }) => (
  <div>
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
    <p className="text-gray-900 font-semibold text-sm mt-0.5">{value}</p>
  </div>
);

export default PropertyModerationPage;
