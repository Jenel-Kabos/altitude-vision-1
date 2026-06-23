export const fonts = {
  display:       'CormorantGaramond-Bold',
  displaySemi:   'CormorantGaramond-SemiBold',
  displayItalic: 'CormorantGaramond-Italic',
  body:          'DMSans-Regular',
  bodyMedium:    'DMSans-Medium',
  bodyBold:      'DMSans-Bold',
  bodyItalic:    'CormorantGaramond-Italic',
  // note : DM Sans italique n'est pas chargé (cohérent avec le web
  // qui n'a pas non plus d'italique DM Sans) — on réutilise
  // Cormorant italique pour les cas où bodyItalic est utilisé
  // (ex: " fcfa" dans PrixFCFA)
};

export const fontSize = {
  xs:      11,
  sm:      13,
  md:      16,
  lg:      22,
  display: 32,
};

// Styles de compatibilité — évite de casser tous les écrans d'un coup
export const typography = {
  display: { fontFamily: fonts.display,  fontSize: fontSize.display },
  h1:      { fontFamily: fonts.display,  fontSize: fontSize.lg },
  h2:      { fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  h3:      { fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  body:    { fontFamily: fonts.body,     fontSize: fontSize.md },
  caption: { fontFamily: fonts.body,     fontSize: fontSize.sm },
  tiny:    { fontFamily: fonts.body,     fontSize: fontSize.xs },
};
