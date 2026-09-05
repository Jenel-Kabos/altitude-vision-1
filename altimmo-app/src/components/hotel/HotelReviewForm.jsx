import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../Input';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

// PHASE-H5 §20/21 — complète la soumission d'avis mobile déférée par H3.
// L'éligibilité reste server-authoritative : ce formulaire n'apparaît que si
// le parent a déjà reçu `reviewEligibility.eligible === true` du backend
// (HotelReservationDetailScreen) — jamais déduit ici du seul statut.
export default function HotelReviewForm({ onSubmit, loading, error }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const canSubmit = rating >= 1 && rating <= 5 && comment.trim().length > 0 && !loading;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Donner votre avis</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`${value} étoile(s)`} onPress={() => setRating(value)}>
            <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={28} color={c.gold} />
          </TouchableOpacity>
        ))}
      </View>
      <Input
        label="Votre commentaire"
        value={comment}
        onChangeText={setComment}
        multiline
        placeholder="Décrivez votre séjour…"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Envoyer mon avis" loading={loading} disabled={!canSubmit} onPress={() => onSubmit({ overallRating: rating, comment: comment.trim() })} />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  title: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  starsRow: { flexDirection: 'row', gap: spacing.xs },
  error: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.error },
});
