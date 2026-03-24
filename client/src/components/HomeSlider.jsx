import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import PropertyCard  from './PropertyCard';
import EventCard     from './EventCard';
import PortfolioCard from './PortfolioCard';

const POLE_COLORS = {
  property:  { primary: '#2E7BB5', shadow: 'rgba(46,123,181,0.22)'  },
  event:     { primary: '#D42B2B', shadow: 'rgba(212,43,43,0.22)'   },
  portfolio: { primary: '#C8872A', shadow: 'rgba(200,135,42,0.22)'  },
};

const SkeletonCard = () => (
  <div style={{
    borderRadius: '14px', overflow: 'hidden',
    border: '1px solid rgba(232,228,220,0.06)',
    background: 'rgba(17,20,24,0.8)', flexShrink: 0, width: '100%',
    animation: 'avSkeleton 2s ease-in-out infinite',
  }}>
    <div style={{ height: '200px', background: 'rgba(232,228,220,0.05)' }} />
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <div style={{ height: '13px', borderRadius: '6px', background: 'rgba(232,228,220,0.06)', width: '65%' }} />
      <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(232,228,220,0.04)', width: '100%' }} />
      <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(232,228,220,0.04)', width: '55%' }} />
    </div>
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

  /* Nombre de slides visibles selon largeur fenêtre */
  const getSlidesVisible = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 560)  return 1;
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
  const goTo = (i) => setCurrentIndex(Math.min(maxIndex, Math.max(0, i)));

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
    if      (dragDeltaX.current < -50) next();
    else if (dragDeltaX.current >  50) prev();
    dragDeltaX.current = 0;
  };

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${slidesVisible},1fr)`, gap: '14px' }}>
      {Array.from({ length: slidesVisible }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100px', borderRadius: '14px',
      border: '1px solid rgba(212,43,43,0.14)',
      background: 'rgba(212,43,43,0.04)',
    }}>
      <p style={{ color: '#D42B2B', fontSize: '0.85rem' }}>⚠️ {error}</p>
    </div>
  );

  if (!properties || properties.length === 0) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100px', borderRadius: '14px',
      border: '1px dashed rgba(232,228,220,0.1)',
      background: 'rgba(232,228,220,0.02)',
    }}>
      <p style={{ color: 'rgba(232,228,220,0.28)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        Aucune annonce disponible pour le moment.
      </p>
    </div>
  );

  const cardWidthPct = 100 / slidesVisible;
  const arrowStyle = (side) => ({
    position: 'absolute',
    [side]: '-18px',
    top: '50%', transform: 'translateY(-50%)',
    zIndex: 10, width: '38px', height: '38px',
    borderRadius: '50%',
    background: 'rgba(10,12,15,0.92)',
    border: '1px solid rgba(232,228,220,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: '0.2s',
    boxShadow: `0 4px 18px ${colors.shadow}`,
  });

  return (
    <div style={{ position: 'relative' }}>

      {/* Flèche gauche */}
      <AnimatePresence>
        {currentIndex > 0 && (
          <motion.button initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }} onClick={prev} aria-label="Précédent"
            style={arrowStyle('left')}>
            <ChevronLeft size={17} style={{ color: colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Flèche droite */}
      <AnimatePresence>
        {currentIndex < maxIndex && (
          <motion.button initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }} onClick={next} aria-label="Suivant"
            style={arrowStyle('right')}>
            <ChevronRight size={17} style={{ color: colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Track */}
      <div style={{ overflow: 'hidden', borderRadius: '14px', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onDragStart} onMouseMove={onDragMove}
        onMouseUp={onDragEnd}    onMouseLeave={onDragEnd}
        onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
        <motion.div
          style={{ display: 'flex', width: `${(properties.length / slidesVisible) * 100}%` }}
          animate={{ x: `-${currentIndex * cardWidthPct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}>
          {properties.map((item, index) => (
            <div key={item._id || index}
              style={{
                padding: '0 8px',
                width: `${cardWidthPct / (properties.length / slidesVisible)}%`,
              }}>
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
          alignItems: 'center', gap: '7px', marginTop: '28px',
        }}>
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Page ${i + 1}`}
              style={{
                border: 'none', cursor: 'pointer', padding: 0,
                borderRadius: '40px', transition: '0.3s',
                width: i === currentIndex ? '20px' : '6px',
                height: '6px',
                background: i === currentIndex ? colors.primary : 'rgba(232,228,220,0.14)',
                boxShadow: i === currentIndex ? `0 2px 8px ${colors.shadow}` : 'none',
              }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeSlider;