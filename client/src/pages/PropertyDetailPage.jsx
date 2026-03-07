import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPropertyById } from '../services/propertyService';
import {
    ArrowLeft, MapPin, Tag, Check, Bed, Bath,
    Sofa, UtensilsCrossed, Maximize2, MessageSquare,
    Phone, Clock, Scale, ChevronLeft, ChevronRight,
} from 'lucide-react';
import CommentList from '../components/comments/CommentList';

<SEOHead
  title={property.title}
  description={`${property.type || 'Bien'} à ${property.city || 'Brazzaville'} — ${property.description?.slice(0, 120)}…`}
  image={property.images?.[0]}
  url={`/properties/${property._id}`}
  type="property"
  data={property}
  breadcrumb={[
    { name: 'Accueil', path: '/' },
    { name: 'Altimmo', path: '/altimmo' },
    { name: property.title, path: `/properties/${property._id}` },
  ]}
/>

// ─────────────────────────────────────────────────────────────
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

const BACKEND_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : 'https://altitude-vision.onrender.com';

const PLACEHOLDER = 'https://placehold.co/800x600/E5E7EB/9CA3AF?text=Image+non+disponible';

const buildImageUrl = (path) => {
    if (!path) return PLACEHOLDER;
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}/${path.replace(/^\//, '')}`;
};

const priceFormatter = new Intl.NumberFormat('fr-CG', {
    style: 'currency', currency: 'XAF', maximumFractionDigits: 0,
});

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
const DetailSkeleton = () => (
    <div className="animate-pulse" style={{ fontFamily:"'Outfit', sans-serif" }}>
        <div className="h-10 bg-gray-200 rounded-2xl w-2/3 mb-4" />
        <div className="h-5 bg-gray-100 rounded-full w-1/3 mb-8" />
        <div className="h-[420px] bg-gray-200 rounded-3xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="h-40 bg-gray-100 rounded-3xl" />
                <div className="h-32 bg-gray-100 rounded-3xl" />
                <div className="h-24 bg-gray-100 rounded-3xl" />
            </div>
            <div className="h-64 bg-gray-100 rounded-3xl" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
const PropertyDetailPage = () => {
    const { propertyId }  = useParams();
    const [property,     setProperty]  = useState(null);
    const [loading,      setLoading]   = useState(true);
    const [error,        setError]     = useState('');
    const [mainIdx,      setMainIdx]   = useState(0);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const data = await getPropertyById(propertyId);
                setProperty(data);
                setError('');
            } catch {
                setError("Impossible de charger les détails de l'annonce.");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [propertyId]);

    // ── États ─────────────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen bg-gray-50 pt-8" style={{ fontFamily:"'Outfit', sans-serif" }}>
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-12">
                <DetailSkeleton />
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background:`${BLUE}12` }}>
                    <MapPin className="w-7 h-7" style={{ color:BLUE }} />
                </div>
                <p className="font-bold text-gray-800 text-lg mb-2"
                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                    Annonce introuvable
                </p>
                <p className="text-gray-500 text-sm mb-6" style={{ fontFamily:"'Outfit', sans-serif" }}>
                    {error}
                </p>
                <Link to="/altimmo/annonces"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                    style={{ background:`linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily:"'Outfit', sans-serif" }}>
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux annonces
                </Link>
            </div>
        </div>
    );

    if (!property) return null;

    // ── Données ───────────────────────────────────────────────
    const images = Array.isArray(property.images) && property.images.length > 0
        ? property.images : [];
    const mainImage = images.length > 0 ? buildImageUrl(images[mainIdx]) : PLACEHOLDER;

    const displayAddress = property.address
        ? [property.address.district, property.address.city].filter(Boolean).join(', ')
        : 'Adresse non disponible';

    const characteristics = [
        { Icon: Bed,            label: 'Chambres',      value: property.bedrooms    || 0 },
        { Icon: Bath,           label: 'Salles de bain', value: property.bathrooms  || 0 },
        { Icon: Sofa,           label: 'Salons',        value: property.livingRooms || 0 },
        { Icon: UtensilsCrossed,label: 'Cuisines',      value: property.kitchens   || 0 },
        { Icon: Maximize2,      label: 'Surface',       value: `${property.surface || 0} m²` },
    ];

    const prevImg = () => setMainIdx(i => (i - 1 + images.length) % images.length);
    const nextImg = () => setMainIdx(i => (i + 1) % images.length);

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Outfit', sans-serif" }}>

            {/* ── Header / Breadcrumb ───────────────────────── */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-30 backdrop-blur-md">
                <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-4 flex items-center gap-4">
                    <Link to="/altimmo/annonces"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80 group"
                        style={{ color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Annonces
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm text-gray-500 truncate max-w-xs"
                        style={{ fontFamily:"'Outfit', sans-serif" }}>
                        {property.title || 'Détail du bien'}
                    </span>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-8 sm:py-12">

                {/* ── Titre ────────────────────────────────── */}
                <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                    transition={{ duration:0.5 }} className="mb-8">
                    <h1 className="text-gray-900 mb-3"
                        style={{
                            fontFamily:"'Cormorant Garamond', Georgia, serif",
                            fontSize:'clamp(1.8rem, 4vw, 3rem)',
                            fontWeight:700, lineHeight:1.15,
                        }}>
                        {property.title || 'Bien immobilier'}
                    </h1>
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500"
                            style={{ fontFamily:"'Outfit', sans-serif" }}>
                            <MapPin className="w-4 h-4" style={{ color:BLUE }} />
                            {displayAddress}
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold capitalize"
                            style={{
                                backgroundColor: property.status === 'vente' ? `${BLUE}12` : `${GOLD}12`,
                                color:           property.status === 'vente' ? BLUE : GOLD,
                                fontFamily:      "'Outfit', sans-serif",
                            }}>
                            <Tag className="w-3 h-3 inline mr-1" />
                            En {property.status || 'vente'}
                        </span>
                        {property.availability && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold"
                                style={{
                                    backgroundColor: property.availability === 'Disponible' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                                    color:           property.availability === 'Disponible' ? '#16A34A' : '#DC2626',
                                    fontFamily:      "'Outfit', sans-serif",
                                }}>
                                {property.availability}
                            </span>
                        )}
                    </div>
                </motion.div>

                {/* ── Galerie ───────────────────────────────── */}
                <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:0.1, duration:0.5 }} className="mb-10">

                    {images.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                            {/* Image principale */}
                            <div className="lg:col-span-4 relative group rounded-3xl overflow-hidden shadow-md">
                                <img src={mainImage} alt="Vue principale"
                                    className="w-full h-[380px] sm:h-[480px] object-cover"
                                    onError={e => { e.target.src = PLACEHOLDER; }} />
                                {/* Compteur */}
                                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold text-white backdrop-blur-md"
                                    style={{ backgroundColor:'rgba(0,0,0,0.45)', fontFamily:"'Outfit', sans-serif" }}>
                                    {mainIdx + 1} / {images.length}
                                </div>
                                {/* Flèches si plusieurs */}
                                {images.length > 1 && (
                                    <>
                                        <button onClick={prevImg}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                            style={{ backgroundColor:'rgba(0,0,0,0.4)' }}>
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button onClick={nextImg}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                            style={{ backgroundColor:'rgba(0,0,0,0.4)' }}>
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                            {/* Thumbnails */}
                            <div className="flex lg:flex-col overflow-x-auto lg:overflow-y-auto gap-2 pb-1 lg:pb-0 lg:max-h-[480px]">
                                {images.map((img, i) => (
                                    <button key={i} onClick={() => setMainIdx(i)}
                                        className="flex-shrink-0 w-20 h-20 sm:w-full sm:h-24 rounded-2xl overflow-hidden transition-all duration-200"
                                        style={{
                                            border: `2px solid ${i === mainIdx ? BLUE : '#E5E7EB'}`,
                                            transform: i === mainIdx ? 'scale(1.04)' : 'scale(1)',
                                            boxShadow: i === mainIdx ? `0 4px 12px ${BLUE}30` : 'none',
                                        }}>
                                        <img src={buildImageUrl(img)} alt={`Vue ${i+1}`}
                                            className="w-full h-full object-cover"
                                            onError={e => { e.target.src = PLACEHOLDER; }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-[380px] rounded-3xl border border-dashed flex items-center justify-center"
                            style={{ borderColor:`${BLUE}25`, backgroundColor:`${BLUE}03` }}>
                            <div className="text-center">
                                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-400 text-sm" style={{ fontFamily:"'Outfit', sans-serif" }}>
                                    Aucune image disponible
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Contenu principal ─────────────────── */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Prix + Caractéristiques */}
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ delay:0.2, duration:0.5 }}
                            className="rounded-3xl p-6 sm:p-8 border"
                            style={{ backgroundColor:`${BLUE}06`, borderColor:`${BLUE}20` }}>

                            <div className="mb-6">
                                <p className="text-xs font-bold uppercase tracking-widest mb-1"
                                    style={{ color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
                                    Prix
                                </p>
                                <p className="font-bold"
                                    style={{
                                        fontSize:'clamp(1.8rem, 4vw, 2.5rem)',
                                        color:BLUE_DARK,
                                        fontFamily:"'Cormorant Garamond', Georgia, serif",
                                    }}>
                                    {priceFormatter.format(property.price || 0)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {characteristics.map(({ Icon, label, value }, i) => (
                                    <div key={i} className="bg-white rounded-2xl p-4 border flex items-center gap-3 hover:shadow-sm transition-shadow"
                                        style={{ borderColor:`${BLUE}15` }}>
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background:`${BLUE}12` }}>
                                            <Icon className="w-4 h-4" style={{ color:BLUE }} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg leading-none">{value}</p>
                                            <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Description */}
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ delay:0.3, duration:0.5 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                            <h2 className="font-bold text-gray-900 text-xl mb-4 flex items-center gap-2"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                <div className="w-1 h-5 rounded-full" style={{ background:`linear-gradient(to bottom, ${BLUE_DARK}, ${BLUE})` }} />
                                Description
                            </h2>
                            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm sm:text-base"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                {property.description || 'Aucune description disponible pour ce bien.'}
                            </p>
                        </motion.div>

                        {/* Infos complémentaires */}
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ delay:0.35, duration:0.5 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                            <h2 className="font-bold text-gray-900 text-xl mb-4 flex items-center gap-2"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                <div className="w-1 h-5 rounded-full" style={{ background:`linear-gradient(to bottom, ${BLUE_DARK}, ${BLUE})` }} />
                                Informations Complémentaires
                            </h2>
                            <div className="divide-y divide-gray-50">
                                {[
                                    { label:'Type de bien',       value: property.type             || 'Non spécifié' },
                                    { label:'Type de construction',value: property.constructionType || 'Non spécifié' },
                                    { label:'Statut',             value: property.status           || 'Non spécifié' },
                                    { label:'Disponibilité',      value: property.availability     || 'Non spécifié' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between py-3">
                                        <span className="text-sm text-gray-500" style={{ fontFamily:"'Outfit', sans-serif" }}>{label}</span>
                                        <span className="text-sm font-semibold text-gray-900 capitalize" style={{ fontFamily:"'Outfit', sans-serif" }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Équipements */}
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ delay:0.4, duration:0.5 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                            <h2 className="font-bold text-gray-900 text-xl mb-4 flex items-center gap-2"
                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                <div className="w-1 h-5 rounded-full" style={{ background:`linear-gradient(to bottom, ${BLUE_DARK}, ${BLUE})` }} />
                                Équipements & Commodités
                            </h2>
                            {Array.isArray(property.amenities) && property.amenities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map((a, i) => (
                                        <span key={i}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                                            style={{ backgroundColor:`${BLUE}10`, color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
                                            <Check className="w-3 h-3" />
                                            {a}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm" style={{ fontFamily:"'Outfit', sans-serif" }}>
                                    Aucun équipement spécifié.
                                </p>
                            )}
                        </motion.div>

                        {/* Commentaires */}
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ delay:0.45, duration:0.5 }}>
                            <CommentList targetType="Property" targetId={property._id} />
                        </motion.div>
                    </div>

                    {/* ── Sidebar Contact ───────────────────── */}
                    <aside className="lg:col-span-1">
                        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                            transition={{ delay:0.3, duration:0.5 }}
                            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden sticky top-20">

                            {/* Prix sticky */}
                            <div className="px-6 py-5 border-b border-gray-100 text-center"
                                style={{ background:`${BLUE}06` }}>
                                <p className="text-xs font-bold uppercase tracking-widest mb-1"
                                    style={{ color:BLUE, fontFamily:"'Outfit', sans-serif" }}>
                                    Prix du bien
                                </p>
                                <p className="font-bold"
                                    style={{
                                        color:BLUE_DARK, fontSize:'1.8rem',
                                        fontFamily:"'Cormorant Garamond', Georgia, serif",
                                    }}>
                                    {priceFormatter.format(property.price || 0)}
                                </p>
                            </div>

                            <div className="px-6 py-5">
                                <h3 className="font-bold text-gray-900 mb-1"
                                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                                    Intéressé par ce bien ?
                                </h3>
                                <p className="text-xs text-gray-500 mb-5 leading-relaxed"
                                    style={{ fontFamily:"'Outfit', sans-serif" }}>
                                    Contactez notre agent immédiatement pour plus d'informations et organiser une visite.
                                </p>

                                {/* WhatsApp */}
                                <a href={`https://wa.me/242068002151?text=Bonjour, je suis intéressé par le bien "${property.title || 'sans titre'}" (ID: ${property._id})`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-white text-sm mb-3 transition-all hover:opacity-90 hover:scale-[1.02]"
                                    style={{
                                        background:'linear-gradient(135deg, #16A34A, #22C55E)',
                                        boxShadow:'0 4px 16px rgba(34,197,94,0.3)',
                                        fontFamily:"'Outfit', sans-serif",
                                    }}>
                                    {/* WhatsApp SVG inline — évite react-icons */}
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                    Contacter sur WhatsApp
                                </a>

                                {/* Téléphone */}
                                <a href="tel:+242068002151"
                                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl font-semibold text-sm border transition-all hover:opacity-80"
                                    style={{
                                        color:BLUE, borderColor:`${BLUE}25`,
                                        backgroundColor:`${BLUE}08`,
                                        fontFamily:"'Outfit', sans-serif",
                                    }}>
                                    <Phone className="w-4 h-4" />
                                    +242 06 800 21 51
                                </a>

                                {/* Points rassurance */}
                                <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
                                    {[
                                        { Icon:Clock,           text:'Réponse rapide garantie sous 24h' },
                                        { Icon:MessageSquare,   text:'Visite virtuelle disponible sur demande' },
                                        { Icon:Scale,           text:'Accompagnement juridique inclus' },
                                    ].map(({ Icon, text }, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background:`${BLUE}12` }}>
                                                <Icon className="w-2.5 h-2.5" style={{ color:BLUE }} />
                                            </div>
                                            <p className="text-xs text-gray-500 leading-relaxed"
                                                style={{ fontFamily:"'Outfit', sans-serif" }}>
                                                {text}
                                            </p>
                                        </div>
                                    ))}
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