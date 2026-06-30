import React from 'react';
import Svg, { Rect, Circle, Line, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';

// Calendrier vide — "aucune visite"
export default function IllustrationNoVisites({ size = 160, gold = '#C8960C', muted = '#888', bg = '#1A1A1A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Defs>
        <LinearGradient id="calHeader" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gold} stopOpacity="0.9" />
          <Stop offset="1" stopColor={gold} stopOpacity="0.55" />
        </LinearGradient>
      </Defs>

      {/* Fond */}
      <Circle cx="80" cy="80" r="68" fill={bg} opacity="0.5" />

      {/* Corps calendrier */}
      <Rect x="22" y="44" width="116" height="94" rx="10" fill="none" stroke={muted} strokeWidth="2.5" />

      {/* En-tête doré */}
      <Path d="M22 44 Q22 44 22 54 L138 54 Q138 44 138 44 Q138 44 132 44 L28 44 Q22 44 22 44 Z" fill="url(#calHeader)" />
      <Rect x="22" y="44" width="116" height="24" rx="10" fill="url(#calHeader)" />

      {/* Anneaux de reliure */}
      <Rect x="52" y="32" width="10" height="24" rx="5" fill={gold} />
      <Rect x="98" y="32" width="10" height="24" rx="5" fill={gold} />

      {/* Lignes de grille — 3 colonnes x 3 lignes */}
      {[0, 1, 2].map(row =>
        [0, 1, 2, 3].map(col => (
          <Circle
            key={`${row}-${col}`}
            cx={38 + col * 28}
            cy={82 + row * 22}
            r="3.5"
            fill="none"
            stroke={muted}
            strokeWidth="1.5"
            opacity="0.5"
          />
        ))
      )}

      {/* Croix rouge sur case du milieu */}
      <G>
        <Circle cx="80" cy="104" r="12" fill={bg} stroke={muted} strokeWidth="1.5" opacity="0.8" />
        <Line x1="74" y1="98" x2="86" y2="110" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="86" y1="98" x2="74" y2="110" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round" />
      </G>

      {/* Texte-fantôme "MOI" dans l'en-tête */}
      <Line x1="54" y1="58" x2="76" y2="58" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
      <Line x1="84" y1="58" x2="106" y2="58" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
