import React from 'react';
import { Text } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

// Signature visuelle Altimmo
// Usage : <PrixFCFA montant={185000000} />
export default function PrixFCFA({ montant = 0, style }) {
  return (
    <Text style={style}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: fontSize.display,
          color: colors.gold,
        }}
      >
        {Number(montant).toLocaleString('fr-FR')}
      </Text>
      <Text
        style={{
          fontFamily: fonts.bodyItalic,
          fontSize: fontSize.xs,
          color: colors.textSub,
        }}
      >
        {' '}fcfa
      </Text>
    </Text>
  );
}
