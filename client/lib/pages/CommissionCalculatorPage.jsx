"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../services/authService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Home, Key, Calculator, CheckCircle,
  TrendingUp, Shield, Clock, ChevronDown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — charte Altimmo
═══════════════════════════════════════════════════════════════ */
const GOLD      = '#C8872A';
const GOLD_PALE = 'rgba(200,135,42,0.08)';
const GOLD_MID  = 'rgba(200,135,42,0.18)';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';

const SALE_RATE   = 0.10;
const RENT_RATE   = 0.80;
const PARTNER_CUT = 0.30;

const fmtXAF = (v) =>
  new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(v);

const fmtNum = (v) =>
  new Intl.NumberFormat('fr-FR').format(v);

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const PAGE_CSS = `
  /* ── Animations ── */
  @keyframes cp-drift {
    0%   { transform: translateX(0) translateY(0); }
    100% { transform: translateX(30px) translateY(30px); }
  }
  @keyframes cp-breathe {
    0%,100% { opacity:.6; transform:scale(1); }
    50%     { opacity:1;  transform:scale(1.1); }
  }
  @keyframes cp-shimmer {
    0%      { left:-100%; }
    40%,100%{ left:160%; }
  }
  @keyframes cp-pulse-dot {
    0%,100%{ opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(200,135,42,.4); }
    50%    { opacity:.8; transform:scale(1.4); box-shadow:0 0 0 6px rgba(200,135,42,0); }
  }
  @keyframes cp-count {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes cp-bar {
    from { width:0; }
  }

  /* ── Root ── */
  .cp-root {
    font-family:var(--font-dm-sans),sans-serif;
    background:${CREAM};
    min-height:100vh;
    color:${INK};
  }

  /* ════════════════════════════════════
     HERO
  ════════════════════════════════════ */
  .cp-hero {
    position:relative; overflow:hidden;
    /* min-height au lieu de height fixe : le contenu dicte la hauteur */
    min-height:clamp(520px,72vh,760px);
    display:flex; flex-direction:column; justify-content:flex-end;
  }
  .cp-hero-img {
    position:absolute; inset:0;
    width:100%; height:100%; object-fit:cover; object-position:center;
  }
  /* Dégradé superposé */
  .cp-hero-grad {
    position:absolute; inset:0;
    background:linear-gradient(
      160deg,
      rgba(26,22,18,.93) 0%,
      rgba(26,22,18,.70) 55%,
      rgba(26,22,18,.30) 100%
    );
  }
  /* Grille de points */
  .cp-hero-dots {
    position:absolute; inset:0;
    background-image:radial-gradient(circle,rgba(200,135,42,.15) 1px,transparent 1px);
    background-size:28px 28px;
    animation:cp-drift 20s linear infinite;
  }
  /* Halo */
  .cp-hero-halo {
    position:absolute; top:-120px; left:-80px;
    width:500px; height:500px; border-radius:50%;
    background:radial-gradient(circle,rgba(200,135,42,.14) 0%,transparent 65%);
    animation:cp-breathe 5s ease-in-out infinite;
  }
  /* Ligne accent */
  .cp-hero-accent {
    position:absolute; top:0; left:0; right:0; height:1px;
    background:linear-gradient(to right,transparent,${GOLD},rgba(200,135,42,.25),transparent);
  }

  .cp-hero-inner {
    position:relative; z-index:2;
    max-width:1200px; margin:0 auto;
    /* padding-top : compense la navbar fixe (~70px) + respiration */
    padding:clamp(80px,12vw,120px) clamp(20px,5vw,48px) clamp(40px,6vw,64px);
  }
  /* Sur petits écrans : réduire le padding-top (navbar moins haute) */
  @media(max-width:640px){
    .cp-hero-inner { padding-top:clamp(48px,8vw,72px); }
  }
  .cp-hero-eyebrow {
    display:inline-flex; align-items:center; gap:9px;
    margin-bottom:clamp(12px,2vw,18px);
  }
  .cp-hero-dot {
    width:5px; height:5px; border-radius:50%; background:${GOLD};
    animation:cp-pulse-dot 2.2s ease-in-out infinite; flex-shrink:0;
  }
  .cp-hero-eyebrow-text {
    font-size:clamp(.58rem,1.2vw,.65rem); font-weight:600;
    letter-spacing:.22em; text-transform:uppercase; color:${GOLD};
  }
  .cp-hero-h1 {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(2.2rem,5.5vw,6rem);
    font-weight:600; line-height:1.06; color:#F5F2EE;
    letter-spacing:-.02em;
    margin-bottom:clamp(12px,2vw,18px);
  }
  .cp-hero-h1 em { font-style:italic; color:${GOLD}; }
  .cp-hero-rule {
    width:38px; height:1px;
    background:linear-gradient(to right,${GOLD},transparent);
    margin-bottom:clamp(12px,2vw,18px);
  }
  .cp-hero-sub {
    font-size:clamp(.85rem,2vw,.98rem); font-weight:300; line-height:1.72;
    color:rgba(245,242,238,.58); max-width:540px;
  }
  .cp-hero-sub strong { font-weight:500; color:rgba(245,242,238,.88); }

  /* Stats hero */
  .cp-hero-stats {
    display:flex; gap:clamp(14px,3vw,28px); flex-wrap:wrap;
    align-items:baseline;
    margin-top:clamp(20px,3.5vw,32px);
    padding-top:clamp(16px,3vw,24px);
    border-top:1px solid rgba(200,135,42,.18);
  }
  .cp-hstat { display:flex; flex-direction:column; gap:2px; }
  .cp-hstat-val {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.5rem,3.5vw,5rem); font-weight:600; color:${GOLD}; line-height:1;
  }
  .cp-hstat-lbl {
    font-size:clamp(.56rem,1.1vw,0.85rem); font-weight:400;
    letter-spacing:.12em; text-transform:uppercase; color:rgba(245,242,238,.3);
  }
  .cp-hstat-sep { width:1px; height:36px; background:rgba(200,135,42,.18); align-self:center; }

  /* Chevron scroll */
  .cp-scroll-hint {
    display:flex; flex-direction:column; align-items:center; gap:4px;
    margin-top:clamp(20px,4vw,36px);
    opacity:.45;
  }
  .cp-scroll-hint span {
    font-size:.56rem; letter-spacing:.2em; text-transform:uppercase; color:rgba(245,242,238,.6);
  }

  /* ════════════════════════════════════
     LAYOUT
  ════════════════════════════════════ */
  .cp-section {
    max-width:1200px; margin:0 auto;
    padding:clamp(40px,7vw,80px) clamp(16px,4vw,48px);
  }

  /* ─ 2 colonnes ─ */
  .cp-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:clamp(24px,4vw,48px);
    align-items:start;
  }
  @media(max-width:900px){
    .cp-grid { grid-template-columns:1fr; }
  }

  /* ════════════════════════════════════
     CALCULATEUR
  ════════════════════════════════════ */
  .cp-calc {
    background:#FDFCFA;
    border:1px solid rgba(200,135,42,.16);
    border-radius:2px;
    overflow:hidden;
  }
  /* En-tête calculateur */
  .cp-calc-head {
    background:${INK};
    padding:clamp(18px,3vw,26px) clamp(18px,3vw,28px);
    position:relative; overflow:hidden;
  }
  .cp-calc-head-dots {
    position:absolute; inset:0;
    background-image:radial-gradient(circle,rgba(200,135,42,.12) 1px,transparent 1px);
    background-size:22px 22px;
    animation:cp-drift 16s linear infinite;
  }
  .cp-calc-head-inner { position:relative; z-index:1; }
  .cp-calc-head-title {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.3rem,3vw,1.7rem); font-weight:600; color:#F5F2EE; line-height:1.1;
  }
  .cp-calc-head-sub {
    font-size:clamp(.70rem,1.5vw,.76rem); font-weight:300;
    color:rgba(245,242,238,.45); margin-top:4px;
  }
  /* Corps calculateur */
  .cp-calc-body { padding:clamp(18px,3.5vw,28px); }

  /* Tabs transaction type */
  .cp-tabs {
    display:grid; grid-template-columns:1fr 1fr; gap:6px;
    margin-bottom:clamp(16px,3vw,24px);
  }
  .cp-tab {
    display:flex; align-items:center; justify-content:center; gap:7px;
    padding:clamp(10px,2vw,13px);
    border:1px solid rgba(200,135,42,.2); border-radius:1px;
    font-family:var(--font-dm-sans),sans-serif;
    font-size:clamp(.70rem,1.5vw,.76rem); font-weight:500;
    letter-spacing:.08em; text-transform:uppercase;
    cursor:pointer; transition:background .2s,border-color .2s,color .2s;
    color:${INK_SOFT}; background:transparent;
  }
  .cp-tab--active-vente {
    background:${INK}; color:${GOLD};
    border-color:rgba(200,135,42,.35);
  }
  .cp-tab--active-location {
    background:#0F5132; color:#22C55E;
    border-color:rgba(34,197,94,.35);
  }
  .cp-tab:not(.cp-tab--active-vente):not(.cp-tab--active-location):hover {
    border-color:rgba(200,135,42,.35); color:${INK};
  }

  /* Label */
  .cp-label {
    font-size:clamp(.60rem,1.2vw,.66rem); font-weight:600;
    letter-spacing:.16em; text-transform:uppercase; color:${INK_SOFT};
    margin-bottom:8px; display:block;
  }

  /* Input prix */
  .cp-input-wrap { position:relative; margin-bottom:clamp(18px,3vw,24px); }
  .cp-input-currency {
    position:absolute; left:16px; top:50%; transform:translateY(-50%);
    font-family:var(--font-dm-sans),sans-serif;
    font-size:clamp(.70rem,1.4vw,.76rem); font-weight:600;
    letter-spacing:.12em; color:${INK_SOFT};
    pointer-events:none; text-transform:uppercase;
  }
  .cp-input {
    width:100%; padding:clamp(14px,2.5vw,18px) 14px clamp(14px,2.5vw,18px) 80px;
    border:1px solid rgba(200,135,42,.22); border-radius:1px;
    background:${CREAM};
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.5rem,3.5vw,2.2rem); font-weight:600; color:${INK};
    transition:border-color .2s,box-shadow .2s,background .2s;
    box-sizing:border-box;
  }
  .cp-input:focus {
    outline:none;
    border-color:rgba(200,135,42,.5);
    box-shadow:0 0 0 3px rgba(200,135,42,.08);
    background:#fff;
  }

  /* Slider */
  .cp-slider-wrap { margin-bottom:clamp(16px,3vw,24px); }
  .cp-slider {
    width:100%; margin:6px 0;
    appearance:none; height:3px; border-radius:2px;
    background:linear-gradient(to right,${GOLD} var(--pct,40%),rgba(200,135,42,.2) var(--pct,40%));
    cursor:pointer;
  }
  .cp-slider::-webkit-slider-thumb {
    appearance:none; width:18px; height:18px; border-radius:50%;
    background:${GOLD}; border:2px solid #fff;
    box-shadow:0 2px 8px rgba(200,135,42,.4); cursor:pointer;
  }
  .cp-slider-labels {
    display:flex; justify-content:space-between;
    font-size:clamp(.56rem,1.1vw,.60rem); letter-spacing:.1em;
    color:${INK_SOFT};
  }

  /* Résultat */
  .cp-result-agency {
    display:flex; justify-content:space-between; align-items:center;
    padding:clamp(12px,2vw,16px);
    background:${CREAM}; border:1px solid rgba(200,135,42,.12); border-radius:1px;
    margin-bottom:8px;
  }
  .cp-result-agency-label {
    font-size:clamp(.70rem,1.4vw,.76rem); color:${INK_SOFT};
  }
  .cp-result-agency-sub {
    font-size:clamp(.58rem,1.1vw,.62rem); color:rgba(140,123,110,.6);
    margin-top:2px;
  }
  .cp-result-agency-val {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.1rem,2.5vw,1.4rem); font-weight:600; color:${INK};
  }

  /* Part apporteur */
  .cp-result-main {
    padding:clamp(16px,3vw,22px);
    background:${INK}; border-radius:1px;
    position:relative; overflow:hidden;
  }
  .cp-result-main-halo {
    position:absolute; top:-40px; right:-40px;
    width:160px; height:160px; border-radius:50%;
    background:radial-gradient(circle,rgba(200,135,42,.2) 0%,transparent 70%);
    pointer-events:none;
  }
  .cp-result-main-label {
    font-size:clamp(.60rem,1.2vw,.66rem); font-weight:600;
    letter-spacing:.18em; text-transform:uppercase;
    color:rgba(200,135,42,.7); margin-bottom:8px;
  }
  .cp-result-main-val {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.8rem,4vw,2.6rem); font-weight:700; color:#F5F2EE;
    line-height:1; animation:cp-count .35s ease both;
  }
  .cp-result-main-sub {
    font-size:clamp(.58rem,1.1vw,.62rem); font-weight:300;
    color:rgba(245,242,238,.38); margin-top:6px;
  }
  /* Barre de progression */
  .cp-bar-wrap {
    margin-top:14px; height:2px; background:rgba(200,135,42,.15); border-radius:1px;
  }
  .cp-bar {
    height:100%; background:${GOLD}; border-radius:1px;
    animation:cp-bar .6s ease both;
  }

  /* Info box */
  .cp-info-box {
    margin-top:10px; padding:clamp(10px,2vw,14px);
    border:1px solid rgba(200,135,42,.2); border-radius:1px;
    background:${GOLD_PALE};
    display:flex; gap:10px; align-items:flex-start;
  }
  .cp-info-box-text {
    font-size:clamp(.72rem,1.5vw,.78rem); line-height:1.65; color:${INK_MID};
  }

  /* ════════════════════════════════════
     COLONNE DROITE — CTA
  ════════════════════════════════════ */
  .cp-cta-col {
    display:flex; flex-direction:column; gap:clamp(20px,3.5vw,28px);
  }
  @media(min-width:900px){
    .cp-cta-col { position:sticky; top:clamp(60px,8vw,80px); }
  }

  /* Image paysage */
  .cp-cta-img-wrap {
    border-radius:2px; overflow:hidden; position:relative;
    height:clamp(180px,22vw,240px);
  }
  .cp-cta-img {
    width:100%; height:100%; object-fit:cover;
    transition:transform .6s cubic-bezier(.25,.46,.45,.94);
  }
  .cp-cta-img-wrap:hover .cp-cta-img { transform:scale(1.04); }
  .cp-cta-img-overlay {
    position:absolute; inset:0;
    background:linear-gradient(to top,rgba(26,22,18,.7) 0%,transparent 60%);
  }
  .cp-cta-img-badge {
    position:absolute; bottom:14px; left:14px;
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 12px; border-radius:1px;
    background:rgba(26,22,18,.8); backdrop-filter:blur(8px);
    border:1px solid rgba(200,135,42,.35);
  }
  .cp-cta-img-badge-dot { width:5px; height:5px; border-radius:50%; background:#22C55E; flex-shrink:0; }
  .cp-cta-img-badge-text {
    font-size:.58rem; font-weight:600; letter-spacing:.15em;
    text-transform:uppercase; color:rgba(245,242,238,.7);
  }

  .cp-cta-h2 {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.7rem,3.5vw,2.4rem); font-weight:600; line-height:1.1;
    color:${INK};
  }
  .cp-cta-h2 em { font-style:italic; color:${GOLD}; }
  .cp-cta-body {
    font-size:clamp(.82rem,1.8vw,.90rem); font-weight:300; line-height:1.75;
    color:${INK_SOFT};
  }

  /* Avantages */
  .cp-advantages { display:flex; flex-direction:column; gap:12px; }
  .cp-advantage {
    display:flex; align-items:flex-start; gap:12px;
    padding:clamp(12px,2vw,16px);
    border:1px solid rgba(200,135,42,.12); border-radius:1px;
    background:#FDFCFA;
    transition:border-color .2s,box-shadow .2s;
  }
  .cp-advantage:hover {
    border-color:rgba(200,135,42,.3);
    box-shadow:0 4px 16px rgba(200,135,42,.06);
  }
  .cp-advantage-icon {
    width:clamp(32px,4vw,38px); height:clamp(32px,4vw,38px);
    border-radius:1px; flex-shrink:0;
    background:${GOLD_PALE}; border:1px solid rgba(200,135,42,.2);
    display:flex; align-items:center; justify-content:center;
  }
  .cp-advantage-title {
    font-size:clamp(.80rem,1.8vw,.86rem); font-weight:500; color:${INK}; margin-bottom:2px;
  }
  .cp-advantage-sub {
    font-size:clamp(.68rem,1.4vw,.72rem); font-weight:300; color:${INK_SOFT}; line-height:1.55;
  }

  /* Bouton CTA */
  .cp-cta-btn {
    display:flex; align-items:center; justify-content:center; gap:9px;
    width:100%; padding:clamp(14px,2.5vw,18px);
    background:${INK}; color:${GOLD};
    font-family:var(--font-dm-sans),sans-serif;
    font-size:clamp(.70rem,1.5vw,.78rem); font-weight:600;
    letter-spacing:.12em; text-transform:uppercase;
    border:1px solid rgba(200,135,42,.25); border-radius:1px;
    cursor:pointer; text-decoration:none;
    position:relative; overflow:hidden;
    transition:transform .22s,box-shadow .22s,background .22s;
  }
  .cp-cta-btn::before {
    content:''; position:absolute; inset:0;
    background:rgba(255,255,255,0); transition:background .2s;
  }
  .cp-cta-btn:hover::before { background:rgba(255,255,255,.04); }
  .cp-cta-btn::after {
    content:''; position:absolute;
    top:0; left:-100%; width:55%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(200,135,42,.18),transparent);
    transform:skewX(-20deg);
    animation:cp-shimmer 3.5s ease-in-out infinite;
  }
  .cp-cta-btn:hover {
    transform:translateY(-2px);
    box-shadow:0 8px 28px rgba(200,135,42,.3);
    background:#2D2520;
    border-color:rgba(200,135,42,.5);
    color:#E8B86D;
  }
  .cp-cta-icon { transition:transform .22s; flex-shrink:0; }
  .cp-cta-btn:hover .cp-cta-icon { transform:translateX(3px); }

  .cp-login-hint {
    text-align:center;
    font-size:clamp(.68rem,1.4vw,.72rem); color:${INK_SOFT};
  }
  .cp-login-hint a { color:${BLUE}; text-decoration:none; font-weight:500; }
  .cp-login-hint a:hover { color:${BLUE_DARK}; }

  /* ════════════════════════════════════
     SECTION EXEMPLES
  ════════════════════════════════════ */
  .cp-examples-section {
    background:${INK}; position:relative; overflow:hidden;
  }
  .cp-examples-section-dots {
    position:absolute; inset:0;
    background-image:radial-gradient(circle,rgba(200,135,42,.12) 1px,transparent 1px);
    background-size:28px 28px;
    animation:cp-drift 22s linear infinite;
    pointer-events:none;
  }
  .cp-examples-accent {
    position:absolute; top:0; left:0; right:0; height:1px;
    background:linear-gradient(to right,transparent,${GOLD},rgba(200,135,42,.25),transparent);
  }
  .cp-examples-inner { position:relative; z-index:1; }

  .cp-examples-eyebrow {
    text-align:center; margin-bottom:clamp(28px,5vw,48px);
  }
  .cp-examples-eyebrow p {
    font-size:clamp(.58rem,1.2vw,.64rem); font-weight:600;
    letter-spacing:.22em; text-transform:uppercase; color:${GOLD};
    margin-bottom:10px;
  }
  .cp-examples-eyebrow h2 {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.7rem,4vw,2.6rem); font-weight:600; color:#F5F2EE; line-height:1.1;
  }
  .cp-examples-eyebrow h2 em { font-style:italic; color:${GOLD}; }

  .cp-examples-grid {
    display:grid; grid-template-columns:1fr 1fr; gap:clamp(14px,2.5vw,20px);
  }
  @media(max-width:640px){ .cp-examples-grid{ grid-template-columns:1fr; } }

  .cp-example-card {
    border:1px solid rgba(200,135,42,.18); border-radius:2px;
    overflow:hidden;
  }
  .cp-example-img {
    width:100%; height:clamp(140px,18vw,200px); object-fit:cover; display:block;
  }
  .cp-example-body { padding:clamp(16px,3vw,22px); }
  .cp-example-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 10px; border-radius:1px; margin-bottom:12px;
    font-size:.60rem; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
  }
  .cp-example-badge--vente { background:rgba(46,123,181,.15); color:${BLUE}; border:1px solid rgba(46,123,181,.25); }
  .cp-example-badge--location { background:rgba(34,197,94,.1); color:#22C55E; border:1px solid rgba(34,197,94,.25); }
  .cp-example-title {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.1rem,2.5vw,1.4rem); font-weight:600; color:#F5F2EE; margin-bottom:14px;
  }
  .cp-example-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:clamp(7px,1.5vw,10px) 0;
    border-bottom:1px solid rgba(200,135,42,.1);
    font-size:clamp(.74rem,1.6vw,.80rem);
  }
  .cp-example-row:last-child { border-bottom:none; }
  .cp-example-row-label { color:rgba(245,242,238,.45); }
  .cp-example-row-val { font-weight:400; color:rgba(245,242,238,.75); }
  .cp-example-gain {
    display:flex; justify-content:space-between; align-items:center;
    margin-top:12px; padding:clamp(12px,2vw,16px);
    background:rgba(200,135,42,.1); border:1px solid rgba(200,135,42,.22); border-radius:1px;
  }
  .cp-example-gain-label {
    font-size:clamp(.62rem,1.3vw,.68rem); font-weight:600;
    letter-spacing:.14em; text-transform:uppercase; color:${GOLD};
  }
  .cp-example-gain-val {
    font-family:var(--font-cormorant),serif;
    font-size:clamp(1.15rem,2.5vw,1.5rem); font-weight:700; color:${GOLD};
  }

  /* ════════════════════════════════════
     RESPONSIVE
  ════════════════════════════════════ */
  @media(max-width:480px){
    .cp-hero-stats { gap:10px; }
    .cp-hstat-sep { display:none; }
  }
`;

