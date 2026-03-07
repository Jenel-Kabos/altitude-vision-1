import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Loader2, Newspaper, Calendar, RefreshCw, Clock } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://altitude-vision.onrender.com/api";

// ─────────────────────────────────────────────────────────────
// Couleurs Altitude-Vision
// ─────────────────────────────────────────────────────────────
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

// ─────────────────────────────────────────────────────────────
// Skeleton article
// ─────────────────────────────────────────────────────────────
const ArticleSkeleton = () => (
    <div className="animate-pulse bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col sm:flex-row">
        <div className="sm:w-64 h-52 sm:h-auto bg-gray-200 flex-shrink-0" />
        <div className="flex-1 p-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-gray-200 rounded-full w-1/3" />
                    <div className="h-2 bg-gray-100 rounded-full w-1/4" />
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded-full w-full" />
                <div className="h-3 bg-gray-100 rounded-full w-5/6" />
                <div className="h-3 bg-gray-100 rounded-full w-4/6" />
            </div>
            <div className="h-8 bg-gray-100 rounded-full w-40 mt-4" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
const ActualitesPage = () => {
    const [posts,       setPosts]       = useState([]);
    const [isLoading,   setIsLoading]   = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            const res  = await fetch(`${API_URL}/facebook-posts/actus`);
            const data = await res.json();
            if (data.success) {
                setPosts(data.data);
                setLastUpdated(new Date());
            }
        } catch {
            // silencieux en production
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPosts(); }, []);

    const formatDate = (dateStr) =>
        new Date(dateStr).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });

    const formatHeure = (dateStr) =>
        new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ── Hero ─────────────────────────────── */}
            <section className="relative text-white pt-32 pb-20 px-4 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0e1e30 50%, #0D1117 100%)' }}>

                {/* Halos décoratifs */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-12"
                        style={{ background: BLUE }} />
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-[100px] opacity-8"
                        style={{ background: GOLD }} />
                </div>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${BLUE}50, transparent)` }} />

                <div className="container mx-auto max-w-4xl text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}>

                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white border border-white/15 backdrop-blur-sm mb-6"
                            style={{ backgroundColor: `${BLUE}25` }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#90C8F0' }} />
                            Publications Facebook
                        </motion.div>

                        {/* Titre */}
                        <motion.h1
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.7 }}
                            className="text-white mb-4"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   'clamp(2.5rem, 5vw, 4.5rem)',
                                fontWeight: 700, lineHeight: 1.1,
                            }}>
                            Actualités
                        </motion.h1>

                        {/* Ligne déco */}
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: '48px' }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="h-0.5 rounded-full mx-auto mb-4"
                            style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />

                        <motion.p
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-white/60 max-w-xl mx-auto text-base leading-relaxed">
                            Retrouvez toutes nos publications des 5 derniers jours
                        </motion.p>
                    </motion.div>
                </div>
            </section>

            {/* ── Contenu ──────────────────────────── */}
            <section className="py-12 px-4 sm:px-6">
                <div className="container mx-auto max-w-4xl">

                    {/* Barre info + refresh */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" style={{ color: BLUE }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {posts.length > 0
                                    ? <><span className="font-bold text-gray-900">{posts.length}</span> publication{posts.length > 1 ? 's' : ''} sur 5 jours</>
                                    : 'Aucune publication récente'
                                }
                            </span>
                        </div>
                        <motion.button
                            onClick={fetchPosts} disabled={isLoading}
                            whileHover={{ scale: isLoading ? 1 : 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border transition-all disabled:opacity-50"
                            style={{
                                color:       BLUE,
                                borderColor: `${BLUE}30`,
                                backgroundColor: `${BLUE}08`,
                                fontFamily:  "'Outfit', sans-serif",
                            }}>
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Actualiser
                        </motion.button>
                    </div>

                    {/* Skeleton */}
                    {isLoading && (
                        <div className="space-y-5">
                            {[1, 2, 3].map(i => <ArticleSkeleton key={i} />)}
                        </div>
                    )}

                    {/* Liste articles */}
                    {!isLoading && posts.length > 0 && (
                        <motion.div className="space-y-5"
                            initial="hidden" animate="visible"
                            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
                            {posts.map((post) => (
                                <motion.article key={post._id}
                                    variants={{
                                        hidden:   { opacity: 0, y: 20 },
                                        visible:  { opacity: 1, y: 0, transition: { duration: 0.4 } },
                                    }}
                                    className="group bg-white rounded-3xl border overflow-hidden hover:shadow-lg transition-all duration-400"
                                    style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                    <div className="flex flex-col sm:flex-row">

                                        {/* Image */}
                                        {post.image && (
                                            <div className="sm:w-64 h-52 sm:h-auto flex-shrink-0 overflow-hidden relative">
                                                <img src={post.image} alt="Publication"
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                {/* Ligne bleue hover */}
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                    style={{ backgroundColor: BLUE }} />
                                            </div>
                                        )}

                                        {/* Contenu */}
                                        <div className="flex-1 p-6 flex flex-col justify-between">
                                            {/* Header auteur */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-black"
                                                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                                                        f
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900"
                                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                            {post.page_name}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400"
                                                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                            <Calendar className="w-3 h-3" />
                                                            <span>{formatDate(post.date_publication)}</span>
                                                            <span className="text-gray-300">·</span>
                                                            <Clock className="w-3 h-3" />
                                                            <span>{formatHeure(post.date_publication)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Message */}
                                                <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-5 whitespace-pre-line"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                    {post.message}
                                                </p>
                                            </div>

                                            {/* Lien Facebook */}
                                            {post.permalink && (
                                                <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all self-start"
                                                    style={{
                                                        color:           BLUE,
                                                        backgroundColor: `${BLUE}10`,
                                                        border:          `1px solid ${BLUE}20`,
                                                        fontFamily:      "'Outfit', sans-serif",
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${BLUE}18`; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${BLUE}10`; }}>
                                                    Voir la publication originale
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </motion.article>
                            ))}
                        </motion.div>
                    )}

                    {/* État vide */}
                    {!isLoading && posts.length === 0 && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className="text-center py-20 rounded-3xl border border-dashed"
                            style={{ borderColor: `${BLUE}25`, backgroundColor: `${BLUE}03` }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                                <Newspaper className="w-8 h-8 text-white" />
                            </div>
                            <p className="font-bold text-gray-700 text-xl mb-2"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Aucune actualité récente
                            </p>
                            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Aucune publication dans les 5 derniers jours. Revenez bientôt !
                            </p>
                            <motion.button onClick={fetchPosts}
                                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm"
                                style={{
                                    background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow:  `0 4px 16px ${BLUE}30`,
                                    fontFamily: "'Outfit', sans-serif",
                                }}>
                                <RefreshCw className="w-4 h-4" />
                                Réessayer
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Dernière MàJ */}
                    <AnimatePresence>
                        {lastUpdated && !isLoading && (
                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="text-center text-xs text-gray-400 mt-8"
                                style={{ fontFamily: "'Outfit', sans-serif" }}>
                                Dernière mise à jour : {lastUpdated.toLocaleTimeString('fr-FR')}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            </section>
        </div>
    );
};

export default ActualitesPage;