import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';

export default function StepFooter({
  onBack, onNext, isLast = false, loading = false, nextLabel, backLabel = 'Précédent', nextTestID,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.row}>
      {onBack ? (
        <View style={styles.backBtn}>
          <Button label={backLabel} onPress={onBack} variant="outline" disabled={loading} />
        </View>
      ) : null}
      <View style={styles.nextBtn}>
        <Button
          label={nextLabel || (isLast ? 'Publier' : 'Continuer')}
          onPress={onNext}
          variant="primary"
          loading={loading}
          testID={nextTestID}
        />
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
