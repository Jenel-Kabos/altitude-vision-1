import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import HotelHeroGallery from '../../components/hotel/HotelHeroGallery';
import HotelRoomCard from '../../components/hotel/HotelRoomCard';
import HotelBookingStickyBar from '../../components/hotel/HotelBookingStickyBar';
import HotelLocationMap from '../../components/hotel/HotelLocationMap';
import HotelSearchPanel from '../../components/hotel/HotelSearchPanel';
import HotelAvailableRoomCard from '../../components/hotel/HotelAvailableRoomCard';
import HotelReviewsSection from '../../components/hotel/HotelReviewsSection';
import HotelFaqAccordion from '../../components/hotel/HotelFaqAccordion';
import HotelNearbySection from '../../components/hotel/HotelNearbySection';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import { getPublicHotel, getHotelReviews, getNearbyHotels, searchHotelAvailability } from '../../services/hotelReservationService';

// PHASE-H1 — icônes/étiquettes des points forts déterministes uniquement,
// dérivées de Hotel.hotelServices (jamais un highlight inventé si le champ
// est absent/false — voir HOTEL_DETAIL_H1_REPORT.md §9).
const HIGHLIGHT_DEFINITIONS = [
  { key: 'restaurant', icon: 'restaurant-outline', label: 'Restaurant' },
  { key: 'bar', icon: 'wine-outline', label: 'Bar' },
  { key: 'piscine', icon: 'water-outline', label: 'Piscine' },
  { key: 'spa', icon: 'flower-outline', label: 'Spa' },
  { key: 'salleSport', icon: 'barbell-outline', label: 'Salle de sport' },
  { key: 'salleConference', icon: 'business-outline', label: 'Salle de conférence' },
  { key: 'navette', icon: 'bus-outline', label: 'Navette' },
  { key: 'parking', icon: 'car-outline', label: 'Parking' },
  { key: 'reception24h', icon: 'time-outline', label: 'Réception 24h/24' },
  { key: 'wifi', icon: 'wifi-outline', label: 'Wi-Fi' },
];
// PHASE-H3 — clés normalisées par buildNormalizedPolicies (server/services/
// hotelService.js) : checkIn/checkOut remplacent checkInTime/checkOutTime,
// et smoking/deposit/paymentMethods/minimumAge s'ajoutent (précédence
// Hotel canonique > Accommodation en repli, jamais un défaut inventé).
const POLICY_LABELS = {
  checkIn: 'Arrivée', checkOut: 'Départ', cancellation: 'Annulation',
  pets: 'Animaux', children: 'Enfants', visitors: 'Visiteurs', accessibility: 'Accessibilité',
  smoking: 'Fumeurs', minimumAge: 'Âge minimum', paymentMethods: 'Moyens de paiement',
};
const AMENITY_CATEGORY_LABELS = { cuisine: 'Cuisine', salon: 'Salon', internet: 'Internet', exterieur: 'Extérieur', parking: 'Parking', securite: 'Sécurité' };
const CONDENSED_AMENITY_COUNT = 6;
const DESCRIPTION_COLLAPSED_LENGTH = 180;
const REVIEWS_PAGE_SIZE = 5;
// PHASE-H3 — navigation de section (Altimmo, jamais une copie Trip.com) :
// ancres réellement présentes uniquement, jamais un onglet vers une section
// absente pour cet hôtel (filtré au rendu selon les données chargées).
const SECTION_NAV = [
  { key: 'apercu', label: 'Aperçu' },
  { key: 'chambres', label: 'Chambres' },
  { key: 'avis', label: 'Évaluations' },
  { key: 'emplacement', label: 'Emplacement' },
  { key: 'services', label: 'Services' },
  { key: 'politiques', label: 'Politiques' },
  { key: 'faq', label: 'FAQ' },
];

