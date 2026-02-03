import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getAllProperties, deleteProperty, updateProperty, addProperty } from "../../services/propertyService";
import { PlusCircle, X, Edit, Trash2, Home, Search, Loader, AlertTriangle, ArrowLeft, ArrowRight, Building2, MapPin, Maximize2, Bed, Bath, Sparkles, Send } from "lucide-react";
import PropertyForm from "../../components/dashboard/PropertyForm";

const PROPERTIES_PER_PAGE = 8;

const ManagePropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });
  
  // ✅ AJOUT : État pour gérer les images existantes
  const [existingImages, setExistingImages] = useState([]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    pole: "Altimmo",
    status: "vente",
    type: "Appartement",
    availability: "Disponible",
    address: { street: "", district: "", city: "Brazzaville" },
    surface: "",
    bedrooms: "",
    bathrooms: "",
    livingRooms: "",
    constructionType: "Béton armé",
    kitchens: "",
    amenities: "", 
    latitude: -4.266, 
    longitude: 15.283,
    images: [],
  });
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => { fetchProperties(); }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = properties.filter((property) =>
        property.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address?.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProperties(filtered);
    } else {
      setFilteredProperties(properties);
    }
    setCurrentPage(1);
  }, [searchTerm, properties]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await getAllProperties();
      setProperties(res);
      setFilteredProperties(res);
    } catch (error) {
      console.error(error);
      showNotification("Erreur lors du chargement des biens.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      price: "",
      pole: "Altimmo",
      status: "vente",
      type: "Appartement",
      availability: "Disponible",
      address: { street: "", district: "", city: "Brazzaville" },
      surface: "",
      bedrooms: "",
      bathrooms: "",
      livingRooms: "",
      constructionType: "Béton armé",
      kitchens: "",
      amenities: "", 
      latitude: -4.266, 
      longitude: 15.283,
      images: [],
    });
    setExistingImages([]); // ✅ Réinitialiser aussi les images existantes
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingId(null);
  };

  const handleEdit = (property) => {
    setEditingId(property._id);
    
    const amenitiesStr = Array.isArray(property.amenities) 
      ? property.amenities.join(", ") 
      : "";
    
    // ✅ CORRECTION : Stocker les images existantes dans un état séparé
    setExistingImages(property.images || []);
    
    setFormData({
      title: property.title || "",
      description: property.description || "",
      price: property.price || "",
      pole: property.pole || "Altimmo",
      status: property.status || "vente",
      type: property.type || "Appartement",
      availability: property.availability || "Disponible",
      address: property.address || { street: "", district: "", city: "Brazzaville" },
      surface: property.surface || "",
      bedrooms: property.bedrooms || "",
      bathrooms: property.bathrooms || "",
      livingRooms: property.livingRooms || "",
      constructionType: property.constructionType || "Béton armé",
      kitchens: property.kitchens || "",
      amenities: amenitiesStr,
      latitude: property.location?.coordinates?.[1] || -4.266,
      longitude: property.location?.coordinates?.[0] || 15.283,
      images: [], // ✅ Garder vide pour les nouvelles images à ajouter
    });
    
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingSubmit(true);

    try {
      // ✅ CORRECTION : Validation adaptée pour la modification
      if (!editingId && (!formData.images || formData.images.length === 0)) {
        showNotification("Veuillez ajouter au moins une image", "error");
        setLoadingSubmit(false);
        return;
      }

      const data = new FormData();
      const { address, amenities, images, latitude, longitude, ...otherFields } = formData;
      
      Object.entries(otherFields).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          data.append(key, value);
        }
      });
      
      data.append('latitude', latitude);
      data.append('longitude', longitude);
      data.append("address", JSON.stringify(address));

      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(",").map(a => a.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      
      data.append("amenities", JSON.stringify(amenitiesArray));

      // ✅ Ajouter les nouvelles images
      if (images && images.length > 0) {
        images.forEach((file) => {
          if (file instanceof File) {
            data.append("images", file);
          }
        });
      }

      // ✅ AJOUT : Envoyer les images existantes à conserver
      if (editingId && existingImages.length > 0) {
        data.append("existingImages", JSON.stringify(existingImages));
      }

      const locationData = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      data.append("location", JSON.stringify(locationData));
      
      let response;
      if (editingId) {
        response = await updateProperty(editingId, data);
        setProperties(properties.map(p => p._id === editingId ? response : p));
        showNotification("Bien modifié avec succès !");
      } else {
        response = await addProperty(data);
        fetchProperties();
        showNotification("Bien ajouté avec succès !");
      }
      
      resetForm();
      
    } catch (err) {
      console.error("❌ Erreur:", err);
      const errorMessage = 
        err.response?.data?.message || 
        err.message || 
        `Erreur lors de ${editingId ? "la modification" : "l'ajout"} du bien.`; 
      
      showNotification(errorMessage, "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmState({
      isOpen: true,
      message: `Êtes-vous sûr de vouloir supprimer ce bien ?`,
      onConfirm: async () => {
        try {
          await deleteProperty(id);
          setProperties(properties.filter((p) => p._id !== id));
          showNotification("Bien supprimé !");
          setConfirmState({ isOpen: false, message: '', onConfirm: () => {} });
        } catch (error) {
          console.error(error);
          showNotification("Erreur lors de la suppression.", "error");
          setConfirmState({ isOpen: false, message: '', onConfirm: () => {} });
        }
      },
    });
  };

  const totalPages = Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE);
  const startIndex = (currentPage - 1) * PROPERTIES_PER_PAGE;
  const currentProperties = filteredProperties.slice(startIndex, startIndex + PROPERTIES_PER_PAGE);

  const ConfirmDialog = () => {
    if (!confirmState.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmation Requise</h3>
          <p className="text-gray-600 text-center mb-6">{confirmState.message}</p>
          <div className="flex gap-4 w-full">
            <button
              onClick={() => setConfirmState({ isOpen: false, message: '', onConfirm: () => {} })}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmState.onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PropertyCard = ({ property }) => {
    const firstImage = property.images?.[0] || 'https://placehold.co/600x400/3B82F6/FFFFFF?text=Altimmo';

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group animate-slideUp">
        <div className="relative h-48 overflow-hidden">
          <img
            src={firstImage}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
            onError={(e) => { e.target.src = 'https://placehold.co/600x400/3B82F6/FFFFFF?text=Altimmo'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <span className="absolute top-2 left-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {property.type || 'Bien'}
          </span>
          <span className="absolute top-2 right-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {property.status || 'Vente'}
          </span>
          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {property.price} FCFA
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1">{property.title}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{property.description}</p>

          <div className="space-y-2 text-sm text-gray-500 mb-4">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-red-500" />
              <span className="line-clamp-1">{property.address?.city || 'Non spécifié'}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <Maximize2 className="w-4 h-4 mr-1 text-blue-500" />
                <span>{property.surface} m²</span>
              </div>
              <div className="flex items-center">
                <Bed className="w-4 h-4 mr-1 text-indigo-500" />
                <span>{property.bedrooms}</span>
              </div>
              <div className="flex items-center">
                <Bath className="w-4 h-4 mr-1 text-cyan-500" />
                <span>{property.bathrooms}</span>
              </div>
            </div>
          </div>

          {property.amenities && property.amenities.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {property.amenities.slice(0, 3).map((amenity, idx) => (
                <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                  {amenity}
                </span>
              ))}
              {property.amenities.length > 3 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  +{property.amenities.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(property)}
              className="flex-1 p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg flex items-center justify-center"
              title="Modifier"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(property._id)}
              className="flex-1 p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg flex items-center justify-center"
              title="Supprimer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">Chargement des biens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-4 sm:p-10 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>

      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white animate-slideUp ${
          notification.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-pink-600'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-slideUp">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                  Gestion des Biens
                </h1>
                <p className="text-lg text-gray-600 font-medium mt-1">
                  Gérez le patrimoine immobilier de <span className="font-bold text-blue-600">Altimmo</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un bien..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 hover:scale-105 hover:shadow-xl"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {currentProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full shadow-md text-blue-600">
                <Home className="w-12 h-12" />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucun bien trouvé</p>
            <p className="text-sm text-gray-500">Cliquez sur <span className="font-semibold text-blue-600">Ajouter</span> pour créer le premier.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {currentProperties.map((property) => (
                <PropertyCard key={property._id} property={property} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      page === currentPage 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-10 max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-20 rounded-t-2xl backdrop-blur-sm bg-white/95">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    Ajouter un nouveau bien
                  </h2>
                  <button
                    onClick={resetForm}
                    disabled={loadingSubmit}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-grow">
                <PropertyForm
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  loading={loadingSubmit}
                />
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-10 max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-20 rounded-t-2xl backdrop-blur-sm bg-white/95">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
                    <Edit className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    Modifier le bien
                  </h2>
                  <button
                    onClick={resetForm}
                    disabled={loadingSubmit}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-grow">
                {/* ✅ CORRECTION : Passer les props existingImages et setExistingImages */}
                <PropertyForm
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  loading={loadingSubmit}
                  existingImages={existingImages}
                  setExistingImages={setExistingImages}
                />
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
};

export default ManagePropertiesPage;