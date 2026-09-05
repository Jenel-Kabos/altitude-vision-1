import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

// PHASE-H3 — n'affiche jamais une note/nombre d'avis inventés : summary
// vient exclusivement de HotelReview.getRatingSummary (backend), et
// reviewCount === 0 est un état explicite ("Aucun avis pour le moment"),
// jamais masqué derrière une fausse note par défaut (ex: "5.0"/"Nouveau").
export default function HotelReviewsSection({ summary, reviews, pagination, loading, loadingMore, onLoadMore }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const hasReviews = (summary?.reviewCount || 0) > 0;
  const canLoadMore = pagination && pagination.page < pagination.pages;

  return (
    <View>
      {hasReviews ? (
        <View style={styles.summaryRow}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={16} color={c.gold} />
            <Text style={styles.ratingValue}>{summary.averageRating}</Text>
          </View>
          <Text style={styles.reviewCount}>{summary.reviewCount} avis vérifié{summary.reviewCount > 1 ? 's' : ''}</Text>
        </View>
      ) : (
        <Text style={styles.mutedText}>Aucun avis pour le moment. Les avis proviennent uniquement de séjours réellement effectués.</Text>
      )}

      {loading && <View style={styles.centerPad}><ActivityIndicator color={c.gold} /></View>}

      {!loading && reviews.length > 0 && (
        <View style={styles.list}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.author}>{review.author}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={c.gold} />
                  <Text style={styles.verifiedText}>Séjour vérifié</Text>
                </View>
              </View>
              <View style={styles.cardRatingRow}>
                {Array.from({ length: review.overallRating }).map((_, i) => <Ionicons key={i} name="star" size={12} color={c.gold} />)}
              </View>
              <Text style={styles.comment}>{review.comment}</Text>
            </View>
          ))}
        </View>
      )}

      {canLoadMore && (
        <Button label="Voir plus d’avis" variant="outline" loading={loadingMore} onPress={onLoadMore} style={styles.loadMoreBtn} />
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bgCardAlt, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 4 },
  ratingValue: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text },
  reviewCount: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub },
  mutedText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  centerPad: { padding: spacing.md },
  list: { gap: spacing.sm },
  card: { backgroundColor: c.bgCard, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, padding: spacing.sm, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.gold },
  cardRatingRow: { flexDirection: 'row', gap: 1 },
  comment: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, lineHeight: 19 },
  loadMoreBtn: { marginTop: spacing.sm },
});
