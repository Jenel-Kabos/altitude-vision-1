import React from 'react';
import Svg, { Path, Rect, Line } from 'react-native-svg';

// Icône maison dérivée du logo Altitude Vision —
// toit-chevron + fenêtre à croix en négatif
// windowColor : couleur de la "découpe" — passer la couleur de fond
// de l'écran qui héberge l'icône pour un effet négatif convaincant.
export default function HouseIcon({
  size = 24,
  color = '#C8960C',
  windowColor = '#FAFAF8',
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 21 L12 6 L21 21 L16.5 21 L16.5 12 L7.5 12 L7.5 21 Z"
        fill={color}
      />
      <Rect x="9.5" y="13.5" width="5" height="5.5" fill={windowColor} />
      <Line x1="12" y1="13.5" x2="12" y2="19" stroke={windowColor} strokeWidth="0.9" />
      <Line x1="9.5" y1="16.2" x2="14.5" y2="16.2" stroke={windowColor} strokeWidth="0.9" />
    </Svg>
  );
}
