import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

// PHASE-H3 — FAQ rédigée par l'hôtel (jamais crowdsourcée/générée par IA),
// active uniquement (le backend ne renvoie que les entrées `active: true`).
export default function HotelFaqAccordion({ entries }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [openId, setOpenId] = useState(null);

  if (!entries || entries.length === 0) return null;

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const open = openId === entry.id;
        return (
          <View key={entry.id} style={styles.item}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.question}
              onPress={() => setOpenId(open ? null : entry.id)}
            >
              <Text style={styles.questionText}>{entry.question}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.textSub} />
            </TouchableOpacity>
            {open && <Text style={styles.answerText}>{entry.answer}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  list: { gap: spacing.xs },
  item: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm },
  question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  questionText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text },
  answerText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub, marginTop: spacing.xs, lineHeight: 19 },
});
