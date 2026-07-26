import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { PrixFCFA } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import IllustrationNoFavoris from '../../components/illustrations/IllustrationNoFavoris';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const PLACEHOLDER = require('../../../assets/Logo_Altitude_transparent.png');

// ─── FavCard ─────────────────────────────────────────────────────────────────
const FavCard = React.memo(function FavCard({ item, onPress, styles, c }) {
  const statusKey     = item.status?.toLowerCase();
  const isLocation    = statusKey === 'location';
  const isHebergement = statusKey === 'hebergement';
  const arrondissement = item.address?.arrondissement || '';
  const city          = item.address?.city || 'Brazzaville';
  const addressText   = arrondissement ? `${arrondissement}, ${city}` : city;
  const bedrooms      = item.bedrooms  || 0;
  const bathrooms     = item.bathrooms || 0;
  const surface       = item.surface   || item.area || 0;
  const hasStats      = bedrooms > 0 || bathrooms > 0 || surface > 0;
  const imgUri        = item.images?.[0] || item.photos?.[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Voir le bien ${item.title}`}
    >
      {/* ─── Image ─── */}
      <View style={styles.imageWrap}>
        <Image
          source={imgUri ? { uri: imgUri } : PLACEHOLDER}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.gradient}
          pointerEvents="none"
        />

        {/* Badge statut — haut-gauche */}
        <View style={[styles.badge, isHebergement ? styles.badgeHeb : isLocation ? styles.badgeLoc : styles.badgeVente]}>
          <Text style={[styles.badgeText, isHebergement ? styles.badgeTextHeb : isLocation ? styles.badgeTextLoc : styles.badgeTextVente]}>
            {isHebergement ? 'HÉBERGEMENT' : isLocation ? 'LOCATION' : 'VENTE'}
          </Text>
        </View>

        {/* Cœur — haut-droite */}
        <View style={styles.heartBadge}>
          <Ionicons name="heart" size={13} color={c.gold} />
        </View>

        {/* Prix — bas-droite */}
        <View style={styles.priceWrap} pointerEvents="none">
          <PrixFCFA montant={item.price} variant="onImage" compact />
        </View>
      </View>

      {/* ─── Corps ─── */}
      <View style={styles.body}>
        {/* Type */}
        <Text style={styles.typeLabel} numberOfLines={1}>
          {(item.type || 'Bien').toUpperCase()}
        </Text>

        {/* Titre */}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Adresse */}
        <View style={styles.addrRow}>
          <Ionicons name="location-outline" size={12} color={c.textMuted} />
          <Text style={styles.addrText} numberOfLines={1}>{addressText}</Text>
        </View>

        {/* Stats */}
        {hasStats && (
          <View style={styles.statsRow}>
            {bedrooms > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="bed-outline" size={13} color={c.textSub} />
                <Text style={styles.statText}>{bedrooms}</Text>
              </View>
            )}
            {bathrooms > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="water-outline" size={13} color={c.textSub} />
                <Text style={styles.statText}>{bathrooms}</Text>
              </View>
            )}
            {surface > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="resize-outline" size={13} color={c.textSub} />
                <Text style={styles.statText}>{surface} m²</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item._id === next.item._id && prev.styles === next.styles);

// ─── FavorisScreen ────────────────────────────────────────────────────────────
export default function FavorisScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [properties, setProperties] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const chargerFavoris = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res  = await api.get('/likes/my-favorites?type=Property');
      const favs = res.data?.data?.favorites?.properties || [];
      setProperties(favs);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { chargerFavoris(); }, [chargerFavoris]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    chargerFavoris(true);
  }, [chargerFavoris]);

  const renderItem = useCallback(({ item }) => (
    <FavCard
      item={item}
      onPress={() => navigation.navigate('DetailAnnonce', { resourceType: 'property', resourceId: item._id || item.id, item })}
      styles={styles}
      c={c}
    />
  ), [navigation, styles, c]);

  const keyExtractor = useCallback((item) => item._id || item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <PageHeader
        title="Mes favoris"
        onBack={() => navigation.goBack()}
      />

      {/* ─── Liste ───────────────────────────────────────────── */}
      <FlatList
        data={properties}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.gold}
            colors={[c.gold]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            illustration={IllustrationNoFavoris}
            title="Aucun bien favori"
            subtitle="Appuyez sur le cœur d'une annonce pour la retrouver ici."
          />
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  // ─── Liste ───
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  // ─── Card ───
  card: {
    backgroundColor: c.bgCard,
    borderRadius: radius.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // ─── Image ───
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: c.bgCardAlt,
  },
  gradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '45%',
  },

  // ─── Badges image ───
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeVente: {
    backgroundColor: 'rgba(200,150,12,0.15)',
    borderColor: 'rgba(200,150,12,0.4)',
  },
  badgeLoc: {
    backgroundColor: 'rgba(24,95,165,0.15)',
    borderColor: 'rgba(24,95,165,0.4)',
  },
  badgeHeb: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: 'rgba(22,163,74,0.4)',
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  badgeTextVente: { color: '#C8960C' },
  badgeTextLoc:   { color: '#185FA5' },
  badgeTextHeb:   { color: '#16A34A' },

  heartBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 100,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceWrap: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },

  // ─── Corps ───
  body: {
    padding: spacing.sm,
    gap: 4,
  },
  typeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.gold,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
    lineHeight: 20,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addrText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
  },
});
