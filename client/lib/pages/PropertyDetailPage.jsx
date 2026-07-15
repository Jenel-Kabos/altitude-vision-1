"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const MotionImage = motion.create(Image);
import { getPropertyById, likeProperty, shareProperty } from '../services/propertyService';
import api from '../services/api';
import toast from '@/lib/utils/toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, MapPin, Tag, Check, Bed, Bath,
  Sofa, UtensilsCrossed, Maximize2, MessageSquare,
  Phone, Clock, Scale, ChevronLeft, ChevronRight,
  Heart, Eye, Share2, Percent, ChevronDown, ChevronUp,
  MessageCircle, Calendar, Flag,
} from 'lucide-react';
import CommentList from '../components/comments/CommentList';
import Breadcrumb from '../components/Breadcrumb';
import ContactModal from '../components/ContactModal';
import SignalerAnnonceModal from '../components/SignalerAnnonceModal';

// ─── Design tokens ─────────────────────────────────────────────
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';
const GOLD_PALE = 'rgba(200,150,12,0.08)';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
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
  /* ── Reset & Root ── */
  .pdp-root {
    font-family: var(--font-dm-sans), sans-serif;
    background: ${CREAM};
    min-height: 100vh;
    color: ${INK};
  }

  /* ── Barre nav sticky ── */
  .pdp-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(250,248,245,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(200,150,12,0.12);
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
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.62rem, 1.5vw, 0.68rem);
    font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
    color: ${INK_SOFT}; text-decoration: none; transition: color 0.2s;
    white-space: nowrap; flex-shrink: 0;
  }
  .pdp-nav-back:hover { color: ${GOLD}; }
  .pdp-nav-sep { color: rgba(200,150,12,0.3); font-size: 12px; flex-shrink: 0; }
  .pdp-nav-title {
    font-family: var(--font-dm-sans), sans-serif;
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
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.68rem, 1.3vw, 0.74rem);
    font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
    color: ${GOLD}; margin-bottom: 8px;
  }
  .pdp-h1 {
    font-family: var(--font-cormorant), serif;
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
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.58rem, 1.2vw, 0.62rem);
    font-weight: 500; letter-spacing: 0.14em; color: rgba(255,255,255,0.85);
  }
  .pdp-img-zoom-hint {
    position: absolute; top: clamp(8px, 1.5vw, 12px); right: clamp(8px, 1.5vw, 12px);
    padding: clamp(3px, 0.5vw, 4px) clamp(8px, 1.5vw, 10px); border-radius: 1px;
    background: rgba(26,22,18,0.55); backdrop-filter: blur(6px);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.64rem, 1vw, 0.68rem); font-weight: 600; letter-spacing: 0.18em;
    color: rgba(255,255,255,0.90); pointer-events: none;
  }
  .pdp-img-price-badge {
    position: absolute;
    bottom: clamp(8px, 2vw, 14px); right: clamp(8px, 2vw, 14px);
    padding: clamp(6px, 1.2vw, 8px) clamp(10px, 2vw, 16px); border-radius: 1px;
    background: rgba(26,22,18,0.82); backdrop-filter: blur(10px);
    border: 1px solid rgba(200,150,12,0.38);
  }
  .pdp-img-price-value {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(1.1rem, 3vw, 1.5rem);
    font-weight: 600; color: #fff; line-height: 1;
  }

  /* Flèches galerie */
  .pdp-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    /* Cible tactile 44px minimum */
    width: clamp(36px, 5vw, 44px); height: clamp(36px, 5vw, 44px);
    background: rgba(26,22,18,0.55); border: 1px solid rgba(200,150,12,0.25);
    backdrop-filter: blur(8px); color: #fff; cursor: pointer; border-radius: 1px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.25s, background 0.2s;
  }
  .pdp-gallery-wrap:hover .pdp-arrow { opacity: 1; }
  .pdp-arrow:hover { background: rgba(200,150,12,0.55); }
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
    border: 1px solid rgba(200,150,12,0.14);
    border-radius: 2px;
    padding: clamp(18px, 4vw, 32px);
    margin-bottom: clamp(14px, 3vw, 22px);
  }
  .pdp-card:last-child { margin-bottom: 0; }
  .pdp-card-title {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.60rem, 1.3vw, 0.68rem);
    font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;
    color: ${GOLD}; margin-bottom: clamp(14px, 3vw, 20px);
    display: flex; align-items: center; gap: 10px;
  }
  .pdp-card-title::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, rgba(200,150,12,0.28), transparent);
  }

  /* ── ENGAGEMENT BAR (vues / likes / partages) ── */
  .pdp-engage-bar {
    display: flex; align-items: center; gap: clamp(14px, 3vw, 22px);
    margin-bottom: clamp(12px, 2.5vw, 18px);
    padding: clamp(6px, 1.2vw, 8px) 0;
    border-bottom: 1px solid rgba(200,150,12,0.1);
  }
  .pdp-engage-item {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: clamp(0.72rem, 1.4vw, 0.78rem); color: ${INK_SOFT};
    font-family: var(--font-dm-sans), sans-serif;
  }
  .pdp-engage-btn {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: clamp(0.72rem, 1.4vw, 0.78rem);
    font-family: var(--font-dm-sans), sans-serif;
    background: none; border: none; cursor: pointer;
    padding: 4px 8px; border-radius: 4px;
    transition: background 0.18s, color 0.18s;
  }
  .pdp-engage-btn:hover  { background: rgba(200,150,12,0.07); }
  .pdp-engage-btn.liked  { color: #E53E3E; }
  .pdp-engage-btn.shared { color: ${BLUE}; }
  .pdp-engage-sep { width:1px; height:12px; background: rgba(200,150,12,0.18); flex-shrink:0; }

  /* ── STATS (caractéristiques) — version compacte ── */
  .pdp-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  @media (min-width: 560px) {
    .pdp-stats-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  }

  .pdp-stat {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px;
    border: 1px solid rgba(200,150,12,0.12); border-radius: 2px;
    background: ${CREAM}; transition: border-color 0.2s;
  }
  .pdp-stat:hover { border-color: rgba(200,150,12,0.30); }
  .pdp-stat-icon {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: ${GOLD_PALE}; border: 1px solid rgba(200,150,12,0.14);
    border-radius: 1px; flex-shrink: 0;
  }
  .pdp-stat-val {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(1rem, 2.5vw, 1.15rem);
    font-weight: 600; color: ${INK}; line-height: 1;
  }
  .pdp-stat-lbl {
    font-size: 0.60rem; font-weight: 500;
    letter-spacing: 0.07em; color: ${INK_SOFT}; text-transform: uppercase; margin-top: 2px;
  }

  /* ── DESCRIPTION ── */
  .pdp-desc {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.88rem, 2vw, 0.95rem);
    line-height: 1.82; color: ${INK_MID}; white-space: pre-wrap;
  }
  .pdp-desc-collapsed {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }
  .pdp-desc-expand-btn {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 0;
    background: none; border: none; cursor: pointer;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.74rem, 1.5vw, 0.78rem);
    font-weight: 600; color: ${GOLD};
    transition: opacity 0.18s;
  }
  .pdp-desc-expand-btn:hover { opacity: 0.75; }

  /* ── FRAIS & CONDITIONS ── */
  .pdp-fees {
    margin-top: clamp(12px, 2.5vw, 18px);
    padding: clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 18px);
    border-radius: 8px;
    background: rgba(46,123,181,0.05);
    border: 1px solid rgba(46,123,181,0.18);
  }
  .pdp-fees-title {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.60rem, 1.1vw, 0.64rem); font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(46,123,181,0.85); margin-bottom: 8px;
    display: flex; align-items: center; gap: 6px;
  }
  .pdp-fees-row {
    display: flex; align-items: center;
    justify-content: space-between; gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(46,123,181,0.1);
  }
  .pdp-fees-row:last-child { border-bottom: none; }
  .pdp-fees-row-label {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.70rem, 1.3vw, 0.74rem); color: ${INK_SOFT};
    flex: 1;
  }
  .pdp-fees-row-value {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(0.95rem, 2.2vw, 1.05rem); font-weight: 600; color: ${INK};
  }
  .pdp-fees-row-note {
    font-size: clamp(0.58rem, 1vw, 0.62rem); color: ${INK_SOFT};
    text-align: right; min-width: 70px;
  }

  /* ── INFO ROWS ── */
  .pdp-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: clamp(10px, 2vw, 14px) 0;
    border-bottom: 1px solid rgba(26,22,18,0.05); gap: 12px;
  }
  .pdp-row:last-child { border-bottom: none; }
  .pdp-row-label {
    font-size: clamp(0.68rem, 1.3vw, 0.74rem); font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: ${INK_SOFT}; flex-shrink: 0;
  }
  .pdp-row-value {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(1rem, 2.5vw, 1.05rem); font-weight: 500;
    color: ${INK}; text-align: right;
  }

  /* ── AMENITY TAGS ── */
  .pdp-tags-wrap { display: flex; flex-wrap: wrap; gap: clamp(6px, 1.2vw, 8px); }
  .pdp-tag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(6px, 1.2vw, 7px) clamp(10px, 2vw, 14px);
    border: 1px solid rgba(200,150,12,0.2); border-radius: 1px;
    font-size: clamp(0.68rem, 1.3vw, 0.74rem); font-weight: 500;
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
    border-bottom: 1px solid rgba(200,150,12,0.2);
  }
  .pdp-sidebar-price-label {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.64rem, 1.1vw, 0.68rem); font-weight: 600;
    letter-spacing: 0.25em; text-transform: uppercase;
    color: rgba(200,150,12,0.88); margin-bottom: 8px;
  }
  .pdp-sidebar-price-value {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    font-weight: 600; color: #fff; line-height: 1;
  }
  .pdp-sidebar-badges {
    display: flex; gap: 8px; margin-top: clamp(10px, 2vw, 16px); flex-wrap: wrap;
  }
  .pdp-sidebar-badge {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.58rem, 1.1vw, 0.62rem); font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: clamp(3px, 0.6vw, 4px) clamp(8px, 1.5vw, 10px);
    border-radius: 1px;
  }

  .pdp-sidebar-body {
    padding: clamp(18px, 4vw, 28px);
  }
  .pdp-sidebar-intro {
    font-family: var(--font-cormorant), serif;
    font-size: clamp(1.05rem, 2.5vw, 1.25rem); font-weight: 500;
    color: #fff; margin-bottom: 5px;
  }
  .pdp-sidebar-sub {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.78rem); line-height: 1.65;
    color: rgba(255,255,255,0.70); margin-bottom: clamp(16px, 3vw, 22px);
  }

  /* CTA WhatsApp */
  .pdp-cta-wa {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: clamp(13px, 2.5vw, 16px);
    background: linear-gradient(135deg, #166534, #16A34A); color: #fff;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 600; letter-spacing: 0.06em;
    border: none; cursor: pointer; border-radius: 1px;
    transition: opacity 0.2s, transform 0.15s; text-decoration: none; margin-bottom: 10px;
  }
  .pdp-cta-wa:hover { opacity: 0.9; transform: translateY(-1px); }

  /* CTA principal (Planifier une visite) */
  .pdp-cta-primary {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: clamp(13px, 2.5vw, 16px);
    background: linear-gradient(135deg, #A06820, ${GOLD}); color: #fff;
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 600; letter-spacing: 0.06em;
    border: none; cursor: pointer; border-radius: 1px;
    transition: opacity 0.2s, transform 0.15s; text-decoration: none; margin-bottom: 10px;
  }
  .pdp-cta-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .pdp-cta-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* CTA Téléphone */
  .pdp-cta-tel {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: clamp(11px, 2.2vw, 14px);
    background: transparent; color: rgba(200,150,12,0.9);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.76rem, 1.6vw, 0.82rem); font-weight: 500; letter-spacing: 0.08em;
    border: 1px solid rgba(200,150,12,0.3); cursor: pointer; border-radius: 1px;
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
    border-radius: 1px; border: 1px solid rgba(200,150,12,0.2);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pdp-reassurance-text {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.74rem, 1.5vw, 0.78rem); line-height: 1.6;
    color: rgba(255,255,255,0.65);
  }

  /* ── BADGES ── */
  .pdp-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(4px, 0.8vw, 5px) clamp(10px, 2vw, 12px);
    border: 1px solid rgba(200,150,12,0.3); color: ${GOLD};
    font-family: var(--font-dm-sans), sans-serif;
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
    background: rgba(250,248,245,0.08); border: 1px solid rgba(200,150,12,0.25);
    color: rgba(255,255,255,0.7); font-size: 20px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .pdp-lightbox-close:hover { background: rgba(200,150,12,0.25); }
  .pdp-lightbox-counter {
    position: fixed; bottom: clamp(14px, 3vw, 24px); left: 50%; transform: translateX(-50%);
    font-family: var(--font-dm-sans), sans-serif;
    font-size: clamp(0.60rem, 1.2vw, 0.68rem); font-weight: 500; letter-spacing: 0.2em;
    color: rgba(255,255,255,0.70);
  }
  .pdp-lightbox-arrow {
    position: fixed; top: 50%; transform: translateY(-50%);
    width: clamp(40px, 5vw, 44px); height: clamp(40px, 5vw, 44px); border-radius: 1px;
    background: rgba(26,22,18,0.6); backdrop-filter: blur(8px);
    border: 1px solid rgba(200,150,12,0.2);
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
    border-radius: 2px; border: 1px solid rgba(200,150,12,0.15);
    max-width: 90vw; overflow-x: auto; scrollbar-width: none;
  }
  .pdp-lightbox-strip::-webkit-scrollbar { display: none; }
  .pdp-lightbox-thumb {
    width: clamp(44px, 8vw, 56px); height: clamp(30px, 5vw, 38px);
    object-fit: cover; border-radius: 1px; cursor: pointer; flex-shrink: 0;
    transition: opacity 0.2s, outline 0.2s;
  }

  /* ── MODAL RENDEZ-VOUS ── */
  .pdp-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5); z-index: 1000;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .pdp-rdv-sheet {
    background: #fff; border-radius: 24px 24px 0 0;
    padding: 28px; width: 100%; max-width: 560px;
    max-height: 90vh; overflow-y: auto;
  }
  .pdp-rdv-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .pdp-rdv-title {
    font-family: var(--font-cormorant), serif;
    font-size: 22px; font-weight: 700; color: ${INK};
  }
  .pdp-rdv-close {
    background: none; border: none; font-size: 20px; cursor: pointer; color: #999;
  }
  .pdp-rdv-bien {
    padding-bottom: 14px; margin-bottom: 14px;
    border-bottom: 1px solid #F0F0EE;
  }
  .pdp-rdv-bien-nom { font-weight: 600; font-size: 15px; color: ${INK}; }
  .pdp-rdv-bien-loc { font-size: 12px; color: #999; margin-top: 2px; }
  .pdp-rdv-finances {
    background: #FCEFD6; border-radius: 12px;
    padding: 12px 14px; margin-bottom: 16px;
    border: 1px solid rgba(200,150,12,0.35);
  }
  .pdp-rdv-finance-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0; font-size: 13px; color: #666;
  }
  .pdp-rdv-finance-row strong { color: ${GOLD}; font-weight: 700; }
  .pdp-rdv-gratuit { color: #3B6D11 !important; }
  .pdp-rdv-form { display: flex; flex-direction: column; gap: 12px; }
  .pdp-rdv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pdp-rdv-field { display: flex; flex-direction: column; gap: 6px; }
  .pdp-rdv-field label { font-size: 12px; font-weight: 600; color: #666; }
  .pdp-rdv-field input, .pdp-rdv-field textarea {
    border: 1px solid #F0F0EE; border-radius: 10px;
    padding: 11px 13px; font-size: 14px; color: ${INK};
    background: #FAFAF8; outline: none; font-family: inherit;
  }
  .pdp-rdv-field input:focus, .pdp-rdv-field textarea:focus {
    border-color: ${GOLD};
  }
  .pdp-rdv-submit {
    width: 100%; margin-top: 16px; padding: 14px;
    background: ${GOLD}; color: #fff; border: none;
    border-radius: 12px; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }
  .pdp-rdv-submit:hover { background: #A07A0A; }
  .pdp-rdv-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .pdp-rdv-success { text-align: center; padding: 20px 0; }
  .pdp-rdv-success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: #EAF3DE;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px; font-size: 28px; color: #3B6D11;
  }
  .pdp-rdv-success h3 {
    font-family: var(--font-cormorant), serif;
    font-size: 24px; margin-bottom: 8px; color: ${INK};
  }
  .pdp-rdv-success p { font-size: 14px; color: #666; margin-bottom: 16px; }
  .pdp-rdv-recap {
    background: #FAFAF8; border-radius: 12px;
    padding: 14px; margin: 16px 0; text-align: left;
    display: flex; flex-direction: column; gap: 8px;
    font-size: 13px; color: ${INK};
  }
  .pdp-rdv-note { font-size: 12px; color: #999; }
  .pdp-rdv-close-btn {
    margin-top: 16px; padding: 12px 32px;
    background: #F5F5F2; border: 1px solid #F0F0EE;
    border-radius: 12px; font-size: 14px; font-weight: 600;
    cursor: pointer; color: #666; font-family: inherit;
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
  const router          = useRouter();
  const { user }        = useAuth();
  const [property,  setProperty]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [mainIdx,       setMainIdx]       = useState(0);
  const [lightbox,      setLightbox]      = useState(false);
  const [mainImgError,  setMainImgError]  = useState(false);
  const [lbImgError,    setLbImgError]    = useState(false);
  const [localLikes,    setLocalLikes]    = useState(0);
  const [localShares,   setLocalShares]   = useState(0);
  const [liked,         setLiked]         = useState(false);
  const [shared,        setShared]        = useState(false);
  const [descExpanded,  setDescExpanded]  = useState(false);
  const [showContact,      setShowContact]      = useState(false);
  const [showSignaler,     setShowSignaler]     = useState(false);
  const [rdvModal,   setRdvModal]   = useState(false);
  const [rdvDate,    setRdvDate]    = useState('');
  const [rdvHeure,   setRdvHeure]   = useState('');
  const [rdvTel,     setRdvTel]     = useState(user?.phone || '');
  const [rdvMessage, setRdvMessage] = useState('');
  const [rdvLoading, setRdvLoading] = useState(false);
  const [rdvSuccess, setRdvSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPropertyById(propertyId);
        setProperty(data);
        setLocalLikes(data?.likes?.length || 0);
        setLocalShares(data?.shares || 0);
        if (user && data?.likes) {
          setLiked(data.likes.some(id => id === user._id || id?._id === user._id));
        }
      } catch {
        setError("Impossible de charger les détails de l'annonce.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId]);

  const handleLike = async () => {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLocalLikes(n => next ? n + 1 : Math.max(0, n - 1));
    try { await likeProperty(propertyId); } catch { setLiked(!next); setLocalLikes(n => next ? Math.max(0, n - 1) : n + 1); }
  };

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch {}
    if (!shared) {
      setShared(true);
      setLocalShares(n => n + 1);
      try { await shareProperty(propertyId); } catch {}
      setTimeout(() => setShared(false), 3000);
    }
  };

  const openRdvModal = () => {
    if (!user) {
      router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setRdvSuccess(false);
    setRdvDate('');
    setRdvHeure('');
    setRdvTel(user?.phone || '');
    setRdvMessage('');
    setRdvModal(true);
  };

  const soumettreRdv = async () => {
    if (!rdvDate || !rdvHeure || !rdvTel.trim()) {
      toast.error("Veuillez remplir la date, l'heure et votre téléphone.");
      return;
    }
    setRdvLoading(true);
    try {
      const convRes = await api.post('/conversations/start', {
        propertyId: property._id,
        message: `Demande de visite le ${new Date(rdvDate).toLocaleDateString('fr-FR')} à ${rdvHeure}. Tél: ${rdvTel}${rdvMessage ? '. ' + rdvMessage : ''}`,
      });
      await api.post('/visites', {
        propertyId: property._id,
        conversationId: convRes.data?.data?.conversation?._id,
        datePreferee: new Date(rdvDate).toLocaleDateString('fr-FR'),
        heurePreferee: rdvHeure,
        telephone: rdvTel,
        message: rdvMessage,
      });
      setRdvSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible d'envoyer la demande.");
    } finally {
      setRdvLoading(false);
    }
  };

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

  useEffect(() => { setMainImgError(false); }, [mainIdx]);
  useEffect(() => { setLbImgError(false); },  [lightbox]);

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
        <Link href="/immobilier/annonces" style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'12px 24px', background:INK, color:'#fff',
          fontFamily:"'DM Sans', sans-serif", fontSize:'clamp(0.68rem,1.5vw,0.75rem)',
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
    ? [property.address.street, property.address.arrondissement, property.address.city].filter(Boolean).join(' — ')
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

      {/* ── Nav ── */}
      <div className="pdp-nav">
        <div className="pdp-nav-inner">
          <Breadcrumb items={[
            { label: 'Altimmo',   href: '/immobilier' },
            { label: 'Annonces',  href: '/immobilier/annonces' },
            { label: property.title },
          ]} />
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

        {/* ── Barre engagement : vues · likes · partages ── */}
        <div className="pdp-engage-bar">
          <span className="pdp-engage-item" title="Nombre de vues">
            <Eye size={13} style={{ color:GOLD }} /> {property.views || 0} vue{(property.views || 0) !== 1 ? 's' : ''}
          </span>
          <div className="pdp-engage-sep" />
          <button
            className={`pdp-engage-btn${liked ? ' liked' : ''}`}
            onClick={handleLike}
            title={user ? (liked ? 'Ne plus aimer' : 'J\'aimer ce bien') : 'Connectez-vous pour liker'}
            style={{ color: liked ? '#E53E3E' : INK_SOFT }}>
            <Heart size={13} fill={liked ? '#E53E3E' : 'none'} stroke={liked ? '#E53E3E' : INK_SOFT} />
            {localLikes} j'aime
          </button>
          <div className="pdp-engage-sep" />
          <button
            className={`pdp-engage-btn${shared ? ' shared' : ''}`}
            onClick={handleShare}
            title="Copier le lien et partager"
            style={{ color: shared ? BLUE : INK_SOFT }}>
            <Share2 size={13} />
            {shared ? 'Lien copié !' : `${localShares} partage${localShares !== 1 ? 's' : ''}`}
          </button>
        </div>

        {/* ── Galerie ── */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08, duration:0.5, ease:[0.22,1,0.36,1] }}>
          {images.length > 0 ? (
            <div className="pdp-gallery-wrap">
              <div className="pdp-main-img-wrap">
                <AnimatePresence mode="wait">
                  <MotionImage
                    key={mainIdx}
                    src={mainImgError ? PLACEHOLDER : mainImage}
                    alt="Vue principale"
                    fill sizes="(max-width: 768px) 100vw, 60vw"
                    className="pdp-main-img"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    transition={{ duration:0.3 }}
                    onError={() => setMainImgError(true)}
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
                    <Image key={i}
                      src={optimizeCloudinaryUrl(buildImageUrl(img), 200)}
                      alt={`Vue ${i + 1}`}
                      width={120} height={72}
                      className={`pdp-thumb${i === mainIdx ? ' active' : ''}`}
                      onClick={() => setMainIdx(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              height:'clamp(180px,40vw,240px)', borderRadius:2,
              border:'1px dashed rgba(200,150,12,0.25)', background:GOLD_PALE,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:10, color:INK_SOFT,
              marginBottom:'clamp(20px,4vw,28px)',
            }}>
              <MapPin size={24} style={{ opacity:0.3 }} />
              <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'clamp(0.62rem,1.3vw,0.68rem)', letterSpacing:'0.12em' }}>
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
              <p className={`pdp-desc${descExpanded ? '' : ' pdp-desc-collapsed'}`}>
                {property.description || 'Aucune description disponible pour ce bien.'}
              </p>
              {property.description && property.description.length > 180 && (
                <button className="pdp-desc-expand-btn" onClick={() => setDescExpanded(v => !v)}>
                  {descExpanded ? 'Réduire' : 'Lire la suite'}
                  {descExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
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
                    border:'1px solid rgba(200,150,12,0.3)', color:GOLD,
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

              {/* Honoraires d'agence — valeurs stockées en base, formule uniquement en repli */}
              {(() => {
                const isLocation = property.status === 'location';
                const honoraires = property.honoraires ?? (
                  isLocation
                    ? Math.round((property.price || 0) * 0.8)
                    : Math.round((property.price || 0) * 0.1)
                );
                const fraisVisite = property.fraisVisite ?? 0;
                const note        = isLocation
                  ? '80% du loyer mensuel'
                  : '10% du prix de vente';
                return (
                  <div style={{ padding:'0 clamp(18px,4vw,28px) clamp(6px,1.5vw,10px)' }}>
                    <div className="pdp-fees">
                      <div className="pdp-fees-title">
                        <Percent size={10} /> Honoraires d'agence
                      </div>
                      <div className="pdp-fees-row">
                        <span className="pdp-fees-row-label" style={{ color:'rgba(255,255,255,0.55)' }}>Montant estimé</span>
                        <span className="pdp-fees-row-value" style={{ color:'#fff' }}>{priceFormatter.format(honoraires)}</span>
                        <span className="pdp-fees-row-note" style={{ color:'rgba(255,255,255,0.38)' }}>{note}</span>
                      </div>
                      <div className="pdp-fees-row">
                        <span className="pdp-fees-row-label" style={{ color:'rgba(255,255,255,0.55)' }}>Frais de visite</span>
                        <span className="pdp-fees-row-value" style={{ color:'#fff' }}>
                          {fraisVisite > 0 ? priceFormatter.format(fraisVisite) : 'Visite gratuite'}
                        </span>
                        {fraisVisite > 0 && (
                          <span className="pdp-fees-row-note" style={{ color:'rgba(255,255,255,0.38)' }}>à régler sur place</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Contact */}
              <div className="pdp-sidebar-body">
                <p className="pdp-sidebar-intro">Intéressé par ce bien ?</p>
                <p className="pdp-sidebar-sub">
                  Contactez notre agent pour organiser une visite.
                </p>

                <button
                  onClick={() => setShowContact(true)}
                  className="pdp-cta-wa">
                  <MessageCircle size={18} />
                  Contacter l'agence
                </button>

                <button
                  onClick={openRdvModal}
                  className="pdp-cta-primary">
                  <Calendar size={18} />
                  Planifier une visite
                </button>

                <a href="tel:+242068002151" className="pdp-cta-tel">
                  <Phone size={13} /> +242 06 800 21 51
                </a>

                <button
                  onClick={() => { if (!user) { router.push('/login'); return; } setShowSignaler(true); }}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition mt-4 w-full justify-center"
                >
                  <Flag size={14} />
                  Signaler cette annonce
                </button>

                <div className="pdp-reassurance">
                  {[
                    { Icon: Clock,         text:'Réponse sous 24h garantie' },
                    { Icon: MessageSquare, text:'Visite virtuelle sur demande' },
                    { Icon: Scale,         text:'Accompagnement juridique inclus' },
                  ].map(({ Icon, text }, i) => (
                    <div key={i} className="pdp-reassurance-item">
                      <div className="pdp-reassurance-icon">
                        <Icon size={11} color="rgba(200,150,12,0.7)" />
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

            <MotionImage
              key={lightbox}
              src={lbImgError ? PLACEHOLDER : optimizeCloudinaryUrl(buildImageUrl(images[lightbox]), 1600)}
              alt={`Photo ${lightbox + 1}`}
              width={1600} height={900} unoptimized
              className="pdp-lightbox-img"
              initial={{ opacity:0, scale:0.94 }}
              animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0, scale:0.96 }}
              transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}
              onClick={e => e.stopPropagation()}
              onError={() => setLbImgError(true)}
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
                    <Image key={i}
                      src={optimizeCloudinaryUrl(buildImageUrl(img), 200)}
                      alt={`Miniature ${i + 1}`}
                      width={56} height={38}
                      className="pdp-lightbox-thumb"
                      onClick={() => setLightbox(i)}
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

      {showContact && (
        <ContactModal
          intention="Informations Générales"
          serviceTitle={`${property.title} (ID: ${property._id})`}
          onClose={() => setShowContact(false)}
        />
      )}

      {showSignaler && (
        <SignalerAnnonceModal
          propertyId={property._id}
          onClose={() => setShowSignaler(false)}
        />
      )}

      {rdvModal && (
        <div className="pdp-modal-overlay" onClick={() => setRdvModal(false)}>
          <div className="pdp-rdv-sheet" onClick={e => e.stopPropagation()}>

            {!rdvSuccess ? (
              <>
                <div className="pdp-rdv-header">
                  <h3 className="pdp-rdv-title">Planifier une visite</h3>
                  <button onClick={() => setRdvModal(false)} className="pdp-rdv-close">✕</button>
                </div>

                <div className="pdp-rdv-bien">
                  <p className="pdp-rdv-bien-nom">{property.title}</p>
                  <p className="pdp-rdv-bien-loc">
                    {property.address?.arrondissement}, {property.address?.city}
                  </p>
                </div>

                <div className="pdp-rdv-finances">
                  <div className="pdp-rdv-finance-row">
                    <span>Honoraires d'agence</span>
                    <strong>
                      {(property.honoraires ?? (
                        property.status === 'location'
                          ? Math.round((property.price || 0) * 0.8)
                          : Math.round((property.price || 0) * 0.1)
                      )).toLocaleString('fr-FR')} FCFA
                    </strong>
                  </div>
                  <div className="pdp-rdv-finance-row">
                    <span>Frais de visite</span>
                    <strong className={!property.fraisVisite ? 'pdp-rdv-gratuit' : ''}>
                      {property.fraisVisite
                        ? property.fraisVisite.toLocaleString('fr-FR') + ' FCFA'
                        : 'Gratuite'}
                    </strong>
                  </div>
                </div>

                <div className="pdp-rdv-form">
                  <div className="pdp-rdv-row">
                    <div className="pdp-rdv-field">
                      <label>Date souhaitée *</label>
                      <input type="date" value={rdvDate}
                        onChange={e => setRdvDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="pdp-rdv-field">
                      <label>Heure souhaitée *</label>
                      <input type="time" value={rdvHeure}
                        onChange={e => setRdvHeure(e.target.value)} />
                    </div>
                  </div>
                  <div className="pdp-rdv-field">
                    <label>Téléphone *</label>
                    <input type="tel" value={rdvTel}
                      onChange={e => setRdvTel(e.target.value)}
                      placeholder="+242 06 XXX XX XX" />
                  </div>
                  <div className="pdp-rdv-field">
                    <label>Message (optionnel)</label>
                    <textarea value={rdvMessage}
                      onChange={e => setRdvMessage(e.target.value)}
                      placeholder="Précisions sur la visite..."
                      rows={3} />
                  </div>
                </div>

                <button
                  className="pdp-rdv-submit"
                  onClick={soumettreRdv}
                  disabled={rdvLoading}
                >
                  {rdvLoading ? 'Envoi...' : 'Confirmer la demande'}
                </button>
              </>
            ) : (
              <div className="pdp-rdv-success">
                <div className="pdp-rdv-success-icon">✓</div>
                <h3>Demande envoyée !</h3>
                <p>Notre équipe vous contactera au <strong>{rdvTel}</strong> pour confirmer votre rendez-vous.</p>
                <div className="pdp-rdv-recap">
                  <div>📅 Date souhaitée : <strong>
                    {new Date(rdvDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong></div>
                  <div>🕐 Heure : <strong>{rdvHeure}</strong></div>
                  <div>🏠 Bien : <strong>{property.title}</strong></div>
                </div>
                <p className="pdp-rdv-note">
                  Vous recevrez une notification dès confirmation par notre équipe.
                </p>
                <button className="pdp-rdv-close-btn" onClick={() => setRdvModal(false)}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetailPage;