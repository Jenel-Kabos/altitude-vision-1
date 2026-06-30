import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, Animated, Easing,
  TouchableOpacity, Linking, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, fontSize, spacing } from '../theme';

const SCREEN_W    = Dimensions.get('window').width;
const HEIGHT      = 210;
const INTERVAL_MS = 5000;
const SEG_GAP     = 5;
const SEG_H       = 2.5;
const H_PADDING   = spacing.md;

// ─── Segment de progression (Stories-style) ──────────────────────────────────

function ProgressSegment({ active, done, segWidth }) {
  const anim = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    if (done) {
      anim.setValue(1);
      return;
    }
    if (active) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: INTERVAL_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0);
    }
    return () => anim.stopAnimation();
  }, [active, done]);

  const fillWidth = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, segWidth],
    extrapolate: 'clamp',
  });

  return (
    <View style={[segStyles.track, { width: segWidth }]}>
      <Animated.View style={[segStyles.fill, { width: fillWidth }]} />
    </View>
  );
}

const segStyles = StyleSheet.create({
  track: {
    height: SEG_H,
    borderRadius: SEG_H / 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: SEG_H,
    backgroundColor: '#FFFFFF',
    borderRadius: SEG_H / 2,
  },
});

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdCarousel({ items }) {
  const list = items || [];

  // ── Tous les hooks AVANT le early return ──
  const listRef     = useRef(null);
  const intervalRef = useRef(null);
  const indexRef    = useRef(0);
  const isDragging  = useRef(false);
  const [index, setIndex] = useState(0);

  const segWidth = useMemo(() => {
    const n = Math.max(list.length, 1);
    return (SCREEN_W - 2 * H_PADDING - (n - 1) * SEG_GAP) / n;
  }, [list.length]);

  const stopAutoScroll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scrollToIndex = useCallback((i) => {
    listRef.current?.scrollToOffset({ offset: i * SCREEN_W, animated: true });
    indexRef.current = i;
    setIndex(i);
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    if (list.length <= 1) return;
    intervalRef.current = setInterval(() => {
      if (isDragging.current) return;
      const next = (indexRef.current + 1) % list.length;
      scrollToIndex(next);
    }, INTERVAL_MS);
  }, [list.length, stopAutoScroll, scrollToIndex]);

  useEffect(() => {
    startAutoScroll();
    return stopAutoScroll;
  }, [list.length]);

  // ── Guard après tous les hooks ──
  if (list.length === 0) return null;

  const onScrollBeginDrag = () => {
    isDragging.current = true;
    stopAutoScroll();
  };

  const onScrollEndDrag = () => {
    isDragging.current = false;
    startAutoScroll();
  };

  const onMomentumScrollEnd = (e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (newIdx !== indexRef.current) {
      indexRef.current = newIdx;
      setIndex(newIdx);
    }
  };

  const handlePress = (item) => {
    if (item.lien) Linking.openURL(item.lien).catch(() => {});
  };

  const renderItem = ({ item }) => {
    const slide = (
      <View style={styles.slide}>
        <Image
          source={{ uri: item.media }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={300}
          accessible={false}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.gradient}
          pointerEvents="none"
        />
        {item.titre ? (
          <Text style={styles.title} numberOfLines={2}>
            {item.titre}
          </Text>
        ) : null}
      </View>
    );

    if (item.lien) {
      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => handlePress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.titre ? `Publicité : ${item.titre}` : 'Voir la publicité'}
        >
          {slide}
        </TouchableOpacity>
      );
    }

    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={item.titre ? `Publicité : ${item.titre}` : 'Publicité'}
      >
        {slide}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={list}
        renderItem={renderItem}
        keyExtractor={(item, i) => item._id || item.id || String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      />

      {/* Segments de progression stories-style */}
      {list.length > 1 && (
        <View style={styles.progressRow} pointerEvents="none">
          {list.map((_, i) => (
            <ProgressSegment
              key={i}
              active={i === index}
              done={i < index}
              segWidth={segWidth}
            />
          ))}
        </View>
      )}

      {/* Dots de position (sous les segments) */}
      {list.length > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {list.map((_, i) => (
            <View
              key={i}
              style={i === index ? styles.dotActive : styles.dotInactive}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
    width: SCREEN_W,
  },
  slide: {
    width: SCREEN_W,
    height: HEIGHT,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HEIGHT * 0.65,
  },
  title: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    fontFamily: fonts.displayItalic,
    fontSize: fontSize.lg,
    color: '#FFFFFF',
    lineHeight: 28,
  },

  // ─── Progress segments (haut, stories-style) ───
  progressRow: {
    position: 'absolute',
    top: spacing.sm,
    left: H_PADDING,
    right: H_PADDING,
    flexDirection: 'row',
    gap: SEG_GAP,
    alignItems: 'center',
  },

  // ─── Dots (position, bas) ───
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    alignItems: 'center',
  },
  dotActive: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
