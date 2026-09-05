'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, ImageOff, Bed, Bath, Maximize2, MapPin, Home } from 'lucide-react';
import LikeButton from './likes/LikeButton';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
  : 'https://altitude-vision.onrender.com';

const optimizeCloudinaryUrl = (url, width = 800) => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('/f_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
};

const formatDate = (d) => {
  if (!d) return 'N/D';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return 'N/D'; }
};

const STATUS_LABEL = { vente: 'Vente', location: 'Location', hebergement: 'Hébergement' };

const CARD_STYLES = `
  .pcard-root {
    font-family: var(--font-dm-sans), sans-serif;
    --gold: #C8960C; --gold-light: #DCA815; --gold-pale: rgba(200,150,12,0.08);
    --ink: #1A1612; --ink-mid: #4A3F35; --ink-soft: #6B5D52;
    --cream: #FAF8F5; --cream-dark: #F0EDE8; --border: rgba(200,150,12,0.2);
  }
  .pcard-grid {
    position: relative; background: #FDFCFA; border-radius: 10px; overflow: hidden;
    border: 1px solid var(--border); box-shadow: 0 2px 20px rgba(26,22,18,0.06);
    transition: box-shadow 0.35s ease, transform 0.35s ease, border-color 0.35s ease;
    display: flex; flex-direction: column; height: 100%; cursor: pointer;
  }
  .pcard-grid:hover { box-shadow: 0 16px 52px rgba(26,22,18,0.16), 0 0 0 1px rgba(200,150,12,0.35); transform: translateY(-4px); border-color: rgba(200,150,12,0.35); }
  .pcard-img-wrap { position: relative; height: clamp(200px, 20vw, 340px); overflow: hidden; background: var(--cream-dark); }
  .pcard-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94); }
  .pcard-grid:hover .pcard-img { transform: scale(1.06); }
  .pcard-scrim { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 35%, rgba(26,18,10,0.55) 75%, rgba(26,18,10,0.82) 100%); }
  .pcard-corner { position: absolute; top: 0; left: 0; width: 48px; height: 48px; border-top: 2px solid var(--gold); border-left: 2px solid var(--gold); opacity: 0; transition: opacity 0.35s ease; }
  .pcard-grid:hover .pcard-corner { opacity: 1; }
  .pcard-corner-br { top: auto; left: auto; bottom: 0; right: 0; border-top: none; border-left: none; border-bottom: 2px solid var(--gold); border-right: 2px solid var(--gold); }
  .pcard-badge { position: absolute; top: 16px; right: 16px; font-size: clamp(0.55rem, 0.9vw, 0.7rem); font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; padding: 5px 12px; border: 1px solid rgba(255,255,255,0.45); backdrop-filter: blur(8px); color: #fff; border-radius: 1px; }
  .pcard-badge-vente { background: rgba(46,123,181,0.72); border-color: rgba(46,123,181,0.6); }
  .pcard-badge-loc { background: rgba(21,128,61,0.72); border-color: rgba(21,128,61,0.5); }
  .pcard-badge-heb { background: rgba(200,150,12,0.78); border-color: rgba(200,150,12,0.6); }
  .pcard-price { position: absolute; bottom: 18px; left: 20px; font-family: var(--font-cormorant), serif; font-size: clamp(1.2rem, 1.8vw, 1.8rem); font-weight: 500; color: #fff; letter-spacing: 0.01em; text-shadow: 0 1px 8px rgba(0,0,0,0.4); }
  .pcard-price span { font-family: var(--font-dm-sans), sans-serif; font-size: 11px; font-weight: 400; letter-spacing: 0.12em; opacity: 0.85; margin-left: 4px; vertical-align: middle; }
  .pcard-like { position: absolute; top: 14px; left: 14px; background: rgba(250,248,245,0.9); backdrop-filter: blur(6px); border-radius: 50%; padding: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .pcard-body { padding: clamp(16px, 2vw, 32px); flex: 1; display: flex; flex-direction: column; gap: 0; background: #FDFCFA; }
  .pcard-type { font-size: clamp(0.55rem, 0.9vw, 0.7rem); font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #8B5E1A; margin-bottom: 6px; }
  .pcard-title { font-family: var(--font-cormorant), serif; font-size: clamp(1rem, 1.5vw, 1.5rem); font-weight: 500; color: var(--ink); line-height: 1.25; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color 0.2s; }
  .pcard-grid:hover .pcard-title { color: #8C5A10; }
  .pcard-location { display: flex; align-items: center; gap: 5px; font-size: clamp(0.68rem, 1vw, 0.85rem); color: var(--ink-soft); letter-spacing: 0.03em; margin-bottom: 16px; }
  .pcard-divider { width: 32px; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); margin-bottom: 16px; }
  .pcard-desc { font-size: clamp(0.75rem, 1.1vw, 0.9rem); line-height: 1.65; color: var(--ink-mid); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 18px; flex: 1; }
  .pcard-stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .pcard-stat { display: flex; align-items: center; gap: 6px; font-size: clamp(0.68rem, 1vw, 0.85rem); color: var(--ink-soft); }
  .pcard-stat-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: var(--gold-pale); border: 1px solid rgba(200,150,12,0.15); border-radius: 6px; }
  .pcard-stat strong { color: var(--ink); font-weight: 500; }
  .pcard-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .pcard-tag { font-size: clamp(0.55rem, 0.9vw, 0.7rem); letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border: 1px solid var(--border); color: var(--ink-soft); background: transparent; border-radius: 4px; transition: border-color 0.2s, color 0.2s; }
  .pcard-grid:hover .pcard-tag { border-color: rgba(200,135,42,0.35); color: var(--gold); }
  .pcard-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid var(--cream-dark); }
  .pcard-date { display: flex; align-items: center; gap: 5px; font-size: clamp(0.62rem, 0.9vw, 0.78rem); color: var(--ink-soft); letter-spacing: 0.05em; }
  .pcard-cta { font-size: clamp(0.58rem, 0.9vw, 0.75rem); font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #8B5E1A; display: flex; align-items: center; gap: 6px; transition: gap 0.2s, color 0.2s; min-height: 44px; padding-block: 8px; }
  .pcard-grid:hover .pcard-cta { color: #9A710A; gap: 10px; }
  .pcard-cta::after { content: '→'; transition: transform 0.2s; }
  .pcard-grid:hover .pcard-cta::after { transform: translateX(3px); }
  .pcard-noimg { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--cream-dark) 0%, #E8E2DA 100%); color: var(--ink-soft); gap: 8px; font-size: 12px; letter-spacing: 0.08em; }
  .pcard-list { position: relative; background: #FDFCFA; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 2px 20px rgba(26,22,18,0.06); transition: box-shadow 0.35s ease, transform 0.35s ease, border-color 0.35s ease; cursor: pointer; }
  .pcard-list:hover { box-shadow: 0 12px 44px rgba(26,22,18,0.14), 0 0 0 1px rgba(200,150,12,0.3); transform: translateY(-3px); border-color: rgba(200,150,12,0.3); }
  .pcard-list-inner { display: flex; flex-direction: column; }
  @media (min-width: 768px) { .pcard-list-inner { flex-direction: row; } }
  .pcard-list-img { position: relative; flex-shrink: 0; height: 260px; }
  @media (min-width: 768px) { .pcard-list-img { width: 360px; height: auto; } }
  .pcard-list-body { padding: 28px 32px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
  .pcard-list-price { font-family: var(--font-cormorant), serif; font-size: 28px; font-weight: 500; color: var(--ink); letter-spacing: 0.01em; margin-bottom: 4px; }
  .pcard-list-price span { font-family: var(--font-dm-sans), sans-serif; font-size: 12px; color: var(--ink-soft); letter-spacing: 0.1em; margin-left: 4px; }
`;

