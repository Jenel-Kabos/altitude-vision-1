"use client";
import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search, Shield, Smartphone, MessageSquare, BarChart3, MapPin,
  CheckCircle, ArrowRight, Home, Building2, TrendingUp, Star,
  Clock, Users, Eye, Filter, Camera, Bell, Lock, Zap,
  ChevronRight, Play,
} from 'lucide-react';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';
const INK       = '#111827';
const GRAY      = '#6B7280';

/* ── Animation helpers ──────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0 } };
const fadeLeft  = { hidden: { opacity: 0, x: -32 }, visible: { opacity: 1, x: 0 } };
const fadeRight = { hidden: { opacity: 0, x:  32 }, visible: { opacity: 1, x: 0 } };

const Reveal = ({ children, delay = 0, variant = fadeUp, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} variants={variant}
      initial="hidden" animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}>
      {children}
    </motion.div>
  );
};

/* ── Eyebrow ────────────────────────────────────────────────── */
const Eyebrow = ({ children, color = GOLD }) => (
  <p style={{ color, fontFamily:"'DM Sans',sans-serif", fontSize:'0.72rem', fontWeight:700,
    letterSpacing:'0.20em', textTransform:'uppercase', marginBottom:14 }}>
    {children}
  </p>
);

/* ── Section title ──────────────────────────────────────────── */
const SectionTitle = ({ children, light = false }) => (
  <h2 style={{
    fontFamily:"'Cormorant Garamond',Georgia,serif",
    fontSize:'clamp(2.2rem,5.5vw,4.5rem)',
    fontWeight:400, lineHeight:1.06,
    color: light ? '#fff' : INK,
    marginBottom: 0,
  }}>
    {children}
  </h2>
);

/* ══════════════════════════════════════════════════════════════
   BROWSER MOCKUP — représente l'interface web Altimmo
══════════════════════════════════════════════════════════════ */
const BrowserMockup = ({ children, title = 'altitudevision.agency/altimmo' }) => (
  <div style={{
    borderRadius:14, overflow:'hidden',
    boxShadow:'0 32px 80px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.12)',
    border:'1px solid rgba(255,255,255,0.08)',
  }}>
    {/* Barre navigateur */}
    <div style={{ background:'#1E2228', padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ display:'flex', gap:6 }}>
        {['#FF5F57','#FFBD2E','#28C840'].map(c => (
          <div key={c} style={{ width:12, height:12, borderRadius:'50%', background:c }} />
        ))}
      </div>
      <div style={{
        flex:1, background:'rgba(255,255,255,0.06)', borderRadius:6,
        padding:'5px 12px', display:'flex', alignItems:'center', gap:8,
      }}>
        <Lock size={10} style={{ color:'rgba(255,255,255,0.35)' }} />
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.68rem', color:'rgba(255,255,255,0.45)' }}>
          {title}
        </span>
      </div>
    </div>
    {children}
  </div>
);

