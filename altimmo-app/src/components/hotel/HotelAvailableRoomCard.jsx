import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import { formatMealPlan, formatCancellationOffer } from '../../utils/hotelCommercialConditions';

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;
const RATE_TYPE_LABELS = { public: 'Tarif public', entreprise: 'Tarif entreprise', weekend: 'Tarif week-end', promotion: 'Promotion', haute_saison: 'Haute saison' };

// PHASE-H2 — une catégorie disponible + ses offres RÉELLES (RatePlan actifs
// uniquement). Jamais un bouton générique unique si plusieurs offres
// existent — chaque RatePlan a son propre "Choisir" (mission §12).
export default function HotelAvailableRoomCard({ category, onSelectOffer }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cover = category.gallery?.[0]?.url;

  return (
    <View style={styles.card}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}><Ionicons name="bed-outline" size={28} color={c.border} /></View>
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{category.name}</Text>
        <View style={styles.metaRow}>
          {category.capacity?.maxAdults != null && (
            <View style={styles.metaItem}><Ionicons name="person-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.capacity.maxAdults} adulte(s)</Text></View>
          )}
          {category.beds != null && (
            <View style={styles.metaItem}><Ionicons name="bed-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.beds} lit(s)</Text></View>
          )}
          {category.size != null && (
            <View style={styles.metaItem}><Ionicons name="resize-outline" size={13} color={c.textSub} /><Text style={styles.metaText}>{category.size} m²</Text></View>
          )}
        </View>
        {category.availableQuantity != null && (
          <Text style={styles.stock}>{category.availableQuantity} chambre(s) disponible(s) pour ce séjour</Text>
        )}

        <View style={styles.offers}>
          {category.offers.map((offer) => (
            <View key={offer.ratePlanId} style={styles.offerRow}>
              <View style={styles.offerInfo}>
                <Text style={styles.offerLabel}>{RATE_TYPE_LABELS[offer.rateType] || offer.rateType || 'Tarif'}</Text>
                <Text style={styles.offerPrice}>{formatMoney(offer.amount, offer.currency)} <Text style={styles.offerUnit}>/ nuit</Text></Text>
                <Text style={styles.offerTotal}>Total {offer.nights} nuit(s) : {formatMoney(offer.totalAmount, offer.currency)}</Text>
                {/* PHASE-H5 — jamais affiché si absent du RatePlan (mission §4/§14). */}
                {formatMealPlan(offer.mealPlan) && <Text style={styles.condition}>{formatMealPlan(offer.mealPlan)}</Text>}
                {formatCancellationOffer(offer.cancellation) && <Text style={styles.condition}>{formatCancellationOffer(offer.cancellation)}</Text>}
              </View>
              <TouchableOpacity
                style={styles.chooseBtn}
                onPress={() => onSelectOffer(category, offer)}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${RATE_TYPE_LABELS[offer.rateType] || offer.rateType} pour ${category.name}`}
              >
                <Text style={styles.chooseBtnText}>Choisir</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: { backgroundColor: c.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  image: { width: '100%', height: 140 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCardAlt },
  body: { padding: spacing.sm, gap: 6 },
  name: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub },
  stock: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.success || '#27845A' },
  offers: { gap: spacing.xs, marginTop: spacing.xs },
  offerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.xs },
  offerInfo: { flexShrink: 1 },
  offerLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.textSub },
  offerPrice: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.gold },
  offerUnit: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub },
  offerTotal: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted },
  condition: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub, marginTop: 1 },
  chooseBtn: { backgroundColor: c.primary, borderRadius: radius.xs, paddingHorizontal: spacing.md, paddingVertical: 10 },
  chooseBtnText: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.onAccent },
});
