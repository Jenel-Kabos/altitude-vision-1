import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPropertyById } from '../services/propertyService';
import { 
  IoBedOutline, 
  IoWaterOutline, 
  IoCubeOutline, 
  IoFastFoodOutline, 
  IoLocationOutline,
  IoHomeOutline
} from 'react-icons/io5'; 
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { FaWhatsapp } from 'react-icons/fa';
import { ArrowLeft, MapPin, Tag, Check } from 'lucide-react';
import CommentList from '../components/comments/CommentList';

// ✅ CORRECTION : Vérifier que VITE_API_URL existe avant de l'utiliser
const BACKEND_URL = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace('/api', '') 
    : 'https://altitude-vision.onrender.com';

const buildImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/800x600?text=Image+non+disponible';
  // Gérer les URLs complètes vs relatives
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}/${path.replace(/^\//, '')}`;
};

const PropertyDetailPage = () => {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mainImage, setMainImage] = useState('');

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        const data = await getPropertyById(propertyId);
        setProperty(data);
        
        // ✅ FIX: Vérifier que les images existent et sont un tableau
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          setMainImage(buildImageUrl(data.images[0]));
        } else {
          setMainImage('https://via.placeholder.com/800x600?text=Aucune+image+disponible');
        }
        
        setError('');
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        setError('Impossible de charger les détails de l\'annonce.');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl shadow-lg max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-xl font-semibold text-red-600 mb-4">{error}</p>
          <Link 
            to="/altimmo/annonces" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux annonces
          </Link>
        </div>
      </div>
    );
  }

  if (!property) return null;

  const priceFormatter = new Intl.NumberFormat('fr-CG', { 
    style: 'currency', 
    currency: 'XAF', 
    maximumFractionDigits: 0 
  });

  // ✅ FIX: Gérer les valeurs manquantes avec valeurs par défaut
  const characteristics = [
    { icon: IoBedOutline, label: 'Chambres', value: property.bedrooms || 0 },
    { icon: LuBath, label: 'Salles de bain', value: property.bathrooms || 0 },
    { icon: IoHomeOutline, label: 'Salons', value: property.livingRooms || 0 },
    { icon: IoFastFoodOutline, label: 'Cuisines', value: property.kitchens || 0 },
    { icon: BiArea, label: 'Surface', value: `${property.surface || 0} m²` },
  ];

  // ✅ FIX: Gérer l'adresse manquante
  const displayAddress = property.address 
    ? `${property.address.district || ''}, ${property.address.city || ''}`.replace(/^, |, $/g, '') 
    : 'Adresse non disponible';

  // ✅ FIX: Vérifier que images existe et est un tableau
  const propertyImages = Array.isArray(property.images) ? property.images : [];

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>

      {/* Header avec breadcrumb */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-6">
          <Link 
            to="/altimmo/annonces" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-4 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour aux annonces
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
              {property.title || 'Titre non disponible'}
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                <span className="font-medium">{displayAddress}</span>
              </div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                property.status === 'Vendre' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                <Tag className="w-4 h-4 mr-1.5" />
                En {property.status || 'vente'}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-8 sm:py-12">
        
        {/* Galerie d'images */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-10"
        >
          {propertyImages.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-4">
                <img 
                  src={mainImage} 
                  alt="Vue principale" 
                  className="w-full h-[400px] sm:h-[500px] object-cover rounded-3xl shadow-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/800x600?text=Image+non+disponible';
                  }}
                />
              </div>
              <div className="flex lg:flex-col overflow-x-auto lg:overflow-y-auto gap-3 pb-2 lg:pb-0">
                {propertyImages.map((img, i) => (
                  <img
                    key={i}
                    src={buildImageUrl(img)}
                    alt={`Vue ${i+1}`}
                    className={`w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl cursor-pointer border-2 transition-all duration-300 flex-shrink-0 ${
                      mainImage === buildImageUrl(img) 
                        ? 'border-blue-600 scale-105 shadow-lg' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => setMainImage(buildImageUrl(img))}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150?text=Image+non+disponible';
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full h-[400px] sm:h-[500px] bg-gray-100 rounded-3xl flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Aucune image disponible</p>
              </div>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Contenu principal */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Prix et caractéristiques principales */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="bg-gradient-to-br from-blue-50 to-sky-50 p-6 sm:p-8 rounded-3xl border border-blue-100"
            >
              <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-1">Prix</p>
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                    {priceFormatter.format(property.price || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {characteristics.map((char, index) => (
                  <div key={index} className="bg-white p-4 rounded-2xl border border-blue-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-100">
                        <char.icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{char.value}</p>
                        <p className="text-xs text-gray-500">{char.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                Description
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                {property.description || 'Aucune description disponible pour ce bien.'}
              </p>
            </motion.div>

            {/* Détails supplémentaires */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                Informations Complémentaires
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Type de construction</span>
                  <span className="font-semibold text-gray-900">{property.constructionType || 'Non spécifié'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">Statut</span>
                  <span className="font-semibold text-gray-900 capitalize">{property.status || 'Non spécifié'}</span>
                </div>
              </div>
            </motion.div>

            {/* Équipements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
                Équipements & Commodités
              </h2>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(property.amenities) && property.amenities.length > 0 ? (
                  property.amenities.map((amenity, index) => (
                    <span 
                      key={index} 
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 text-blue-700 rounded-full text-sm font-medium hover:shadow-md transition-all"
                    >
                      <Check className="w-4 h-4" />
                      {amenity}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500">Aucun équipement spécifié.</p>
                )}
              </div>
            </motion.div>

            {/* Commentaires */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <CommentList targetType="Property" targetId={property._id} />
            </motion.div>
          </div>

          {/* Sidebar Contact */}
          <aside className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 sticky top-24"
            >
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Prix du bien</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {priceFormatter.format(property.price || 0)}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Intéressé par ce bien ?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Contactez notre agent immédiatement pour plus d'informations et organiser une visite.
                </p>
              </div>

              <a 
                href={`https://wa.me/242068002151?text=Bonjour, je suis intéressé par le bien "${property.title || 'sans titre'}" (ID: ${property._id})`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold py-4 px-6 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <FaWhatsapp size={22} />
                Contacter sur WhatsApp
              </a>

              <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                  <p>Réponse rapide garantie sous 24h</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                  <p>Visite virtuelle disponible sur demande</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                  <p>Accompagnement juridique inclus</p>
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailPage;