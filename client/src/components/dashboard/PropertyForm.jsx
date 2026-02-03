import React, { useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Correction icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PropertyForm = ({
  formData,
  setFormData,
  onSubmit,
  loading,
  // Gardés pour la réutilisabilité (ex: page de modification)
  existingImages = [], 
  setExistingImages = () => {},
}) => {
  const fileInputRef = useRef(null);

  // Carte interactive
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        console.log("🗺️ [PropertyForm] Clic sur la carte:", e.latlng);
        setFormData(prev => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }));
      },
    });
    return (
      <Marker
        position={[formData.latitude, formData.longitude]}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const latlng = e.target.getLatLng();
            console.log("🗺️ [PropertyForm] Marqueur déplacé:", latlng);
            setFormData(prev => ({
              ...prev,
              latitude: latlng.lat,
              longitude: latlng.lng
            }));
          },
        }}
      />
    );
  };

  // Fonction pour les champs de premier niveau
  const handleChange = (e) => {
    console.log(`📝 [PropertyForm] Changement ${e.target.name}:`, e.target.value);
    setFormData(prev => ({ 
      ...prev, 
      [e.target.name]: e.target.value 
    }));
  };

  // Fonction pour les champs d'adresse imbriqués
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    console.log(`🏠 [PropertyForm] Changement adresse.${name}:`, value);
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value,
      }
    }));
  };

  // ⭐ CORRECTION CRUCIALE : Gestion des images
  const handleImageChange = (e) => {
    console.log("📸 [PropertyForm] handleImageChange déclenché");
    
    // 1. Convertir la FileList en tableau JavaScript
    const newFiles = Array.from(e.target.files);
    
    // 2. Mettre à jour l'état avec les nouveaux fichiers
    setFormData(prev => {
      const updatedImages = [...prev.images, ...newFiles];
      
      return {
        ...prev,
        images: updatedImages
      };
    });
    
    // 3. Réinitialiser l'input pour permettre la resélection
    e.target.value = null; 
  };

  // Permet de supprimer une nouvelle image avant l'envoi
  const handleRemoveNewImage = (index) => {
    console.log(`🗑️ [PropertyForm] Suppression de l'image ${index}`);
    setFormData(prev => {
      const updatedImages = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: updatedImages
      };
    });
  };

  const handleRemoveExistingImage = (url) => {
    console.log(`🗑️ [PropertyForm] Suppression de l'image existante:`, url);
    setExistingImages(existingImages.filter(img => img !== url));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      
      {/* ------------------ SECTION INFOS DE BASE ------------------ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
        <input 
          name="title" 
          value={formData.title} 
          onChange={handleChange} 
          placeholder="Ex: Appartement moderne à Moungali" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
          required 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea 
          name="description" 
          value={formData.description} 
          onChange={handleChange} 
          placeholder="Décrivez le bien en détail..." 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
          rows={5} 
          required 
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
        <input 
          name="price" 
          type="number" 
          value={formData.price} 
          onChange={handleChange} 
          placeholder="Ex: 150000" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
          required 
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pôle *</label>
          <select 
            name="pole" 
            value={formData.pole} 
            onChange={handleChange} 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            required
          >
            <option value="Altimmo">Altimmo</option>
            <option value="MilaEvents">MilaEvents</option>
            <option value="Altcom">Altcom</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
          <select 
            name="status" 
            value={formData.status} 
            onChange={handleChange} 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="vente">Vendre</option>
            <option value="location">Louer</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilité</label>
        <select 
          name="availability" 
          value={formData.availability} 
          onChange={handleChange} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>Disponible</option>
          <option>Vendu</option>
          <option>Loué</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <input 
          name="type" 
          value={formData.type} 
          onChange={handleChange} 
          placeholder="Ex: Appartement, Villa, Studio" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />
      </div>

      {/* ------------------ SECTION ADRESSE ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Adresse</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quartier *</label>
            <input 
              name="district" 
              value={formData.address.district} 
              onChange={handleAddressChange} 
              placeholder="Ex: Moungali" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
            <input 
              name="street" 
              value={formData.address.street} 
              onChange={handleAddressChange} 
              placeholder="Ex: Avenue de la Paix" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input 
              name="city" 
              value={formData.address.city} 
              onChange={handleAddressChange} 
              placeholder="Brazzaville" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
        </div>
      </div>

      {/* ------------------ SECTION CARACTÉRISTIQUES ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Caractéristiques Détaillées</h3>
        
        {/* Rangée 1: Surface, Chambres, SDB */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
            <input 
              name="surface" 
              type="number" 
              value={formData.surface} 
              onChange={handleChange} 
              placeholder="Ex: 62" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chambres</label>
            <input 
              name="bedrooms" 
              type="number" 
              value={formData.bedrooms} 
              onChange={handleChange} 
              placeholder="Ex: 3" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salles de bain</label>
            <input 
              name="bathrooms" 
              type="number" 
              value={formData.bathrooms} 
              onChange={handleChange} 
              placeholder="Ex: 2" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
        </div>

        {/* Rangée 2: Salons, Cuisines, Type de construction (Nouveaux champs) */}
        <div className="grid grid-cols-3 gap-3">
          {/* ✅ 1. Nombre de salons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salons</label>
            <input 
              name="livingRooms" 
              type="number" 
              value={formData.livingRooms} 
              onChange={handleChange} 
              placeholder="Ex: 1" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          
          {/* ✅ 2. Nombre de cuisines */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuisines</label>
            <input 
              name="kitchens" 
              type="number" 
              value={formData.kitchens} 
              onChange={handleChange} 
              placeholder="Ex: 1" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          {/* ✅ 3. Type de construction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de construction</label>
            <select 
              name="constructionType" 
              value={formData.constructionType} 
              onChange={handleChange} 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            >
              <option value="Béton armé">Béton armé</option>
              <option value="Briques/Parpaings">Briques/Parpaings</option>
              <option value="Bois">Bois</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Équipements</label>
        <input 
          name="amenities" 
          value={formData.amenities} 
          onChange={handleChange} 
          placeholder="Ex: Climatisation, Parking, Wifi (séparés par des virgules)" 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />
        <p className="text-xs text-gray-500 mt-1">Séparez les équipements par des virgules</p>
      </div>

      {/* ------------------ SECTION IMAGES ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Images *</h3>
        
        {/* Images existantes (pour la modification) */}
        {existingImages.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Images existantes:</p>
            <div className="flex flex-wrap gap-3">
              {existingImages.map((img, i) => (
                <div key={i} className="relative w-24 h-24">
                  <img 
                    src={img} 
                    alt={`Image existante ${i}`} 
                    className="object-cover w-full h-full rounded border-2 border-gray-300" 
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveExistingImage(img)} 
                    className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input pour nouvelles images */}
        <div className="mb-4">
          <label className="block">
            <span className="sr-only">Choisir des images</span>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*"
              onChange={handleImageChange} 
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {formData.images.length === 0 
              ? "Veuillez ajouter au moins une image" 
              : `${formData.images.length} image(s) sélectionnée(s)`}
          </p>
        </div>
        
        {/* Prévisualisation des nouvelles images */}
        {formData.images.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Nouvelles images à ajouter:</p>
            <div className="flex flex-wrap gap-3">
              {formData.images.map((file, i) => (
                <div key={i} className="relative w-24 h-24">
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt={`Nouvelle image ${i}`} 
                    className="object-cover w-full h-full rounded border-2 border-green-300" 
                    onLoad={(e) => URL.revokeObjectURL(e.target.src)} 
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveNewImage(i)} 
                    className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                  >
                    ×
                  </button>
                  <p className="text-xs text-center mt-1 truncate w-24">{file.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ------------------ SECTION CARTE ------------------ */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-3">Localisation</h3>
        <p className="text-sm text-gray-600 mb-2">Cliquez sur la carte ou déplacez le marqueur pour définir la position</p>
        <div className="h-64 rounded-lg overflow-hidden border-2 border-gray-300">
          <MapContainer 
            center={[formData.latitude, formData.longitude]} 
            zoom={16} 
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-600">Latitude</label>
            <input 
              type="number" 
              value={formData.latitude} 
              readOnly 
              className="w-full px-2 py-1 text-sm border rounded bg-gray-50" 
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Longitude</label>
            <input 
              type="number" 
              value={formData.longitude} 
              readOnly 
              className="w-full px-2 py-1 text-sm border rounded bg-gray-50" 
            />
          </div>
        </div>
      </div>

      {/* Bouton Submit */}
      <button 
        type="submit" 
        disabled={loading || formData.images.length === 0} 
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
      >
        {loading ? "Sauvegarde en cours..." : "Enregistrer le bien"}
      </button>
      
      {formData.images.length === 0 && (
        <p className="text-sm text-red-600 text-center -mt-2">
          ⚠️ Veuillez ajouter au moins une image avant de soumettre
        </p>
      )}
    </form>
  );
};

export default PropertyForm;