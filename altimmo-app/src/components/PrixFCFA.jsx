import React from 'react';
import { Text } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

// Signature visuelle Altimmo
// Usage : <PrixFCFA montant={185000000} />
// Variante compacte (carousels, cartes étroites) : <PrixFCFA montant={...} compact />
// Variante "sur photo" (texte blanc, lisible par-dessus image) : <PrixFCFA montant={...} variant="onImage" />
export default function PrixFCFA({
  montant = 0,
  style,
  compact = false,
  variant = 'default',
}) {
  const isOnImage = variant === 'onImage';
  const mainColor   = isOnImage ? colors.white : colors.gold;
  const suffixColor = isOnImage ? colors.white : colors.textSub;

  return (
    <Text style={style} numberOfLines={compact ? 1 : undefined}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: compact ? fontSize.lg : fontSize.display,
          color: mainColor,
        }}
      >
        {Number(montant).toLocaleString('fr-FR')}
      </Text>
      <Text
        style={{
          fontFamily: fonts.bodyItalic,
          fontSize: fontSize.xs,
          color: suffixColor,
        }}
      >
        {' '}fcfa
      </Text>
    </Text>
  );
}
