import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getPropertyById } from '../services/propertyService';
import {
  ArrowLeft, MapPin, Tag, Check, Bed, Bath,
  Sofa, UtensilsCrossed, Maximize2, MessageSquare,
  Phone, Clock, Scale, ChevronLeft, ChevronRight,
} from 'lucide-react';
import CommentList from '../components/comments/CommentList';
import SEOHead from '../components/SEOHead';

// ─── Design tokens ─────────────────────────────────────────────
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';
const GOLD_PALE = 'rgba(200,135,42,0.08)';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';

const BACKEND_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://altitude-vision.onrender.com';

const PLACEHOLDER = 'https://placehold.co/800x600/F0EDE8/9C8B7A?text=Altitude+Vision';

const buildImageUrl = (path) => {
  if (!path) return PLACEHOLDER;
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}/${path.replace(/^\//, '')}`;
};

const optimizeCloudinaryUrl = (url, width = 1200) => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('/f_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
};

const priceFormatter = new Intl.NumberFormat('fr-CG', {
  style: 'currency', currency: 'XAF', maximumFractionDigits: 0,
});

/* ═══════════════════════════════════════════════════════════════
   CSS — Mobile-first, luxury real estate
   
   Breakpoints :
   • < 640px   : mobile (1 colonne, galerie compacte)
   • 640–1023px: tablette (sidebar sous le contenu, galerie médium)  
   • ≥ 1024px  : desktop (grille 2 cols, sidebar sticky)

   Philosophie :
   - Chaque valeur de taille fixe est remplacée par un clamp()
   - Les grilles s'adaptent de 1 → 2 → multi colonnes
   - La sidebar passe dessus du contenu sur mobile (prix visible immédiatement)
   - Typographie : minimum 14px corps, 28px+ titres sur mobile
═══════════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap');

  /* ── Reset & Root ── */
  .pdp-root {
    font-family: 'Jost', sans-serif;
    background: ${CREAM};
    min-height: 100vh;
    color: ${INK};
  }

  /* ── Barre nav sticky ── */
  .pdp-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(250,248,245,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(200,135,42,0.12);
  }
  .pdp-nav-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 24px);
    height: clamp(52px, 7vw, 60px);
    display: flex; align-items: center; gap: 10px;
    overflow: hidden;
  }
  .pdp-nav-back {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.62rem, 1.5vw, 0.68rem);
    font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
    color: ${INK_SOFT}; text-decoration: none; transition: color 0.2s;
    white-space: nowrap; flex-shrink: 0;
  }
  .pdp-nav-back:hover { color: ${GOLD}; }
  .pdp-nav-sep { color: rgba(200,135,42,0.3); font-size: 12px; flex-shrink: 0; }
  .pdp-nav-title {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.62rem, 1.5vw, 0.68rem);
    color: ${INK_SOFT};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
  }

  /* ── Contenu principal ── */
  .pdp-main {
    max-width: 1200px; margin: 0 auto;
    padding: clamp(20px, 4vw, 36px) clamp(16px, 4vw, 24px) clamp(48px, 8vw, 80px);
  }

  /* ── Hero header ── */
  .pdp-hero-header {
    display: flex; align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap; gap: 14px;
    margin-bottom: clamp(16px, 3vw, 24px);
  }
  .pdp-eyebrow {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.58rem, 1.3vw, 0.62rem);
    font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
    color: ${GOLD}; margin-bottom: 8px;
  }
  .pdp-h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.9rem, 5vw, 3.2rem);
    font-weight: 600; line-height: 1.08; color: ${INK};
    max-width: 680px;
  }
  .pdp-rule {
    width: 40px; height: 1px;
    background: linear-gradient(90deg, ${GOLD}, transparent);
    margin: clamp(8px, 1.5vw, 10px) 0 clamp(10px, 2vw, 16px);
  }
  .pdp-address {
    display: flex; align-items: center; gap: 6px;
    color: ${INK_SOFT}; font-size: clamp(0.80rem, 2vw, 0.85rem);
  }
  .pdp-badges {
    display: flex; gap: 8px; flex-wrap: wrap;
    align-items: flex-start; padding-top: 4px;
  }

  /* ── GALERIE ── */
  .pdp-gallery-wrap {
    border-radius: 2px; overflow: hidden; position: relative;
    margin-bottom: clamp(20px, 4vw, 28px);
  }
  .pdp-main-img-wrap {
    position: relative; overflow: hidden;
    /* Hauteur adaptative : 56vw sur mobile (ratio ~16:9), plafonnée à 520px */
    height: clamp(220px, 56vw, 520px);
  }
  .pdp-main-img {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
    transition: transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94);
    cursor: zoom-in;
  }
  .pdp-gallery-wrap:hover .pdp-main-img { transform: scale(1.03); }

  /* Overlay infos en bas de l'image */
  .pdp-img-overlay-bl {
    position: absolute; bottom: clamp(8px, 2vw, 14px); left: clamp(8px, 2vw, 14px);
  }
  .pdp-img-counter {
    padding: clamp(3px, 0.6vw, 5px) clamp(8px, 1.5vw, 12px);
    border-radius: 1px;
    background: rgba(26,22,18,0.65); backdrop-filter: blur(8px);
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.58rem, 1.2vw, 0.62rem);
    font-weight: 500; letter-spacing: 0.14em; color: rgba(255,255,255,0.85);
  }
  .pdp-img-zoom-hint {
    position: absolute; top: clamp(8px, 1.5vw, 12px); right: clamp(8px, 1.5vw, 12px);
    padding: clamp(3px, 0.5vw, 4px) clamp(8px, 1.5vw, 10px); border-radius: 1px;
    background: rgba(26,22,18,0.55); backdrop-filter: blur(6px);
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.52rem, 1vw, 0.56rem); font-weight: 600; letter-spacing: 0.18em;
    color: rgba(255,255,255,0.7); pointer-events: none;
  }
  .pdp-img-price-badge {
    position: absolute;
    bottom: clamp(8px, 2vw, 14px); right: clamp(8px, 2vw, 14px);
    padding: clamp(6px, 1.2vw, 8px) clamp(10px, 2vw, 16px); border-radius: 1px;
    background: rgba(26,22,18,0.82); backdrop-filter: blur(10px);
    border: 1px solid rgba(200,135,42,0.38);
  }
  .pdp-img-price-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.1rem, 3vw, 1.5rem);
    font-weight: 600; color: #fff; line-height: 1;
  }

  /* Flèches galerie */
  .pdp-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    /* Cible tactile 44px minimum */
    width: clamp(36px, 5vw, 44px); height: clamp(36px, 5vw, 44px);
    background: rgba(26,22,18,0.55); border: 1px solid rgba(200,135,42,0.25);
    backdrop-filter: blur(8px); color: #fff; cursor: pointer; border-radius: 1px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.25s, background 0.2s;
  }
  .pdp-gallery-wrap:hover .pdp-arrow { opacity: 1; }
  .pdp-arrow:hover { background: rgba(200,135,42,0.55); }
  .pdp-arrow-left  { left: clamp(8px, 1.5vw, 16px); }
  .pdp-arrow-right { right: clamp(8px, 1.5vw, 16px); }
  /* Sur mobile : flèches toujours visibles (pas de hover) */
  @media (hover: none) {
    .pdp-arrow { opacity: 1; }
  }

  /* Strip thumbnails */
  .pdp-strip {
    display: flex; gap: 3px; margin-top: 3px;
    height: clamp(56px, 10vw, 72px); overflow-x: auto; overflow-y: hidden;
    scrollbar-width: none;
  }
  .pdp-strip::-webkit-scrollbar { display: none; }
  .pdp-thumb {
    flex: 0 0 auto;
    /* Largeur adaptative : au moins 80px, max 120px */
    width: clamp(72px, 15vw, 120px);
    height: 100%;
    object-fit: cover; cursor: pointer; border-radius: 1px;
    transition: filter 0.2s, transform 0.2s;
    filter: saturate(0.6) brightness(0.88);
  }
  .pdp-thumb:hover { filter: saturate(1) brightness(1); }
  .pdp-thumb.active {
    filter: saturate(1) brightness(1);
    outline: 2px solid ${GOLD}; outline-offset: -2px;
  }

  /* ── GRILLE PRINCIPALE : contenu + sidebar ── */
  .pdp-layout {
    display: grid;
    /* Mobile : 1 colonne — sidebar EN PREMIER via order */
    grid-template-columns: 1fr;
    gap: clamp(20px, 4vw, 32px);
    align-items: start;
  }
  @media (min-width: 1024px) {
    .pdp-layout { grid-template-columns: 1fr 340px; }
  }

  /* Sidebar : en premier sur mobile (prix visible immédiatement) */
  .pdp-sidebar-col { order: -1; }
  @media (min-width: 1024px) { .pdp-sidebar-col { order: 0; } }

  /* ── CARDS contenu ── */
  .pdp-card {
    background: #FDFCFA;
    border: 1px solid rgba(200,135,42,0.14);
    border-radius: 2px;
    padding: clamp(18px, 4vw, 32px);
    margin-bottom: clamp(14px, 3vw, 22px);
  }
  .pdp-card:last-child { margin-bottom: 0; }
  .pdp-card-title {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.3vw, 0.68rem);
    font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;
    color: ${GOLD}; margin-bottom: clamp(14px, 3vw, 20px);
    display: flex; align-items: center; gap: 10px;
  }
  .pdp-card-title::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, rgba(200,135,42,0.28), transparent);
  }

  /* ── STATS (caractéristiques) ── */
  .pdp-stats-grid {
    display: grid;
    /* Mobile : 2 colonnes ; ≥ 480px : auto-fill */
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(8px, 2vw, 12px);
  }
  @media (min-width: 480px) {
    .pdp-stats-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  }

  .pdp-stat {
    display: flex; align-items: center; gap: clamp(8px, 1.5vw, 12px);
    padding: clamp(10px, 2vw, 14px) clamp(10px, 2vw, 18px);
    border: 1px solid rgba(200,135,42,0.14); border-radius: 2px;
    background: ${CREAM}; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .pdp-stat:hover {
    border-color: rgba(200,135,42,0.35);
    box-shadow: 0 4px 16px rgba(200,135,42,0.08);
  }
  .pdp-stat-icon {
    width: clamp(30px, 5vw, 38px); height: clamp(30px, 5vw, 38px);
    display: flex; align-items: center; justify-content: center;
    background: ${GOLD_PALE}; border: 1px solid rgba(200,135,42,0.15);
    border-radius: 1px; flex-shrink: 0;
  }
  .pdp-stat-val {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.1rem, 3vw, 1.4rem);
    font-weight: 600; color: ${INK}; line-height: 1;
  }
  .pdp-stat-lbl {
    font-size: clamp(0.60rem, 1.2vw, 0.68rem); font-weight: 500;
    letter-spacing: 0.08em; color: ${INK_SOFT}; text-transform: uppercase; margin-top: 2px;
  }

  /* ── DESCRIPTION ── */
  .pdp-desc {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.88rem, 2vw, 0.95rem);
    line-height: 1.82; color: ${INK_MID}; white-space: pre-wrap;
  }

  /* ── INFO ROWS ── */
  .pdp-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: clamp(10px, 2vw, 14px) 0;
    border-bottom: 1px solid rgba(26,22,18,0.05); gap: 12px;
  }
  .pdp-row:last-child { border-bottom: none; }
  .pdp-row-label {
    font-size: clamp(0.62rem, 1.3vw, 0.70rem); font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: ${INK_SOFT}; flex-shrink: 0;
  }
  .pdp-row-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1rem, 2.5vw, 1.05rem); font-weight: 500;
    color: ${INK}; text-align: right;
  }

  /* ── AMENITY TAGS ── */
  .pdp-tags-wrap { display: flex; flex-wrap: wrap; gap: clamp(6px, 1.2vw, 8px); }
  .pdp-tag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(6px, 1.2vw, 7px) clamp(10px, 2vw, 14px);
    border: 1px solid rgba(200,135,42,0.2); border-radius: 1px;
    font-size: clamp(0.62rem, 1.3vw, 0.68rem); font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: ${INK_MID}; background: transparent;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
  }
  .pdp-tag:hover { border-color: ${GOLD}; color: ${GOLD}; background: ${GOLD_PALE}; }

  /* ── SIDEBAR ── */
  .pdp-sidebar {
    background: ${INK}; border-radius: 2px; overflow: hidden;
  }
  @media (min-width: 1024px) {
    .pdp-sidebar { position: sticky; top: clamp(60px, 8vw, 72px); }
  }

  .pdp-sidebar-price {
    padding: clamp(20px, 4vw, 32px) clamp(18px, 4vw, 28px) clamp(16px, 3vw, 24px);
    border-bottom: 1px solid rgba(200,135,42,0.2);
  }
  .pdp-sidebar-price-label {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.52rem, 1.1vw, 0.56rem); font-weight: 600;
    letter-spacing: 0.25em; text-transform: uppercase;
    color: rgba(200,135,42,0.6); margin-bottom: 8px;
  }
  .pdp-sidebar-price-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    font-weight: 600; color: #fff; line-height: 1;
  }
  .pdp-sidebar-badges {
    display: flex; gap: 8px; margin-top: clamp(10px, 2vw, 16px); flex-wrap: wrap;
  }
  .pdp-sidebar-badge {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.58rem, 1.1vw, 0.62rem); font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: clamp(3px, 0.6vw, 4px) clamp(8px, 1.5vw, 10px);
    border-radius: 1px;
  }

  .pdp-sidebar-body {
    padding: clamp(18px, 4vw, 28px);
  }
  .pdp-sidebar-intro {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.05rem, 2.5vw, 1.25rem); font-weight: 500;
    color: #fff; margin-bottom: 5px;
  }
  .pdp-sidebar-sub {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.78rem); line-height: 1.65;
    color: rgba(255,255,255,0.42); margin-bottom: clamp(16px, 3vw, 22px);
  }

  /* CTA WhatsApp */
  .pdp-cta-wa {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: clamp(13px, 2.5vw, 16px);
    background: linear-gradient(135deg, #166534, #16A34A); color: #fff;
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 600; letter-spacing: 0.06em;
    border: none; cursor: pointer; border-radius: 1px;
    transition: opacity 0.2s, transform 0.15s; text-decoration: none; margin-bottom: 10px;
  }
  .pdp-cta-wa:hover { opacity: 0.9; transform: translateY(-1px); }

  /* CTA Téléphone */
  .pdp-cta-tel {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: clamp(11px, 2.2vw, 14px);
    background: transparent; color: rgba(200,135,42,0.9);
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 500; letter-spacing: 0.08em;
    border: 1px solid rgba(200,135,42,0.3); cursor: pointer; border-radius: 1px;
    transition: border-color 0.2s, color 0.2s; text-decoration: none;
  }
  .pdp-cta-tel:hover { border-color: ${GOLD}; color: ${GOLD}; }

  /* Reassurance items */
  .pdp-reassurance {
    margin-top: clamp(16px, 3vw, 24px);
    padding-top: clamp(14px, 2.5vw, 20px);
    border-top: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column; gap: clamp(10px, 2vw, 14px);
  }
  .pdp-reassurance-item {
    display: flex; align-items: flex-start; gap: 10px;
  }
  .pdp-reassurance-icon {
    width: clamp(24px, 3.5vw, 28px); height: clamp(24px, 3.5vw, 28px);
    border-radius: 1px; border: 1px solid rgba(200,135,42,0.2);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pdp-reassurance-text {
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.74rem, 1.5vw, 0.78rem); line-height: 1.6;
    color: rgba(255,255,255,0.36);
  }

  /* ── BADGES ── */
  .pdp-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(4px, 0.8vw, 5px) clamp(10px, 2vw, 12px);
    border: 1px solid rgba(200,135,42,0.3); color: ${GOLD};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.58rem, 1.1vw, 0.62rem); font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    border-radius: 1px; background: ${GOLD_PALE};
  }
  .pdp-badge-avail-yes {
    border-color: rgba(22,163,74,0.3); color: #16A34A; background: rgba(22,163,74,0.06);
  }
  .pdp-badge-avail-no {
    border-color: rgba(220,38,38,0.3); color: #DC2626; background: rgba(220,38,38,0.06);
  }

  /* ── SKELETON ── */
  .pdp-skel {
    animation: pdp-pulse 1.6s ease-in-out infinite;
    background: #EDE9E3; border-radius: 2px;
  }
  @keyframes pdp-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }

  /* ── LIGHTBOX ── */
  .pdp-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(10,8,6,0.97);
    display: flex; align-items: center; justify-content: center;
    padding: clamp(12px, 3vw, 24px);
  }
  .pdp-lightbox-img {
    max-width: 90vw; max-height: 82vh;
    object-fit: contain; border-radius: 2px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6);
  }
  .pdp-lightbox-close {
    position: fixed; top: clamp(12px, 2.5vw, 20px); right: clamp(12px, 2.5vw, 20px);
    width: clamp(36px, 5vw, 40px); height: clamp(36px, 5vw, 40px); border-radius: 1px;
    background: rgba(250,248,245,0.08); border: 1px solid rgba(200,135,42,0.25);
    color: rgba(255,255,255,0.7); font-size: 20px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .pdp-lightbox-close:hover { background: rgba(200,135,42,0.25); }
  .pdp-lightbox-counter {
    position: fixed; bottom: clamp(14px, 3vw, 24px); left: 50%; transform: translateX(-50%);
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.2vw, 0.68rem); font-weight: 500; letter-spacing: 0.2em;
    color: rgba(255,255,255,0.42);
  }
  .pdp-lightbox-arrow {
    position: fixed; top: 50%; transform: translateY(-50%);
    width: clamp(40px, 5vw, 44px); height: clamp(40px, 5vw, 44px); border-radius: 1px;
    background: rgba(26,22,18,0.6); backdrop-filter: blur(8px);
    border: 1px solid rgba(200,135,42,0.2);
    color: #fff; cursor: pointer; font-size: 22px;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.2s;
  }
  .pdp-lightbox-arrow:hover { border-color: ${GOLD}; }
  .pdp-lightbox-arrow-l { left: clamp(8px, 2vw, 16px); }
  .pdp-lightbox-arrow-r { right: clamp(8px, 2vw, 16px); }
  .pdp-lightbox-strip {
    position: fixed; bottom: clamp(40px, 7vw, 60px); left: 50%; transform: translateX(-50%);
    display: flex; gap: 5px; padding: clamp(6px, 1.2vw, 8px) clamp(10px, 2vw, 12px);
    background: rgba(26,22,18,0.72); backdrop-filter: blur(10px);
    border-radius: 2px; border: 1px solid rgba(200,135,42,0.15);
    max-width: 90vw; overflow-x: auto; scrollbar-width: none;
  }
  .pdp-lightbox-strip::-webkit-scrollbar { display: none; }
  .pdp-lightbox-thumb {
    width: clamp(44px, 8vw, 56px); height: clamp(30px, 5vw, 38px);
    object-fit: cover; border-radius: 1px; cursor: pointer; flex-shrink: 0;
    transition: opacity 0.2s, outline 0.2s;
  }
