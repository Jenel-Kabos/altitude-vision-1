"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    ExternalLink, Loader2, Newspaper, Calendar,
    RefreshCw, Clock, Tag, ArrowRight, BookOpen,
    Building2, CalendarCheck, Briefcase, ChevronRight,
} from "lucide-react";
import { ARTICLES as SITE_ARTICLES_RAW } from "@/lib/data/articlesData";
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';
const GOLD_DARK = '#A0671A';
const RED       = '#D42B2B';

const ICON_MAP = { Building2, CalendarCheck, Briefcase, BookOpen };

// Adapter pour inclure icon React et href vers l'article
const SITE_ARTICLES = SITE_ARTICLES_RAW.map(a => ({
    ...a,
    categoryIcon: ICON_MAP[a.categoryIconName] || BookOpen,
    href: `/actualites/${a.slug}`,
}));

// ─── Skeleton ────────────────────────────────────────────────
const FbSkeleton = () => (
    <div className="animate-pulse bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-40 bg-gray-200" />
        <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200" />
                <div className="h-3 bg-gray-200 rounded-full w-1/3" />
            </div>
            <div className="h-3 bg-gray-100 rounded-full w-full" />
            <div className="h-3 bg-gray-100 rounded-full w-5/6" />
            <div className="h-3 bg-gray-100 rounded-full w-3/4" />
        </div>
    </div>
);

