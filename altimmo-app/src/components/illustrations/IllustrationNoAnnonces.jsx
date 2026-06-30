import React from 'react';
import Svg, { G, Path, Rect, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

// Maison + loupe — "aucune annonce trouvée"
export default function IllustrationNoAnnonces({ size = 160, gold = '#C8960C', muted = '#888', bg = '#1A1A1A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Defs>
        <LinearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gold} stopOpacity="0.9" />
          <Stop offset="1" stopColor={gold} stopOpacity="0.5" />
        </LinearGradient>
      </Defs>

      {/* Cercle de fond */}
      <Circle cx="80" cy="80" r="68" fill={bg} opacity="0.5" />

      {/* Corps de la maison */}
      <Rect x="38" y="74" width="74" height="58" rx="3" fill="none" stroke={muted} strokeWidth="2.5" />

      {/* Toit */}
      <Path d="M28 76 L80 36 L132 76" fill="url(#roofGrad)" stroke={gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Porte */}
      <Rect x="66" y="100" width="28" height="32" rx="14" fill="none" stroke={muted} strokeWidth="2" />

      {/* Fenêtre gauche */}
      <Rect x="44" y="82" width="18" height="16" rx="2" fill="none" stroke={muted} strokeWidth="1.8" />
      <Line x1="53" y1="82" x2="53" y2="98" stroke={muted} strokeWidth="1.2" />
      <Line x1="44" y1="90" x2="62" y2="90" stroke={muted} strokeWidth="1.2" />

      {/* Fenêtre droite */}
      <Rect x="88" y="82" width="18" height="16" rx="2" fill="none" stroke={muted} strokeWidth="1.8" />
      <Line x1="97" y1="82" x2="97" y2="98" stroke={muted} strokeWidth="1.2" />
      <Line x1="88" y1="90" x2="106" y2="90" stroke={muted} strokeWidth="1.2" />

      {/* Loupe */}
      <G>
        <Circle cx="116" cy="112" r="16" fill={bg} stroke={gold} strokeWidth="3" />
        <Line x1="127" y1="123" x2="138" y2="134" stroke={gold} strokeWidth="4" strokeLinecap="round" />
        {/* Reflet loupe */}
        <Path d="M108 106 Q110 103 113 102" stroke={gold} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      </G>
    </Svg>
  );
}
