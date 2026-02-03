// src/components/PropertyCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    IoBedOutline, 
    IoHomeOutline, 
    IoBuildOutline, 
    IoLocationOutline
} from 'react-icons/io5'; 
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { Calendar, Euro } from 'lucide-react';
import LikeButton from './likes/LikeButton';

const BACKEND_URL = import.meta.env.VITE_API_URL.replace('/api', '');

const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return 'Date invalide';
    }
};

const PropertyCard = ({ property, index = 0, viewMode = 'grid' }) => {
    // Debug: afficher les données de la propriété
    console.log('PropertyCard - property:', property);
    console.log('PropertyCard - amenities:', property.amenities);
    console.log('PropertyCard - amenities type:', typeof property.amenities);
    console.log('PropertyCard - amenities isArray:', Array.isArray(property.amenities));
    
    const priceFormatter = new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 0,
    });

    const imagePath = property.images && property.images.length > 0 ? property.images[0] : null;
    const imageUrl = imagePath
        ? `${BACKEND_URL}/${imagePath.replace(/^\//, '')}`
        : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop';

    const publicationDate = property.createdAt ? formatDate(property.createdAt) : 'N/D';

    const formattedPrice = property.price > 0 ? priceFormatter.format(property.price) : 'Prix sur demande';

    // Gérer l'affichage de la localisation
    const getLocationDisplay = () => {
        if (typeof property.location === 'string') return property.location;
        if (property.address && typeof property.address === 'object') {
            const parts = [];
            if (property.address.street) parts.push(property.address.street);
            if (property.address.district) parts.push(property.address.district);
            if (property.address.city) parts.push(property.address.city);
            if (parts.length > 0) return parts.join(', ');
        }
        if (typeof property.address === 'string') return property.address;
        if (typeof property.city === 'string') return property.city;
        return 'Localisation non spécifiée';
    };

    // Normaliser les amenities en tableau
    const getAmenities = () => {
        if (!property.amenities) return [];
        
        // Si c'est déjà un tableau, le retourner
        if (Array.isArray(property.amenities)) {
            return property.amenities.filter(Boolean); // Filtrer les valeurs vides
        }
        
        // Si c'est une string, la séparer
        if (typeof property.amenities === 'string') {
            return property.amenities
                .split(',')
                .map(a => a.trim())
                .filter(Boolean);
        }
        
        return [];
    };

    const amenitiesList = getAmenities();
    console.log('PropertyCard - amenitiesList après traitement:', amenitiesList);

    // Vue Liste
    if (viewMode === 'list') {
        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
            >
                <Link to={`/altimmo/property/${property._id}`} className="flex flex-col md:flex-row">
                    <div className="relative md:w-1/3 h-64 md:h-auto overflow-hidden">
                        <img
                            src={imageUrl}
                            alt={property.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => {
                                e.target.src = 'https://placehold.co/800x600/3B82F6/FFFFFF?text=Altimmo';
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        
                        {/* Badge Status - Position modernisée */}
                        <div className="absolute top-3 right-3">
                            <span
                                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                                    property.status === 'Vente' 
                                        ? 'bg-blue-500/90 text-white border-blue-400/50' 
                                        : 'bg-emerald-500/90 text-white border-emerald-400/50'
                                } shadow-lg`}
                            >
                                En {property.status || 'Vente'}
                            </span>
                        </div>

                        {/* Prix Badge */}
                        <span className="absolute top-3 left-3 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                            {formattedPrice} FCFA
                        </span>

                        {/* Like Button */}
                        <div className="absolute bottom-4 left-4 z-10">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-white transition-all">
                                <LikeButton 
                                    targetType="Property" 
                                    targetId={property._id} 
                                    size="sm"
                                    showCount={false}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:w-2/3 flex flex-col justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition">
                                {property.title}
                            </h3>
                            <p className="text-gray-600 mb-4 line-clamp-2">{property.description}</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center text-gray-600">
                                <IoLocationOutline className="w-5 h-5 mr-3 text-red-500" />
                                <span>{getLocationDisplay()}</span>
                            </div>
                            
                            <div className="flex gap-6 text-gray-600">
                                {property.bedrooms > 0 && (
                                    <div className="flex items-center">
                                        <IoBedOutline className="w-5 h-5 mr-2 text-blue-500" />
                                        <span className="font-semibold">{property.bedrooms}</span>
                                    </div>
                                )}
                                {property.bathrooms > 0 && (
                                    <div className="flex items-center">
                                        <LuBath className="w-5 h-5 mr-2 text-cyan-500" />
                                        <span className="font-semibold">{property.bathrooms}</span>
                                    </div>
                                )}
                                {property.surface && (
                                    <div className="flex items-center">
                                        <BiArea className="w-5 h-5 mr-2 text-purple-500" />
                                        <span className="font-semibold">{property.surface} m²</span>
                                    </div>
                                )}
                                {property.livingRooms > 0 && (
                                    <div className="flex items-center">
                                        <IoHomeOutline className="w-5 h-5 mr-2 text-green-500" />
                                        <span className="font-semibold">{property.livingRooms}</span>
                                    </div>
                                )}
                            </div>

                            {property.constructionType && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-50 to-blue-50 border border-blue-100">
                                    <IoBuildOutline className="w-4 h-4 text-blue-600"/>
                                    <span className="text-xs font-medium text-gray-700">
                                        {property.constructionType}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Commodités / Amenities */}
                        {amenitiesList.length > 0 && (
                            <div className="mb-4">
                                <div className="flex flex-wrap gap-1.5">
                                    {amenitiesList.slice(0, 4).map((amenity, idx) => (
                                        <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                                            {amenity}
                                        </span>
                                    ))}
                                    {amenitiesList.length > 4 && (
                                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                                            +{amenitiesList.length - 4}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Link>
            </motion.div>
        );
    }

    // Vue Grille (par défaut)
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col"
        >
            <Link to={`/altimmo/property/${property._id}`} className="flex flex-col h-full">
                {/* Image Container */}
                <div className="relative h-64 overflow-hidden">
                    <img 
                        src={imageUrl} 
                        alt={property.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        onError={(e) => {
                            e.target.src = 'https://placehold.co/800x600/3B82F6/FFFFFF?text=Altimmo';
                        }}
                    />
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    
                    {/* Badge Status - Position modernisée */}
                    <div className="absolute top-3 right-3">
                        <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                                property.status === 'Vente' 
                                    ? 'bg-blue-500/90 text-white border-blue-400/50' 
                                    : 'bg-emerald-500/90 text-white border-emerald-400/50'
                            } shadow-lg`}
                        >
                            En {property.status || 'Vente'}
                        </span>
                    </div>

                    {/* Prix Badge */}
                    <span className="absolute bottom-4 left-4 bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1">
                        <Euro className="w-4 h-4" />
                        {formattedPrice} FCFA
                    </span>

                    {/* Like Button */}
                    <div className="absolute top-3 left-3 z-10">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg hover:bg-white transition-all">
                            <LikeButton 
                                targetType="Property" 
                                targetId={property._id} 
                                size="sm"
                                showCount={false}
                            />
                        </div>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-all duration-300 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 bg-white text-blue-600 px-6 py-3 rounded-full font-bold shadow-xl transform scale-90 group-hover:scale-100 transition-all duration-300">
                            Voir les détails →
                        </span>
                    </div>
                </div>

                {/* Content Container */}
                <div className="p-6 flex-1 flex flex-col">
                    
                    {/* Titre et Localisation */}
                    <div className="mb-3">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition">
                            {property.title}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600">
                            <IoLocationOutline className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                            <p className="line-clamp-1">{getLocationDisplay()}</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 mb-4 line-clamp-2 text-sm">{property.description}</p>
                    
                    {/* Séparateur */}
                    <div className="border-t border-gray-100 mb-4"></div>

                    {/* Caractéristiques - Grid compact */}
                    <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                        {property.bedrooms > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50">
                                    <IoBedOutline className="w-4 h-4 text-blue-600"/>
                                </div>
                                <span className="text-gray-600">
                                    <span className="font-semibold text-gray-900">{property.bedrooms}</span> Ch.
                                </span>
                            </div>
                        )}

                        {property.bathrooms > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50">
                                    <LuBath className="w-4 h-4 text-blue-600"/>
                                </div>
                                <span className="text-gray-600">
                                    <span className="font-semibold text-gray-900">{property.bathrooms}</span> SDB
                                </span>
                            </div>
                        )}

                        {property.surface && (
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50">
                                    <BiArea className="w-4 h-4 text-blue-600"/>
                                </div>
                                <span className="text-gray-600">
                                    <span className="font-semibold text-gray-900">{property.surface}</span> m²
                                </span>
                            </div>
                        )}
                        
                        {property.livingRooms > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50">
                                    <IoHomeOutline className="w-4 h-4 text-blue-600"/>
                                </div>
                                <span className="text-gray-600">
                                    <span className="font-semibold text-gray-900">{property.livingRooms}</span> Salon
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Type de Construction */}
                    {property.constructionType && (
                        <div className="mb-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-50 to-blue-50 border border-blue-100">
                                <IoBuildOutline className="w-4 h-4 text-blue-600"/>
                                <span className="text-xs font-medium text-gray-700">
                                    {property.constructionType}
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Footer - Date de publication */}
                    <div className="pt-3 border-t border-gray-100 mt-auto">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Publié le</span>
                            </div>
                            <span className="font-medium text-gray-600">{publicationDate}</span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};

export default PropertyCard;