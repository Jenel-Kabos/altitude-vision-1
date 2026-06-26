import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, RefreshControl, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { Card, PrixFCFA } from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { AMENITIES } from '../../constants/amenities';

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x450/F5F5F2/C8960C?text=Altimmo';

const getAmenityIcon = (name) => {
  const found = AMENITIES.find(a => a.value === name);
  return found?.icon || 'checkmark-circle-outline';
};

export default function FavorisScreen({ navigation }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const chargerFavoris = async () => {
    try {
      const res = await api.get('/likes/my-favorites?type=Property');
      const favs = res.data?.data?.favorites?.properties || [];
      setProperties(favs);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Recharge à chaque fois que l'écran devient actif
  useFocusEffect(useCallback(() => { chargerFavoris(); }, []));

  const onRefresh = () => { setRefreshing(true); chargerFavoris(); };

  const renderItem = ({ item }) => {
    const isLocation   = item.status?.toLowerCase() === 'location';
    const arrondissement = item.address?.arrondissement || '';
    const city         = item.address?.city || 'Brazzaville';
    const addressText  = arrondissement ? `${arrondissement} · ${city}` : city;
    const description  = item.description || '';
    const bedrooms     = item.bedrooms  || 0;
    const bathrooms    = item.bathrooms || 0;
    const surface      = item.surface   || item.area || 0;
    const hasStats     = bedrooms > 0 || bathrooms > 0 || surface > 0;
    const amenities    = item.amenities || [];
    const visibleAmenities = amenities.slice(0, 3);
    const extraCount   = amenities.length - 3;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('DetailAnnonce', { annonce: item })}
        activeOpacity={0.85}
      >
        <Card>
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: item.images?.[0] || item.photos?.[0] || PLACEHOLDER_IMG }}
              style={styles.image}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.priceGradient}
              pointerEvents="none"
            />
            <View style={[styles.badge, isLocation ? styles.badgeLoc : styles.badgeVente]}>
              <Text style={[styles.badgeText, isLocation ? styles.badgeTextLoc : styles.badgeTextVente]}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
            </View>
            <View style={styles.priceOverlay} pointerEvents="none">
              <PrixFCFA montant={item.price} variant="onImage" compact />
            </View>
            {/* Cœur plein pour rappeler que c'est un favori */}
            <View style={styles.heartBadge}>
              <Ionicons name="heart" size={14} color={colors.gold} />
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{(item.type || 'Bien').toUpperCase()}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

            {hasStats && (
              <View style={styles.statsRow}>
                {bedrooms > 0 && (
                  <View style={styles.statChip}>
                    <Text style={styles.statText}>{bedrooms} ch.</Text>
                  </View>
                )}
                {bathrooms > 0 && (
                  <View style={styles.statChip}>
                    <Text style={styles.statText}>{bathrooms} SDB</Text>
                  </View>
                )}
                {surface > 0 && (
                  <View style={styles.statChip}>
                    <Text style={styles.statText}>{surface} m²</Text>
                  </View>
                )}
              </View>
            )}

            {amenities.length > 0 && (
              <View style={styles.amenitiesRow}>
                {visibleAmenities.map((a, i) => (
                  <View key={i} style={styles.amenityChip}>
                    <Ionicons name={getAmenityIcon(a)} size={11} color={colors.blue} />
                    <Text style={styles.amenityChipText}>{a}</Text>
                  </View>
                ))}
                {extraCount > 0 && (
                  <View style={styles.amenityChipMore}>
                    <Text style={styles.amenityChipMoreText}>+{extraCount}</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.location} numberOfLines={1}>{addressText}</Text>

            {description.trim().length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.description} numberOfLines={2}>{description}</Text>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.cta}>Voir →</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes favoris</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={properties}
        renderItem={renderItem}
        keyExtractor={item => item._id || item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Aucun bien favori"
            subtitle="Appuyez sur le cœur d'une annonce pour la retrouver ici."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  // Card — identique à ListeAnnoncesScreen
  imageWrap: { width: '100%' },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.sm,
  },
  priceGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '40%',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  badge: {
    position: 'absolute',
    top: spacing.md, right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeVente: { backgroundColor: colors.goldMuted },
  badgeLoc:   { backgroundColor: colors.blueMuted },
  badgeText: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
  },
  badgeTextVente: { color: colors.goldDark },
  badgeTextLoc:   { color: colors.blue },
  priceOverlay: {
    position: 'absolute',
    bottom: spacing.md, left: spacing.md,
  },
  heartBadge: {
    position: 'absolute',
    top: spacing.md, left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 100,
    padding: 5,
  },

  body: { padding: spacing.md },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statChip: {
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  statText: { color: colors.gold, fontSize: fontSize.xs, fontFamily: fonts.body },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blueMuted,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  amenityChipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.blue,
  },
  amenityChipMore: {
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  amenityChipMoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  location: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  divider: {
    width: 32, height: 1,
    backgroundColor: colors.gold,
    marginBottom: spacing.sm,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  cta: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
