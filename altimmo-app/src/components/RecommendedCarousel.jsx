import React from 'react';
import {
  View, Text, Image, ScrollView,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import PrixFCFA from './PrixFCFA';
import { colors, fonts, fontSize, spacing, radius } from '../theme';

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/300x180/F5F5F2/C8960C?text=Altimmo';

export default function RecommendedCarousel({ properties, onPressItem }) {
  const items = properties || [];
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item._id || item.id}
          style={styles.card}
          onPress={() => onPressItem?.(item)}
          activeOpacity={0.85}
        >
          <View style={styles.imageWrap}>
            <Image
              source={{
                uri: item.images?.[0] || item.photos?.[0] || PLACEHOLDER_IMG,
              }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>★ Recommandé</Text>
            </View>
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <PrixFCFA montant={item.price} compact style={styles.price} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 150,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: 90,
  },
  image: {
    width: '100%',
    height: 90,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.xs,
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.borderGoldFull,
    borderRadius: radius.xs,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  body: {
    padding: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    minHeight: 32,
  },
  price: {
    marginTop: spacing.xs,
  },
});
