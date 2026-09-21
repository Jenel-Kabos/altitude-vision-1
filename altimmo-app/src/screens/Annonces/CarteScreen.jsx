import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SearchPanel } from '../../components';
import { formatPriceShort, PRICE_MAX } from '../../constants/propertyTypes';
import { ACCOMMODATION_TYPES_WITH_ALL } from '../../constants/accommodation';
import { DEFAULT_PROPERTY_FILTERS, buildPropertyQueryParams } from '../../utils/propertyQueryParams';
import { fetchMapAggregates } from '../../services/mapAggregatesService';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

// ALTIMMO-MAP-LOCALITY-CENTROIDS-2
// La carte présente désormais une AGRÉGATION par localité (arrondissement).
// - 1 marker = 1 localité, jamais 1 marker = 1 propriété.
// - Les coordonnées des propriétés ne sont plus consommées par cet écran.
// - Les centroïdes proviennent de `server/data/localityCentroids.js` (source
//   OSM/ODbL, résolus manuellement une fois, servis par le backend).
// - Le total du header vient du backend (mappedTotal + unmappedTotal), donc
//   INDÉPENDANT de la pagination.

const TRANSACTION_LABELS = { vente: 'Vente', location: 'Location', hebergement: 'Hébergement' };

const BRAZZAVILLE = {
  latitude: -4.2634,
  longitude: 15.2429,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry',                    stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.text.fill',            stylers: [{ color: '#C8960C' }] },
  { elementType: 'labels.text.stroke',          stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'road',        elementType: 'geometry',        stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road',        elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'water',       elementType: 'geometry',        stylers: [{ color: '#0D1E36' }] },
  { featureType: 'poi',         elementType: 'geometry',        stylers: [{ color: '#222222' }] },
  { featureType: 'poi',         elementType: 'labels.text.fill',stylers: [{ color: '#888888' }] },
  { featureType: 'landscape',   elementType: 'geometry',        stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'transit',     elementType: 'geometry',        stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C8960C', opacity: 0.4 }] },
];

const DEFAULT_FILTERS = DEFAULT_PROPERTY_FILTERS;
const buildQuery = (filters) => buildPropertyQueryParams(filters, {});

// ─── Marker de localité ──────────────────────────────────────────────────────

const LocalityBubble = memo(function LocalityBubble({ count, label, isSelected, bubbleStyles }) {
  return (
    <View style={bubbleStyles.wrapper} collapsable={false}>
      <View style={[bubbleStyles.bubble, isSelected && bubbleStyles.bubbleSelected]}>
        <Text style={[bubbleStyles.count, isSelected && bubbleStyles.countSelected]}>{count}</Text>
      </View>
      <View style={[bubbleStyles.labelBox, isSelected && bubbleStyles.labelBoxSelected]}>
        <Text style={[bubbleStyles.label, isSelected && bubbleStyles.labelSelected]} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
});

// react-native-maps #1631 — sur Android, un Marker avec un enfant personnalisé
// reste invisible sur GoogleMap tant que `tracksViewChanges` n'a pas été forcé
// à true pour la première mesure. On garde `tracksViewChanges: true` pendant
// ~700ms au montage puis on le désactive (perfs sur pan/zoom). Un marker
// sélectionné réactive le suivi pour animer proprement le style.
function LocalityMarker({ area, isSelected, onPress, bubbleStyles }) {
  const [tracks, setTracks] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
  }, [area.key]);
  const lat = Number(area.latitude);
  const lng = Number(area.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      accessibilityLabel={`${area.count} bien${area.count > 1 ? 's' : ''} à ${area.label}`}
      tracksViewChanges={tracks || isSelected}
      anchor={{ x: 0.5, y: 1 }}
    >
      <LocalityBubble
        count={area.count}
        label={area.label}
        isSelected={isSelected}
        bubbleStyles={bubbleStyles}
      />
    </Marker>
  );
}

function ActiveChip({ label, onRemove, c, styles }) {
  return (
    <View style={styles.activeChip}>
      <Text style={styles.activeChipText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`Supprimer le filtre ${label}`}>
        <Ionicons name="close-circle" size={14} color={c.gold} />
      </TouchableOpacity>
    </View>
  );
}

// ─── CarteScreen ────────────────────────────────────────────────────────────