export default function HotelDetailScreen({ route, navigation }) {
  const { hotelId } = route.params || {};
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [state, setState] = useState({ loading: true, error: null, hotel: null });
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);

  // PHASE-H2 — contexte de recherche canonique (checkIn/checkOut/adults/
  // children/rooms). Réutilisé depuis la navigation si déjà fourni (jamais
  // un séjour inventé par défaut — mission §3) ; sinon état vide explicite,
  // le panneau affiche "Sélectionner" tant qu'aucune date n'est choisie.
  const [search, setSearch] = useState({
    checkIn: route.params?.checkIn || null, checkOut: route.params?.checkOut || null,
    adults: route.params?.adults || 1, children: route.params?.children || 0, rooms: route.params?.rooms || 1,
  });
  // 'idle' | 'loading' | 'success' | 'no_availability' | 'error'
  const [availability, setAvailability] = useState({ status: 'idle', data: null });

  // PHASE-H3 — première page d'avis chargée avec la fiche (jamais toutes les
  // pages d'un coup) ; pagination ultérieure via "Voir plus d'avis".
  const [reviews, setReviews] = useState({ loading: true, loadingMore: false, items: [], pagination: null });
  const loadReviews = useCallback(async (page = 1) => {
    if (!hotelId) return;
    setReviews((current) => ({ ...current, loading: page === 1, loadingMore: page > 1 }));
    try {
      const data = await getHotelReviews(hotelId, { page, limit: REVIEWS_PAGE_SIZE });
      setReviews((current) => ({
        loading: false, loadingMore: false,
        items: page === 1 ? data.reviews : [...current.items, ...data.reviews],
        pagination: data.pagination,
      }));
    } catch (error) {
      setReviews((current) => ({ ...current, loading: false, loadingMore: false }));
    }
  }, [hotelId]);
  useEffect(() => { loadReviews(1); }, [loadReviews]);

  // PHASE-H4 — hôtels à proximité (distance géospatiale serveur, jamais
  // recalculée côté mobile). Chargé une fois, jamais paginé (liste courte,
  // limite serveur par défaut).
  const [nearby, setNearby] = useState({ loading: true, hotels: [] });
  useEffect(() => {
    let cancelled = false;
    if (!hotelId) return undefined;
    setNearby({ loading: true, hotels: [] });
    getNearbyHotels(hotelId).then((hotels) => {
      if (!cancelled) setNearby({ loading: false, hotels });
    }).catch(() => {
      if (!cancelled) setNearby({ loading: false, hotels: [] });
    });
    return () => { cancelled = true; };
  }, [hotelId]);
  // PHASE-H4 — remplace l'écran courant (jamais un `push`) : taper sur un
  // hôtel à proximité depuis une fiche déjà atteinte via un autre hôtel à
  // proximité ne doit jamais faire grossir la pile de navigation.
  const goToNearbyHotel = useCallback((nearbyHotel) => {
    navigation.replace('HotelDetail', { hotelId: nearbyHotel.hotelId });
  }, [navigation]);

  const scrollRef = useRef(null);
  const bodyLayoutY = useRef(0);
  const sectionOffsets = useRef({});
  const scrollToSection = useCallback((key) => {
    const offset = sectionOffsets.current[key];
    if (offset == null) return;
    scrollRef.current?.scrollTo({ y: bodyLayoutY.current + offset - spacing.md, animated: true });
  }, []);

  const runSearch = useCallback(async (context = search) => {
    if (!context.checkIn || !context.checkOut) return;
    setAvailability({ status: 'loading', data: null });
    try {
      const data = await searchHotelAvailability(hotelId, context);
      const hasRooms = (data.roomCategories || []).length > 0;
      setAvailability({ status: hasRooms ? 'success' : 'no_availability', data });
    } catch (error) {
      setAvailability({ status: 'error', data: null });
    }
  }, [hotelId, search]);

  useEffect(() => {
    // Contexte déjà fourni par la navigation (ex: retour depuis Annonces
    // avec des dates déjà choisies) : lance la recherche immédiatement.
    if (route.params?.checkIn && route.params?.checkOut) runSearch(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const handleSelectOffer = useCallback((category, offer) => {
    navigation.navigate('HotelBooking', {
      hotelId,
      roomCategoryId: category.id,
      ratePlanId: offer.ratePlanId,
      checkInDate: search.checkIn,
      checkOutDate: search.checkOut,
      adults: search.adults,
      children: search.children,
      roomsCount: search.rooms,
    });
  }, [navigation, hotelId, search]);

  const load = useCallback(async () => {
    if (!hotelId) { setState({ loading: false, error: 'MISSING_ID', hotel: null }); return; }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await getPublicHotel(hotelId);
      if (!data?.detail) { setState({ loading: false, error: 'NOT_FOUND', hotel: null }); return; }
      setState({ loading: false, error: null, hotel: data.detail });
    } catch (error) {
      const status = error?.response?.status;
      setState({ loading: false, error: status === 404 ? 'NOT_FOUND' : 'NETWORK', hotel: null });
    }
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  const share = useCallback(() => {
    if (!state.hotel) return;
    Share.share({ message: `${state.hotel.name} — découvert sur Altitude Vision` }).catch(() => {});
  }, [state.hotel]);

  const goToBooking = useCallback(() => {
    navigation.navigate('HotelBooking', { hotelId });
  }, [navigation, hotelId]);

  if (state.loading) {
    return (
      <View style={[styles.centerFill, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.gold} />
      </View>
    );
  }

  if (state.error) {
    const messages = {
      MISSING_ID: 'Cet hôtel est introuvable.',
      NOT_FOUND: 'Cet hôtel n’est plus disponible ou n’a pas encore été publié.',
      NETWORK: 'Impossible de charger cette fiche hôtel. Vérifiez votre connexion.',
    };
    return (
      <View style={[styles.centerFill, styles.centerPad, { backgroundColor: c.bg }]}>
        <Ionicons name="alert-circle-outline" size={40} color={c.textMuted} />
        <Text style={styles.errorText}>{messages[state.error] || messages.NETWORK}</Text>
        {state.error === 'NETWORK' && <Button label="Réessayer" onPress={load} style={styles.retryBtn} />}
        <Button label="Retour" variant="outline" onPress={() => navigation.goBack()} style={styles.retryBtn} />
      </View>
    );
  }

  const hotel = state.hotel;
  const activeHighlights = HIGHLIGHT_DEFINITIONS.filter((def) => hotel.amenities?.hotelServices?.[def.key]);
  const structuredAmenities = Object.entries(AMENITY_CATEGORY_LABELS)
    .flatMap(([key, label]) => (hotel.roomCategories?.[0]?.amenities?.[key] || []).map((item) => ({ label, item })));
  // Les points forts (Highlights, dérivés de hotelServices) sont déjà
  // affichés dans leur propre section — cette liste ne reprend que les
  // services libres additionnels (Hotel.services, legacy), jamais un doublon.
  const flatAmenities = hotel.amenities?.services || [];
  const visibleAmenities = amenitiesExpanded ? flatAmenities : flatAmenities.slice(0, CONDENSED_AMENITY_COUNT);
  const activePolicies = Object.entries(hotel.policies || {}).filter(([, value]) => value != null);
  const faqEntries = hotel.faq || [];
  const availableSections = SECTION_NAV.filter((section) => {
    if (section.key === 'avis') return true; // toujours affiché, même vide (état explicite)
    if (section.key === 'services') return flatAmenities.length > 0;
    if (section.key === 'politiques') return activePolicies.length > 0;
    if (section.key === 'faq') return faqEntries.length > 0;
    return true;
  });
  const cheapestRate = hotel.roomCategories
    ?.flatMap((category) => category.rates || [])
    .filter((rate) => rate.rateType === 'public')
    .sort((a, b) => a.amount - b.amount)[0];
  const description = hotel.description || '';
  const descriptionIsLong = description.length > DESCRIPTION_COLLAPSED_LENGTH;
  const visibleDescription = !descriptionIsLong || descriptionExpanded ? description : `${description.slice(0, DESCRIPTION_COLLAPSED_LENGTH)}…`;

  return (
    <View style={styles.root}>
      <Screen ref={scrollRef} scroll style={styles.scrollContent}>
        <HotelHeroGallery images={hotel.gallery} onBack={() => navigation.goBack()} onShare={share} />

        {/* PHASE-H3 — navigation de section (ancres présentes uniquement) */}
        <View style={styles.sectionNavBar}>
          <View style={styles.sectionNavRow}>
            {availableSections.map((section) => (
              <TouchableOpacity key={section.key} accessibilityRole="button" onPress={() => scrollToSection(section.key)} style={styles.sectionNavChip}>
                <Text style={styles.sectionNavChipText}>{section.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.body} onLayout={(e) => { bodyLayoutY.current = e.nativeEvent.layout.y; }}>
          {/* Identité */}
          <View style={styles.section} onLayout={(e) => { sectionOffsets.current.apercu = e.nativeEvent.layout.y; }}>
            <Text accessibilityRole="header" style={styles.name}>{hotel.name}</Text>
            <View style={styles.identityRow}>
              {hotel.starRating != null && (
                <View style={styles.starsRow}>
                  {Array.from({ length: hotel.starRating }).map((_, i) => <Ionicons key={i} name="star" size={14} color={c.gold} />)}
                </View>
              )}
              {hotel.hotelType && <Text style={styles.typeBadge}>{hotel.hotelType}</Text>}
            </View>
            {hotel.location && (hotel.location.city || hotel.location.district) && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={c.textSub} />
                <Text style={styles.locationText}>{[hotel.location.district, hotel.location.city].filter(Boolean).join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Points forts */}
          {activeHighlights.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Points forts</Text>
              <View style={styles.highlightsGrid}>
                {activeHighlights.map((highlight) => (
                  <View key={highlight.key} style={styles.highlightChip}>
                    <Ionicons name={highlight.icon} size={16} color={c.gold} />
                    <Text style={styles.highlightLabel}>{highlight.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.bodyText}>{visibleDescription}</Text>
              {descriptionIsLong && (
                <TouchableOpacity onPress={() => setDescriptionExpanded((v) => !v)} accessibilityRole="button">
                  <Text style={styles.linkText}>{descriptionExpanded ? 'Réduire' : 'Voir la description complète'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Équipements */}
          {flatAmenities.length > 0 && (
            <View style={styles.section} onLayout={(e) => { sectionOffsets.current.services = e.nativeEvent.layout.y; }}>
              <Text style={styles.sectionTitle}>Services et équipements</Text>
              <View style={styles.highlightsGrid}>
                {visibleAmenities.map((label, i) => (
                  <View key={`${label}-${i}`} style={styles.amenityChip}><Text style={styles.amenityChipText}>{label}</Text></View>
                ))}
              </View>
              {structuredAmenities.length > 0 && amenitiesExpanded && (
                <View style={styles.amenityDetailList}>
                  {structuredAmenities.map(({ label, item }, i) => (
                    <Text key={`${label}-${item}-${i}`} style={styles.amenityDetailText}>• {label} — {item}</Text>
                  ))}
                </View>
              )}
              {flatAmenities.length > CONDENSED_AMENITY_COUNT && (
                <TouchableOpacity onPress={() => setAmenitiesExpanded((v) => !v)} accessibilityRole="button">
                  <Text style={styles.linkText}>{amenitiesExpanded ? 'Réduire' : 'Voir tous les services et équipements'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Localisation */}
          <View style={styles.section} onLayout={(e) => { sectionOffsets.current.emplacement = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Localisation</Text>
            {hotel.location ? (
              <>
                <Text style={styles.bodyText}>
                  {[hotel.location.address, hotel.location.neighborhood, hotel.location.district, hotel.location.city].filter(Boolean).join(', ') || 'Adresse non communiquée.'}
                </Text>
                {Array.isArray(hotel.location.coordinates) && hotel.location.coordinates.length === 2 ? (
                  <HotelLocationMap
                    longitude={hotel.location.coordinates[0]}
                    latitude={hotel.location.coordinates[1]}
                    title={hotel.name}
                  />
                ) : (
                  <Text style={styles.mutedText}>Carte indisponible pour cet établissement.</Text>
                )}
              </>
            ) : (
              <Text style={styles.mutedText}>Localisation non communiquée.</Text>
            )}
          </View>

          {/* Politiques */}
          {activePolicies.length > 0 && (
            <View style={styles.section} onLayout={(e) => { sectionOffsets.current.politiques = e.nativeEvent.layout.y; }}>
              <Text style={styles.sectionTitle}>Informations pratiques</Text>
              {activePolicies.map(([key, value]) => (
                <View key={key} style={styles.policyRow}>
                  <Text style={styles.policyLabel}>{POLICY_LABELS[key] || key}</Text>
                  <Text style={styles.policyValue}>
                    {key === 'deposit' ? `${Number(value.amount || 0).toLocaleString('fr-FR')} ${value.currency || 'XAF'}` : String(value)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* PHASE-H3 — avis clients vérifiés */}
          <View style={styles.section} onLayout={(e) => { sectionOffsets.current.avis = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Évaluations des clients</Text>
            <HotelReviewsSection
              summary={hotel.reviewSummary}
              reviews={reviews.items}
              pagination={reviews.pagination}
              loading={reviews.loading}
              loadingMore={reviews.loadingMore}
              onLoadMore={() => loadReviews((reviews.pagination?.page || 1) + 1)}
            />
          </View>

          {/* PHASE-H3 — FAQ rédigée par l'hôtel */}
          {faqEntries.length > 0 && (
            <View style={styles.section} onLayout={(e) => { sectionOffsets.current.faq = e.nativeEvent.layout.y; }}>
              <Text style={styles.sectionTitle}>Questions fréquentes</Text>
              <HotelFaqAccordion entries={faqEntries} />
            </View>
          )}

          {/* Informations légales — H1 : aucun champ classé public-safe */}
          {hotel.legal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations légales</Text>
              <Text style={styles.mutedText}>{hotel.legal}</Text>
            </View>
          )}

          {/* PHASE-H2 — recherche de disponibilité */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vérifier la disponibilité</Text>
            <HotelSearchPanel value={search} onChange={setSearch} onSubmit={() => runSearch(search)} loading={availability.status === 'loading'} />
          </View>

          {/* Chambres — catalogue statique tant qu'aucune recherche n'a été
              lancée (H1, jamais de disponibilité affirmée), résultats
              vivants une fois une recherche effectuée. */}
          <View style={styles.section} onLayout={(e) => { sectionOffsets.current.chambres = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Chambres</Text>
            {availability.status === 'idle' && (
              (hotel.roomCategories || []).length > 0 ? (
                <View style={styles.roomList}>
                  {hotel.roomCategories.map((category) => <HotelRoomCard key={category.id} category={category} />)}
                </View>
              ) : (
                <Text style={styles.mutedText}>Aucune catégorie de chambre publiée pour le moment.</Text>
              )
            )}
            {availability.status === 'loading' && (
              <View style={styles.centerPad}><ActivityIndicator color={c.gold} /></View>
            )}
            {availability.status === 'error' && (
              <View style={styles.centerPad}>
                <Text style={styles.mutedText}>Impossible de vérifier la disponibilité. Vérifiez votre connexion.</Text>
                <Button label="Réessayer" variant="outline" onPress={() => runSearch(search)} style={styles.retryBtn} />
              </View>
            )}
            {availability.status === 'no_availability' && (
              <View style={styles.centerPad}>
                <Text style={styles.mutedText}>Aucune chambre disponible pour ces dates.</Text>
                <Button label="Modifier les dates" variant="outline" onPress={() => setAvailability({ status: 'idle', data: null })} style={styles.retryBtn} />
              </View>
            )}
            {availability.status === 'success' && (
              <View style={styles.roomList}>
                {availability.data.roomCategories.map((category) => (
                  <HotelAvailableRoomCard key={category.id} category={category} onSelectOffer={handleSelectOffer} />
                ))}
              </View>
            )}
          </View>

          {/* PHASE-H4 — hôtels à proximité (toujours affiché : loading →
              cartes → état vide neutre, jamais d'alternative inventée). */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hôtels à proximité</Text>
            <HotelNearbySection loading={nearby.loading} hotels={nearby.hotels} onSelect={goToNearbyHotel} />
          </View>

          <View style={styles.stickySpacer} />
        </View>
      </Screen>

      <HotelBookingStickyBar
        priceFrom={cheapestRate?.amount ?? null}
        currency={cheapestRate?.currency}
        label={(hotel.roomCategories || []).length > 0 ? 'Choisir une chambre' : 'Voir les chambres'}
        onPress={goToBooking}
      />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  scrollContent: { padding: 0 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { padding: spacing.lg, gap: spacing.sm },
  errorText: { fontFamily: fonts.body, fontSize: fontSize.md, color: c.textSub, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, minWidth: 160 },
  sectionNavBar: { borderBottomWidth: 1, borderBottomColor: c.border },
  sectionNavRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionNavChip: { backgroundColor: c.bgCardAlt, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 6 },
  sectionNavChipText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.text },
  body: { padding: spacing.md, gap: spacing.lg },
  section: { gap: spacing.xs },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  name: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  starsRow: { flexDirection: 'row', gap: 2 },
  typeBadge: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.textSub, backgroundColor: c.bgCardAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xs, textTransform: 'capitalize' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub },
  bodyText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
  mutedText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  linkText: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.gold, marginTop: 4 },
  highlightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  highlightChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.bgCardAlt, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 8 },
  highlightLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.text },
  amenityChip: { backgroundColor: c.bgCardAlt, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 6 },
  amenityChipText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.text },
  amenityDetailList: { marginTop: spacing.xs, gap: 2 },
  amenityDetailText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  policyLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.textSub },
  policyValue: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, flexShrink: 1, textAlign: 'right', marginLeft: spacing.sm },
  roomList: { gap: spacing.sm },
  stickySpacer: { height: 72 },
});
