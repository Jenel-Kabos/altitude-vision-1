import React from 'react';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

// Cœur vide + étincelles — "aucun favori"
export default function IllustrationNoFavoris({ size = 160, gold = '#C8960C', muted = '#888', bg = '#1A1A1A' }) {
  // Chemin du cœur centré en (80,82), hauteur ~65
  const heart = 'M80 115 C28 92 14 66 14 48 C14 30 28 18 46 18 C60 18 72 27 80 38 C88 27 100 18 114 18 C132 18 146 30 146 48 C146 66 132 92 80 115 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Defs>
        <LinearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gold} stopOpacity="0.18" />
          <Stop offset="1" stopColor={gold} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>

      {/* Cercle de fond */}
      <Circle cx="80" cy="80" r="68" fill={bg} opacity="0.5" />

      {/* Cœur rempli (très subtil) */}
      <Path d={heart} fill="url(#heartGrad)" />

      {/* Cœur contour */}
      <Path d={heart} fill="none" stroke={gold} strokeWidth="3" strokeLinejoin="round" />

      {/* Étincelle haut-gauche */}
      <G opacity="0.7">
        <Path d="M32 32 L32 22" stroke={gold} strokeWidth="2" strokeLinecap="round" />
        <Path d="M27 27 L37 27" stroke={gold} strokeWidth="2" strokeLinecap="round" />
        <Path d="M28.5 23.5 L35.5 30.5" stroke={gold} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M35.5 23.5 L28.5 30.5" stroke={gold} strokeWidth="1.5" strokeLinecap="round" />
      </G>

      {/* Étincelle haut-droit */}
      <G opacity="0.5">
        <Path d="M128 28 L128 21" stroke={gold} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M124.5 24.5 L131.5 24.5" stroke={gold} strokeWidth="1.8" strokeLinecap="round" />
      </G>

      {/* Petit point doré haut */}
      <Circle cx="80" cy="12" r="3.5" fill={gold} opacity="0.6" />

      {/* Petits cercles décoratifs */}
      <Circle cx="18" cy="70" r="3" fill="none" stroke={muted} strokeWidth="1.5" opacity="0.5" />
      <Circle cx="142" cy="68" r="2.5" fill={gold} opacity="0.4" />
      <Circle cx="22" cy="110" r="2" fill={gold} opacity="0.3" />

      {/* Ligne brisée "vide" au centre du cœur */}
      <Path d="M68 68 L76 68" stroke={muted} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <Path d="M84 68 L92 68" stroke={muted} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}
