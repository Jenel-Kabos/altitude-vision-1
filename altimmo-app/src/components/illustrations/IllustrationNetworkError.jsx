import React from 'react';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';

// Nuage barré — "erreur réseau / pas de connexion"
export default function IllustrationNetworkError({ size = 160, gold = '#C8960C', muted = '#888', bg = '#1A1A1A' }) {
  // Nuage : combinaison de cercles + rectangle
  const cloud = 'M46 100 Q24 100 24 80 Q24 64 40 60 Q42 44 58 44 Q66 36 78 40 Q88 30 102 36 Q118 36 122 52 Q136 54 136 70 Q136 86 120 88 Q120 88 118 100 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">

      {/* Fond */}
      <Circle cx="80" cy="80" r="68" fill={bg} opacity="0.5" />

      {/* Nuage */}
      <Path d={cloud} fill={bg} stroke={muted} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Croix au centre du nuage */}
      <G>
        <Line x1="64" y1="60" x2="96" y2="92" stroke="#A32D2D" strokeWidth="4" strokeLinecap="round" />
        <Line x1="96" y1="60" x2="64" y2="92" stroke="#A32D2D" strokeWidth="4" strokeLinecap="round" />
      </G>

      {/* Gouttes de pluie (symbolise "connexion perdue") */}
      <G opacity="0.5">
        <Line x1="52" y1="112" x2="48" y2="126" stroke={muted} strokeWidth="2" strokeLinecap="round" />
        <Line x1="80" y1="110" x2="76" y2="128" stroke={muted} strokeWidth="2" strokeLinecap="round" />
        <Line x1="108" y1="112" x2="104" y2="126" stroke={muted} strokeWidth="2" strokeLinecap="round" />
      </G>

      {/* Éclairs barrés */}
      <Path
        d="M68 118 L76 106 L72 106 L80 94"
        fill="none"
        stroke={gold}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Point d'exclamation */}
      <Circle cx="138" cy="118" r="10" fill={bg} stroke={gold} strokeWidth="2" />
      <Line x1="138" y1="112" x2="138" y2="120" stroke={gold} strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="138" cy="124" r="1.5" fill={gold} />
    </Svg>
  );
}