let stylesInjected = false;
const injectStyles = () => {
  if (stylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = CARD_STYLES;
  document.head.appendChild(s);
  stylesInjected = true;
};

const PropertyCard = ({ property, index = 0, viewMode = 'grid' }) => {
  injectStyles();
  const [imageError, setImageError] = useState(false);

  const getImageUrl = (width = 800) => {
    if (property.images?.length > 0) {
      const first = property.images[0];
      if (typeof first === 'string' && first.match(/^https?:\/\//)) return optimizeCloudinaryUrl(first, width);
      if (typeof first === 'string' && first.trim()) return `${BACKEND_URL}/${first.replace(/\\/g, '/').replace(/^\//, '')}`;
    }
    if (property.mainImage) {
      if (property.mainImage.match(/^https?:\/\//)) return optimizeCloudinaryUrl(property.mainImage, width);
      return `${BACKEND_URL}/${property.mainImage.replace(/\\/g, '/').replace(/^\//, '')}`;
    }
    return null;
  };

  const getLocation = () => {
    if (typeof property.location === 'string' && property.location.trim()) return property.location;
    if (property.address && typeof property.address === 'object') {
      const parts = [property.address.street, property.address.arrondissement, property.address.city].filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    if (typeof property.address === 'string' && property.address.trim()) return property.address;
    if (typeof property.city === 'string') return property.city;
    return 'Localisation non spécifiée';
  };

  const getAmenities = () => {
    if (!property.amenities) return [];
    if (Array.isArray(property.amenities)) return property.amenities.filter(Boolean);
    if (typeof property.amenities === 'string') return property.amenities.split(',').map(a => a.trim()).filter(Boolean);
    return [];
  };

  const imgUrl    = getImageUrl(800);
  const statusKey = (property.status || 'vente').toLowerCase();
  const nightlyRate = property.accommodation?.rates?.find?.(r => r.mode === 'nightly')?.amount;
  const displayAmount = statusKey === 'hebergement' && nightlyRate ? nightlyRate : property.price;
  const price     = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(displayAmount || 0);
  const priceSuffix = statusKey === 'hebergement' && nightlyRate ? '/ nuit' : 'FCFA';
  const badgeClass = statusKey === 'hebergement' ? 'pcard-badge-heb' : statusKey === 'location' ? 'pcard-badge-loc' : 'pcard-badge-vente';
  // PHASE-HW1 §18 — un bien adossé à un Hotel publié route vers la fiche
  // Hotel canonique (Hotel._id, jamais Property._id) — parité avec mobile H1.5.
  const isHotel = property.accommodationType === 'hotel' && Boolean(property.hotel);
  const detailHref = isHotel ? `/immobilier/hotels/${property.hotel}` : `/immobilier/property/${property._id}`;
  const amenities = getAmenities();
  const date      = formatDate(property.createdAt);

  const ImagePlaceholder = () => (
    <div className="pcard-noimg"><ImageOff size={32} strokeWidth={1} /><span>Image non disponible</span></div>
  );

  if (viewMode === 'list') {
    return (
      <motion.div className="pcard-root pcard-list"
        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}>
        <Link href={detailHref} className="pcard-list-inner">
          <div className="pcard-list-img">
            {!imageError && imgUrl
              ? <Image src={imgUrl} alt={property.title} fill sizes="(max-width: 768px) 100vw, 360px" className="object-cover" onError={() => setImageError(true)} />
              : <ImagePlaceholder />}
            <div className="pcard-scrim" />
            <div className="pcard-corner" /><div className="pcard-corner pcard-corner-br" />
            <div className={`pcard-badge ${badgeClass}`}>{isHotel ? 'Hôtel' : (STATUS_LABEL[statusKey] || property.status)}</div>
            <div className="pcard-like"><LikeButton targetType="Property" targetId={property._id} size="sm" showCount={false} /></div>
          </div>
          <div className="pcard-list-body">
            <div>
              <div className="pcard-type">{property.type || 'Bien immobilier'}</div>
              <h3 className="pcard-title" style={{ fontSize: 26 }}>{property.title || 'Sans titre'}</h3>
              <div className="pcard-location"><MapPin size={13} style={{ color: '#C8960C', flexShrink: 0 }} />{getLocation()}</div>
              <div className="pcard-divider" />
              <p className="pcard-desc">{property.description || 'Aucune description disponible.'}</p>
            </div>
            <div>
              <div className="pcard-list-price">{price}<span>{priceSuffix}</span></div>
              <div className="pcard-stats" style={{ marginBottom: 12 }}>
                {property.bedrooms > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Bed size={14} color="#C8960C" /></div><strong>{property.bedrooms}</strong> Ch.</div>}
                {property.bathrooms > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Bath size={13} color="#C8960C" /></div><strong>{property.bathrooms}</strong> SDB</div>}
                {property.surface > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Maximize2 size={13} color="#C8960C" /></div><strong>{property.surface}</strong> m²</div>}
                {property.livingRooms > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Home size={13} color="#C8960C" /></div><strong>{property.livingRooms}</strong> Salon</div>}
              </div>
              {amenities.length > 0 && <div className="pcard-tags">{amenities.slice(0, 5).map((a, i) => <span key={i} className="pcard-tag">{a}</span>)}{amenities.length > 5 && <span className="pcard-tag">+{amenities.length - 5}</span>}</div>}
              <div className="pcard-footer">
                <div className="pcard-date"><Calendar size={11} />{date}</div>
                <span className="pcard-cta">Voir le bien</span>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div className="pcard-root pcard-grid"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}>
      <Link href={detailHref} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="pcard-img-wrap">
          {!imageError && imgUrl
            ? <Image src={imgUrl} alt={property.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="pcard-img" onError={() => setImageError(true)} />
            : <ImagePlaceholder />}
          <div className="pcard-scrim" />
          <div className="pcard-corner" /><div className="pcard-corner pcard-corner-br" />
          <div className={`pcard-badge ${badgeClass}`}>{isHotel ? 'Hôtel' : (STATUS_LABEL[statusKey] || property.status)}</div>
          <div className="pcard-price">{price}<span>{priceSuffix}</span></div>
          <div className="pcard-like"><LikeButton targetType="Property" targetId={property._id} size="sm" showCount={false} /></div>
        </div>
        <div className="pcard-body">
          <div className="pcard-type">{property.type || 'Bien immobilier'}</div>
          <h3 className="pcard-title">{property.title || 'Sans titre'}</h3>
          <div className="pcard-location"><MapPin size={12} style={{ color: '#C8960C', flexShrink: 0 }} />{getLocation()}</div>
          <div className="pcard-divider" />
          <p className="pcard-desc">{property.description || 'Aucune description disponible.'}</p>
          <div className="pcard-stats">
            {property.bedrooms > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Bed size={13} color="#C8960C" /></div><strong>{property.bedrooms}</strong>&nbsp;Ch.</div>}
            {property.bathrooms > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Bath size={12} color="#C8960C" /></div><strong>{property.bathrooms}</strong>&nbsp;SDB</div>}
            {property.surface > 0 && <div className="pcard-stat"><div className="pcard-stat-icon"><Maximize2 size={12} color="#C8960C" /></div><strong>{property.surface}</strong>&nbsp;m²</div>}
          </div>
          {amenities.length > 0 && <div className="pcard-tags">{amenities.slice(0, 3).map((a, i) => <span key={i} className="pcard-tag">{a}</span>)}{amenities.length > 3 && <span className="pcard-tag">+{amenities.length - 3}</span>}</div>}
          <div className="pcard-footer">
            <div className="pcard-date"><Calendar size={11} />{date}</div>
            <span className="pcard-cta">Voir</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default PropertyCard;