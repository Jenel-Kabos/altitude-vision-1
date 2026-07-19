import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Linking, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import Supercluster from 'supercluster';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../services/api';
import { cache } from '../../services/cacheService';
import { SearchPanel } from '../../components';
import { formatPriceShort, PRICE_MAX } from '../../constants/propertyTypes';
import PrixFCFA from '../../components/PrixFCFA';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

const PLACEHOLDER_IMG = require('../../../assets/Logo_Altitude_transparent.png');

const TRANSACTION_LABELS = { vente: 'Vente', location: 'Location', hebergement: 'Hébergement' };

const BRAZZAVILLE = {
  latitude:      -4.2634,
  longitude:     15.2429,
  latitudeDelta:  0.15,
  longitudeDelta: 0.15,
};

// Style carte sombre — appliqué quand isDark est vrai
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

// ─── Filtres par défaut ───────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  transaction:    'tous',
  typeBien:       'tous',
  priceRange:     [0, 500000000],
  ville:          'Toutes',
  arrondissement: 'Tous',
};

// ─── Construction de la query API depuis les filtres ─────────────────────────
function buildQuery(filters) {
  const params = new URLSearchParams({
    limit: '200',
    statusAdmin: 'Validée',
    availability: 'Disponible',
  });
  if (filters.transaction !== 'tous')    params.set('status', filters.transaction);
  if (filters.typeBien !== 'tous')       params.set('type', filters.typeBien);
  if (filters.ville !== 'Toutes')        params.set('city', filters.ville);
  if (filters.arrondissement !== 'Tous') params.set('arrondissement', filters.arrondissement);
  if (filters.priceRange[0] > 0)         params.set('price[gte]', String(filters.priceRange[0]));
  if (filters.priceRange[1] < 500000000) params.set('price[lte]', String(filters.priceRange[1]));
  return params.toString();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function regionToSupercluster(region) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
  return {
    bbox: [
      longitude - longitudeDelta / 2,
      latitude  - latitudeDelta  / 2,
      longitude + longitudeDelta / 2,
      latitude  + latitudeDelta  / 2,
    ],
    zoom: Math.round(Math.log2(360 / longitudeDelta)),
  };
}

function clusterSize(count) {
  if (count < 5)  return 40;
  if (count < 15) return 50;
  if (count < 40) return 60;
  return 70;
}