// ─── Page ────────────────────────────────────────────────────
const ActualitesPage = () => {
    const [fbPosts,     setFbPosts]     = useState([]);
    const [fbLoading,   setFbLoading]   = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeArticle, setActiveArticle] = useState(SITE_ARTICLES[0]);

    const fetchFb = async () => {
        setFbLoading(true);
        try {
            const res  = await fetch(`${API_URL}/facebook-posts/actus`);
            const data = await res.json();
            if (data.success) { setFbPosts(data.data); setLastUpdated(new Date()); }
        } catch { /* silencieux */ }
        finally { setFbLoading(false); }
    };

    useEffect(() => { fetchFb(); }, []);

    const fmtDate  = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmtHeure = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-16 px-4 overflow-hidden"
                style={{ background: '#F8F8F8', borderBottom: '1px solid rgba(17,24,39,0.07)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${BLUE}30, transparent)` }} />

                <div className="container mx-auto max-w-6xl relative z-10">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border mb-6"
                            style={{ backgroundColor: `${BLUE}10`, borderColor: `${BLUE}25`, color: BLUE }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: BLUE }} />
                            Blog & Actualités
                        </div>
                        <h1 className="mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2.2rem,5vw,4rem)', fontWeight: 700, lineHeight: 1.1, color: '#111827' }}>
                            Actualités
                        </h1>
                        <div className="h-0.5 w-12 rounded-full mb-4"
                            style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                        <p className="max-w-xl text-base leading-relaxed" style={{ color: '#6B7280' }}>
                            Nos dernières publications, actualités des pôles et fils d'actualité Facebook
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* ── Corps : layout 2 colonnes ─────────────────────── */}
            <section className="py-12 px-4 sm:px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">

                        {/* ════ COLONNE GAUCHE — Articles du site ════ */}
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <BookOpen className="w-5 h-5" style={{ color: GOLD }} />
                                <h2 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'DM Sans',sans-serif" }}>
                                    Articles & Analyses
                                </h2>
                            </div>

                            {/* Article principal mis en avant */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-3xl border overflow-hidden mb-5 group cursor-pointer hover:shadow-lg transition-all duration-300"
                                style={{ borderColor: 'rgba(0,0,0,0.07)' }}
                                onClick={() => setActiveArticle(SITE_ARTICLES[0])}>
                                <div className="relative h-64 overflow-hidden">
                                    <Image src={SITE_ARTICLES[0].image} alt={SITE_ARTICLES[0].title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0"
                                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />
                                    <div className="absolute top-4 left-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
                                            style={{ backgroundColor: SITE_ARTICLES[0].categoryColor }}>
                                            {React.createElement(SITE_ARTICLES[0].categoryIcon, { className: "w-3 h-3" })}
                                            {SITE_ARTICLES[0].category}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-4 left-5 right-5">
                                        <h3 className="text-white font-bold text-xl leading-tight"
                                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                                            {SITE_ARTICLES[0].title}
                                        </h3>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{fmtDate(SITE_ARTICLES[0].date)}</span>
                                        <span>·</span>
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{SITE_ARTICLES[0].readTime} de lecture</span>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                                        {SITE_ARTICLES[0].excerpt}
                                    </p>
                                    <Link href={SITE_ARTICLES[0].href}
                                        className="inline-flex items-center gap-2 text-sm font-semibold transition-all"
                                        style={{ color: SITE_ARTICLES[0].categoryColor }}>
                                        Lire la suite <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.div>

                            {/* Grille 3 articles secondaires */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {SITE_ARTICLES.slice(1).map((article, i) => {
                                    const Icon = article.categoryIcon;
                                    return (
                                        <motion.div key={article.id}
                                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 + i * 0.08 }}
                                            className="bg-white rounded-2xl border overflow-hidden group hover:shadow-md transition-all duration-300"
                                            style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                            <div className="relative h-36 overflow-hidden">
                                                <Image src={article.image} alt={article.title}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, 33vw"
                                                    className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                                <div className="absolute inset-0"
                                                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)' }} />
                                                <div className="absolute top-2.5 left-2.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                                                        style={{ backgroundColor: article.categoryColor }}>
                                                        <Icon className="w-2.5 h-2.5" />
                                                        {article.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {fmtDate(article.date)}
                                                </p>
                                                <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">
                                                    {article.title}
                                                </h3>
                                                <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2">
                                                    {article.excerpt}
                                                </p>
                                                <Link href={article.href}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold"
                                                    style={{ color: article.categoryColor }}>
                                                    Lire <ChevronRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ════ COLONNE DROITE — Fil Facebook ════ */}
                        <div className="lg:sticky lg:top-24">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-black"
                                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                                        f
                                    </div>
                                    <h2 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'DM Sans',sans-serif" }}>
                                        Facebook
                                    </h2>
                                </div>
                                <motion.button onClick={fetchFb} disabled={fbLoading}
                                    whileHover={{ scale: fbLoading ? 1 : 1.05 }} whileTap={{ scale: 0.97 }}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50"
                                    style={{ color: BLUE, borderColor: `${BLUE}30`, backgroundColor: `${BLUE}08` }}>
                                    <RefreshCw className={`w-3 h-3 ${fbLoading ? 'animate-spin' : ''}`} />
                                    Actualiser
                                </motion.button>
                            </div>

                            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1"
                                style={{ scrollbarWidth: 'thin' }}>

                                {/* Skeleton */}
                                {fbLoading && [1, 2, 3].map(i => <FbSkeleton key={i} />)}

                                {/* Posts */}
                                {!fbLoading && fbPosts.length > 0 && (
                                    <AnimatePresence>
                                        {fbPosts.map((post, i) => (
                                            <motion.article key={post._id}
                                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.06 }}
                                                className="group bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all duration-300"
                                                style={{ borderColor: 'rgba(0,0,0,0.07)' }}>

                                                {post.image && (
                                                    <div className="relative h-40 overflow-hidden">
                                                        <Image src={post.image} alt="Publication Facebook"
                                                            fill unoptimized
                                                            sizes="(max-width: 768px) 100vw, 25vw"
                                                            className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                                    </div>
                                                )}

                                                <div className="p-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
                                                            style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                                                            f
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-900">{post.page_name}</p>
                                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                <Calendar className="w-2.5 h-2.5" />
                                                                {fmtDate(post.date_publication)}
                                                                <span>·</span>
                                                                {fmtHeure(post.date_publication)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <p className="text-gray-700 text-xs leading-relaxed mb-3 line-clamp-4 whitespace-pre-line">
                                                        {post.message}
                                                    </p>

                                                    {post.permalink && (
                                                        <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                                                            style={{ color: BLUE, backgroundColor: `${BLUE}10`, border: `1px solid ${BLUE}20` }}
                                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${BLUE}20`; }}
                                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${BLUE}10`; }}>
                                                            Voir sur Facebook
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </motion.article>
                                        ))}
                                    </AnimatePresence>
                                )}

                                {/* Vide */}
                                {!fbLoading && fbPosts.length === 0 && (
                                    <div className="text-center py-12 rounded-2xl border border-dashed"
                                        style={{ borderColor: `${BLUE}25` }}>
                                        <Newspaper className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm text-gray-500">Aucune publication récente</p>
                                    </div>
                                )}

                                {lastUpdated && !fbLoading && (
                                    <p className="text-center text-xs text-gray-400 pt-2">
                                        MàJ : {lastUpdated.toLocaleTimeString('fr-FR')}
                                    </p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
};

export default ActualitesPage;