export default function CarteScreen({ navigation }) {
  const { themeColors: c, isDark } = useTheme();
  const styles       = useMemo(() => makeStyles(c), [c]);
  const bubbleStyles = useMemo(() => makeBubbleStyles(c), [c]);
  const insets       = useSafeAreaInsets();

  const [aggregates, setAggregates] = useState({ total: 0, mappedTotal: 0, unmappedTotal: 0, areas: [] });
  const [loading, setLoading]       = useState(true);
  const [erreur, setErreur]         = useState('');
  const [selected, setSelected]     = useState(null); // area sélectionnée
  const [locating, setLocating]     = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const mapRef = useRef(null);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (activeFilters.offerType !== 'tous')    n++;
    const secondary = activeFilters.offerType === 'hebergement' ? activeFilters.accommodationType : activeFilters.propertyType;
    if (secondary !== 'tous')       n++;
    if (activeFilters.city !== 'Toutes')        n++;
    if (activeFilters.arrondissement !== 'Tous') n++;
    if (activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < PRICE_MAX) n++;
    return n;
  }, [activeFilters]);

  const loadAggregates = useCallback(async (filters) => {
    setLoading(true);
    setErreur('');
    setSelected(null);
    try {
      const data = await fetchMapAggregates(buildQuery(filters));
      setAggregates(data);
    } catch {
      setErreur('Impossible de charger la carte.');
      setAggregates({ total: 0, mappedTotal: 0, unmappedTotal: 0, areas: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAggregates(activeFilters); }, [activeFilters, loadAggregates]);

  const onMarkerPress = useCallback((area) => {
    setSelected(area);
    mapRef.current?.animateToRegion({
      latitude: area.latitude - 0.005, longitude: area.longitude,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 400);
  }, []);

  const onDismiss = useCallback(() => setSelected(null), []);

  const onSeeArea = useCallback(() => {
    if (!selected) return;
    // Conserve tous les filtres actifs et injecte city+arrondissement de la
    // bulle tapée. ListeAnnoncesScreen lit `route.params.initialFilters` et
    // exécute `/altimmo/search` avec les mêmes filtres canoniques que
    // `/altimmo/map-aggregates` — l'INVARIANT area.count === list.total
    // dépend de cette propagation.
    const initialFilters = { ...activeFilters, city: selected.city, arrondissement: selected.label };
    navigation.navigate('Annonces', { screen: 'ListeAnnonces', params: { initialFilters } });
  }, [selected, activeFilters, navigation]);

  const onSearchSubmit = useCallback((filters) => {
    setActiveFilters(filters);
    setFilterOpen(false);
  }, []);

  const onResetFilters = useCallback(() => setActiveFilters(DEFAULT_FILTERS), []);

  const locateUser = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          "Veuillez autoriser l'accès à la localisation dans les paramètres de votre téléphone.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 600,
      );
    } catch {
      Alert.alert('Erreur', "Impossible d'obtenir votre position.");
    } finally {
      setLocating(false);
    }
  }, []);

  const cardBottom      = useMemo(() => insets.bottom + (Platform.OS === 'ios' ? 60 : 56), [insets.bottom]);
  const locateBtnBottom = useMemo(() => (selected ? cardBottom + 128 + 12 : cardBottom + 16), [selected, cardBottom]);

  const showEmpty = !loading && !erreur && aggregates.total === 0;

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.gold} />
          <Text style={styles.loaderText}>Chargement de la carte…</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          // ALTIMMO-MAP-ZERO-HEIGHT-FIX-6 — `flex: 1` remplace absoluteFillObject
          // (yoga+Fabric mesurait la MapView à 0 de hauteur en absolute).
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={BRAZZAVILLE}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {aggregates.areas.map((area) => (
            <LocalityMarker
              key={area.key}
              area={area}
              isSelected={selected?.key === area.key}
              onPress={() => onMarkerPress(area)}
              bubbleStyles={bubbleStyles}
            />
          ))}
        </MapView>
      )}

      {/* ─── Header ─── (position: absolute — la MapView occupe le flex flow) */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.headerLayer}>
        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.headerRow} pointerEvents="auto">
            <Ionicons name="map-outline" size={18} color={c.gold} />
            <Text style={styles.headerTitle}>Carte des biens</Text>
            {aggregates.total > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText} accessibilityLabel={`${aggregates.total} biens au total`}>
                  {aggregates.total} bien{aggregates.total > 1 ? 's' : ''}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
              onPress={() => setFilterOpen((v) => !v)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount > 0 ? `${activeFilterCount} filtres actifs` : 'Filtrer les biens'}
            >
              <Ionicons name="options-outline" size={15}
                color={activeFilterCount > 0 ? '#0A0A0A' : c.textSub} />
              <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>Filtres</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeFilterCount > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipsRow} contentContainerStyle={styles.chipsContent} pointerEvents="auto">
              {activeFilters.offerType !== 'tous' && (
                <ActiveChip label={TRANSACTION_LABELS[activeFilters.offerType] || activeFilters.offerType}
                  onRemove={() => setActiveFilters((p) => ({ ...p, offerType: 'tous', propertyType: 'tous', accommodationType: 'tous' }))}
                  c={c} styles={styles} />
              )}
              {activeFilters.offerType === 'hebergement'
                ? activeFilters.accommodationType !== 'tous' && (
                  <ActiveChip label={ACCOMMODATION_TYPES_WITH_ALL.find((t) => t.value === activeFilters.accommodationType)?.label || activeFilters.accommodationType}
                    onRemove={() => setActiveFilters((p) => ({ ...p, accommodationType: 'tous' }))}
                    c={c} styles={styles} />
                )
                : activeFilters.propertyType !== 'tous' && (
                  <ActiveChip label={activeFilters.propertyType}
                    onRemove={() => setActiveFilters((p) => ({ ...p, propertyType: 'tous' }))}
                    c={c} styles={styles} />
                )}
              {activeFilters.city !== 'Toutes' && (
                <ActiveChip label={activeFilters.city}
                  onRemove={() => setActiveFilters((p) => ({ ...p, city: 'Toutes', arrondissement: 'Tous' }))}
                  c={c} styles={styles} />
              )}
              {activeFilters.arrondissement !== 'Tous' && (
                <ActiveChip label={activeFilters.arrondissement}
                  onRemove={() => setActiveFilters((p) => ({ ...p, arrondissement: 'Tous' }))}
                  c={c} styles={styles} />
              )}
              {(activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < PRICE_MAX) && (
                <ActiveChip label={`${activeFilters.priceRange[0] > 0 ? formatPriceShort(activeFilters.priceRange[0]) : '0'} – ${activeFilters.priceRange[1] < PRICE_MAX ? formatPriceShort(activeFilters.priceRange[1]) : '∞'} FCFA`}
                  onRemove={() => setActiveFilters((p) => ({ ...p, priceRange: [0, PRICE_MAX] }))}
                  c={c} styles={styles} />
              )}
              <TouchableOpacity onPress={onResetFilters} style={styles.resetChip}
                accessibilityRole="button" accessibilityLabel="Effacer tous les filtres">
                <Text style={styles.resetChipText}>Tout effacer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {aggregates.unmappedTotal > 0 && (
            <View style={styles.unmappedBanner} pointerEvents="auto">
              <Ionicons name="information-circle-outline" size={14} color={c.textSub} />
              <Text style={styles.unmappedText} numberOfLines={2}>
                {aggregates.unmappedTotal} bien{aggregates.unmappedTotal > 1 ? 's' : ''} dans des zones non encore cartographiées.
              </Text>
            </View>
          )}
        </View>

        <SearchPanel
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          initialFilters={activeFilters}
          onSearch={onSearchSubmit}
        />
      </SafeAreaView>

      {/* ─── Bouton "Me localiser" ─── */}
      <TouchableOpacity
        style={[styles.locateBtn, { bottom: locateBtnBottom }]}
        onPress={locateUser}
        activeOpacity={0.85}
        accessibilityLabel="Me localiser"
      >
        {locating ? <ActivityIndicator size="small" color={c.gold} /> : <Ionicons name="locate-outline" size={22} color={c.gold} />}
      </TouchableOpacity>

      {/* ─── Empty state ─── */}
      {showEmpty && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View style={styles.emptyCard} pointerEvents="auto">
            <Ionicons name="map-outline" size={28} color={c.gold} />
            <Text style={styles.emptyTitle}>Aucun bien correspondant</Text>
            <Text style={styles.emptyBody}>Modifiez vos filtres pour découvrir d'autres biens.</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.emptyBtn} onPress={onResetFilters}>
                <Text style={styles.emptyBtnText}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ─── Erreur API ─── */}
      {!loading && !!erreur && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View style={styles.emptyCard} pointerEvents="auto">
            <Ionicons name="cloud-offline-outline" size={26} color={c.textSub} />
            <Text style={styles.emptyTitle}>{erreur}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => loadAggregates(activeFilters)}>
              <Text style={styles.emptyBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Bottom card d'une zone ─── */}
      {selected && (
        <View style={[styles.selectedCard, { bottom: cardBottom }]}>
          <TouchableOpacity style={styles.closeCard} onPress={onDismiss} hitSlop={10} accessibilityLabel="Fermer">
            <Ionicons name="close" size={14} color={c.textMuted} />
          </TouchableOpacity>
          <View style={styles.selectedInner}>
            <Text style={styles.selectedTitle} numberOfLines={1}>{selected.label}</Text>
            <Text style={styles.selectedSubtitle}>
              {selected.count} bien{selected.count > 1 ? 's' : ''} disponible{selected.count > 1 ? 's' : ''}
              {selected.city ? ` · ${selected.city}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.seeBtn} onPress={onSeeArea} activeOpacity={0.85}
            accessibilityLabel={`Voir les ${selected.count} biens à ${selected.label}`}>
            <Text style={styles.seeBtnText}>Voir les {selected.count} bien{selected.count > 1 ? 's' : ''}</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeBubbleStyles = (c) => StyleSheet.create({
  wrapper: { alignItems: 'center' },
  bubble: {
    minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: 12,
    backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 6,
  },
  bubbleSelected: { backgroundColor: '#0A0A0A', borderColor: c.gold },
  count: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#0A0A0A' },
  countSelected: { color: c.gold },
  labelBox: {
    marginTop: 3, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: c.bgCard, borderRadius: 4,
    borderWidth: 1, borderColor: c.border,
  },
  labelBoxSelected: { backgroundColor: c.gold, borderColor: c.gold },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, color: c.text },
  labelSelected: { color: '#0A0A0A' },
});

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bgCardAlt },
  // ALTIMMO-MAP-ZERO-HEIGHT-FIX-6 — la MapView occupe désormais le flex flow
  // (`flex: 1`) car `absoluteFillObject` la mesurait à 0×0 sur Fabric. Les
  // overlays qui s'affichaient au-dessus de la carte doivent donc être
  // extraits du flow avec position:absolute, sinon le header pousserait la
  // MapView vers le bas.
  headerLayer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loaderText: { fontFamily: fonts.body, fontSize: fontSize.md, color: c.textSub },

  header: {
    margin: spacing.md, marginBottom: 0, backgroundColor: c.bgCard, borderRadius: radius.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5, overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontSize: fontSize.md, color: c.text },
  countBadge: { backgroundColor: c.goldMuted, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  countText: { fontFamily: fonts.bodyBold, fontSize: 11, color: c.goldDark },

  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.xs, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCardAlt },
  filterBtnActive: { backgroundColor: c.gold, borderColor: c.gold },
  filterBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.textSub },
  filterBtnTextActive: { color: '#0A0A0A' },
  filterBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: c.gold },

  chipsRow: { borderTopWidth: 1, borderTopColor: c.border },
  chipsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: 20, backgroundColor: 'rgba(200,150,12,0.10)', borderWidth: 1, borderColor: 'rgba(200,150,12,0.32)', maxWidth: 160 },
  activeChipText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: '#A07A0A', flexShrink: 1 },
  resetChip: { paddingHorizontal: spacing.sm, paddingVertical: 5 },
  resetChipText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, textDecorationLine: 'underline' },

  unmappedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bgCardAlt,
  },
  unmappedText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: c.textSub },

  selectedCard: {
    position: 'absolute', left: spacing.md, right: spacing.md, backgroundColor: c.bgCard, borderRadius: radius.md,
    padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  selectedInner: { gap: 2 },
  selectedTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.lg, color: c.text },
  selectedSubtitle: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub },
  seeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.sm, backgroundColor: '#185FA5', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 11 },
  seeBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
  closeCard: { position: 'absolute', top: spacing.xs, right: spacing.xs, zIndex: 1,
    width: 22, height: 22, borderRadius: 11, backgroundColor: c.bgCardAlt, alignItems: 'center', justifyContent: 'center' },

  locateBtn: { position: 'absolute', right: spacing.md, width: 46, height: 46, borderRadius: 23,
    backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
    borderWidth: 1, borderColor: c.borderGold },

  emptyOverlay: { position: 'absolute', left: 0, right: 0, top: 140, bottom: 140,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  emptyCard: { alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgCard, padding: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, textAlign: 'center' },
  emptyBody:  { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub, textAlign: 'center' },
  emptyBtn:   { marginTop: spacing.xs, backgroundColor: c.gold, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.sm },
  emptyBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#0A0A0A' },
});
