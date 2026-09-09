import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getHotelHighlightLabels } from '../../constants/hotel';
import { fonts, spacing } from '../../theme';

export default function HotelHighlights({ hotelServices, max = 3, style }) {
  const labels = getHotelHighlightLabels(hotelServices);
  if (labels.length === 0) return null;
  const visible = labels.slice(0, max);
  const remaining = labels.length - visible.length;
  return (
    <View style={[styles.row, style]} accessibilityLabel="Points forts de l’hôtel">
      {visible.map((label) => <View key={label} style={styles.badge}><Text style={styles.label} numberOfLines={1}>{label}</Text></View>)}
      {remaining > 0 && <View style={styles.moreBadge}><Text style={styles.moreLabel}>+{remaining}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { maxWidth: 112, borderRadius: 999, borderWidth: 1, borderColor: '#E8D7AB', backgroundColor: '#FFF9EA', paddingHorizontal: 8, paddingVertical: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, color: '#4A3F35' },
  moreBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E1DC', backgroundColor: '#FAF8F5', paddingHorizontal: 8, paddingVertical: 4 },
  moreLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: '#6B5D52' },
});