/* ─── Hook compteur animé ─────────────────────────────────── */
const useAnimatedValue = (target) => {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    const start = prev.current;
    const diff  = target - start;
    const steps = 18;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(start + diff * (i / steps)));
      if (i >= steps) { clearInterval(id); prev.current = target; }
    }, 18);
    return () => clearInterval(id);
  }, [target]);
  return display;
};

/* ─── Slider helper ───────────────────────────────────────── */
const SLIDER_CONFIG = {
  vente:    { min: 5_000_000,  max: 500_000_000, step: 5_000_000,  default: 50_000_000 },
  location: { min: 50_000,     max: 5_000_000,   step: 50_000,     default: 500_000   },
};

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
const CommissionCalculatorPage = () => {
  const router = useRouter();
  const isLoggedIn = isAuthenticated();

  const [type,  setType]  = useState('vente');
  const [price, setPrice] = useState(SLIDER_CONFIG.vente.default);
  const cfg = SLIDER_CONFIG[type];

  /* Recalcul lors du changement de type */
  const handleTypeChange = (t) => {
    setType(t);
    setPrice(SLIDER_CONFIG[t].default);
  };

  /* Calculs */
  const agencyFee  = type === 'vente' ? price * SALE_RATE : price * RENT_RATE;
  const partnerFee = agencyFee * PARTNER_CUT;
  const pct        = Math.round(((price - cfg.min) / (cfg.max - cfg.min)) * 100);

  /* Compteur animé */
  const animatedPartner = useAnimatedValue(partnerFee);

  /* Slider style */
  const sliderStyle = { '--pct': `${pct}%` };

  /* Input texte — parse les espaces */
  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/\s/g, '').replace(/[^\d]/g, '');
    const n   = Number(raw) || 0;
    setPrice(Math.min(Math.max(n, 0), cfg.max));
  };

  const handleCTA = () => router.push(isLoggedIn ? '/mes-biens' : '/register');

  return (
    <div className="cp-root">
      <style>{PAGE_CSS}</style>

      {/* ══ HERO ═══════════════════════════════════════════════ */}
      <motion.section className="cp-hero"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}>

        <Image fill priority
          className="cp-hero-img"
          src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1973&auto=format&fit=crop"
          alt="Immobilier Brazzaville"
          sizes="100vw"
        />
        <div className="cp-hero-grad" />
        <div className="cp-hero-dots" />
        <div className="cp-hero-halo" />
        <div className="cp-hero-accent" />

        <div className="cp-hero-inner">
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:.2, duration:.6 }}>
            <div className="cp-hero-eyebrow">
              <div className="cp-hero-dot" />
              <span className="cp-hero-eyebrow-text">Programme partenaire · Altimmo</span>
            </div>

            <h1 className="cp-hero-h1">
              Devenez <em>Apporteur<br />d'Affaires</em>
            </h1>
            <div className="cp-hero-rule" />
            <p className="cp-hero-sub">
              Référez un bien immobilier et <strong>touchez 30% de notre commission</strong>{' '}
              sur chaque transaction conclue — sans investissement, sans contrainte.
            </p>
          </motion.div>

          <motion.div className="cp-hero-stats"
            initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.4, duration:.6 }}>
            {[
              { val:'30%',   lbl:'De commission' },
              { val:'0 FCFA',lbl:'Investissement' },
              { val:'24h',   lbl:'Validation' },
              { val:'200+',  lbl:'Transactions' },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="cp-hstat-sep" />}
                <div className="cp-hstat">
                  <span className="cp-hstat-val">{s.val}</span>
                  <span className="cp-hstat-lbl">{s.lbl}</span>
                </div>
              </React.Fragment>
            ))}
          </motion.div>

          <motion.div className="cp-scroll-hint"
            initial={{ opacity:0 }} animate={{ opacity:.45 }} transition={{ delay:.8, duration:.6 }}>
            <span>Calculer</span>
            <ChevronDown size={14} color="rgba(245,242,238,0.6)" />
          </motion.div>
        </div>
      </motion.section>

      {/* ══ CALCULATEUR + CTA ════════════════════════════════ */}
      <div className="cp-section">
        <div className="cp-grid">

          {/* ─ Calculateur ─ */}
          <motion.div initial={{ opacity:0, x:-24 }} whileInView={{ opacity:1, x:0 }}
            viewport={{ once:true, amount:.1 }} transition={{ duration:.6, ease:[.22,1,.36,1] }}>

            <div className="cp-calc">
              {/* En-tête */}
              <div className="cp-calc-head">
                <div className="cp-calc-head-dots" />
                <div className="cp-calc-head-inner">
                  <p className="cp-calc-head-title">Estimez vos gains</p>
                  <p className="cp-calc-head-sub">Simulateur en temps réel</p>
                </div>
              </div>

              {/* Corps */}
              <div className="cp-calc-body">

                {/* Tabs */}
                <div className="cp-tabs">
                  {[
                    { id:'vente',    label:'Vente',    Icon:Home },
                    { id:'location', label:'Location', Icon:Key  },
                  ].map(({ id, label, Icon }) => (
                    <button key={id}
                      onClick={() => handleTypeChange(id)}
                      className={`cp-tab${type === id ? ` cp-tab--active-${id}` : ''}`}>
                      <Icon size={13} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Label */}
                <label className="cp-label" htmlFor="cp-price-input">
                  {type === 'vente' ? 'Prix de vente du bien' : 'Loyer mensuel'}
                </label>

                {/* Input */}
                <div className="cp-input-wrap">
                  <span className="cp-input-currency">FCFA</span>
                  <input
                    id="cp-price-input"
                    type="text"
                    className="cp-input"
                    value={fmtNum(price)}
                    onChange={handleInputChange}
                    inputMode="numeric"
                    aria-label={type === 'vente' ? 'Prix de vente en FCFA' : 'Loyer mensuel en FCFA'}
                  />
                </div>

                {/* Slider */}
                <div className="cp-slider-wrap">
                  <input
                    type="range"
                    className="cp-slider"
                    style={sliderStyle}
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    aria-label="Ajuster le montant"
                  />
                  <div className="cp-slider-labels">
                    <span>{fmtXAF(cfg.min)}</span>
                    <span>{fmtXAF(cfg.max)}</span>
                  </div>
                </div>

                {/* Commission agence */}
                <div className="cp-result-agency">
                  <div>
                    <p className="cp-result-agency-label">Commission agence</p>
                    <p className="cp-result-agency-sub">
                      {type === 'vente' ? '10% du prix de vente' : '80% du loyer mensuel'}
                    </p>
                  </div>
                  <span className="cp-result-agency-val">{fmtXAF(agencyFee)}</span>
                </div>

                {/* Votre part */}
                <AnimatePresence mode="wait">
                  <motion.div key={`${type}-${price}`}
                    initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                    exit={{ opacity:0 }} transition={{ duration:.25 }}
                    className="cp-result-main">
                    <div className="cp-result-main-halo" />
                    <p className="cp-result-main-label">Votre part (30%)</p>
                    <p className="cp-result-main-val">{fmtXAF(animatedPartner)}</p>
                    <p className="cp-result-main-sub">
                      Pour {type === 'vente' ? 'une vente à' : 'un loyer de'} {fmtXAF(price)}
                    </p>
                    <div className="cp-bar-wrap">
                      <div className="cp-bar" style={{ width:'30%' }} />
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Info */}
                <div className="cp-info-box">
                  <TrendingUp size={14} color={GOLD} style={{ flexShrink:0, marginTop:2 }} />
                  <p className="cp-info-box-text">
                    {type === 'vente'
                      ? 'Pour chaque vente, vous recevez 30% de notre commission de 10%.'
                      : 'Pour chaque location, vous recevez 30% de notre commission équivalente à 80% du loyer mensuel.'}
                  </p>
                </div>

              </div>
            </div>
          </motion.div>

          {/* ─ CTA ─ */}
          <motion.div initial={{ opacity:0, x:24 }} whileInView={{ opacity:1, x:0 }}
            viewport={{ once:true, amount:.1 }} transition={{ duration:.6, delay:.1, ease:[.22,1,.36,1] }}
            className="cp-cta-col">

            {/* Image */}
            <div className="cp-cta-img-wrap">
              <Image fill
                className="cp-cta-img"
                src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1296&auto=format&fit=crop"
                alt="Partenariat Altimmo"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="cp-cta-img-overlay" />
              <div className="cp-cta-img-badge">
                <div className="cp-cta-img-badge-dot" />
                <span className="cp-cta-img-badge-text">Programme actif</span>
              </div>
            </div>

            <div>
              <h2 className="cp-cta-h2">
                Prêt à <em>commencer ?</em>
              </h2>
            </div>

            <p className="cp-cta-body">
              Créez votre compte, publiez le bien, et nous gérons le reste.
              Dès la transaction conclue, votre commission est versée — sans délai.
            </p>

            {/* Avantages */}
            <div className="cp-advantages">
              {[
                { Icon:Shield,   title:'Inscription gratuite',     sub:'Aucun frais, aucun abonnement.' },
                { Icon:CheckCircle, title:'Paiement sécurisé',     sub:'Commission versée dès la transaction finalisée.' },
                { Icon:Clock,    title:'Accompagnement complet',   sub:'Notre équipe vous guide à chaque étape.' },
              ].map(({ Icon, title, sub }, i) => (
                <motion.div key={i} className="cp-advantage"
                  initial={{ opacity:0, y:10 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay: i * 0.08, duration:.5 }}>
                  <div className="cp-advantage-icon">
                    <Icon size={14} color={GOLD} />
                  </div>
                  <div>
                    <p className="cp-advantage-title">{title}</p>
                    <p className="cp-advantage-sub">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bouton */}
            <button onClick={handleCTA} className="cp-cta-btn">
              {isLoggedIn ? 'Accéder à mon espace' : 'Créer mon compte'}
              <ArrowRight size={13} className="cp-cta-icon" aria-hidden="true" />
            </button>

            <p className="cp-login-hint">
              Déjà inscrit ?{' '}
              <Link href="/login">Connectez-vous</Link>
            </p>

          </motion.div>
        </div>
      </div>

      {/* ══ EXEMPLES CONCRETS ════════════════════════════════ */}
      <section className="cp-examples-section">
        <div className="cp-examples-section-dots" />
        <div className="cp-examples-accent" />
        <div className="cp-section cp-examples-inner">

          <div className="cp-examples-eyebrow">
            <p>Cas concrets</p>
            <h2>Exemples <em>de gains réels</em></h2>
          </div>

          <div className="cp-examples-grid">
            {/* Vente */}
            <motion.div className="cp-example-card"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ duration:.55 }}>
              <Image width={800} height={200}
                className="cp-example-img"
                src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=800&auto=format&fit=crop"
                alt="Villa à vendre Brazzaville"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="cp-example-body">
                <span className="cp-example-badge cp-example-badge--vente">
                  <Home size={10} aria-hidden="true" /> Vente
                </span>
                <p className="cp-example-title">Villa familiale — Bacongo</p>
                <div className="cp-example-row">
                  <span className="cp-example-row-label">Prix de vente</span>
                  <span className="cp-example-row-val">50 000 000 FCFA</span>
                </div>
                <div className="cp-example-row">
                  <span className="cp-example-row-label">Commission agence (10%)</span>
                  <span className="cp-example-row-val">5 000 000 FCFA</span>
                </div>
                <div className="cp-example-gain">
                  <span className="cp-example-gain-label">Votre gain (30%)</span>
                  <span className="cp-example-gain-val">1 500 000 FCFA</span>
                </div>
              </div>
            </motion.div>

            {/* Location */}
            <motion.div className="cp-example-card"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ duration:.55, delay:.1 }}>
              <Image width={800} height={200}
                className="cp-example-img"
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop"
                alt="Appartement à louer Brazzaville"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="cp-example-body">
                <span className="cp-example-badge cp-example-badge--location">
                  <Key size={10} aria-hidden="true" /> Location
                </span>
                <p className="cp-example-title">Appartement moderne — Centre-ville</p>
                <div className="cp-example-row">
                  <span className="cp-example-row-label">Loyer mensuel</span>
                  <span className="cp-example-row-val">500 000 FCFA</span>
                </div>
                <div className="cp-example-row">
                  <span className="cp-example-row-label">Commission agence (80%)</span>
                  <span className="cp-example-row-val">400 000 FCFA</span>
                </div>
                <div className="cp-example-gain">
                  <span className="cp-example-gain-label">Votre gain (30%)</span>
                  <span className="cp-example-gain-val">120 000 FCFA</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </section>

    </div>
  );
};

export default CommissionCalculatorPage;