import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { getRecommendedProperties } from '../../services/annonceService';
import { getActivePublicites } from '../../services/publiciteService';
import { PROPERTY_TYPES_WITH_ALL } from '../../constants/propertyTypes';
import { AMENITIES } from '../../constants/amenities';
import {
  Screen, Card, PrixFCFA, RecommendedCarousel, SearchPanel,
  GreetingBar, AdCarousel,
} from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x450/F5F5F2/C8960C?text=Altimmo';

const HERO_IMG =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80';

const DEFAULT_FILTERS = {
  transaction:   'tous',
  typeBien:      'tous',
  priceRange:    [0, 500000000],
  ville:         'Toutes',
  arrondissement: 'Tous',
};

const QUICK_TYPES = PROPERTY_TYPES_WITH_ALL;

const getAmenityIcon = (name) => {
  const found = AMENITIES.find(a => a.value === name);
  return found?.icon || 'checkmark-circle-outline';
};

export default function ListeAnnoncesScreen({ navigation }) {
  const [annonces, setAnnonces]       = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [pubs, setPubs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [erreur, setErreur]           = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

  // Biens recommandés et publicités — une seule fois au mount
  useEffect(() => {
    getRecommendedProperties().then(setRecommended).catch(() => {});
    getActivePublicites().then(setPubs).catch(() => {});
  }, []);

  const chargerAnnonces = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/properties?limit=200&statusAdmin=Validée');
      const data = response.data.data?.properties
        || response.data.properties
        || response.data.data
        || [];
      setAnnonces(data);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les annonces');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { chargerAnnonces(); }, []));

  const onRefresh = () => { setRefreshing(true); chargerAnnonces(true); };

  const annoncesFiltrées = useMemo(() => annonces.filter((item) => {
    const matchTransaction = activeFilters.transaction === 'tous'
      || item.status?.toLowerCase() === activeFilters.transaction;
    const matchType = activeFilters.typeBien === 'tous'
      || item.type === activeFilters.typeBien;
    const price = item.price || 0;
    const matchPrice = price >= activeFilters.priceRange[0]
      && price <= activeFilters.priceRange[1];
    const matchVille = activeFilters.ville === 'Toutes'
      || item.address?.city === activeFilters.ville;
    const matchArrond = activeFilters.arrondissement === 'Tous'
      || item.address?.arrondissement === activeFilters.arrondissement;
    return matchTransaction && matchType && matchPrice && matchVille && matchArrond;
  }), [annonces, activeFilters]);

  const renderAnnonce = ({ item, index }) => {
    const isLocation = item.status?.toLowerCase() === 'location';
    const arrondissement = item.address?.arrondissement || '';
    const city = item.address?.city || 'Brazzaville';
    const addressText = arrondissement ? `${arrondissement} · ${city}` : city;
    const reference = `AV·${index + 1}`;
    const description = item.description || '';
    const bedrooms  = item.bedrooms  || 0;
    const bathrooms = item.bathrooms || 0;
    const surface   = item.surface   || item.area || 0;
    const hasStats  = bedrooms > 0 || bathrooms > 0 || surface > 0;
    const amenities = item.amenities || [];
    const visibleAmenities = amenities.slice(0, 3);
    const extraCount = amenities.length - 3;

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
          </View>

          <View style={styles.body}>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{(item.type || 'Bien').toUpperCase()}</Text>
              <Text style={styles.metaText}>{reference}</Text>
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
      <Screen>
        <LoadingSpinner />
      </Screen>
    );
  }

  const ListHeader = (
    <View>
      <GreetingBar onPressNotifications={() => {}} />

      {pubs.length > 0 ? (
        <AdCarousel items={pubs} />
      ) : (
        <View style={styles.hero}>
          <Image
            source={{ uri: HERO_IMG }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.heroTitle}>
            Investir à Brazzaville en toute sérénité
          </Text>
        </View>
      )}

      <View style={styles.searchZone}>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setSearchOpen(s => !s)}
          activeOpacity={0.85}
        >
          <Ionicons name="search" size={18} color={colors.gold} />
          <Text style={styles.searchBtnText}>Rechercher un bien</Text>
          <Ionicons
            name={searchOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.white}
          />
        </TouchableOpacity>
        {searchOpen && (
          <View style={styles.panelWrap}>
            <SearchPanel
              visible={searchOpen}
              onClose={() => setSearchOpen(false)}
              initialFilters={activeFilters}
              onSearch={(filters) => {
                setActiveFilters(filters);
                setSearchOpen(false);
              }}
            />
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilterRow}
        contentContainerStyle={styles.quickFilterContent}
      >
        {QUICK_TYPES.map((item) => {
          const active = activeFilters.typeBien === item.value;
          return (
            <TouchableOpacity
              key={item.label}
              onPress={() => setActiveFilters(prev => ({ ...prev, typeBien: item.value }))}
              style={[styles.quickChip, active && styles.quickChipActive]}
              activeOpacity={0.8}
            >
              <View style={styles.quickChipInner}>
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? colors.black : colors.textSub}
                />
                <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {recommended.length > 0 && (
        <View style={styles.recoSection}>
          <Text style={styles.recoTitle}>Biens recommandés</Text>
          <RecommendedCarousel
            properties={recommended}
            onPressItem={(item) => navigation.navigate('DetailAnnonce', { annonce: item })}
          />
        </View>
      )}

      <Text style={styles.catalogTitle}>À découvrir</Text>
    </View>
  );

  return (
    <Screen>
      {erreur ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Erreur de chargement"
          subtitle={erreur}
          actionLabel="Réessayer"
          onAction={chargerAnnonces}
        />
      ) : (
        <FlatList
          data={annoncesFiltrées}
          renderItem={renderAnnonce}
          keyExtractor={item => item._id || item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
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
              icon="home-outline"
              title="Aucune annonce trouvée"
              subtitle="Essayez d'élargir vos critères de recherche."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 230,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroTitle: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSize.lg,
    color: colors.white,
    paddingRight: spacing.lg,
  },
  searchZone: {
    paddingHorizontal: spacing.md,
    marginTop: -28,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.black,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  searchBtnText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.white,
  },
  panelWrap: { marginTop: spacing.sm },

  quickFilterRow: { marginTop: spacing.md },
  quickFilterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  quickChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  quickChipTextActive: { fontFamily: fonts.bodyBold, color: colors.black },

  list: { paddingBottom: spacing.lg, gap: spacing.md },

  recoSection: { marginTop: spacing.lg, marginBottom: spacing.sm },
  recoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  catalogTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

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