function formatPriceCourt(price) {
  if (!price || price <= 0) return '—';
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1).replace('.', ',')}Md`;
  if (price >= 1_000_000)    return `${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1).replace('.', ',')}M`;
  if (price >= 1_000)        return `${Math.round(price / 1_000)}k`;
  return `${price}`;
}

// ─── Pin prix ─────────────────────────────────────────────────────────────────

const LOCATION_BG = '#1A2C4E';
const HEBERGEMENT_BG = '#14532D';

const PricePin = memo(function PricePin({ price, status, isSelected, pinStyles }) {
  const statusKey = status?.toLowerCase();
  const isLocation = statusKey === 'location';
  const isHebergement = statusKey === 'hebergement';
  const label  = formatPriceCourt(price);
  const suffix = isHebergement ? ' FCFA' : isLocation ? '/m' : ' FCFA';

  return (
    <View style={pinStyles.wrapper}>
      <View style={[
        pinStyles.bubble,
        isSelected && pinStyles.bubbleSelected,
        isLocation && !isSelected && pinStyles.bubbleLocation,
        isHebergement && !isSelected && pinStyles.bubbleHebergement,
      ]}>
        <Text style={[pinStyles.amount, isSelected && pinStyles.amountSelected]}>{label}</Text>
        <Text style={[pinStyles.suffix, isSelected && pinStyles.suffixSelected]}>{suffix}</Text>
      </View>
      <View style={[
        pinStyles.triangle,
        isSelected && pinStyles.triangleSelected,
        isLocation && !isSelected && pinStyles.triangleLocation,
        isHebergement && !isSelected && pinStyles.triangleHebergement,
      ]} />
    </View>
  );
}, (prev, next) =>
  prev.isSelected === next.isSelected &&
  prev.price      === next.price      &&
  prev.pinStyles  === next.pinStyles
);

// ─── Chip filtre actif ────────────────────────────────────────────────────────
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

// ─── CarteScreen ──────────────────────────────────────────────────────────────

export default function CarteScreen({ navigation }) {
  const { themeColors: c, isDark } = useTheme();
  const styles    = useMemo(() => makeStyles(c), [c]);
  const pinStyles = useMemo(() => makePinStyles(c), [c]);
  const insets    = useSafeAreaInsets();

  const [annonces, setAnnonces]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null);
  const [clusters, setClusters]         = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating]         = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen]     = useState(false);

  const mapRef = useRef(null);
  const scRef  = useRef(null);

  // ─── Compteur de filtres actifs ───
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (activeFilters.transaction !== 'tous')    n++;
    if (activeFilters.typeBien !== 'tous')       n++;
    if (activeFilters.ville !== 'Toutes')        n++;
    if (activeFilters.arrondissement !== 'Tous') n++;
    if (activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < 500_000_000) n++;
    return n;
  }, [activeFilters]);

  // ─── Chargement avec cache + filtres dynamiques ───
  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const KEY = `carte:${buildQuery(activeFilters)}`;
    const hit = cache.get(KEY);
    if (hit) { setAnnonces(hit); setLoading(false); return; }
    api.get(`/properties?${buildQuery(activeFilters)}`)
      .then(res => {
        const data = res.data.data?.properties || res.data.properties || res.data.data || [];
        const withCoords = data.filter(
          p => (p.latitude || p.address?.coordinates?.lat) &&
               (p.longitude || p.address?.coordinates?.lng)
        );
        cache.set(KEY, withCoords, 5 * 60 * 1000);
        setAnnonces(withCoords);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeFilters]);

  // ─── Index Supercluster ───
  const updateClusters = useCallback((region) => {
    if (!scRef.current) return;
    const { bbox, zoom } = regionToSupercluster(region);
    setClusters(scRef.current.getClusters(bbox, zoom));
  }, []);

  useEffect(() => {
    if (annonces.length === 0) { setClusters([]); return; }
    const index = new Supercluster({ radius: 50, maxZoom: 16, minPoints: 2 });
    index.load(annonces.map(a => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          a.longitude || a.address?.coordinates?.lng,
          a.latitude  || a.address?.coordinates?.lat,
        ],
      },
      properties: { annonce: a },
    })));
    scRef.current = index;
    updateClusters(BRAZZAVILLE);
  }, [annonces, updateClusters]);

  // ─── Handlers ───
  const handleClusterPress = useCallback((clusterId) => {
    if (!scRef.current) return;
    const leaves = scRef.current.getLeaves(clusterId, Infinity);
    const lats   = leaves.map(l => l.geometry.coordinates[1]);
    const lngs   = leaves.map(l => l.geometry.coordinates[0]);
    mapRef.current?.animateToRegion({
      latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta:  Math.max((Math.max(...lats) - Math.min(...lats)) * 1.6, 0.02),
      longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.6, 0.02),
    }, 500);
  }, []);

  const handleMarkerPress = useCallback((annonce) => {
    setSelected(annonce);
    mapRef.current?.animateToRegion({
      latitude:       (annonce.latitude || annonce.address?.coordinates?.lat) - 0.008,
      longitude:      annonce.longitude || annonce.address?.coordinates?.lng,
      latitudeDelta:  0.04,
      longitudeDelta: 0.04,
    }, 400);
  }, []);

  const handleDismiss   = useCallback(() => setSelected(null), []);
  const handleCardPress = useCallback(() => {
    if (selected) navigation.navigate('Annonces', { screen: 'DetailAnnonce', params: { annonce: selected } });
  }, [selected, navigation]);

  const onSearchSubmit = useCallback((filters) => {
    setActiveFilters(filters);
    setFilterOpen(false);
  }, []);

  const onResetFilters = useCallback(() => setActiveFilters(DEFAULT_FILTERS), []);

  // ─── Localiser l'utilisateur ───
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
      setUserLocation({ latitude, longitude });
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 },
        600,
      );
    } catch {
      Alert.alert('Erreur', "Impossible d'obtenir votre position.");
    } finally {
      setLocating(false);
    }
  }, []);

  // ─── Ouvrir l'itinéraire ───
  const openDirections = useCallback(async (annonce) => {
    const lat = annonce.latitude || annonce.address?.coordinates?.lat;
    const lng = annonce.longitude || annonce.address?.coordinates?.lng;
    if (!lat || !lng) {
      Alert.alert('Coordonnées manquantes', "Ce bien n'a pas encore de position GPS.");
      return;
    }
    const label = encodeURIComponent(annonce.title || 'Bien immobilier');

    if (Platform.OS === 'ios') {
      const googleInstalled = await Linking.canOpenURL('comgooglemaps://');
      if (googleInstalled) {
        Linking.openURL(`comgooglemaps://?daddr=${lat},${lng}&q=${label}&directionsmode=driving`);
      } else {
        Linking.openURL(`maps://?daddr=${lat},${lng}&q=${label}`);
      }
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}&travelmode=driving`,
      );
    }
  }, []);

  // Offset bas de la card : inset bas + hauteur de la tab bar
  const cardBottom = useMemo(
    () => insets.bottom + (Platform.OS === 'ios' ? 60 : 56),
    [insets.bottom],
  );

  // Position du bouton locate : au-dessus de la card si un bien est sélectionné
  const locateBtnBottom = useMemo(
    () => (selected ? cardBottom + 152 + 12 : cardBottom + 16),
    [selected, cardBottom],
  );

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
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={BRAZZAVILLE}
          onRegionChangeComplete={updateClusters}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {clusters.map((item) => {
            const [lng, lat] = item.geometry.coordinates;
            const coordinate = { latitude: lat, longitude: lng };

            if (item.properties.cluster) {
              const { cluster_id, point_count } = item.properties;
              const size = clusterSize(point_count);
              return (
                <Marker
                  key={`cluster-${cluster_id}`}
                  coordinate={coordinate}
                  onPress={() => handleClusterPress(cluster_id)}
                  accessibilityLabel={`Groupe de ${point_count} biens`}
                  tracksViewChanges={false}
                >
                  <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
                    <Text style={styles.clusterCount}>{point_count}</Text>
                    <Text style={styles.clusterLabel}>biens</Text>
                  </View>
                </Marker>
              );
            }

            const { annonce } = item.properties;
            const isSelected  = selected?._id === annonce._id;

            return (
              <Marker
                key={annonce._id}
                coordinate={coordinate}
                onPress={() => handleMarkerPress(annonce)}
                accessibilityLabel={annonce.title}
                tracksViewChanges={isSelected}
              >
                <PricePin
                  price={annonce.price}
                  status={annonce.status}
                  isSelected={isSelected}
                  pinStyles={pinStyles}
                />
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* ─── Header flottant ─────────────────────────────────── */}
      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">

          {/* Ligne principale */}
          <View style={styles.headerRow} pointerEvents="auto">
            <Ionicons name="map-outline" size={18} color={c.gold} />
            <Text style={styles.headerTitle}>Carte des biens</Text>
            {annonces.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {annonces.length} bien{annonces.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Bouton Filtres */}
            <TouchableOpacity
              style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
              onPress={() => setFilterOpen(v => !v)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount > 0
                ? `${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''} actif${activeFilterCount > 1 ? 's' : ''}`
                : 'Filtrer les biens'}
            >
              <Ionicons name="options-outline" size={15}
                color={activeFilterCount > 0 ? '#0A0A0A' : c.textSub} />
              <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
                Filtres
              </Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Chips filtres actifs */}
          {activeFilterCount > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
              contentContainerStyle={styles.chipsContent}
              pointerEvents="auto"
            >
              {activeFilters.transaction !== 'tous' && (
                <ActiveChip
                  label={TRANSACTION_LABELS[activeFilters.transaction] || activeFilters.transaction}
                  onRemove={() => setActiveFilters(prev => ({ ...prev, transaction: 'tous' }))}
                  c={c} styles={styles}
                />
              )}
              {activeFilters.typeBien !== 'tous' && (
                <ActiveChip
                  label={activeFilters.typeBien}
                  onRemove={() => setActiveFilters(prev => ({ ...prev, typeBien: 'tous' }))}
                  c={c} styles={styles}
                />
              )}
              {activeFilters.ville !== 'Toutes' && (
                <ActiveChip
                  label={activeFilters.ville}
                  onRemove={() => setActiveFilters(prev => ({ ...prev, ville: 'Toutes', arrondissement: 'Tous' }))}
                  c={c} styles={styles}
                />
              )}
              {activeFilters.arrondissement !== 'Tous' && (
                <ActiveChip
                  label={activeFilters.arrondissement}
                  onRemove={() => setActiveFilters(prev => ({ ...prev, arrondissement: 'Tous' }))}
                  c={c} styles={styles}
                />
              )}
              {(activeFilters.priceRange[0] > 0 || activeFilters.priceRange[1] < PRICE_MAX) && (
                <ActiveChip
                  label={`${activeFilters.priceRange[0] > 0 ? formatPriceShort(activeFilters.priceRange[0]) : '0'} – ${activeFilters.priceRange[1] < PRICE_MAX ? formatPriceShort(activeFilters.priceRange[1]) : '∞'} FCFA`}
                  onRemove={() => setActiveFilters(prev => ({ ...prev, priceRange: [0, PRICE_MAX] }))}
                  c={c} styles={styles}
                />
              )}
              <TouchableOpacity onPress={onResetFilters} style={styles.resetChip}
                accessibilityRole="button" accessibilityLabel="Effacer tous les filtres">
                <Text style={styles.resetChipText}>Tout effacer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* SearchPanel — s'ouvre par-dessus la carte */}
        <SearchPanel
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          initialFilters={activeFilters}
          onSearch={onSearchSubmit}
        />
      </SafeAreaView>

      {/* ─── Bouton "Me localiser" ───────────────────────── */}
      <TouchableOpacity
        style={[styles.locateBtn, { bottom: locateBtnBottom }]}
        onPress={locateUser}
        activeOpacity={0.85}
        accessibilityLabel="Me localiser"
      >
        {locating
          ? <ActivityIndicator size="small" color={c.gold} />
          : <Ionicons name="locate-outline" size={22} color={c.gold} />
        }
      </TouchableOpacity>

      {/* ─── Card bien sélectionné ────────────────────────────── */}
      {selected && (
        <View style={[styles.selectedCard, { bottom: cardBottom }]}>
          <TouchableOpacity
            style={styles.closeCard}
            onPress={handleDismiss}
            hitSlop={10}
            accessibilityLabel="Fermer"
          >
            <Ionicons name="close" size={14} color={c.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectedCardInner}
            onPress={handleCardPress}
            activeOpacity={0.9}
            accessibilityLabel={`Voir le détail : ${selected.title}`}
          >
            <Image
              source={selected.images?.[0] ? { uri: selected.images[0] } : PLACEHOLDER_IMG}
              style={styles.selectedThumb}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedType}>
                {(selected.type || 'Bien').toUpperCase()}
                {selected.status ? ` · ${selected.status.toUpperCase()}` : ''}
              </Text>
              <Text style={styles.selectedTitle} numberOfLines={1}>{selected.title}</Text>
              <View style={styles.selectedAddrRow}>
                <Ionicons name="location-outline" size={11} color={c.textMuted} />
                <Text style={styles.selectedAddr} numberOfLines={1}>
                  {selected.address?.arrondissement || selected.address?.city || 'Brazzaville'}
                </Text>
              </View>
              <PrixFCFA montant={selected.price} />
            </View>
            <View style={styles.selectedArrow}>
              <Ionicons name="chevron-forward" size={18} color={c.gold} />
            </View>
          </TouchableOpacity>

          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => openDirections(selected)}
            activeOpacity={0.85}
            accessibilityLabel="Obtenir l'itinéraire"
          >
            <Ionicons name="navigate-outline" size={15} color="#FFFFFF" />
            <Text style={styles.directionsBtnText}>Itinéraire vers ce bien</Text>
            <Ionicons name="open-outline" size={13} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles pins prix ─────────────────────────────────────────────────────────

const makePinStyles = (c) => StyleSheet.create({
  wrapper:  { alignItems: 'center' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    backgroundColor: c.bgCard,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 5,
  },
  bubbleSelected: { backgroundColor: c.gold, borderColor: c.gold },
  bubbleLocation: { backgroundColor: LOCATION_BG, borderColor: c.blue },
  bubbleHebergement: { backgroundColor: HEBERGEMENT_BG, borderColor: '#16A34A' },
  amount: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: c.text,
  },
  amountSelected: { color: '#0A0A0A' },
  suffix: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: c.textMuted,
  },
  suffixSelected: { color: '#0A0A0A', opacity: 0.7 },
  triangle: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: c.bgCard,
    marginTop: -1,
  },
  triangleSelected: { borderTopColor: c.gold },
  triangleLocation: { borderTopColor: LOCATION_BG },
  triangleHebergement: { borderTopColor: HEBERGEMENT_BG },
});

// ─── Styles écran ─────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bgCardAlt },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loaderText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textSub,
  },

  // ─── Header ───
  header: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: c.bgCard,
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
  },
  countBadge: {
    backgroundColor: c.goldMuted,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: c.goldDark,
  },

  // ─── Bouton Filtres ───
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCardAlt,
  },
  filterBtnActive: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  filterBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.textSub,
  },
  filterBtnTextActive: {
    color: '#0A0A0A',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.gold,
  },

  // ─── Chips filtres actifs ───
  chipsRow: {
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  chipsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    maxWidth: 160,
  },
  activeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: '#A07A0A',
    flexShrink: 1,
  },
  resetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  resetChipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textDecorationLine: 'underline',
  },

  // ─── Clusters ───
  cluster: {
    backgroundColor: c.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  clusterCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
    lineHeight: 18,
  },
  clusterLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#0A0A0A',
    opacity: 0.7,
  },

  // ─── Card sélectionné ───
  selectedCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  selectedCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  selectedThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.xs,
    backgroundColor: c.bgCardAlt,
  },
  selectedInfo: { flex: 1, gap: 3 },
  selectedType: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.2,
    color: c.textMuted,
  },
  selectedTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  selectedAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  selectedAddr: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
    flex: 1,
  },
  selectedArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCard: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    zIndex: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Bouton "Me localiser" ───
  locateBtn: {
    position: 'absolute',
    right: spacing.md,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: c.borderGold,
  },

  // ─── Itinéraire ───
  cardDivider: {
    height: 1,
    backgroundColor: c.border,
    marginHorizontal: spacing.sm,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#185FA5',
    margin: spacing.sm,
    marginTop: 8,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  directionsBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
  },
});
