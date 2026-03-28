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

// ─── Design tokens ────────────────────────────────────────────
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

const priceFormatter = new Intl.NumberFormat('fr-CG', {
  style: 'currency', currency: 'XAF', maximumFractionDigits: 0,
});

// ─── Styles globaux injectés une fois ─────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap');

  .pdp-root {
    font-family: 'Jost', sans-serif;
    background: ${CREAM};
    min-height: 100vh;
    color: ${INK};
  }

  /* Breadcrumb bar */
  .pdp-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(250,248,245,0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(200,135,42,0.12);
  }

  /* Gold rule */
  .pdp-rule {
    width: 48px; height: 1px;
    background: linear-gradient(90deg, ${GOLD}, transparent);
    margin: 10px 0 18px;
  }

  /* Gallery */
  .pdp-main-img {
    width: 100%; height: 520px;
    object-fit: cover;
    display: block;
    transition: transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94);
  }
  .pdp-gallery-wrap:hover .pdp-main-img { transform: scale(1.025); }

  .pdp-thumb {
    width: 100%; aspect-ratio: 4/3;
    object-fit: cover;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
    filter: saturate(0.7);
  }
  .pdp-thumb:hover, .pdp-thumb.active {
    filter: saturate(1);
    transform: scale(1.03);
  }
  .pdp-thumb.active { outline: 2px solid ${GOLD}; outline-offset: 2px; }

  /* Cards */
  .pdp-card {
    background: #FDFCFA;
    border: 1px solid rgba(200,135,42,0.14);
    border-radius: 2px;
    padding: 32px;
  }
  .pdp-card-title {
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${GOLD};
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pdp-card-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(200,135,42,0.3), transparent);
  }

  /* Stat pill */
  .pdp-stat {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px;
    border: 1px solid rgba(200,135,42,0.14);
    border-radius: 2px;
    background: ${CREAM};
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .pdp-stat:hover {
    border-color: rgba(200,135,42,0.35);
    box-shadow: 0 4px 16px rgba(200,135,42,0.08);
  }
  .pdp-stat-icon {
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    background: ${GOLD_PALE};
    border: 1px solid rgba(200,135,42,0.15);
    border-radius: 1px;
    flex-shrink: 0;
  }
  .pdp-stat-val {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; font-weight: 600;
    color: ${INK}; line-height: 1;
  }
  .pdp-stat-lbl {
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.08em;
    color: ${INK_SOFT};
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* Info row */
  .pdp-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid rgba(26,22,18,0.05);
  }
  .pdp-row:last-child { border-bottom: none; }
  .pdp-row-label {
    font-size: 12px; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: ${INK_SOFT};
  }
  .pdp-row-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 17px; font-weight: 500;
    color: ${INK}; text-align: right;
  }

  /* Amenity tag */
  .pdp-tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    border: 1px solid rgba(200,135,42,0.2);
    border-radius: 1px;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: ${INK_MID};
    background: transparent;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
  }
  .pdp-tag:hover {
    border-color: ${GOLD};
    color: ${GOLD};
    background: ${GOLD_PALE};
  }

  /* Sidebar */
  .pdp-sidebar {
    background: ${INK};
    border-radius: 2px;
    overflow: hidden;
    position: sticky; top: 72px;
  }
  .pdp-sidebar-price {
    padding: 32px 28px 24px;
    border-bottom: 1px solid rgba(200,135,42,0.2);
  }
  .pdp-sidebar-body { padding: 28px; }

  /* CTA buttons */
  .pdp-cta-wa {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #166534, #16A34A);
    color: #fff;
    font-family: 'Jost', sans-serif;
    font-size: 13px; font-weight: 600;
    letter-spacing: 0.06em;
    border: none; cursor: pointer;
    border-radius: 1px;
    transition: opacity 0.2s, transform 0.15s;
    text-decoration: none;
    margin-bottom: 10px;
  }
  .pdp-cta-wa:hover { opacity: 0.9; transform: translateY(-1px); }

  .pdp-cta-tel {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px;
    background: transparent;
    color: rgba(200,135,42,0.9);
    font-family: 'Jost', sans-serif;
    font-size: 13px; font-weight: 500;
    letter-spacing: 0.08em;
    border: 1px solid rgba(200,135,42,0.3);
    cursor: pointer; border-radius: 1px;
    transition: border-color 0.2s, color 0.2s;
    text-decoration: none;
  }
  .pdp-cta-tel:hover { border-color: ${GOLD}; color: ${GOLD}; }

  /* Badge */
  .pdp-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px;
    border: 1px solid rgba(200,135,42,0.3);
    color: ${GOLD};
    font-family: 'Jost', sans-serif;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    border-radius: 1px;
    background: ${GOLD_PALE};
  }
  .pdp-badge-avail-yes {
    border-color: rgba(22,163,74,0.3); color: #16A34A;
    background: rgba(22,163,74,0.06);
  }
  .pdp-badge-avail-no {
    border-color: rgba(220,38,38,0.3); color: #DC2626;
    background: rgba(220,38,38,0.06);
  }

  /* Arrow buttons */
  .pdp-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 44px; height: 44px;
    background: rgba(26,22,18,0.55);
    border: 1px solid rgba(200,135,42,0.25);
    backdrop-filter: blur(8px);
    color: #fff; cursor: pointer; border-radius: 1px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.25s, background 0.2s;
  }
  .pdp-gallery-wrap:hover .pdp-arrow { opacity: 1; }
  .pdp-arrow:hover { background: rgba(200,135,42,0.55); }
  .pdp-arrow-left { left: 16px; }
  .pdp-arrow-right { right: 16px; }

  /* Skeleton */
  .pdp-skel { animation: pdp-pulse 1.6s ease-in-out infinite; background: #EDE9E3; border-radius: 2px; }
  @keyframes pdp-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }

  @media (max-width: 1023px) {
    .pdp-main-img { height: 320px; }
    .pdp-card { padding: 20px; }
    .pdp-sidebar { position: static; }
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
  <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
    <div className="pdp-skel" style={{ height:32, width:'55%' }} />
    <div className="pdp-skel" style={{ height:16, width:'30%' }} />
    <div className="pdp-skel" style={{ height:520 }} />
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
      {[1,2,3].map(i=><div key={i} className="pdp-skel" style={{ height:140 }} />)}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────
const PropertyDetailPage = () => {
  injectStyles();
  const { propertyId }  = useParams();
  const [property,  setProperty]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [mainIdx,   setMainIdx]   = useState(0);

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

  if (loading) return (
    <div className="pdp-root">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'48px 24px' }}>
        <DetailSkeleton />
      </div>
    </div>
  );

  if (error || !property) return (
    <div className="pdp-root" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
      <div style={{ textAlign:'center', padding:40 }}>
        <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:28, color:INK, marginBottom:8 }}>
          Annonce introuvable
        </p>
        <p style={{ color:INK_SOFT, fontSize:14, marginBottom:24 }}>{error}</p>
        <Link to="/altimmo/annonces" style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'12px 24px', background:INK, color:'#fff',
          fontFamily:"'Jost', sans-serif", fontSize:12,
          letterSpacing:'0.15em', textTransform:'uppercase',
          textDecoration:'none', borderRadius:1,
        }}>
          <ArrowLeft size={14} /> Retour aux annonces
        </Link>
      </div>
    </div>
  );

  const images = Array.isArray(property.images) && property.images.length > 0
    ? property.images : [];
  const mainImage = images.length > 0 ? buildImageUrl(images[mainIdx]) : PLACEHOLDER;
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
    { label: 'Type de bien',        value: property.type             || '—' },
    { label: 'Construction',        value: property.constructionType || '—' },
    { label: 'Statut',              value: property.status           || '—' },
    { label: 'Disponibilité',       value: property.availability     || '—' },
  ];

  const prevImg = () => setMainIdx(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setMainIdx(i => (i + 1) % images.length);

  const statusIsVente = property.status === 'vente';
  const isAvail       = property.availability === 'Disponible';

  return (
    <div className="pdp-root">
      <SEOHead
        title={property.title}
        description={`${property.type || 'Bien'} à ${property.address?.city || 'Brazzaville'} — ${property.description?.slice(0, 120)}…`}
        image={property.images?.[0]}
        url={`/properties/${property._id}`}
        type="property"
        data={property}
        breadcrumb={[
          { name:'Accueil', path:'/' },
          { name:'Altimmo', path:'/altimmo' },
          { name:property.title, path:`/properties/${property._id}` },
        ]}
      />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <div className="pdp-nav">
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px', height:60, display:'flex', alignItems:'center', gap:12 }}>
          <Link to="/altimmo/annonces" style={{
            display:'inline-flex', alignItems:'center', gap:6,
            fontFamily:"'Jost', sans-serif", fontSize:11, fontWeight:600,
            letterSpacing:'0.15em', textTransform:'uppercase',
            color:INK_SOFT, textDecoration:'none', transition:'color 0.2s',
          }}
            onMouseEnter={e=>e.currentTarget.style.color=GOLD}
            onMouseLeave={e=>e.currentTarget.style.color=INK_SOFT}>
            <ArrowLeft size={13} /> Annonces
          </Link>
          <span style={{ color:'rgba(200,135,42,0.3)', fontSize:12 }}>—</span>
          <span style={{ fontFamily:"'Jost', sans-serif", fontSize:11, color:INK_SOFT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:320 }}>
            {property.title}
          </span>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'52px 24px 80px' }}>

        {/* ── Hero header ─────────────────────────────────── */}
        <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.55, ease:[0.22,1,0.36,1] }}
          style={{ marginBottom:40 }}>

          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:12 }}>
            <div>
              <p style={{ fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color:GOLD, marginBottom:10 }}>
                Altitude-Vision · Altimmo
              </p>
              <h1 style={{
                fontFamily:"'Cormorant Garamond', serif",
                fontSize:'clamp(2rem, 4.5vw, 3.2rem)',
                fontWeight:600, lineHeight:1.1, color:INK,
                maxWidth:700,
              }}>
                {property.title || 'Bien immobilier'}
              </h1>
              <div className="pdp-rule" />
              <div style={{ display:'flex', alignItems:'center', gap:6, color:INK_SOFT, fontSize:13 }}>
                <MapPin size={13} style={{ color:GOLD, flexShrink:0 }} />
                {displayAddress}
              </div>
            </div>

            {/* Badges */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start', paddingTop:4 }}>
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

        {/* ── Gallery ─────────────────────────────────────── */}
        <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.55, ease:[0.22,1,0.36,1] }}
          style={{ marginBottom:48 }}>

          {images.length > 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 200px', gap:3 }}
              className="pdp-gallery-wrap"
              onMouseLeave={()=>{}}>

              {/* Main */}
              <div style={{ position:'relative', overflow:'hidden', borderRadius:2 }}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={mainIdx}
                    src={mainImage}
                    alt="Vue principale"
                    className="pdp-main-img"
                    initial={{ opacity:0, scale:1.04 }}
                    animate={{ opacity:1, scale:1 }}
                    exit={{ opacity:0 }}
                    transition={{ duration:0.4 }}
                    onError={e=>{ e.target.src=PLACEHOLDER; }}
                  />
                </AnimatePresence>

                {/* Counter */}
                <div style={{
                  position:'absolute', bottom:16, left:16,
                  padding:'5px 12px', borderRadius:1,
                  background:'rgba(26,22,18,0.6)', backdropFilter:'blur(8px)',
                  fontFamily:"'Jost', sans-serif", fontSize:11, fontWeight:500,
                  letterSpacing:'0.12em', color:'rgba(255,255,255,0.85)',
                }}>
                  {mainIdx + 1} / {images.length}
                </div>

                {/* Price overlay */}
                <div style={{
                  position:'absolute', bottom:16, right:16,
                  padding:'8px 16px', borderRadius:1,
                  background:'rgba(26,22,18,0.75)', backdropFilter:'blur(8px)',
                  border:'1px solid rgba(200,135,42,0.3)',
                }}>
                  <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:20, fontWeight:600, color:'#fff', lineHeight:1 }}>
                    {priceFormatter.format(property.price || 0)}
                  </p>
                </div>

                {images.length > 1 && (
                  <>
                    <button className="pdp-arrow pdp-arrow-left" onClick={prevImg}>
                      <ChevronLeft size={18} />
                    </button>
                    <button className="pdp-arrow pdp-arrow-right" onClick={nextImg}>
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails column */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, overflow:'hidden', borderRadius:2 }}>
                {images.slice(0, 5).map((img, i) => (
                  <div key={i} style={{ overflow:'hidden', flex:1, borderRadius:2 }}>
                    <img
                      src={buildImageUrl(img)}
                      alt={`Vue ${i+1}`}
                      className={`pdp-thumb ${i === mainIdx ? 'active' : ''}`}
                      style={{ height:'100%' }}
                      onClick={() => setMainIdx(i)}
                      onError={e=>{ e.target.src=PLACEHOLDER; }}
                    />
                  </div>
                ))}
                {images.length > 5 && (
                  <div style={{
                    flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                    background:INK, color:GOLD, borderRadius:2,
                    fontFamily:"'Jost', sans-serif", fontSize:11, fontWeight:600,
                    letterSpacing:'0.15em', cursor:'pointer',
                  }}
                    onClick={() => setMainIdx(5)}>
                    +{images.length - 5} PHOTOS
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              height:420, borderRadius:2, border:`1px dashed rgba(200,135,42,0.25)`,
              background:GOLD_PALE, display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:12, color:INK_SOFT,
            }}>
              <MapPin size={32} style={{ opacity:0.3 }} />
              <p style={{ fontFamily:"'Jost', sans-serif", fontSize:12, letterSpacing:'0.1em' }}>
                AUCUNE IMAGE DISPONIBLE
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Main grid ───────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:32, alignItems:'start' }}>

          {/* Left column */}
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

            {/* Stats */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Caractéristiques</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10 }}>
                {stats.map(({ Icon, label, value }, i) => (
                  <div key={i} className="pdp-stat">
                    <div className="pdp-stat-icon">
                      <Icon size={15} color={GOLD} />
                    </div>
                    <div>
                      <div className="pdp-stat-val">{value}</div>
                      <div className="pdp-stat-lbl">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Description */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Description</div>
              <p style={{
                fontFamily:"'Jost', sans-serif", fontSize:15, lineHeight:1.8,
                color:INK_MID, whiteSpace:'pre-wrap',
              }}>
                {property.description || 'Aucune description disponible pour ce bien.'}
              </p>
            </motion.div>

            {/* Infos */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.5 }}
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
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35, duration:0.5 }}
              className="pdp-card">
              <div className="pdp-card-title">Équipements & Commodités</div>
              {Array.isArray(property.amenities) && property.amenities.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {property.amenities.map((a, i) => (
                    <span key={i} className="pdp-tag">
                      <Check size={10} color={GOLD} />
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color:INK_SOFT, fontSize:13, fontStyle:'italic' }}>
                  Aucun équipement spécifié.
                </p>
              )}
            </motion.div>

            {/* Commentaires */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4, duration:0.5 }}>
              <CommentList targetType="Property" targetId={property._id} />
            </motion.div>
          </div>

          {/* ── Sidebar ────────────────────────────────── */}
          <motion.aside initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.3, duration:0.5 }}>
            <div className="pdp-sidebar">

              {/* Price panel */}
              <div className="pdp-sidebar-price">
                <p style={{
                  fontFamily:"'Jost', sans-serif", fontSize:9, fontWeight:600,
                  letterSpacing:'0.25em', textTransform:'uppercase',
                  color:'rgba(200,135,42,0.6)', marginBottom:10,
                }}>
                  Prix du bien
                </p>
                <p style={{
                  fontFamily:"'Cormorant Garamond', serif",
                  fontSize:'clamp(1.6rem, 2.5vw, 2.2rem)',
                  fontWeight:600, color:'#fff', lineHeight:1,
                }}>
                  {priceFormatter.format(property.price || 0)}
                </p>
                <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
                  <span style={{
                    fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:500,
                    letterSpacing:'0.14em', padding:'4px 10px',
                    border:'1px solid rgba(200,135,42,0.3)', color:GOLD,
                    borderRadius:1, textTransform:'uppercase',
                  }}>
                    En {property.status || 'vente'}
                  </span>
                  {property.availability && (
                    <span style={{
                      fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:500,
                      letterSpacing:'0.14em', padding:'4px 10px',
                      border:`1px solid ${isAvail ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.3)'}`,
                      color: isAvail ? '#22C55E' : '#EF4444',
                      borderRadius:1, textTransform:'uppercase',
                    }}>
                      {property.availability}
                    </span>
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="pdp-sidebar-body">
                <p style={{
                  fontFamily:"'Cormorant Garamond', serif", fontSize:20, fontWeight:500,
                  color:'#fff', marginBottom:6,
                }}>
                  Intéressé par ce bien ?
                </p>
                <p style={{
                  fontFamily:"'Jost', sans-serif", fontSize:12, lineHeight:1.7,
                  color:'rgba(255,255,255,0.45)', marginBottom:22,
                }}>
                  Contactez notre agent pour organiser une visite.
                </p>

                <a href={`https://wa.me/242068002151?text=Bonjour, je suis intéressé par "${property.title || 'un bien'}" (ID: ${property._id})`}
                  target="_blank" rel="noopener noreferrer"
                  className="pdp-cta-wa">
                  <svg viewBox="0 0 24 24" style={{ width:16, height:16, fill:'#fff', flexShrink:0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Contacter sur WhatsApp
                </a>

                <a href="tel:+242068002151" className="pdp-cta-tel">
                  <Phone size={13} /> +242 06 800 21 51
                </a>

                {/* Reassurance */}
                <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', gap:14 }}>
                  {[
                    { Icon:Clock,         text:'Réponse sous 24h garantie' },
                    { Icon:MessageSquare, text:'Visite virtuelle sur demande' },
                    { Icon:Scale,         text:'Accompagnement juridique inclus' },
                  ].map(({ Icon, text }, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{
                        width:28, height:28, borderRadius:1,
                        border:'1px solid rgba(200,135,42,0.2)',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        <Icon size={12} color="rgba(200,135,42,0.7)" />
                      </div>
                      <p style={{
                        fontFamily:"'Jost', sans-serif", fontSize:12, lineHeight:1.65,
                        color:'rgba(255,255,255,0.38)',
                      }}>
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailPage;