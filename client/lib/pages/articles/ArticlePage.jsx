"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowLeft, Calendar, Clock, Tag, ArrowRight,
    Building2, CalendarCheck, Briefcase, BookOpen, ChevronRight,
} from 'lucide-react';
import { getArticleBySlug, getOtherArticles } from '@/lib/data/articlesData';

const ICON_MAP = { Building2, CalendarCheck, Briefcase, BookOpen };

// ─── Composants de rendu de section ────────────────────────────────────────
const SectionIntro = ({ content }) => (
    <p className="text-lg leading-relaxed text-gray-700 border-l-4 pl-5 py-1 mb-8 italic"
        style={{ borderColor: 'rgba(0,0,0,0.12)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.15rem' }}>
        {content}
    </p>
);

const SectionHeading = ({ content }) => (
    <h2 className="font-bold text-gray-900 mt-10 mb-4"
        style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', lineHeight: 1.3 }}>
        {content}
    </h2>
);

const SectionParagraph = ({ content }) => (
    <p className="text-gray-600 leading-relaxed mb-5"
        style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.97rem' }}>
        {content}
    </p>
);

const SectionStat = ({ label, value, sub, color }) => (
    <div className="my-8 rounded-2xl p-6 text-center border"
        style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}>
        <p className="text-5xl font-black mb-1" style={{ color, fontFamily: "'Outfit', sans-serif" }}>{value}</p>
        <p className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{label}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>{sub}</p>}
    </div>
);

const SectionPullquote = ({ content, author }) => (
    <blockquote className="my-8 relative">
        <div className="absolute -top-3 -left-2 text-6xl leading-none font-serif text-gray-200 select-none">"</div>
        <div className="rounded-2xl px-8 py-6 relative z-10"
            style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)', border: '1px solid rgba(46,123,181,0.12)' }}>
            <p className="text-gray-800 text-lg leading-relaxed italic mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {content}
            </p>
            {author && (
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    — {author}
                </p>
            )}
        </div>
    </blockquote>
);

const SectionList = ({ items }) => (
    <ul className="my-5 space-y-2.5">
        {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-600 text-sm leading-relaxed"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#2E7BB5' }} />
                {item}
            </li>
        ))}
    </ul>
);

function renderSection(section, index, accentColor) {
    switch (section.type) {
        case 'intro':      return <SectionIntro key={index} {...section} />;
        case 'heading':    return <SectionHeading key={index} {...section} />;
        case 'paragraph':  return <SectionParagraph key={index} {...section} />;
        case 'stat':       return <SectionStat key={index} {...section} color={section.color || accentColor} />;
        case 'pullquote':  return <SectionPullquote key={index} {...section} />;
        case 'list':       return <SectionList key={index} {...section} />;
        default:           return null;
    }
}

// ─── Carte d'article lié ──────────────────────────────────────────────────
const RelatedCard = ({ article }) => {
    const Icon = ICON_MAP[article.categoryIconName] || BookOpen;
    return (
        <Link href={`/actualites/${article.slug}`}
            className="group flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                <img src={article.image} alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </div>
            <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-xs font-bold mb-1"
                    style={{ color: article.categoryColor, fontFamily: "'Outfit', sans-serif" }}>
                    <Icon className="w-3 h-3" /> {article.category}
                </span>
                <p className="text-gray-800 text-xs font-semibold leading-snug line-clamp-2 group-hover:text-gray-900"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {article.title}
                </p>
            </div>
        </Link>
    );
};

