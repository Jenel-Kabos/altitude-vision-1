'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const GOLD   = '#C8960C';
const BLUE   = '#2E7BB5';

const ServiceCard = ({ service, onQuoteRequest }) => {
  const router = useRouter();
  const IconComponent = service.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: '#FDFCFA',
        border: '1px solid rgba(200,150,12,0.14)',
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        cursor: 'pointer',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      className="service-card-root"
    >
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${GOLD} 0%, ${BLUE} 100%)`,
        flexShrink: 0,
        transition: 'height 0.3s ease',
      }} className="service-card-bar" />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: 'clamp(24px, 3vw, 40px)', flex: 1, gap: 0,
      }}>
        <div style={{
          width: 56, height: 56, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(200,150,12,0.07)',
          border: '1px solid rgba(200,150,12,0.18)', borderRadius: 0,
          marginBottom: 20, transition: 'background 0.25s, border-color 0.25s', flexShrink: 0,
        }} className="service-card-icon">
          {IconComponent && <IconComponent size={24} color={GOLD} />}
        </div>

        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 600,
          color: '#1A1612', lineHeight: 1.25, marginBottom: 12,
          transition: 'color 0.2s', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }} className="service-card-title">
          {service.title}
        </h3>

        <div style={{
          width: 28, height: 1,
          background: `linear-gradient(90deg, ${GOLD}, transparent)`,
          marginBottom: 14, flexShrink: 0,
        }} />

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 'clamp(0.82rem, 1.2vw, 0.95rem)', color: '#6B5D52',
          lineHeight: 1.65, marginBottom: 28, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {service.description}
        </p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <button
            onClick={() => onQuoteRequest(service.title)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, width: '100%', padding: '12px 20px',
              background: GOLD, color: '#0A0C0F', border: 'none', borderRadius: 0,
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.74rem',
              fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
              cursor: 'pointer', minHeight: 44, transition: 'background 0.2s, box-shadow 0.2s',
            }} className="service-card-cta">
            <Send size={14} /> Demander un devis
          </button>

          <a
            href={`/altcom/service/${service._id}`}
            onClick={e => { e.preventDefault(); router.push(`/altcom/service/${service._id}`); }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: '0.74rem',
              fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: `rgba(46,123,181,0.75)`, textDecoration: 'none',
              minHeight: 44, padding: '8px 0', transition: 'color 0.2s',
            }} className="service-card-link">
            Détails du service
            <ArrowRight size={13} className="service-card-arrow" style={{ transition: 'transform 0.2s' }} />
          </a>
        </div>
      </div>

      <style>{`
        .service-card-root:hover { border-color: rgba(200,150,12,0.3) !important; box-shadow: 0 16px 48px rgba(26,22,18,0.12) !important; }
        .service-card-root:hover .service-card-bar { height: 3px !important; }
        .service-card-root:hover .service-card-icon { background: rgba(200,150,12,0.12) !important; border-color: rgba(200,150,12,0.3) !important; }
        .service-card-root:hover .service-card-title { color: #8C5A10 !important; }
        .service-card-cta:hover { background: #DCA815 !important; box-shadow: 0 4px 20px rgba(200,150,12,0.28) !important; }
        .service-card-link:hover { color: #2E7BB5 !important; }
        .service-card-link:hover .service-card-arrow { transform: translateX(3px) !important; }
      `}</style>
    </motion.div>
  );
};

export default ServiceCard;