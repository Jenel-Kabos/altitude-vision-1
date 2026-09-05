import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;

// PHASE-H1 — aperçu catalogue uniquement (nom/photos/capacité/lits/m²/
// équipements/tarif de base). Jamais de mention "dernière chambre",
// "disponible ce soir" ou "petit-déjeuner inclus" : H1 n'a pas de recherche
// de disponibilité multi-catégorie ni de champs repas/annulation sur
// RatePlan (voir HOTEL_DETAIL_H1_REPORT.md, classification E).
export default function HotelRoomCard({ category }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cover = category.gallery?.[0]?.url;
  const publicRate = category.rates?.find((rate) => rate.rateType === 'public') || category.rates?.[0];
  const amenityChips = [
    ...(category.amenities?.salon || []),
    ...(category.amenities?.internet || []),
    ...(category.amenities?.cuisine || []),
  ].slice(0, 3);

  return (
    <View style={styles.card}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="bed-outline" size={28} color={c.border} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{category.name}</Text>
        <View style={styles.metaRow}>
          {category.capacity?.maxAdults != null && (
            <View style={styles.metaItem}><Ionicons name="person-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.capacity.maxAdults} adulte(s)</Text></View>
          )}
          {category.bedCount != null && (
            <View style={styles.metaItem}><Ionicons name="bed-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.bedCount} lit(s)</Text></View>
          )}
          {category.size != null && (
            <View style={styles.metaItem}><Ionicons name="resize-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.size} m²</Text></View>
          )}
        </View>
        {amenityChips.length > 0 && <Text style={styles.amenities}>{amenityChips.join(' · ')}</Text>}
        {publicRate ? (
          <Text style={styles.price}>Dès {formatMoney(publicRate.amount, publicRate.currency)} / nuit</Text>
        ) : (
          <Text style={styles.priceMuted}>Tarif communiqué à la réservation</Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: c.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden', minHeight: 110 },
  image: { width: 110, height: 110 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCardAlt },
  body: { flex: 1, padding: spacing.sm, gap: 4, justifyContent: 'center' },
  name: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub },
  amenities: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted },
  price: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.gold, marginTop: 2 },
  priceMuted: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
});