/* ── Mockup : liste de biens ──────────────────────────────────  */
const MockupListings = () => (
  <BrowserMockup>
    <div style={{ background:'#F8F8F8', minHeight:360 }}>
      {/* Nav */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:6, background:`linear-gradient(135deg,${BLUE},${BLUE_DARK})` }} />
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', fontWeight:600, color:INK }}>Altimmo</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['Vente','Location','Estimation'].map(l => (
            <span key={l} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.65rem', color:GRAY }}>{l}</span>
          ))}
        </div>
      </div>
      {/* Search bar */}
      <div style={{ padding:'12px 20px', background:'#fff', borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', background:'#F9FAFB', border:`1px solid #E5E7EB`, borderRadius:8, padding:'8px 12px' }}>
          <Search size={13} style={{ color:GRAY, flexShrink:0 }} />
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.70rem', color:'#9CA3AF' }}>Bacongo, Poto-Poto, Moungali…</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <div style={{ background:`${BLUE}15`, borderRadius:5, padding:'3px 8px' }}>
              <span style={{ fontSize:'0.60rem', color:BLUE, fontWeight:600 }}>Location</span>
            </div>
            <div style={{ background:`${GOLD}15`, borderRadius:5, padding:'3px 8px' }}>
              <span style={{ fontSize:'0.60rem', color:GOLD, fontWeight:600 }}>Tous prix</span>
            </div>
          </div>
        </div>
      </div>
      {/* Cards grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'12px 20px' }}>
        {[
          { title:'Villa F5 — Bacongo', price:'85 000 000', badge:'Vente', color:BLUE, img:'#C8D9EA' },
          { title:'Appt F3 — Poto-Poto', price:'350 000/mois', badge:'Location', color:GOLD, img:'#E8D5B0' },
          { title:'Studio — Plateau', price:'150 000/mois', badge:'Location', color:GOLD, img:'#D5E8D5' },
        ].map((c, i) => (
          <div key={i} style={{ background:'#fff', borderRadius:8, overflow:'hidden', border:'1px solid #F3F4F6', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ height:72, background:c.img, position:'relative', display:'flex', alignItems:'flex-end', padding:6 }}>
              <span style={{ background:c.color, color:'#fff', fontSize:'0.52rem', fontWeight:700, padding:'2px 6px', borderRadius:4 }}>{c.badge}</span>
            </div>
            <div style={{ padding:'8px 8px 10px' }}>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.60rem', fontWeight:600, color:INK, marginBottom:2 }}>{c.title}</p>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'0.58rem', color:BLUE, fontWeight:700 }}>{c.price} FCFA</p>
              <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:4 }}>
                <MapPin size={8} style={{ color:GRAY }} />
                <span style={{ fontSize:'0.52rem', color:GRAY }}>Congo Brazzaville</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Footer barre */}
      <div style={{ padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:'0.60rem', color:GRAY, fontFamily:"'DM Sans',sans-serif" }}>142 biens disponibles</span>
        <div style={{ display:'flex', gap:4 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ width:20, height:20, borderRadius:4, background: n===1?BLUE:'#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'0.52rem', color: n===1?'#fff':GRAY, fontWeight:600 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </BrowserMockup>
);

/* ── Mockup : fiche bien ──────────────────────────────────────  */
const MockupDetail = () => (
  <BrowserMockup title="altitudevision.agency/altimmo/property/…">
    <div style={{ background:'#F8F8F8' }}>
      {/* Hero image */}
      <div style={{ height:140, background:`linear-gradient(135deg, ${BLUE}40, ${BLUE_DARK}60)`, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Home size={36} style={{ color:'rgba(255,255,255,0.20)' }} />
        <div style={{ position:'absolute', top:10, left:14, background:'rgba(0,0,0,0.5)', borderRadius:6, padding:'4px 10px' }}>
          <span style={{ fontSize:'0.58rem', color:'#fff', fontWeight:600 }}>8 PHOTOS</span>
        </div>
        <div style={{ position:'absolute', bottom:10, right:14, display:'flex', gap:6 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ width:36, height:28, borderRadius:5, background:i===1?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.20)' }} />
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:10, padding:'12px 16px' }}>
        {/* Left */}
        <div>
          <div style={{ background:BLUE, borderRadius:4, padding:'2px 8px', display:'inline-block', marginBottom:6 }}>
            <span style={{ fontSize:'0.52rem', color:'#fff', fontWeight:700 }}>LOCATION</span>
          </div>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', fontWeight:600, color:INK, marginBottom:4 }}>Villa F5 — Bacongo</p>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
            <MapPin size={10} style={{ color:GRAY }} />
            <span style={{ fontSize:'0.60rem', color:GRAY }}>Rue des Martyrs, Bacongo</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
            {[['5','Pièces'],['3','Chambres'],['220','m²']].map(([v,l]) => (
              <div key={l} style={{ background:'#F3F4F6', borderRadius:6, padding:'6px 4px', textAlign:'center' }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:INK }}>{v}</p>
                <p style={{ fontSize:'0.52rem', color:GRAY }}>{l}</p>
              </div>
            ))}
          </div>
          {/* Description */}
          <div style={{ height:32, background:'#F3F4F6', borderRadius:6, marginBottom:6 }} />
          <div style={{ height:32, background:'#F3F4F6', borderRadius:6 }} />
        </div>
        {/* Right sidebar */}
        <div>
          <div style={{ background:'#fff', borderRadius:8, padding:10, border:'1px solid #E5E7EB', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', marginBottom:8 }}>
            <p style={{ fontSize:'0.55rem', color:GRAY, marginBottom:2 }}>LOYER MENSUEL</p>
            <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', fontWeight:700, color:BLUE }}>850 000</p>
            <p style={{ fontSize:'0.52rem', color:GRAY }}>FCFA / mois</p>
            <div style={{ height:1, background:'#F3F4F6', margin:'8px 0' }} />
            <div style={{ background:BLUE, borderRadius:5, padding:'6px', textAlign:'center' }}>
              <span style={{ fontSize:'0.58rem', color:'#fff', fontWeight:700 }}>CONTACTER L'AGENT</span>
            </div>
            <div style={{ border:`1px solid ${GOLD}`, borderRadius:5, padding:'5px', textAlign:'center', marginTop:5 }}>
              <span style={{ fontSize:'0.58rem', color:GOLD, fontWeight:700 }}>VISITER</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 8px', background:'#F0FDF4', borderRadius:6, border:'1px solid #BBF7D0' }}>
            <Shield size={10} style={{ color:'#16A34A', flexShrink:0 }} />
            <span style={{ fontSize:'0.52rem', color:'#15803D', fontWeight:600 }}>Bien vérifié</span>
          </div>
        </div>
      </div>
    </div>
  </BrowserMockup>
);

/* ── Mockup : téléphone ───────────────────────────────────────  */
const PhoneMockup = () => (
  <div style={{
    width: 160, borderRadius: 28, padding: '10px 6px',
    background: '#1A1A1A',
    boxShadow: '0 24px 60px rgba(0,0,0,0.40), inset 0 0 0 1px rgba(255,255,255,0.08)',
  }}>
    {/* Notch */}
    <div style={{ width:52, height:14, background:'#1A1A1A', borderRadius:10, margin:'0 auto 6px', border:'1px solid #2A2A2A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:4, background:'#2A2A2A', borderRadius:4 }} />
    </div>
    {/* Screen */}
    <div style={{ background:'#F8F8F8', borderRadius:20, overflow:'hidden', minHeight:280 }}>
      {/* Header */}
      <div style={{ background:'#fff', padding:'6px 10px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Image
          src="/images/Logo_Altitude1.png"
          alt="Altitude Vision"
          width={72}
          height={22}
          style={{ objectFit:'contain', objectPosition:'left center' }}
          unoptimized
        />
        <Bell size={12} style={{ color:GRAY }} />
      </div>
      {/* Search */}
      <div style={{ padding:'8px 8px 4px' }}>
        <div style={{ background:'#F3F4F6', borderRadius:7, padding:'6px 8px', display:'flex', alignItems:'center', gap:5 }}>
          <Search size={9} style={{ color:GRAY }} />
          <span style={{ fontSize:'0.55rem', color:'#9CA3AF' }}>Chercher un bien…</span>
        </div>
      </div>
      {/* Filtres rapides */}
      <div style={{ padding:'4px 8px', display:'flex', gap:4, overflowX:'hidden' }}>
        {['Tous','Vente','Location'].map((l,i) => (
          <div key={l} style={{ background:i===0?BLUE:'#F3F4F6', borderRadius:5, padding:'3px 8px', flexShrink:0 }}>
            <span style={{ fontSize:'0.52rem', color:i===0?'#fff':GRAY, fontWeight:600 }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Cards mobiles */}
      <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:6 }}>
        {[
          { title:'Villa F5 Bacongo', price:'850 000 F', img:'#C8D9EA', badge:'Location', c:BLUE },
          { title:'Appt F3 Poto-Poto', price:'85 000 000 F', img:'#E8D5B0', badge:'Vente', c:GOLD },
        ].map((item,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:8, overflow:'hidden', border:'1px solid #F3F4F6', display:'flex', gap:0, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ width:52, background:item.img, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Home size={14} style={{ color:'rgba(0,0,0,0.12)' }} />
            </div>
            <div style={{ padding:'6px 8px', flex:1 }}>
              <span style={{ background:item.c, color:'#fff', fontSize:'0.44rem', fontWeight:700, padding:'1px 4px', borderRadius:3 }}>{item.badge}</span>
              <p style={{ fontSize:'0.58rem', fontWeight:600, color:INK, marginTop:2, lineHeight:1.2 }}>{item.title}</p>
              <p style={{ fontSize:'0.56rem', color:item.c, fontWeight:700, marginTop:1 }}>{item.price}</p>
              <div style={{ display:'flex', alignItems:'center', gap:2, marginTop:2 }}>
                <MapPin size={7} style={{ color:GRAY }} />
                <span style={{ fontSize:'0.48rem', color:GRAY }}>Congo Brazzaville</span>
                <div style={{ marginLeft:'auto', display:'flex', gap:1 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={7} fill={GOLD} style={{ color:GOLD }} />)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Bottom nav */}
      <div style={{ background:'#fff', borderTop:'1px solid #F3F4F6', padding:'6px 0', display:'flex', justifyContent:'space-around', marginTop:8 }}>
        {[Home, Search, Heart, Users].map((Icon, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <Icon size={12} style={{ color: i===0?BLUE:GRAY }} />
            <div style={{ width: i===0?16:0, height:2, background:BLUE, borderRadius:2 }} />
          </div>
        ))}
      </div>
    </div>
    {/* Home indicator */}
    <div style={{ width:40, height:4, background:'#333', borderRadius:4, margin:'8px auto 0' }} />
  </div>
);

// Heart icon (not in lucide import)
const Heart = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════ */
export default function AltimmoAppPage() {
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:'#F8F8F8' }}>

      {/* ══ 1. HERO ══════════════════════════════════════════════ */}
      <section style={{
        background: `linear-gradient(135deg, #0A1628 0%, #0F2440 40%, #1A3A5C 70%, #0D1F35 100%)`,
        padding: 'clamp(80px,12vw,160px) clamp(20px,6vw,80px) 0',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Lumières d'ambiance */}
        <div style={{ position:'absolute', top:-120, left:-80, width:500, height:500, borderRadius:'50%', background:`${BLUE}08`, filter:'blur(100px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:60, right:-60, width:400, height:400, borderRadius:'50%', background:`${GOLD}06`, filter:'blur(80px)', pointerEvents:'none' }} />

        <div style={{ maxWidth:1300, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'clamp(40px,8vw,80px)', alignItems:'center' }}>
            {/* Left */}
            <div style={{ textAlign:'center' }}>
              <Reveal>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:18,
                  background:'rgba(200,150,12,0.10)', border:'1px solid rgba(200,150,12,0.20)',
                  borderRadius:100, padding:'6px 16px' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:GOLD }} />
                  <span style={{ fontSize:'0.68rem', fontWeight:700, color:GOLD, letterSpacing:'0.18em', textTransform:'uppercase' }}>
                    Application Altimmo
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.06}>
                <h1 style={{
                  fontFamily:"'Cormorant Garamond',Georgia,serif",
                  fontSize:'clamp(3.2rem,9vw,8rem)',
                  fontWeight:400, lineHeight:1, color:'#fff',
                  marginBottom:16,
                }}>
                  L'immobilier<br />
                  <span style={{ color:GOLD }}>Congo Brazzaville</span><br />
                  <span style={{ color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>simplifié.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p style={{ fontSize:'clamp(0.95rem,2vw,1.12rem)', color:'rgba(255,255,255,0.60)', lineHeight:1.72,
                  maxWidth:580, margin:'0 auto 32px' }}>
                  Altimmo est la plateforme immobilière d'Altitude-Vision dédiée au Congo Brazzaville.
                  Recherchez, comparez et sécurisez vos transactions depuis n'importe quel appareil.
                </p>
              </Reveal>

              <Reveal delay={0.18}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
                  <Link href="/altimmo/annonces" style={{
                    display:'inline-flex', alignItems:'center', gap:8,
                    background:`linear-gradient(135deg,${BLUE},${BLUE_DARK})`,
                    color:'#fff', borderRadius:8, padding:'13px 28px',
                    fontWeight:700, fontSize:'0.80rem', letterSpacing:'0.10em',
                    textTransform:'uppercase', textDecoration:'none',
                    boxShadow:`0 6px 24px ${BLUE}40`,
                  }}>
                    <Search size={15} /> Voir les annonces
                  </Link>
                  <Link href="/altimmo" style={{
                    display:'inline-flex', alignItems:'center', gap:8,
                    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)',
                    color:'rgba(255,255,255,0.85)', borderRadius:8, padding:'13px 24px',
                    fontWeight:600, fontSize:'0.80rem', letterSpacing:'0.08em',
                    textTransform:'uppercase', textDecoration:'none',
                  }}>
                    En savoir plus <ArrowRight size={14} />
                  </Link>
                </div>
              </Reveal>

              {/* Stats */}
              <Reveal delay={0.24}>
                <div style={{ display:'flex', justifyContent:'center', gap:'clamp(24px,5vw,48px)', marginTop:48, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                  {[['200+','Familles logées'],['98%','Clients satisfaits'],['5 ans',"D'expertise locale"]].map(([n,l]) => (
                    <div key={l} style={{ textAlign:'center' }}>
                      <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:400, color:'#fff', lineHeight:1 }}>{n}</p>
                      <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.40)', letterSpacing:'0.12em', textTransform:'uppercase', marginTop:4 }}>{l}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>

          {/* Mockup navigateur — flottant sous le hero */}
          <Reveal delay={0.30}>
            <div style={{ marginTop:52, transform:'perspective(1200px) rotateX(4deg)', transformOrigin:'top center' }}>
              <MockupListings />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 2. CONTEXTE DE CRÉATION ══════════════════════════════ */}
      <section style={{ padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)', background:'#fff' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr', gap:'clamp(48px,8vw,80px)', alignItems:'center' }}>

          <Reveal style={{ maxWidth:760, margin:'0 auto', textAlign:'center' }}>
            <Eyebrow>Pourquoi Altimmo est né</Eyebrow>
            <SectionTitle>Un marché immobilier<br /><em style={{ color:BLUE, fontStyle:'normal' }}>qui méritait mieux.</em></SectionTitle>
          </Reveal>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24 }}>
            {[
              {
                icon: Eye, color: '#DC2626',
                title: 'Marché opaque',
                body: "Avant Altimmo, trouver un bien au Congo relevait du bouche-à-oreille. Les prix variaient du simple au double selon la source, sans aucune transparence.",
              },
              {
                icon: Shield, color: BLUE,
                title: 'Notre réponse',
                body: "Nous avons créé une plateforme centralisée où chaque annonce est vérifiée par nos agents terrain. Prix réels, photos authentiques, informations complètes.",
              },
              {
                icon: Zap, color: GOLD,
                title: 'La solution aujourd\'hui',
                body: "Altimmo permet à tout Congolais de rechercher, comparer et contacter un expert en moins de 5 minutes — depuis le Congo ou depuis l'étranger.",
              },
            ].map(({ icon: Icon, color, title, body }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div style={{
                  background:'#F8F8F8', borderRadius:14,
                  padding:'clamp(24px,4vw,36px)',
                  border:'1px solid rgba(17,24,39,0.06)',
                  height:'100%',
                }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <h3 style={{ fontSize:'1.05rem', fontWeight:700, color:INK, marginBottom:10 }}>{title}</h3>
                  <p style={{ fontSize:'0.90rem', color:GRAY, lineHeight:1.75, fontWeight:400 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. AVANTAGES CLÉS ════════════════════════════════════ */}
      <section style={{ padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)', background:'#F8F8F8' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <Reveal style={{ maxWidth:640, marginBottom:'clamp(40px,7vw,72px)' }}>
            <Eyebrow color={BLUE}>Pourquoi choisir Altimmo</Eyebrow>
            <SectionTitle>Vos avantages,<br /><span style={{ color:GOLD }}>au quotidien.</span></SectionTitle>
          </Reveal>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
            {[
              { icon:Search,      color:BLUE,    title:'Recherche intelligente',    desc:"Filtrez par quartier, surface, budget, type de bien. Résultats en temps réel sans recharger la page." },
              { icon:Shield,      color:'#16A34A',title:'Biens vérifiés',           desc:"Chaque annonce est inspectée physiquement par nos agents. Vous ne visitez que ce qui correspond vraiment." },
              { icon:Smartphone,  color:GOLD,    title:'100% responsive',           desc:"L'expérience est identique sur ordinateur, tablette ou téléphone. Cherchez depuis n'importe où." },
              { icon:MessageSquare,color:'#7C3AED',title:'Contact direct',         desc:"Envoyez un message ou demandez une visite en un clic. Nos agents répondent sous 24 h." },
              { icon:BarChart3,   color:'#EA580C',title:'Estimation gratuite',      desc:"Obtenez une fourchette de valeur pour votre bien grâce à notre outil d'estimation en ligne." },
              { icon:Lock,        color:'#0D9488',title:'Transactions sécurisées', desc:"Nos conseils juridiques et notariaux accompagnent chaque transaction. Zéro mauvaise surprise." },
            ].map(({ icon: Icon, color, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <div style={{
                  background:'#fff', borderRadius:14, padding:'clamp(22px,3.5vw,30px)',
                  border:'1px solid rgba(17,24,39,0.07)',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
                  transition:'all 0.3s ease',
                  height:'100%',
                }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`${color}12`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <h3 style={{ fontSize:'0.96rem', fontWeight:700, color:INK, marginBottom:8 }}>{title}</h3>
                  <p style={{ fontSize:'0.86rem', color:GRAY, lineHeight:1.72, fontWeight:400 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. COMMENT ÇA MARCHE ═════════════════════════════════ */}
      <section style={{ padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)', background:'#fff' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <Reveal style={{ textAlign:'center', maxWidth:600, margin:'0 auto clamp(48px,7vw,80px)' }}>
            <Eyebrow>Guide d'utilisation</Eyebrow>
            <SectionTitle>En 3 étapes<br /><span style={{ color:BLUE }}>vers votre bien.</span></SectionTitle>
          </Reveal>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:24, position:'relative' }}>
            {[
              {
                step:'01', icon: Filter, color: BLUE,
                title: 'Définissez votre recherche',
                desc: "Saisissez vos critères : quartier, type de bien (villa, appartement, studio…), budget, surface. Les filtres s'appliquent instantanément.",
                details: ['Recherche par mots-clés', 'Filtres avancés combinables', 'Tri par prix, date, surface'],
              },
              {
                step:'02', icon: Eye, color: GOLD,
                title: 'Explorez les biens',
                desc: "Consultez les fiches détaillées avec galerie photos, descriptif complet, commodités, localisation précise et informations juridiques.",
                details: ['Photos haute résolution', 'Plan et localisation', 'Badge "Bien vérifié"'],
              },
              {
                step:'03', icon: MessageSquare, color: '#7C3AED',
                title: 'Contactez l\'agent',
                desc: "Posez vos questions, planifiez une visite ou faites une offre directement depuis la fiche. Notre équipe répond sous 24 h.",
                details: ['Messagerie intégrée', 'Prise de RDV en ligne', 'Accompagnement complet'],
              },
            ].map(({ step, icon: Icon, color, title, desc, details }, i) => (
              <Reveal key={step} delay={i * 0.10}>
                <div style={{ position:'relative' }}>
                  {/* Numéro d'étape */}
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",
                    fontSize:'5rem', fontWeight:300,
                    color:`${color}12`, lineHeight:1,
                    marginBottom:-16, paddingLeft:4,
                  }}>{step}</div>
                  <div style={{
                    background:'#F8F8F8', borderRadius:14,
                    padding:'clamp(22px,4vw,32px)',
                    border:'1px solid rgba(17,24,39,0.07)',
                    borderTop:`3px solid ${color}`,
                  }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:`${color}14`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                    <h3 style={{ fontSize:'1.0rem', fontWeight:700, color:INK, marginBottom:10 }}>{title}</h3>
                    <p style={{ fontSize:'0.86rem', color:GRAY, lineHeight:1.74, marginBottom:16, fontWeight:400 }}>{desc}</p>
                    <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                      {details.map(d => (
                        <li key={d} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <CheckCircle size={13} style={{ color, flexShrink:0 }} />
                          <span style={{ fontSize:'0.82rem', color:'#374151' }}>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. GALERIE DE L'APP ══════════════════════════════════ */}
      <section style={{
        padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)',
        background:`linear-gradient(160deg,#0A1628 0%,#0F2440 50%,#152E4A 100%)`,
        overflow:'hidden', position:'relative',
      }}>
        <div style={{ position:'absolute', bottom:-80, left:'50%', transform:'translateX(-50%)', width:'80%', height:300, background:`${BLUE}06`, filter:'blur(80px)', borderRadius:'50%', pointerEvents:'none' }} />

        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'clamp(40px,7vw,64px)' }}>
            <Reveal style={{ textAlign:'center' }}>
              <Eyebrow>L'application en images</Eyebrow>
              <SectionTitle light>
                Une interface pensée<br />
                <span style={{ color:GOLD }}>pour l'efficacité.</span>
              </SectionTitle>
              <p style={{ fontSize:'clamp(0.88rem,2vw,1rem)', color:'rgba(255,255,255,0.55)', marginTop:16, maxWidth:560, margin:'16px auto 0', lineHeight:1.75 }}>
                Ergonomique sur grand écran comme sur mobile, l'interface Altimmo guide l'utilisateur à chaque étape sans friction.
              </p>
            </Reveal>

            {/* Desktop mockup */}
            <Reveal delay={0.10}>
              <MockupDetail />
            </Reveal>

            {/* Téléphone + features flottantes */}
            <Reveal delay={0.16}>
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:32, flexWrap:'wrap' }}>
                <PhoneMockup />
                <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:300 }}>
                  {[
                    { icon:Bell,    color:GOLD,  title:'Alertes personnalisées', desc:'Recevez une notification dès qu\'un bien correspondant à vos critères est publié.' },
                    { icon:Camera,  color:BLUE,  title:'Galerie immersive',      desc:"Jusqu'à 20 photos par bien, organisées pour vous donner une vision complète des espaces." },
                    { icon:MapPin,  color:'#16A34A',title:'Localisation précise',desc:'Chaque bien est géolocalisé. Estimez les distances avec les points d\'intérêt.' },
                  ].map(({ icon: Icon, color, title, desc }) => (
                    <div key={title} style={{ display:'flex', gap:14, alignItems:'flex-start',
                      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                      borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ width:36, height:36, borderRadius:9, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Icon size={17} style={{ color }} />
                      </div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:'0.86rem', color:'#fff', marginBottom:4 }}>{title}</p>
                        <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', lineHeight:1.65 }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ 6. FONCTIONNALITÉS COMPLÈTES ═════════════════════════ */}
      <section style={{ padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)', background:'#F8F8F8' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'clamp(40px,7vw,72px)' }}>
            <Reveal>
              <Eyebrow color={BLUE}>Fonctionnalités</Eyebrow>
              <SectionTitle>Tout ce dont vous avez<br /><span style={{ color:GOLD }}>besoin, intégré.</span></SectionTitle>
            </Reveal>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
              {[
                { icon:Home,         color:BLUE,    label:'Annonces en temps réel'       },
                { icon:Filter,       color:GOLD,    label:'Filtres avancés'               },
                { icon:Camera,       color:'#7C3AED',label:'Photos HD'                  },
                { icon:BarChart3,    color:'#EA580C',label:'Estimation de bien'           },
                { icon:Users,        color:'#0D9488',label:'Espace propriétaire'          },
                { icon:MessageSquare,color:'#16A34A',label:'Messagerie intégrée'          },
                { icon:Bell,         color:GOLD,    label:'Alertes personnalisées'        },
                { icon:Shield,       color:BLUE,    label:'Biens certifiés'               },
                { icon:MapPin,       color:'#DC2626',label:'Géolocalisation'              },
                { icon:Clock,        color:'#7C3AED',label:'Disponibilité 24h/7j'        },
                { icon:Star,         color:GOLD,    label:'Avis clients vérifiés'         },
                { icon:TrendingUp,   color:'#0D9488',label:'Conseil investissement'       },
              ].map(({ icon: Icon, color, label }, i) => (
                <Reveal key={label} delay={Math.floor(i / 4) * 0.05 + (i % 4) * 0.04}>
                  <div style={{
                    background:'#fff', borderRadius:10, padding:'14px 16px',
                    border:'1px solid rgba(17,24,39,0.07)',
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:`${color}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={17} style={{ color }} />
                    </div>
                    <span style={{ fontSize:'0.86rem', fontWeight:600, color:INK }}>{label}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ 7. TÉMOIGNAGES ══════════════════════════════════════ */}
      <section style={{ padding:'clamp(72px,10vw,130px) clamp(20px,6vw,80px)', background:'#fff' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <Reveal style={{ textAlign:'center', maxWidth:600, margin:'0 auto clamp(40px,6vw,64px)' }}>
            <Eyebrow>Ce qu'ils en disent</Eyebrow>
            <SectionTitle>Ils ont trouvé<br /><span style={{ color:BLUE }}>grâce à Altimmo.</span></SectionTitle>
          </Reveal>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {[
              { name:'Marie K.', role:'Propriétaire', stars:5, text:"En quelques jours, j'avais trouvé un locataire sérieux pour ma villa de Bacongo. La plateforme m'a évité des mois de galère.", color:BLUE },
              { name:'Jean-Pierre M.', role:'Locataire', stars:5, text:"J'ai cherché depuis Paris et j'ai visité 3 biens en arrivant à Brazza. Tout était exactement comme sur les photos. Impeccable.", color:GOLD },
              { name:'Christelle N.', role:'Investisseuse', stars:5, text:"L'outil d'estimation m'a aidée à valider le prix de mon investissement avant de signer. Je recommande à 100%.", color:'#7C3AED' },
            ].map(({ name, role, stars, text, color }, i) => (
              <Reveal key={name} delay={i * 0.08}>
                <div style={{
                  background:'#F8F8F8', borderRadius:14, padding:'clamp(22px,4vw,30px)',
                  border:'1px solid rgba(17,24,39,0.07)',
                  borderLeft:`4px solid ${color}`,
                }}>
                  <div style={{ display:'flex', gap:4, marginBottom:14 }}>
                    {Array.from({length:stars}).map((_,i) => (
                      <Star key={i} size={14} fill={GOLD} style={{ color:GOLD }} />
                    ))}
                  </div>
                  <p style={{ fontSize:'0.92rem', color:'#374151', lineHeight:1.75, fontStyle:'italic', marginBottom:18 }}>"{text}"</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:'0.80rem', fontWeight:700, color }}>{name[0]}</span>
                    </div>
                    <div>
                      <p style={{ fontWeight:700, fontSize:'0.88rem', color:INK }}>{name}</p>
                      <p style={{ fontSize:'0.76rem', color:GRAY }}>{role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. CTA FINAL ════════════════════════════════════════ */}
      <section style={{
        padding:'clamp(80px,12vw,150px) clamp(20px,6vw,80px)',
        background:`linear-gradient(135deg,${BLUE_DARK} 0%,${BLUE} 60%,#0A1628 100%)`,
        textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 20% 80%, rgba(200,150,12,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%)', pointerEvents:'none' }} />

        <div style={{ maxWidth:700, margin:'0 auto', position:'relative' }}>
          <Reveal>
            <p style={{ fontSize:'0.70rem', fontWeight:700, color:'rgba(255,255,255,0.50)', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:16 }}>
              Commencez maintenant
            </p>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2.5rem,7vw,5.5rem)', fontWeight:400, color:'#fff', lineHeight:1.06, marginBottom:20 }}>
              Votre prochain bien<br />
              <span style={{ color:GOLD }}>vous attend.</span>
            </h2>
            <p style={{ fontSize:'clamp(0.90rem,2vw,1.05rem)', color:'rgba(255,255,255,0.55)', lineHeight:1.72, marginBottom:36 }}>
              Rejoignez les centaines de familles qui ont trouvé leur logement au Congo Brazzaville grâce à Altimmo. C'est gratuit, rapide et sécurisé.
            </p>
            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <Link href="/altimmo/annonces" style={{
                display:'inline-flex', alignItems:'center', gap:9,
                background:'#fff', color:BLUE, borderRadius:8,
                padding:'14px 32px', fontWeight:700, fontSize:'0.82rem',
                letterSpacing:'0.08em', textTransform:'uppercase',
                textDecoration:'none', boxShadow:'0 8px 28px rgba(0,0,0,0.20)',
              }}>
                <Search size={15} /> Explorer les biens
              </Link>
              <Link href="/contact" style={{
                display:'inline-flex', alignItems:'center', gap:9,
                background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)',
                color:'rgba(255,255,255,0.88)', borderRadius:8,
                padding:'14px 28px', fontWeight:600, fontSize:'0.82rem',
                letterSpacing:'0.08em', textTransform:'uppercase', textDecoration:'none',
              }}>
                Parler à un expert <ArrowRight size={14} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
