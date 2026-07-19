import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList,
  TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PrixFCFA from './PrixFCFA';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../theme';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLACEHOLDER   = require('../../assets/Logo_Altitude_transparent.png');
const SCREEN_W      = Dimensions.get('window').width;
const CARD_W        = 185;
const IMAGE_H       = 115;
const GAP           = spacing.sm;
const H_PAD         = spacing.md;
const INTERVAL_MS   = 5000;
const ITEM_LENGTH   = CARD_W + GAP;

// ─── Carte individuelle ───────────────────────────────────────────────────────

const PropertyCard = React.memo(function PropertyCard({ item, onPress, styles, c }) {
  const statusKey    = item.status?.toLowerCase();
  const isLocation   = statusKey === 'location';
  const isHebergement = statusKey === 'hebergement';
  const statusLabel  = isHebergement ? 'Hébergement' : isLocation ? 'Location' : 'Vente';
  const statusBadgeStyle = isHebergement ? styles.badgeStatusHeb : isLocation ? styles.badgeStatusLoc : styles.badgeStatusVente;
  const statusTextStyle  = isHebergement ? styles.badgeStatusTextHeb : isLocation ? styles.badgeStatusTextLoc : styles.badgeStatusTextVente;
  const imgUri       = item.images?.[0] || item.photos?.[0] || null;
  const arrondissement = item.address?.arrondissement;
  const city         = item.address?.city || 'Brazzaville';
  const locationText = arrondissement ? `${arrondissement} · ${city}` : city;
  const typeLabel    = item.type || '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.87}
      accessibilityRole="button"
      accessibilityLabel={[item.title, typeLabel, locationText].filter(Boolean).join(', ')}
    >
      {/* ─── Image ─── */}
      <View style={styles.imageWrap}>
        <Image
          source={imgUri ? { uri: imgUri } : PLACEHOLDER}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={250}
          accessible={false}
        />
        {/* Gradient subtil en bas de l'image */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Badge Recommandé (haut-gauche) */}
        <View style={styles.badgeReco}>
          <Ionicons name="star" size={9} color={c.gold} />
          <Text style={styles.badgeRecoText}>Recommandé</Text>
        </View>

        {/* Badge Vente / Location (haut-droit) */}
        <View style={[styles.badgeStatus, statusBadgeStyle]}>
          <Text style={[styles.badgeStatusText, statusTextStyle]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ─── Corps ─── */}
      <View style={styles.body}>
        {typeLabel ? (
          <Text style={styles.type} numberOfLines={1}>{typeLabel}</Text>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={11} color={c.textMuted} />
          <Text style={styles.location} numberOfLines={1}>{locationText}</Text>
        </View>
        <PrixFCFA montant={item.price} compact style={styles.price} />
      </View>
    </TouchableOpacity>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────

export default function RecommendedCarousel({ properties, onPressItem }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const items = properties || [];

  // ── Tous les hooks avant le early return ──
  const listRef    = useRef(null);
  const intervalRef = useRef(null);
  const indexRef   = useRef(0);

  const stopAutoScroll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scrollToCard = useCallback((i) => {
    // Offset exact : padding gauche + position de l'item dans le contenu
    const offset = H_PAD + i * ITEM_LENGTH;
    listRef.current?.scrollToOffset({ offset, animated: true });
    indexRef.current = i;
  }, []);

  const startAutoScroll = useCallback((len) => {
    stopAutoScroll();
    if (len <= 2) return;
    intervalRef.current = setInterval(() => {
      const next = (indexRef.current + 1) % len;
      // Retour discret au début : scroll sans animation pour éviter le recul visible
      if (next === 0 && indexRef.current > 0) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        indexRef.current = 0;
      } else {
        scrollToCard(next);
      }
    }, INTERVAL_MS);
  }, [stopAutoScroll, scrollToCard]);

  useEffect(() => {
    startAutoScroll(items.length);
    return stopAutoScroll;
  }, [items.length]);

  // ── Guard après tous les hooks ──
  if (items.length === 0) return null;

  const renderItem = ({ item }) => (
    <PropertyCard
      item={item}
      onPress={onPressItem}
      styles={styles}
      c={c}
    />
  );

  const getItemLayout = (_, i) => ({
    length: ITEM_LENGTH,
    offset: H_PAD + i * ITEM_LENGTH,
    index:  i,
  });

  return (
    <FlatList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={(item, i) => item._id || item.id || String(i)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      removeClippedSubviews
      getItemLayout={getItemLayout}
      onScrollBeginDrag={stopAutoScroll}
      onScrollEndDrag={() => startAutoScroll(items.length)}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  scroll: {
    paddingHorizontal: H_PAD,
    gap: GAP,
    paddingBottom: spacing.xs,
  },

  // ─── Carte ───
  card: {
    width: CARD_W,
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: c.border,
  },

  // ─── Image ───
  imageWrap: {
    width: CARD_W,
    height: IMAGE_H,
    backgroundColor: c.bgCardAlt,
    overflow: 'hidden',
  },

  // ─── Badge Recommandé ───
  badgeReco: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: c.goldMuted,
    borderWidth: 1,
    borderColor: c.borderGoldFull,
    borderRadius: radius.xs,
  },
  badgeRecoText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: c.gold,
    letterSpacing: 0.3,
  },

  // ─── Badge statut ───
  badgeStatus: {
    position: 'absolute',
    top: 7,
    right: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  badgeStatusVente: {
    backgroundColor: 'rgba(200,150,12,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.4)',
  },
  badgeStatusLoc: {
    backgroundColor: 'rgba(74,144,217,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(74,144,217,0.4)',
  },
  badgeStatusHeb: {
    backgroundColor: 'rgba(22,163,74,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.4)',
  },
  badgeStatusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeStatusTextVente: { color: c.gold },
  badgeStatusTextLoc:   { color: c.blue },
  badgeStatusTextHeb:   { color: '#16A34A' },

  // ─── Corps ───
  body: {
    padding: spacing.sm,
    gap: 3,
  },
  type: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: c.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.sm,
    color: c.text,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  location: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: c.textMuted,
    flex: 1,
  },
  price: {
    marginTop: spacing.xs,
  },
});
