import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, FlatList,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import PrixFCFA from './PrixFCFA';
import { colors, fonts, fontSize, spacing, radius } from '../theme';

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/300x180/F5F5F2/C8960C?text=Altimmo';
const CARD_WIDTH = 150;
const INTERVAL_MS = 5000;

export default function RecommendedCarousel({ properties, onPressItem }) {
  const items = properties || [];

  const listRef = useRef(null);
  const intervalRef = useRef(null);
  const indexRef = useRef(0);

  const step = CARD_WIDTH + spacing.sm;

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startAutoScroll = () => {
    stopAutoScroll();
    if (items.length <= 2) return;
    intervalRef.current = setInterval(() => {
      const next = (indexRef.current + 1) % items.length;
      indexRef.current = next;
      listRef.current?.scrollToOffset({
        offset: next * step,
        animated: true,
      });
    }, INTERVAL_MS);
  };

  useEffect(() => {
    startAutoScroll();
    return stopAutoScroll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) return null;

  const renderItem = ({ item }) => (
    <TouchableOpacity
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
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={(item, i) => item._id || item.id || String(i)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScrollBeginDrag={stopAutoScroll}
      onScrollEndDrag={startAutoScroll}
    />
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