`;

let _stylesInjected = false;
const injectStyles = () => {
  if (_stylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = STYLES;
  document.head.appendChild(s);
  _stylesInjected = true;
};

// ─── Skeleton ─────────────────────────────────────────────────
const DetailSkeleton = () => (
  <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
    <div className="pdp-skel" style={{ height:28, width:'45%' }} />
    <div className="pdp-skel" style={{ height:14, width:'28%' }} />
    <div className="pdp-skel" style={{ height:'min(56vw, 420px)' }} />
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      {[1,2,3,4].map(i=><div key={i} className="pdp-skel" style={{ height:80 }} />)}
    </div>
  </div>
);

// ─── Composant principal ───────────────────────────────────────
const PropertyDetailPage = () => {
  injectStyles();
  const { propertyId }  = useParams();
  const [property,  setProperty]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [mainIdx,   setMainIdx]   = useState(0);
  const [lightbox,  setLightbox]  = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPropertyById(propertyId);
        setProperty(data);
      } catch {
        setError("Impossible de charger les détails de l'annonce.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId]);

  useEffect(() => {
    if (lightbox === false) return;
    document.body.style.overflow = 'hidden';
    const len = property?.images?.length || 1;
    const onKey = (e) => {
      if (e.key === 'Escape')      setLightbox(false);
      if (e.key === 'ArrowRight')  setLightbox(i => (i + 1) % len);
      if (e.key === 'ArrowLeft')   setLightbox(i => (i - 1 + len) % len);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [lightbox, property]);

  if (loading) return (
    <div className="pdp-root">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'clamp(20px,4vw,48px) clamp(16px,4vw,24px)' }}>
        <DetailSkeleton />
      </div>
    </div>
  );

  if (error || !property) return (
    <div className="pdp-root" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh', padding:'24px' }}>
      <div style={{ textAlign:'center', padding:40 }}>
        <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'clamp(1.5rem,4vw,1.75rem)', color:INK, marginBottom:8 }}>
          Annonce introuvable
        </p>
        <p style={{ color:INK_SOFT, fontSize:'clamp(0.82rem,2vw,0.88rem)', marginBottom:24 }}>{error}</p>
        <Link to="/altimmo/annonces" style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'12px 24px', background:INK, color:'#fff',
          fontFamily:"'Jost', sans-serif", fontSize:'clamp(0.68rem,1.5vw,0.75rem)',
          letterSpacing:'0.15em', textTransform:'uppercase',
          textDecoration:'none', borderRadius:1,
        }}>
          <ArrowLeft size={14} /> Retour aux annonces
        </Link>
      </div>
    </div>
  );

  const images = Array.isArray(property.images) && property.images.length > 0 ? property.images : [];
  const mainImage = images.length > 0 ? optimizeCloudinaryUrl(buildImageUrl(images[mainIdx]), 1200) : PLACEHOLDER;
  const displayAddress = property.address
    ? [property.address.street, property.address.district, property.address.city].filter(Boolean).join(' — ')
    : 'Adresse non disponible';

  const stats = [
    { Icon: Bed,             label: 'Chambres',       value: property.bedrooms    || 0 },
    { Icon: Bath,            label: 'Salles de bain',  value: property.bathrooms  || 0 },
    { Icon: Sofa,            label: 'Salons',          value: property.livingRooms || 0 },
    { Icon: UtensilsCrossed, label: 'Cuisines',        value: property.kitchens   || 0 },
    { Icon: Maximize2,       label: 'Surface',         value: `${property.surface || 0} m²` },
  ].filter(s => s.value && s.value !== 0 && s.value !== '0 m²');

  const infoRows = [
    { label: 'Type de bien',  value: property.type             || '—' },
    { label: 'Construction',  value: property.constructionType || '—' },
    { label: 'Statut',        value: property.status           || '—' },
    { label: 'Disponibilité', value: property.availability     || '—' },
  ];

  const prevImg = () => setMainIdx(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setMainIdx(i => (i + 1) % images.length);
  const isAvail = property.availability === 'Disponible';

  return (
    <div className="pdp-root">
      <SEOHead
        title={property.title}
        description={`${property.type || 'Bien'} à ${property.address?.city || 'Brazzaville'} — ${property.description?.slice(0, 120)}…`}
        image={optimizeCloudinaryUrl(property.images?.[0], 800)}
        url={`/properties/${property._id}`}
        type="property"
        data={property}
        breadcrumb={[
          { name:'Accueil', path:'/' },
          { name:'Altimmo', path:'/altimmo' },
          { name:property.title, path:`/properties/${property._id}` },
        ]}
      />

      {/* ── Nav ── */}
      <div className="pdp-nav">
        <div className="pdp-nav-inner">
          <Link to="/altimmo/annonces" className="pdp-nav-back">
            <ArrowLeft size={12} /> Annonces
          </Link>
          <span className="pdp-nav-sep">—</span>
          <span className="pdp-nav-title">{property.title}</span>
        </div>
      </div>

      <div className="pdp-main">

        {/* ── Hero header ── */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}>
          <div className="pdp-hero-header">
            <div>
              <p className="pdp-eyebrow">Altitude-Vision · Altimmo</p>
              <h1 className="pdp-h1">{property.title || 'Bien immobilier'}</h1>
              <div className="pdp-rule" />
              <div className="pdp-address">
                <MapPin size={12} style={{ color:GOLD, flexShrink:0 }} />
                {displayAddress}
              </div>
            </div>
            <div className="pdp-badges">
              <span className="pdp-badge">
                <Tag size={10} /> En {property.status || 'vente'}
              </span>
              {property.availability && (
                <span className={`pdp-badge ${isAvail ? 'pdp-badge-avail-yes' : 'pdp-badge-avail-no'}`}>
                  {property.availability}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Galerie ── */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08, duration:0.5, ease:[0.22,1,0.36,1] }}>
          {images.length > 0 ? (
            <div className="pdp-gallery-wrap">
              <div className="pdp-main-img-wrap">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={mainIdx}
                    src={mainImage}
                    alt="Vue principale"
                    className="pdp-main-img"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    transition={{ duration:0.3 }}
                    onError={e=>{ e.target.src=PLACEHOLDER; }}
                    onClick={() => setLightbox(mainIdx)}
                  />
                </AnimatePresence>

                {/* Hint zoom */}
                <div className="pdp-img-zoom-hint">AGRANDIR</div>

                {/* Compteur */}
                <div className="pdp-img-overlay-bl">
                  <span className="pdp-img-counter">{mainIdx + 1} / {images.length}</span>
                </div>

                {/* Prix */}
                <div className="pdp-img-price-badge">
                  <p className="pdp-img-price-value">{priceFormatter.format(property.price || 0)}</p>
                </div>

                {/* Flèches */}
                {images.length > 1 && (
                  <>
                    <button className="pdp-arrow pdp-arrow-left" onClick={prevImg} aria-label="Image précédente">
                      <ChevronLeft size={16} />
                    </button>
                    <button className="pdp-arrow pdp-arrow-right" onClick={nextImg} aria-label="Image suivante">
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>

              {/* Strip thumbnails */}
              {images.length > 1 && (
                <div className="pdp-strip">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={optimizeCloudinaryUrl(buildImageUrl(img), 200)}
                      alt={`Vue ${i + 1}`}
                      className={`pdp-thumb${i === mainIdx ? ' active' : ''}`}
                      onClick={() => setMainIdx(i)}
                      onError={e=>{ e.target.src=PLACEHOLDER; }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              height:'clamp(180px,40vw,240px)', borderRadius:2,
              border:'1px dashed rgba(200,135,42,0.25)', background:GOLD_PALE,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:10, color:INK_SOFT,
              marginBottom:'clamp(20px,4vw,28px)',
            }}>
              <MapPin size={24} style={{ opacity:0.3 }} />
              <p style={{ fontFamily:"'Jost', sans-serif", fontSize:'clamp(0.62rem,1.3vw,0.68rem)', letterSpacing:'0.12em' }}>
                AUCUNE IMAGE
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Grille principale : contenu + sidebar ── */}
        <div className="pdp-layout">

          {/* ── Colonne contenu ── */}
          <div>
            {/* Caractéristiques */}
            {stats.length > 0 && (
              <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15, duration:0.5 }}
                className="pdp-card">
                <div className="pdp-card-title">Caractéristiques</div>
                <div className="pdp-stats-grid">
                  {stats.map(({ Icon, label, value }, i) => (
                    <div key={i} className="pdp-stat">
                      <div className="pdp-stat-icon">
                        <Icon size={14} color={GOLD} />
                      </div>
                      <div>
                        <div className="pdp-stat-val">{value}</div>
                        <div className="pdp-stat-lbl">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Description */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Description</div>
              <p className="pdp-desc">
                {property.description || 'Aucune description disponible pour ce bien.'}
              </p>
            </motion.div>

            {/* Informations */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Informations</div>
              {infoRows.map(({ label, value }) => (
                <div key={label} className="pdp-row">
                  <span className="pdp-row-label">{label}</span>
                  <span className="pdp-row-value">{value}</span>
                </div>
              ))}
            </motion.div>

            {/* Équipements */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Équipements & Commodités</div>
              {Array.isArray(property.amenities) && property.amenities.length > 0 ? (
                <div className="pdp-tags-wrap">
                  {property.amenities.map((a, i) => (
                    <span key={i} className="pdp-tag">
                      <Check size={10} color={GOLD} /> {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color:INK_SOFT, fontSize:'clamp(0.80rem,1.8vw,0.85rem)', fontStyle:'italic' }}>
                  Aucun équipement spécifié.
                </p>
              )}
            </motion.div>

            {/* Commentaires */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35, duration:0.5 }}>
              <CommentList targetType="Property" targetId={property._id} />
            </motion.div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="pdp-sidebar-col">
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5 }}
              className="pdp-sidebar">

              {/* Prix */}
              <div className="pdp-sidebar-price">
                <p className="pdp-sidebar-price-label">Prix du bien</p>
                <p className="pdp-sidebar-price-value">
                  {priceFormatter.format(property.price || 0)}
                </p>
                <div className="pdp-sidebar-badges">
                  <span className="pdp-sidebar-badge" style={{
                    border:'1px solid rgba(200,135,42,0.3)', color:GOLD,
                  }}>
                    En {property.status || 'vente'}
                  </span>
                  {property.availability && (
                    <span className="pdp-sidebar-badge" style={{
                      border:`1px solid ${isAvail ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.3)'}`,
                      color: isAvail ? '#22C55E' : '#EF4444',
                    }}>
                      {property.availability}
                    </span>
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="pdp-sidebar-body">
                <p className="pdp-sidebar-intro">Intéressé par ce bien ?</p>
                <p className="pdp-sidebar-sub">
                  Contactez notre agent pour organiser une visite.
                </p>

                <a
                  href={`https://wa.me/242068002151?text=Bonjour, je suis intéressé par "${property.title || 'un bien'}" (ID: ${property._id})`}
                  target="_blank" rel="noopener noreferrer"
                  className="pdp-cta-wa">
                  <svg viewBox="0 0 24 24" style={{ width:15, height:15, fill:'#fff', flexShrink:0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Contacter sur WhatsApp
                </a>

                <a href="tel:+242068002151" className="pdp-cta-tel">
                  <Phone size={13} /> +242 06 800 21 51
                </a>

                <div className="pdp-reassurance">
                  {[
                    { Icon: Clock,         text:'Réponse sous 24h garantie' },
                    { Icon: MessageSquare, text:'Visite virtuelle sur demande' },
                    { Icon: Scale,         text:'Accompagnement juridique inclus' },
                  ].map(({ Icon, text }, i) => (
                    <div key={i} className="pdp-reassurance-item">
                      <div className="pdp-reassurance-icon">
                        <Icon size={11} color="rgba(200,135,42,0.7)" />
                      </div>
                      <p className="pdp-reassurance-text">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </aside>

        </div>
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightbox !== false && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.22 }}
            onClick={() => setLightbox(false)}
            className="pdp-lightbox">

            <motion.img
              key={lightbox}
              src={optimizeCloudinaryUrl(buildImageUrl(images[lightbox]), 1600)}
              alt={`Photo ${lightbox + 1}`}
              className="pdp-lightbox-img"
              initial={{ opacity:0, scale:0.94 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0, scale:0.96 }}
              transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}
              onClick={e => e.stopPropagation()}
              onError={e=>{ e.target.src=PLACEHOLDER; }}
            />

            <button onClick={() => setLightbox(false)} className="pdp-lightbox-close">×</button>

            <div className="pdp-lightbox-counter">{lightbox + 1} / {images.length}</div>

            {images.length > 1 && (
              <>
                <button
                  className="pdp-lightbox-arrow pdp-lightbox-arrow-l"
                  onClick={e => { e.stopPropagation(); setLightbox(i => (i - 1 + images.length) % images.length); }}>
                  ‹
                </button>
                <button
                  className="pdp-lightbox-arrow pdp-lightbox-arrow-r"
                  onClick={e => { e.stopPropagation(); setLightbox(i => (i + 1) % images.length); }}>
                  ›
                </button>

                <div className="pdp-lightbox-strip" onClick={e => e.stopPropagation()}>
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={optimizeCloudinaryUrl(buildImageUrl(img), 200)}
                      alt={`Miniature ${i + 1}`}
                      className="pdp-lightbox-thumb"
                      onClick={() => setLightbox(i)}
                      onError={e=>{ e.target.src=PLACEHOLDER; }}
                      style={{
                        outline: i === lightbox ? `2px solid ${GOLD}` : '2px solid transparent',
                        outlineOffset: 1,
                        opacity: i === lightbox ? 1 : 0.48,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PropertyDetailPage;