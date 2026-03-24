import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import PropertyCard  from './PropertyCard';
import EventCard     from './EventCard';
import PortfolioCard from './PortfolioCard';

const POLE_COLORS = {
  property:  { primary: '#2E7BB5', shadow: 'rgba(46,123,181,0.25)' },
  event:     { primary: '#D42B2B', shadow: 'rgba(212,43,43,0.25)'  },
  portfolio: { primary: '#C8872A', shadow: 'rgba(200,135,42,0.25)' },
};

const SkeletonCard = () => (
  <div style={{
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(232,228,220,0.06)',
    flexShrink: 0, width: '100%',
    background: 'rgba(17,20,24,0.8)',
    animation: 'avSkeletonPulse 2s ease-in-out infinite',
  }}>
    <div style={{ height: '220px', background: 'rgba(232,228,220,0.05)' }} />
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ height: '14px', borderRadius: '7px', background: 'rgba(232,228,220,0.06)', width: '70%' }} />
      <div style={{ height: '11px', borderRadius: '6px', background: 'rgba(232,228,220,0.04)', width: '100%' }} />
      <div style={{ height: '11px', borderRadius: '6px', background: 'rgba(232,228,220,0.04)', width: '60%' }} />
    </div>
    <style>{`@keyframes avSkeletonPulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
  </div>
);

const HomeSlider = ({
  properties  = [],
  isEvent     = false,
  isPortfolio = false,
  loading     = false,
  error       = null,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragging, setDragging]         = useState(false);
  const dragStartX = useRef(0);
  const dragDeltaX = useRef(0);

  const poleKey = isEvent ? 'event' : isPortfolio ? 'portfolio' : 'property';
  const colors  = POLE_COLORS[poleKey];

  const getSlidesVisible = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 640)  return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  };
  const [slidesVisible, setSlidesVisible] = React.useState(getSlidesVisible);

  React.useEffect(() => {
    const onResize = () => setSlidesVisible(getSlidesVisible());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const maxIndex = Math.max(0, properties.length - slidesVisible);

  const prev = useCallback(() => setCurrentIndex(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCurrentIndex(i => Math.min(maxIndex, i + 1)), [maxIndex]);
  const goTo = (index) => setCurrentIndex(Math.min(maxIndex, Math.max(0, index)));

  const onDragStart = (e) => {
    dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    dragDeltaX.current = 0;
    setDragging(true);
  };
  const onDragMove = (e) => {
    if (!dragging) return;
    dragDeltaX.current = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - dragStartX.current;
  };
  const onDragEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragDeltaX.current < -60) next();
    else if (dragDeltaX.current > 60) prev();
    dragDeltaX.current = 0;
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </div>
  );

  // ── Error ──
  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '120px', borderRadius: '16px',
      border: '1px solid rgba(212,43,43,0.15)',
      background: 'rgba(212,43,43,0.04)',
    }}>
      <p style={{ color: '#D42B2B', fontSize: '0.85rem' }}>⚠️ {error}</p>
    </div>
  );

  // ── Vide ──
  if (!properties || properties.length === 0) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '120px', borderRadius: '16px',
      border: '1px dashed rgba(232,228,220,0.1)',
      background: 'rgba(232,228,220,0.02)',
    }}>
      <p style={{ color: 'rgba(232,228,220,0.3)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        Aucune annonce disponible pour le moment.
      </p>
    </div>
  );

  const cardWidthPct = 100 / slidesVisible;

  return (
    <div style={{ position: 'relative' }}>

      {/* Flèche gauche */}
      <AnimatePresence>
        {currentIndex > 0 && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            onClick={prev}
            aria-label="Précédent"
            style={{
              position: 'absolute', left: '-18px', top: '50%',
              transform: 'translateY(-50%)', zIndex: 10,
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(10,12,15,0.9)',
              border: `1px solid rgba(232,228,220,0.1)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: '0.2s',
              boxShadow: `0 4px 20px ${colors.shadow}`,
            }}
          >
            <ChevronLeft size={18} style={{ color: colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Flèche droite */}
      <AnimatePresence>
        {currentIndex < maxIndex && (
          <motion.button
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            onClick={next}
            aria-label="Suivant"
            style={{
              position: 'absolute', right: '-18px', top: '50%',
              transform: 'translateY(-50%)', zIndex: 10,
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(10,12,15,0.9)',
              border: `1px solid rgba(232,228,220,0.1)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: '0.2s',
              boxShadow: `0 4px 20px ${colors.shadow}`,
            }}
          >
            <ChevronRight size={18} style={{ color: colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Track */}
      <div
        style={{ overflow: 'hidden', borderRadius: '16px', cursor: 'grab' }}
        onMouseDown={onDragStart}
        onMouseMove={onDragMove}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
      >
        <motion.div
          style={{
            display: 'flex',
            width: `${(properties.length / slidesVisible) * 100}%`,
          }}
          animate={{ x: `-${currentIndex * cardWidthPct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        >
          {properties.map((item, index) => (
            <div
              key={item._id || index}
              style={{
                padding: '0 10px',
                width: `${cardWidthPct / (properties.length / slidesVisible)}%`,
              }}
            >
              {isEvent ? (
                <EventCard event={item} index={index} />
              ) : isPortfolio ? (
                <PortfolioCard item={item} />
              ) : (
                <PropertyCard property={item} index={index} />
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Dots */}
      {properties.length > slidesVisible && (
        <div style={{
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', gap: '8px', marginTop: '32px',
        }}>
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Page ${i + 1}`}
              style={{
                border: 'none', cursor: 'pointer', padding: 0,
                borderRadius: '40px', transition: '0.3s',
                width: i === currentIndex ? '22px' : '6px',
                height: '6px',
                background: i === currentIndex ? colors.primary : 'rgba(232,228,220,0.15)',
                boxShadow: i === currentIndex ? `0 2px 8px ${colors.shadow}` : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeSlider;