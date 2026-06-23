import React, { useState, useEffect } from 'react';
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
import {
  Screen, Card, PrixFCFA, RecommendedCarousel, SearchPanel,
  GreetingBar, AdCarousel,
} from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x450/F5F5F2/C8960C?text=Altimmo';

// TODO: remplacer par un asset local (altimmo-app/assets/hero-immobilier.jpg)
const HERO_IMG =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80';

const DEFAULT_FILTERS = {
  transaction: 'tous',
  typeBien: 'tous',
  priceRange: [0, 500000000],
  ville: 'Toutes',
  arrondissement: 'Tous',
};

const QUICK_TYPES = PROPERTY_TYPES_WITH_ALL;

export default function ListeAnnoncesScreen({ navigation, route }) {
  const filterOwner = route?.params?.filterOwner;

  const [annonces, setAnnonces] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState('');

  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

  // Biens recommandés — fetch au mount uniquement
  useEffect(() => {
    getRecommendedProperties().then(setRecommended).catch(() => {});
  }, []);

  // Publicités actives — fetch au mount uniquement
  useEffect(() => {
    getActivePublicites().then(setPubs).catch(() => {});
  }, []);

  const chargerAnnonces = async () => {
    try {
      // TODO: pagination si >200 biens
      const url = filterOwner
        ? '/properties/my-properties'
        : '/properties?limit=200&statusAdmin=Validée';
      const response = await api.get(url);
      const data = response.data.data?.properties
        || response.data.properties
        || response.data.data
        || [];
      setAnnonces(data);
      setErreur('');
    } catch (error) {
      setErreur('Impossible de charger les annonces');
      console.log('Erreur:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { chargerAnnonces(); }, [filterOwner]);

  const onRefresh = () => {
    setRefreshing(true);
    chargerAnnonces();
  };

  const annoncesFiltrées = annonces.filter((item) => {
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
  });

  const renderAnnonce = ({ item, index }) => {
    const isLocation = item.status?.toLowerCase() === 'location';

    const arrondissement = item.address?.arrondissement || item.location?.neighborhood || '';
    const city = item.address?.city || item.location?.city || 'Brazzaville';
    const addressText = arrondissement ? `${arrondissement} · ${city}` : city;

    const reference = `AV·${index + 1}`;

    const description = item.description || '';
    const hasDescription = description.trim().length > 0;

    const bedrooms  = item.bedrooms  || 0;
    const bathrooms = item.bathrooms || 0;
    const surface   = item.surface   || item.area || 0;
    const hasStats  = bedrooms > 0 || bathrooms > 0 || surface > 0;

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

            {/* Gradient bas pour lisibilité du prix (ne cache pas le badge en haut) */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.priceGradient}
              pointerEvents="none"
            />

            <View style={[
              styles.badge,
              isLocation ? styles.badgeLoc : styles.badgeVente,
            ]}>
              <Text style={[
                styles.badgeText,
                isLocation ? styles.badgeTextLoc : styles.badgeTextVente,
              ]}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
            </View>

            {/* Prix superposé en bas-gauche, blanc lisible sur gradient */}
            <View style={styles.priceOverlay} pointerEvents="none">
              <PrixFCFA montant={item.price} variant="onImage" compact />
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {(item.type || 'Bien').toUpperCase()}
              </Text>
              <Text style={styles.metaText}>{reference}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>

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

            <Text style={styles.location} numberOfLines={1}>
              {addressText}
            </Text>

            {hasDescription && (
              <>
                <View style={styles.divider} />
                <Text style={styles.description} numberOfLines={2}>
                  {description}
                </Text>
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
      {/* ─── Greeting ─── */}
      <GreetingBar onPressNotifications={() => {}} />

      {/* ─── HERO : carrousel de pubs si disponibles, sinon fallback statique ─── */}
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

      {/* ─── Bouton recherche (chevauche hero) ─── */}
      <View style={styles.searchZone}>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setSearchOpen((s) => !s)}
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

      {/* ─── Quick filters (chips rapides type de bien) ─── */}
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
              onPress={() => setActiveFilters((prev) => ({
                ...prev, typeBien: item.value,
              }))}
              style={[styles.quickChip, active && styles.quickChipActive]}
              activeOpacity={0.8}
            >
              <View style={styles.quickChipInner}>
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? colors.black : colors.textSub}
                />
                <Text style={[
                  styles.quickChipText,
                  active && styles.quickChipTextActive,
                ]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Carrousel recommandés ─── */}
      {recommended.length > 0 && (
        <View style={styles.recoSection}>
          <Text style={styles.recoTitle}>Biens recommandés</Text>
          <RecommendedCarousel
            properties={recommended}
            onPressItem={(item) =>
              navigation.navigate('DetailAnnonce', { annonce: item })
            }
          />
        </View>
      )}

      {/* ─── Banner filterOwner ─── */}
      {filterOwner ? (
        <View style={styles.ownerBanner}>
          <Text style={styles.ownerBannerText}>
            Affichage : mes annonces uniquement
          </Text>
          <TouchableOpacity
            onPress={() => navigation.setParams({ filterOwner: undefined })}
            style={{ marginLeft: spacing.sm }}
            hitSlop={8}
          >
            <Text style={styles.ownerBannerLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ─── Titre catalogue ─── */}
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
  // ─── Hero ───
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

  // ─── Zone recherche (chevauche le hero) ───
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
  panelWrap: {
    marginTop: spacing.sm,
  },

  // ─── Quick filters (chips rapides) ───
  quickFilterRow: {
    marginTop: spacing.md,
  },
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
  quickChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  quickChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  quickChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: colors.black,
  },

  // ─── List ───
  list: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },

  // ─── Section recommandés ───
  recoSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  recoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  // ─── Banner filterOwner ───
  ownerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ownerBannerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  ownerBannerLink: {
    color: colors.gold,
    fontSize: fontSize.sm,
  },

  // ─── Titre catalogue ───
  catalogTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // ─── Card ───
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.sm,
  },

  // Badge statut (haut-droite, pill)
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },

  // Gradient bas image pour lisibilité du prix blanc
  priceGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },

  // Prix superposé en bas-gauche de l'image
  priceOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
  },
  badgeVente: {
    backgroundColor: colors.goldMuted,
  },
  badgeLoc: {
    backgroundColor: colors.blueMuted,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
  },
  badgeTextVente: {
    color: colors.goldDark,
  },
  badgeTextLoc: {
    color: colors.blue,
  },

  body: {
    padding: spacing.md,
  },
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
  statText: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontFamily: fonts.body,
  },

  location: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  divider: {
    width: 32,
    height: 1,
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