// ─── Page principale ──────────────────────────────────────────────────────
const ArticlePage = ({ slug }) => {
    const article = getArticleBySlug(slug);
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const el = document.documentElement;
            const scrolled = el.scrollTop;
            const total = el.scrollHeight - el.clientHeight;
            setScrollProgress(total > 0 ? (scrolled / total) * 100 : 0);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!article) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50"
                style={{ fontFamily: "'Outfit', sans-serif" }}>
                <div className="text-center">
                    <p className="text-gray-400 text-5xl mb-4">404</p>
                    <p className="text-gray-600 mb-6">Article introuvable.</p>
                    <Link href="/actualites"
                        className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full text-white"
                        style={{ background: 'linear-gradient(135deg, #1A5A8A, #2E7BB5)' }}>
                        <ArrowLeft className="w-4 h-4" /> Retour aux actualités
                    </Link>
                </div>
            </div>
        );
    }

    const CategoryIcon = ICON_MAP[article.categoryIconName] || BookOpen;
    const related = getOtherArticles(article.id);
    const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ── Barre de progression ──────────────────────────────── */}
            <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-gray-100">
                <motion.div className="h-full origin-left"
                    style={{
                        width: `${scrollProgress}%`,
                        background: `linear-gradient(to right, ${article.categoryColor}, #C8872A)`,
                        transition: 'width 0.1s linear',
                    }}
                />
            </div>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative min-h-[72vh] flex items-end overflow-hidden">
                {/* Image de fond avec parallaxe douce */}
                <div className="absolute inset-0">
                    <img src={article.image} alt={article.title}
                        className="w-full h-full object-cover"
                        style={{ transform: 'scale(1.05)' }} />
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.92) 0%, rgba(5,10,20,0.55) 50%, rgba(5,10,20,0.2) 100%)' }} />
                </div>

                {/* Retour */}
                <div className="absolute top-8 left-6 z-20">
                    <Link href="/actualites"
                        className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors duration-200 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/15"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                        <ArrowLeft className="w-3.5 h-3.5" /> Actualités
                    </Link>
                </div>

                {/* Contenu hero */}
                <div className="relative z-10 container mx-auto max-w-4xl px-6 pb-12 pt-32">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white mb-5"
                            style={{ backgroundColor: article.categoryColor }}>
                            <CategoryIcon className="w-3.5 h-3.5" />
                            {article.category}
                        </span>
                        <h1 className="text-white mb-5"
                            style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize: 'clamp(1.8rem, 4.5vw, 3.2rem)',
                                fontWeight: 700,
                                lineHeight: 1.15,
                            }}>
                            {article.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {fmtDate(article.date)}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {article.readTime} de lecture
                            </span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Corps + Sidebar ───────────────────────────────────── */}
            <section className="py-12 px-4 sm:px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">

                        {/* ── Article body ─────────────────────────────── */}
                        <motion.article
                            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
                            className="bg-white rounded-3xl border p-8 sm:p-10"
                            style={{ borderColor: 'rgba(0,0,0,0.07)' }}>

                            {article.sections.map((section, i) => renderSection(section, i, article.categoryColor))}

                            {/* ── Tags ─────────────────────────────────── */}
                            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-gray-100">
                                <Tag className="w-3.5 h-3.5 text-gray-400 mt-1.5" />
                                {article.tags.map(tag => (
                                    <span key={tag}
                                        className="text-xs font-semibold px-3 py-1 rounded-full border"
                                        style={{ color: article.categoryColor, backgroundColor: `${article.categoryColor}0D`, borderColor: `${article.categoryColor}25`, fontFamily: "'Outfit', sans-serif" }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* ── CTA service ──────────────────────────── */}
                            <motion.div
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                                className="mt-8 rounded-2xl overflow-hidden relative"
                                style={{ background: `linear-gradient(135deg, ${article.categoryColor}18, ${article.categoryColor}06)`, border: `1px solid ${article.categoryColor}25` }}>
                                <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                                    style={{ backgroundColor: article.categoryColor, transform: 'translate(30%, -30%)' }} />
                                <div className="p-7 relative z-10">
                                    <p className="text-xs font-bold uppercase tracking-widest mb-2"
                                        style={{ color: article.categoryColor, fontFamily: "'Outfit', sans-serif" }}>
                                        {article.category}
                                    </p>
                                    <h3 className="font-bold text-gray-900 text-lg mb-1 leading-snug"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        Vous souhaitez en savoir plus ?
                                    </h3>
                                    <p className="text-gray-500 text-sm mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                        Découvrez nos services et commencez votre projet avec nos équipes.
                                    </p>
                                    <Link href={article.servicePage}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                                        style={{ background: `linear-gradient(135deg, ${article.categoryColor}CC, ${article.categoryColor})`, fontFamily: "'Outfit', sans-serif" }}>
                                        {article.serviceLabel}
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.div>
                        </motion.article>

                        {/* ── Sidebar ───────────────────────────────────── */}
                        <aside className="lg:sticky lg:top-24 space-y-6">

                            {/* Info article */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                                className="bg-white rounded-2xl border p-5"
                                style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                <h3 className="font-bold text-gray-900 text-sm mb-4"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    À propos de cet article
                                </h3>
                                <div className="space-y-3 text-sm text-gray-600" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${article.categoryColor}15` }}>
                                            <Calendar className="w-3.5 h-3.5" style={{ color: article.categoryColor }} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">Publié le</p>
                                            <p className="font-medium text-gray-800">{fmtDate(article.date)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${article.categoryColor}15` }}>
                                            <Clock className="w-3.5 h-3.5" style={{ color: article.categoryColor }} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">Temps de lecture</p>
                                            <p className="font-medium text-gray-800">{article.readTime}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${article.categoryColor}15` }}>
                                            <CategoryIcon className="w-3.5 h-3.5" style={{ color: article.categoryColor }} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">Catégorie</p>
                                            <p className="font-medium text-gray-800">{article.category}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Articles liés */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                                className="bg-white rounded-2xl border p-5"
                                style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                <h3 className="font-bold text-gray-900 text-sm mb-4"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    Autres articles
                                </h3>
                                <div className="space-y-1">
                                    {related.map(a => <RelatedCard key={a.id} article={a} />)}
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <Link href="/actualites"
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold"
                                        style={{ color: article.categoryColor, fontFamily: "'Outfit', sans-serif" }}>
                                        Toutes les actualités <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </motion.div>
                        </aside>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ArticlePage;
