import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
  ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { getRecommendedProperties } from '../../services/annonceService';
import { getActivePublicites } from '../../services/publiciteService';
import { cache } from '../../services/cacheService';
import { useDebounce } from '../../hooks/useDebounce';
import { PROPERTY_TYPES_WITH_ALL, formatPriceShort, PRICE_MAX } from '../../constants/propertyTypes';
import {
  Screen, Card, PrixFCFA, RecommendedCarousel, SearchPanel,
  GreetingBar, AdCarousel,
} from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import IllustrationNoAnnonces from '../../components/illustrations/IllustrationNoAnnonces';
import IllustrationNetworkError from '../../components/illustrations/IllustrationNetworkError';
import SkeletonPropertyCard from '../../components/ui/SkeletonPropertyCard';

const PLACEHOLDER_IMG = require('../../../assets/Logo_Altitude_transparent.png');

const { width: SCREEN_W } = Dimensions.get('window');
// Largeur de card = écran − padding horizontal Screen (spacing.md × 2 = 40)
const CARD_IMG_W = SCREEN_W - 2 * 20;
const CARD_IMG_H = Math.round(CARD_IMG_W * (3 / 4));

const PAGE_SIZE = 15;

const DEFAULT_FILTERS = {
  transaction:    'tous',
  typeBien:       'tous',
  priceRange:     [0, 500000000],
  ville:          'Toutes',
  arrondissement: 'Tous',
};


const buildQuery = (filters, page) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    statusAdmin: 'Validée',
  });
  if (filters.transaction !== 'tous')
    params.set('status', filters.transaction); // lowercase: 'location' | 'vente' — correspond à l'enum MongoDB
  if (filters.typeBien !== 'tous')
    params.set('type', filters.typeBien);
  if (filters.ville !== 'Toutes')
    params.set('city', filters.ville);
  if (filters.arrondissement !== 'Tous')
    params.set('arrondissement', filters.arrondissement);
  if (filters.priceRange[0] > 0)
    params.set('price[gte]', String(filters.priceRange[0])); // APIFeatures convertit en { price: { $gte } }
  if (filters.priceRange[1] < 500000000)
    params.set('price[lte]', String(filters.priceRange[1])); // APIFeatures convertit en { price: { $lte } }
  return params.toString();
};

const IMG_LAYOUT = { length: CARD_IMG_W, offset: 0, index: 0 };
const getCardImgLayout = (_, i) => ({ ...IMG_LAYOUT, offset: CARD_IMG_W * i, index: i });

const AUTO_SLIDE_MS = 3500;


// ── Chip filtre actif (suppression individuelle) ──────────────────────────────
function ActiveChip({ label, onRemove, c, chipStyle, textStyle }) {
  return (
    <View style={chipStyle}>
      <Text style={textStyle} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`Supprimer le filtre ${label}`}>
        <Ionicons name="close-circle" size={14} color={c.gold} />
      </TouchableOpacity>
    </View>
  );
}

