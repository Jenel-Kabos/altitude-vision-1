"use client";

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

const SLIDER_CSS = `
  @keyframes avSkeleton {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  .av-slider-arrow {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    z-index: 10; border-radius: 50%;
    background: rgba(10,12,15,0.92);
    border: 1px solid rgba(232,228,220,0.12);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: 0.2s;
    /* ↑ cible tactile généreuse */
    width: 44px; height: 44px;
    min-width: 44px; min-height: 44px;
  }
  @media (min-width: 768px) {
    .av-slider-arrow { width: 38px; height: 38px; min-width: 38px; min-height: 38px; }
  }
  .av-slider-arrow-left  { left: -18px; }
  .av-slider-arrow-right { right: -18px; }
  /* Sur mobile : flèches à l'intérieur pour éviter débordement */
  @media (max-width: 560px) {
    .av-slider-arrow-left  { left: 8px; }
    .av-slider-arrow-right { right: 8px; }
  }

  /* Dots */
  .av-slider-dot {
    border: none; cursor: pointer; padding: 0;
    border-radius: 40px; transition: 0.3s;
    height: 6px;
    /* ↑ zone tactile agrandie via padding invisible */
    margin: 4px 0;
  }
`;

const SkeletonCard = () => (
  <div style={{
    borderRadius: '14px', overflow: 'hidden',
    border: '1px solid rgba(232,228,220,0.06)',
    background: 'rgba(17,20,24,0.8)', flexShrink: 0, width: '100%',
    animation: 'avSkeleton 2s ease-in-out infinite',
  }}>
    <div style={{ height: '200px', background: 'rgba(232,228,220,0.05)' }} />
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <div style={{ height: '14px', borderRadius: '6px', background: 'rgba(232,228,220,0.06)', width: '65%' }} />
      <div style={{ height: '11px', borderRadius: '5px', background: 'rgba(232,228,220,0.04)', width: '100%' }} />
      <div style={{ height: '11px', borderRadius: '5px', background: 'rgba(232,228,220,0.04)', width: '55%' }} />
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

  const getSlidesVisible = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 560)  return 1;
    if (window.innerWidth < 900)  return 2;
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
    if      (dragDeltaX.current < -40) next();
    else if (dragDeltaX.current >  40) prev();
    dragDeltaX.current = 0;
  };

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${slidesVisible},1fr)`, gap:'14px' }}>
      {Array.from({ length: slidesVisible }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100px', borderRadius:'14px',
      border:'1px solid rgba(212,43,43,0.14)',
      background:'rgba(212,43,43,0.04)',
    }}>
      <p style={{ color:'#D42B2B', fontSize:'0.88rem' }}>⚠️ {error}</p>
    </div>
  );

  if (!properties || properties.length === 0) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100px', borderRadius:'14px',
      border:'1px dashed rgba(232,228,220,0.1)',
      background:'rgba(232,228,220,0.02)',
    }}>
      <p style={{ color:'rgba(232,228,220,0.28)', fontSize:'0.88rem', fontStyle:'italic' }}>
        Aucune annonce disponible pour le moment.
      </p>
    </div>
  );

  const cardWidthPct = 100 / slidesVisible;

  return (
    <div style={{ position:'relative' }}>
      <style>{SLIDER_CSS}</style>

      {/* Flèche gauche */}
      <AnimatePresence>
        {currentIndex > 0 && (
          <motion.button initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
            exit={{ opacity:0, x:-6 }} onClick={prev} aria-label="Précédent"
            className="av-slider-arrow av-slider-arrow-left"
            style={{ boxShadow:`0 4px 18px ${colors.shadow}` }}>
            <ChevronLeft size={18} style={{ color:colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Flèche droite */}
      <AnimatePresence>
        {currentIndex < maxIndex && (
          <motion.button initial={{ opacity:0, x:6 }} animate={{ opacity:1, x:0 }}
            exit={{ opacity:0, x:6 }} onClick={next} aria-label="Suivant"
            className="av-slider-arrow av-slider-arrow-right"
            style={{ boxShadow:`0 4px 18px ${colors.shadow}` }}>
            <ChevronRight size={18} style={{ color:colors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Track */}
      <div style={{ overflow:'hidden', borderRadius:'14px', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onDragStart} onMouseMove={onDragMove}
        onMouseUp={onDragEnd}    onMouseLeave={onDragEnd}
        onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
        <motion.div
          style={{ display:'flex', width:`${(properties.length / slidesVisible) * 100}%` }}
          animate={{ x: `-${currentIndex * cardWidthPct}%` }}
          transition={{ type:'spring', stiffness:300, damping:35 }}>
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

      {/* Dots — plus grands sur mobile */}
      {properties.length > slidesVisible && (
        <div style={{
          display:'flex', justifyContent:'center',
          alignItems:'center', gap:'7px', marginTop:'28px',
        }}>
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Page ${i+1}`}
              className="av-slider-dot"
              style={{
                width: i === currentIndex ? '22px' : '7px',
                background: i === currentIndex ? colors.primary : 'rgba(232,228,220,0.16)',
                boxShadow: i === currentIndex ? `0 2px 8px ${colors.shadow}` : 'none',
              }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeSlider;