import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, FlatList,
  TouchableOpacity, Linking, StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, fontSize, spacing } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const HEIGHT = 230;
const INTERVAL_MS = 4500;

export default function AdCarousel({ items }) {
  const list = items || [];
  if (list.length === 0) return null;

  const listRef = useRef(null);
  const intervalRef = useRef(null);
  const [index, setIndex] = useState(0);

  const startAutoScroll = () => {
    stopAutoScroll();
    if (list.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % list.length;
        listRef.current?.scrollToOffset({
          offset: next * SCREEN_W,
          animated: true,
        });
        return next;
      });
    }, INTERVAL_MS);
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startAutoScroll();
    return stopAutoScroll;
  }, [list.length]);

  const onMomentumScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_W);
    setIndex(newIndex);
  };

  const handlePress = (item) => {
    if (item.lien) Linking.openURL(item.lien).catch(() => {});
  };

  const renderItem = ({ item }) => {
    const content = (
      <View style={styles.slide}>
        <Image
          source={{ uri: item.media }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.gradient}
        />
        {item.titre ? (
          <Text style={styles.title}>{item.titre}</Text>
        ) : null}
      </View>
    );

    if (item.lien) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(item)}
        >
          {content}
        </TouchableOpacity>
      );
    }
    return content;
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
        onScrollBeginDrag={stopAutoScroll}
        onScrollEndDrag={startAutoScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
      />

      {/* Dots de pagination */}
      <View style={styles.dotsRow}>
        {list.map((_, i) => (
          <View
            key={i}
            style={i === index ? styles.dotActive : styles.dotInactive}
          />
        ))}
      </View>
    </View>
  );
}

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
    height: HEIGHT * 0.6,
  },
  title: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    fontFamily: fonts.displayItalic,
    fontSize: fontSize.lg,
    color: colors.white,
  },

  // ─── Dots pagination (même pattern que DetailAnnonceScreen) ───
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