const AnnonceCard = React.memo(function AnnonceCard({ item, index, onPress, styles, c }) {
  const isLocation     = item.status?.toLowerCase() === 'location';
  const arrondissement = item.address?.arrondissement || '';
  const city           = item.address?.city || 'Brazzaville';
  const addressText    = arrondissement ? `${arrondissement} · ${city}` : city;
  const bedrooms       = item.bedrooms  || 0;
  const bathrooms      = item.bathrooms || 0;
  const surface        = item.surface   || item.area || 0;
  const hasStats       = bedrooms > 0 || bathrooms > 0 || surface > 0;
  const typeLabel      = (item.type || '').toUpperCase();

  const images = useMemo(
    () => (item.images || item.photos || []).filter(Boolean).slice(0, 4),
    [item.images, item.photos],
  );
  const hasMultiple = images.length > 1;

  const [imgIdx, setImgIdx]       = useState(0);
  const imgListRef                = useRef(null);
  const imgIdxRef                 = useRef(0);
  const timerRef                  = useRef(null);
  const isUserSwipeRef            = useRef(false);

  // ─── Auto-scroll ───
  const stopAuto  = useCallback(() => clearInterval(timerRef.current), []);

  const startAuto = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const next = (imgIdxRef.current + 1) % images.length;
      imgIdxRef.current = next;
      setImgIdx(next);
      imgListRef.current?.scrollToOffset({ offset: CARD_IMG_W * next, animated: true });
    }, AUTO_SLIDE_MS);
  }, [images.length]);

  useEffect(() => {
    if (!hasMultiple) return;
    // Stagger par ligne de 3 cards pour éviter un défilement synchronisé
    const delay = (index % 3) * 1100;
    const t = setTimeout(startAuto, delay);
    return () => { clearTimeout(t); stopAuto(); };
  }, [hasMultiple, index, startAuto, stopAuto]);

  // ─── Handlers scroll ───
  const onScrollBeginDrag = useCallback(() => {
    isUserSwipeRef.current = true;
    stopAuto();
  }, [stopAuto]);

  const onMomentumScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_IMG_W);
    imgIdxRef.current = idx;
    setImgIdx(idx);
    if (isUserSwipeRef.current) {
      isUserSwipeRef.current = false;
      startAuto(); // relance après swipe utilisateur
    }
  }, [startAuto]);

  const renderImg = useCallback(({ item: uri }) => (
    <Image
      source={{ uri }}
      style={styles.image}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
    />
  ), [styles]);

  const imgKeyExtractor = useCallback((_, i) => String(i), []);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(300)}>
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.87}
        accessibilityLabel={`${item.title}, ${item.type || 'Bien'}, ${city}`}
        accessibilityRole="button"
        accessibilityHint="Appuyez pour voir les détails"
      >
        <Card>
          {/* ─── Galerie images ─── */}
          <View style={styles.imageWrap}>
            {images.length > 0 ? (
              <FlatList
                ref={imgListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={false}
                onScrollBeginDrag={onScrollBeginDrag}
                onMomentumScrollEnd={onMomentumScrollEnd}
                renderItem={renderImg}
                keyExtractor={imgKeyExtractor}
                getItemLayout={getCardImgLayout}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
              />
            ) : (
              <Image
                source={PLACEHOLDER_IMG}
                style={styles.image}
                contentFit="cover"
              />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.65)']}
              style={styles.priceGradient}
              pointerEvents="none"
            />

            {/* Badge Location / Vente — haut gauche */}
            <View style={[styles.badge, isLocation ? styles.badgeLoc : styles.badgeVente]}>
              <Text style={[styles.badgeText, isLocation ? styles.badgeTextLoc : styles.badgeTextVente]}>
                {isLocation ? 'Location' : 'Vente'}
              </Text>
            </View>

            {/* Compteur photos — haut droite (aucun conflit avec le prix) */}
            {hasMultiple && (
              <View style={styles.cardImgCount} pointerEvents="none">
                <Ionicons name="images-outline" size={9} color="#FFFFFF" />
                <Text style={styles.cardImgCountText}>{imgIdx + 1}/{images.length}</Text>
              </View>
            )}

            {/* Prix — bas droite */}
            <View style={styles.priceOverlay} pointerEvents="none">
              <PrixFCFA montant={item.price} variant="onImage" compact />
            </View>
          </View>

          {/* ─── Corps ─── */}
          <View style={styles.body}>
            {typeLabel ? (
              <Text style={styles.metaText}>{typeLabel}</Text>
            ) : null}
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color={c.textMuted} />
              <Text style={styles.location} numberOfLines={1}>{addressText}</Text>
            </View>

            {hasStats && (
              <View style={styles.statsRow}>
                {bedrooms > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="bed-outline" size={13} color={c.textMuted} />
                    <Text style={styles.statText}>{bedrooms}</Text>
                  </View>
                )}
                {bathrooms > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="water-outline" size={13} color={c.textMuted} />
                    <Text style={styles.statText}>{bathrooms}</Text>
                  </View>
                )}
                {surface > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="resize-outline" size={13} color={c.textMuted} />
                    <Text style={styles.statText}>{surface} m²</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) => prev.item._id === next.item._id && prev.styles === next.styles);

export default function ListeAnnoncesScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [annonces, setAnnonces]       = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [pubs, setPubs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [erreur, setErreur]           = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);

  // Résumé des filtres actifs pour le bouton
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (activeFilters.typeBien !== 'tous') n++;
    if (activeFilters.transaction !== 'tous') n++;
    if (activeFilters.ville !== 'Toutes') n++;
    if (activeFilters.arrondissement !== 'Tous') n++;
    if (activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < 500_000_000) n++;
    return n;
  }, [activeFilters]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (activeFilters.typeBien !== 'tous') parts.push(activeFilters.typeBien);
    if (activeFilters.transaction !== 'tous') parts.push(activeFilters.transaction === 'vente' ? 'Vente' : 'Location');
    if (activeFilters.ville !== 'Toutes') parts.push(activeFilters.ville);
    return parts.length > 0 ? parts.join(' · ') : 'Rechercher un bien';
  }, [activeFilters]);

  const activeFiltersRef = useRef(activeFilters);
  activeFiltersRef.current = activeFilters;

  // Debounce — évite de déclencher une requête à chaque chip/filtre cliqué
  const debouncedFilters = useDebounce(activeFilters, 400);

  useEffect(() => {
    getRecommendedProperties().then(setRecommended).catch(() => {});
    getActivePublicites().then(setPubs).catch(() => {});
  }, []);

  const chargerPage = useCallback(async (pageNum, filters, append = false) => {
    const cacheKey = `properties:${buildQuery(filters, pageNum)}`;

    // Cache hit — on évite un aller-retour réseau
    if (!append) {
      const hit = cache.get(cacheKey);
      if (hit) {
        setAnnonces(hit.items);
        setHasMore(hit.hasMore);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const query = buildQuery(filters, pageNum);
      const response = await api.get(`/properties?${query}`);
      const raw = response.data.data?.properties
        || response.data.properties
        || response.data.data
        || [];
      const total = response.data.data?.total || response.data.total || raw.length;
      const hasMoreData = pageNum * PAGE_SIZE < total;

      // Mise en cache 5 minutes
      if (!append) cache.set(cacheKey, { items: raw, hasMore: hasMoreData });

      setAnnonces(prev => append ? [...prev, ...raw] : raw);
      setHasMore(hasMoreData);
      setErreur('');
    } catch {
      setErreur('Impossible de charger les annonces');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge depuis la page 1 quand les filtres (debouncés) changent
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    chargerPage(1, debouncedFilters, false);
  }, [debouncedFilters, chargerPage]);

  useFocusEffect(useCallback(() => {
    // Ne refetch que si le cache est expiré — évite les requêtes inutiles
    // à chaque retour sur l'écran
    const cacheKey = `properties:${buildQuery(activeFiltersRef.current, 1)}`;
    if (cache.get(cacheKey)) return;
    chargerPage(1, activeFiltersRef.current, false);
    setPage(1);
  }, [chargerPage]));

  const onRefresh = useCallback(() => {
    cache.invalidate('properties:');
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    chargerPage(1, activeFilters, false);
  }, [activeFilters, chargerPage]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    chargerPage(nextPage, activeFilters, true);
  }, [hasMore, loadingMore, loading, page, activeFilters, chargerPage]);

  const handlePressItem = useCallback((item) => {
    navigation.navigate('DetailAnnonce', { annonce: item });
  }, [navigation]);

  const onSearchSubmit = useCallback((filters) => {
    setActiveFilters(filters);
    setSearchOpen(false);
  }, []);

  const renderItem = useCallback(({ item, index }) => (
    <AnnonceCard item={item} index={index} onPress={handlePressItem} styles={styles} c={c} />
  ), [handlePressItem, styles, c]);

  const keyExtractor = useCallback((item) => item._id || item.id, []);

  const ListFooter = useMemo(() => loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={c.gold} />
    </View>
  ) : null, [loadingMore, styles, c]);

  // ─── Callbacks stables (AVANT tout return conditionnel) ───
  const onPressRecommended = useCallback(
    (item) => navigation.navigate('DetailAnnonce', { annonce: item }),
    [navigation],
  );
  const onPressNotifications = useCallback(
    () => navigation.navigate('Notifications'),
    [navigation],
  );
  const onResetFilters = useCallback(() => setActiveFilters(DEFAULT_FILTERS), []);
  const onToggleSearch = useCallback(() => setSearchOpen(s => !s), []);
  const onCloseSearch  = useCallback(() => setSearchOpen(false), []);

  // ─── ListHeader mémoïsé (AVANT le return conditionnel) ───
  const ListHeader = useMemo(() => (
    <View>
      <GreetingBar onPressNotifications={onPressNotifications} />

      {pubs.length > 0 ? (
        <AdCarousel items={pubs} />
      ) : (
        <View style={styles.hero}>
          <LinearGradient
            colors={['#0A0A0A', '#1A1208', '#2D1E04']}
            style={StyleSheet.absoluteFillObject}
          />
          <Image
            source={PLACEHOLDER_IMG}
            style={styles.heroLogo}
            contentFit="contain"
            cachePolicy="memory"
          />
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>BRAZZAVILLE · CONGO</Text>
            <Text style={styles.heroTitle}>
              Votre futur bien{'\n'}immobilier vous attend
            </Text>
          </View>
        </View>
      )}

      <View style={styles.searchZone}>
        <TouchableOpacity
          style={[styles.searchBtn, activeFilterCount > 0 && styles.searchBtnActive]}
          onPress={onToggleSearch}
          activeOpacity={0.85}
          accessibilityLabel={activeFilterCount > 0
            ? `${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''} actif${activeFilterCount > 1 ? 's' : ''} — modifier`
            : 'Ouvrir la recherche'}
          accessibilityRole="button"
        >
          <Ionicons
            name="search"
            size={17}
            color={activeFilterCount > 0 ? c.gold : c.textSub}
          />
          <Text style={styles.searchBtnText} numberOfLines={1}>
            {filterSummary}
          </Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={onResetFilters}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer tous les filtres"
            >
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Ionicons name="options-outline" size={17} color={c.textSub} />
          )}
        </TouchableOpacity>
      </View>

      <SearchPanel
        visible={searchOpen}
        onClose={onCloseSearch}
        initialFilters={activeFilters}
        onSearch={onSearchSubmit}
      />

      {/* ── Chips filtres actifs ── */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeChipsRow}
          contentContainerStyle={styles.activeChipsContent}
        >
          {activeFilters.transaction !== 'tous' && (
            <ActiveChip
              label={activeFilters.transaction === 'vente' ? 'Vente' : 'Location'}
              onRemove={() => setActiveFilters(prev => ({ ...prev, transaction: 'tous' }))}
              c={c} chipStyle={styles.activeChip} textStyle={styles.activeChipText}
            />
          )}
          {activeFilters.typeBien !== 'tous' && (
            <ActiveChip
              label={activeFilters.typeBien}
              onRemove={() => setActiveFilters(prev => ({ ...prev, typeBien: 'tous' }))}
              c={c} chipStyle={styles.activeChip} textStyle={styles.activeChipText}
            />
          )}
          {activeFilters.ville !== 'Toutes' && (
            <ActiveChip
              label={activeFilters.ville}
              onRemove={() => setActiveFilters(prev => ({ ...prev, ville: 'Toutes', arrondissement: 'Tous' }))}
              c={c} chipStyle={styles.activeChip} textStyle={styles.activeChipText}
            />
          )}
          {activeFilters.arrondissement !== 'Tous' && (
            <ActiveChip
              label={activeFilters.arrondissement}
              onRemove={() => setActiveFilters(prev => ({ ...prev, arrondissement: 'Tous' }))}
              c={c} chipStyle={styles.activeChip} textStyle={styles.activeChipText}
            />
          )}
          {(activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < PRICE_MAX) && (
            <ActiveChip
              label={`${activeFilters.priceRange[0] > 0 ? formatPriceShort(activeFilters.priceRange[0]) : '0'} – ${activeFilters.priceRange[1] < PRICE_MAX ? formatPriceShort(activeFilters.priceRange[1]) : '∞'} FCFA`}
              onRemove={() => setActiveFilters(prev => ({ ...prev, priceRange: [0, PRICE_MAX] }))}
              c={c} chipStyle={styles.activeChip} textStyle={styles.activeChipText}
            />
          )}
        </ScrollView>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilterRow}
        contentContainerStyle={styles.quickFilterContent}
      >
        {PROPERTY_TYPES_WITH_ALL.map((item) => {
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
                  color={active ? '#0A0A0A' : c.textSub}
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
          <Text style={styles.sectionTitle}>Biens recommandés</Text>
          <RecommendedCarousel
            properties={recommended}
            onPressItem={onPressRecommended}
          />
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>À découvrir</Text>
    </View>
  ), [
    pubs, recommended, activeFilters, activeFilterCount, filterSummary, searchOpen,
    styles, c,
    onPressNotifications, onPressRecommended, onToggleSearch, onCloseSearch,
    onResetFilters, onSearchSubmit,
  ]);

  // ─── Return conditionnel APRÈS tous les hooks ───
  if (loading) {
    return (
      <Screen>
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPropertyCard key={i} />
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {erreur && annonces.length === 0 ? (
        <EmptyState
          illustration={IllustrationNetworkError}
          title="Erreur de chargement"
          subtitle={erreur}
          actionLabel="Réessayer"
          onAction={() => chargerPage(1, activeFilters, false)}
        />
      ) : (
        <FlatList
          data={annonces}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            <EmptyState
              illustration={IllustrationNoAnnonces}
              title="Aucune annonce trouvée"
              subtitle="Essayez d'élargir vos critères de recherche."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.gold}
              colors={[c.gold]}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          // ─── FlatList perf ───────────────────────────────────────
          windowSize={5}
          initialNumToRender={3}
          maxToRenderPerBatch={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
        />
      )}
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  hero: {
    height: 230,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroLogo: {
    position: 'absolute',
    right: -20,
    top: -10,
    width: 160,
    height: 160,
    opacity: 0.12,
  },
  heroTextWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroEyebrow: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 2.5,
    color: c.gold,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSize.lg,
    color: '#F0EDE8',
    lineHeight: 28,
  },
  searchZone: {
    paddingHorizontal: spacing.md,
    marginTop: -28,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.bgCard,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  searchBtnActive: {
    borderColor: c.borderGold,
    backgroundColor: c.bgCard,
  },
  searchBtnText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
  },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#0A0A0A',
  },

  quickFilterRow: { marginTop: spacing.md },
  quickFilterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
  },
  quickChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickChipActive: { backgroundColor: c.gold, borderColor: c.gold },
  quickChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.textSub,
  },
  quickChipTextActive: { fontFamily: fonts.bodyBold, color: '#0A0A0A' },

  activeChipsRow: { marginTop: spacing.sm },
  activeChipsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(200,150,12,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.32)',
    maxWidth: 180,
  },
  activeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: '#A07A0A',
    flexShrink: 1,
  },
  list: { paddingBottom: spacing.lg, gap: spacing.md },
  skeletonList: { padding: spacing.md, gap: spacing.md },

  recoSection: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  // ─── Card image ───
  imageWrap: {
    width: CARD_IMG_W,
    height: CARD_IMG_H,
    overflow: 'hidden',
  },
  image: {
    width: CARD_IMG_W,
    height: CARD_IMG_H,
    backgroundColor: c.bgCardAlt,
  },
  priceGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: CARD_IMG_H * 0.45,
  },
  // Compteur photos — haut droite, pas de conflit avec le prix en bas
  cardImgCount: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cardImgCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm, left: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  badgeVente: {
    backgroundColor: 'rgba(200,150,12,0.18)',
    borderColor: 'rgba(200,150,12,0.4)',
  },
  badgeLoc: {
    backgroundColor: 'rgba(74,144,217,0.18)',
    borderColor: 'rgba(74,144,217,0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.5,
  },
  badgeTextVente: { color: c.gold },
  badgeTextLoc:   { color: c.blue },
  priceOverlay: {
    position: 'absolute',
    bottom: spacing.sm, right: spacing.sm,
  },

  // ─── Card corps ───
  body: {
    padding: spacing.md,
    gap: 5,
  },
  metaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.gold,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
    lineHeight: 22,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    color: c.textMuted,
  },
});
