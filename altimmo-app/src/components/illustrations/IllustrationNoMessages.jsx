import React from 'react';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

// Deux bulles de chat vides — "aucun message"
export default function IllustrationNoMessages({ size = 160, gold = '#C8960C', muted = '#888', bg = '#1A1A1A' }) {
  // Bulle arrière (gauche)
  const bubble1 = 'M16 40 Q16 28 28 28 L96 28 Q108 28 108 40 L108 78 Q108 90 96 90 L50 90 L40 102 L40 90 L28 90 Q16 90 16 78 Z';
  // Bulle avant (droite, légèrement en dessous)
  const bubble2 = 'M52 62 Q52 50 64 50 L132 50 Q144 50 144 62 L144 100 Q144 112 132 112 L120 112 L120 124 L108 112 L64 112 Q52 112 52 100 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Defs>
        <LinearGradient id="bubble2Grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gold} stopOpacity="0.2" />
          <Stop offset="1" stopColor={gold} stopOpacity="0.06" />
        </LinearGradient>
      </Defs>

      {/* Fond */}
      <Circle cx="80" cy="80" r="68" fill={bg} opacity="0.5" />

      {/* Bulle arrière */}
      <Path d={bubble1} fill={bg} stroke={muted} strokeWidth="2.2" strokeLinejoin="round" opacity="0.8" />
      {/* 3 points dans bulle arrière */}
      <G opacity="0.4">
        <Circle cx="48" cy="59" r="4" fill={muted} />
        <Circle cx="62" cy="59" r="4" fill={muted} />
        <Circle cx="76" cy="59" r="4" fill={muted} />
      </G>

      {/* Bulle avant (dorée) */}
      <Path d={bubble2} fill="url(#bubble2Grad)" stroke={gold} strokeWidth="2.5" strokeLinejoin="round" />
      {/* 3 points animés (points de saisie) */}
      <Circle cx="84" cy="81" r="4.5" fill={gold} opacity="0.9" />
      <Circle cx="98" cy="81" r="4.5" fill={gold} opacity="0.65" />
      <Circle cx="112" cy="81" r="4.5" fill={gold} opacity="0.4" />
    </Svg>
  );
}
