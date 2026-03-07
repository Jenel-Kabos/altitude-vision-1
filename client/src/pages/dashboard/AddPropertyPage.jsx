import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { PlusCircle, Loader2, Home } from 'lucide-react';
import { addProperty } from '../../services/propertyService';
import PropertyForm from '../../components/dashboard/PropertyForm';

const BLUE = '#2E7BB5';

const AddPropertyPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title:            '',
    description:      '',
    price:            '',
    pole:             'Altimmo',
    status:           'vente',
    type:             'Appartement',
    availability:     'Disponible',
    address:          { street: '', district: '', city: 'Brazzaville' },
    surface:          '',
    bedrooms:         '',
    bathrooms:        '',
    livingRooms:      '',
    constructionType: 'Béton armé',
    kitchens:         '',
    amenities:        '',
    latitude:         -4.266,
    longitude:        15.283,
    images:           [],
  });

  const [loading,  setLoading]  = useState(false);
  const [redirect, setRedirect] = useState(false);

  // ── Soumission ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.images || formData.images.length === 0) {
        toast.error('Veuillez ajouter au moins une image.');
        setLoading(false);
        return;
      }

      const data = new FormData();
      const { address, amenities, images, latitude, longitude, ...otherFields } = formData;

      // Champs texte / nombres
      Object.entries(otherFields).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          data.append(key, value);
        }
      });

      // Coordonnées
      data.append('latitude',  latitude);
      data.append('longitude', longitude);

      // Adresse (JSON)
      data.append('address', JSON.stringify(address));

      // Équipements (JSON)
      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(',').map(a => a.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      data.append('amenities', JSON.stringify(amenitiesArray));

      // Fichiers images
      images.forEach(file => { if (file instanceof File) data.append('images', file); });

      // GeoJSON
      data.append('location', JSON.stringify({
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      }));

      await addProperty(data);

      toast.success('Bien ajouté avec succès !');
      setRedirect(true);

    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Erreur lors de l'ajout du bien.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ── Redirection après succès ────────────────────────────────
  useEffect(() => {
    if (!redirect) return;
    const timer = setTimeout(() => navigate('/dashboard/properties'), 1500);
    return () => clearTimeout(timer);
  }, [redirect, navigate]);

  // ── Rendu ───────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      {/* En-tête branded */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${BLUE}18` }}>
          <Home size={20} style={{ color: BLUE }} />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-lg"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Ajouter un nouveau bien
          </h2>
          <p className="text-xs text-gray-400"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Remplissez les informations du bien immobilier
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Bandeau haut */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100"
          style={{ background: '#F8FAFC' }}>
          <PlusCircle size={16} style={{ color: BLUE }} />
          <span className="text-sm font-semibold text-gray-700"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            Nouveau bien — Altimmo
          </span>
        </div>

        <div className="p-6">
          <PropertyForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            loading={loading}
          />

          {/* Indicateur de chargement global si redirection en cours */}
          {redirect && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-400"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              <Loader2 size={15} className="animate-spin" style={{ color: BLUE }} />
              Redirection vers vos propriétés…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPropertyPage;