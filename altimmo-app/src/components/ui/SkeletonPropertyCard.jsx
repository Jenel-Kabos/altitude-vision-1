import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import Skeleton from './Skeleton';

export default function SkeletonPropertyCard() {
  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        {/* Image placeholder — ratio 16:9 — doit correspondre à styles.image dans ListeAnnoncesScreen */}
        <Skeleton width="100%" height={195} borderRadius={0} />

        <View style={styles.body}>
          {/* Meta row : type + ref */}
          <View style={styles.metaRow}>
            <Skeleton width={64} height={12} />
            <Skeleton width={40} height={12} />
          </View>

          {/* Title */}
          <Skeleton width="80%" height={18} style={styles.title} />
          <Skeleton width="55%" height={18} style={styles.titleLine2} />

          {/* Stats chips */}
          <View style={styles.statsRow}>
            <Skeleton width={52} height={26} borderRadius={8} />
            <Skeleton width={52} height={26} borderRadius={8} />
            <Skeleton width={64} height={26} borderRadius={8} />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Skeleton width={90} height={12} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  body: {
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  titleLine2: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.xs,
  },
});
