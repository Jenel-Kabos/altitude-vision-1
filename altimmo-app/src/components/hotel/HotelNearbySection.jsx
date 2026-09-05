import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

// PHASE-H4 — distance canonique calculée côté serveur (mètres) ; le mobile
// ne fait que formater, jamais recalculer (mission §5).
const formatDistance = (meters) => (
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
);
const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;

// PHASE-H4 — recommandation V1 explicable : distance croissante uniquement
// (tri déjà appliqué côté serveur), jamais une note/popularité inventée.
export default function HotelNearbySection({ loading, hotels, onSelect }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  if (loading) {
    return <View style={styles.centerPad}><ActivityIndicator color={c.gold} /></View>;
  }

  if (!hotels || hotels.length === 0) {
    return <Text style={styles.mutedText}>Aucun autre hôtel à proximité pour le moment.</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {hotels.map((hotel) => (
        <TouchableOpacity
          key={hotel.hotelId}
          accessibilityRole="button"
          style={styles.card}
          onPress={() => onSelect(hotel)}
        >
          {hotel.heroImage ? (
            <Image source={{ uri: hotel.heroImage }} style={styles.image} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="business-outline" size={24} color={c.border} />
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{hotel.name}</Text>
            <View style={styles.metaRow}>
              {hotel.starRating != null && (
                <View style={styles.starsRow}>
                  {Array.from({ length: hotel.starRating }).map((_, i) => <Ionicons key={i} name="star" size={10} color={c.gold} />)}
                </View>
              )}
              {(hotel.district || hotel.city) && (
                <Text style={styles.locationText} numberOfLines={1}>{[hotel.district, hotel.city].filter(Boolean).join(', ')}</Text>
              )}
            </View>
            <Text style={styles.distanceText}>{formatDistance(hotel.distanceMeters)}</Text>
            {hotel.startingPrice != null ? (
              <Text style={styles.price}>Dès {formatMoney(hotel.startingPrice, hotel.currency)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  centerPad: { padding: spacing.md },
  mutedText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  row: { gap: spacing.sm },
  card: { width: 160, backgroundColor: c.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  image: { width: '100%', height: 90 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCardAlt },
  body: { padding: spacing.xs, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starsRow: { flexDirection: 'row', gap: 1 },
  locationText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub },
  distanceText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.textSub },
  price: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: c.gold, marginTop: 2 },
});
