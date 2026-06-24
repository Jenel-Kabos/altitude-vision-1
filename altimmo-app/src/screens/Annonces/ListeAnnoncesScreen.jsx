import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, RefreshControl,
  ScrollView, Modal, Alert,
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

const TENANT_PROFILES = ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'];
const REQUIRED_DOCUMENTS = [
  'CNI',
  'Justificatif de revenus',
  '2 derniers bulletins de salaire',
  'Caution bancaire',
  'Attestation de travail',
  'Quittance de loyer précédente',
];

const getAmenityIcon = (name) => {
  const found = AMENITIES.find(a => a.value === name);
  return found?.icon || 'checkmark-circle-outline';
};

const getModerationStatus = (statusAdmin) => {
  if (statusAdmin === 'Validée') {
    return { label: 'Publié', tone: 'published' };
  }
  if (statusAdmin === 'Rejetée') {
    return { label: 'Rejeté', tone: 'rejected' };
  }
  return { label: 'En cours de validation', tone: 'pending' };
};

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
  const [leaseModal, setLeaseModal] = useState(null);

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

  const isOwnerMode = !!filterOwner;

  const ownerStats = useMemo(() => ({
    total: annonces.length,
    disponibles: annonces.filter(item => item.availability === 'Disponible').length,
    occupes: annonces.filter(item => ['Loué', 'Vendu'].includes(item.availability)).length,
    attente: annonces.filter(item => item.statusAdmin === 'En attente').length,
  }), [annonces]);

  const updatePropertyPatch = async (propertyId, payload) => {
    const response = await api.put(`/properties/${propertyId}`, payload);
    const updated = response.data?.data?.property || response.data?.property;
    setAnnonces(prev => prev.map(item => item._id === propertyId ? updated : item));
    return updated;
  };

  const handleToggleAvailability = async (item) => {
    const isLocation = item.status?.toLowerCase() === 'location';
    const availability = item.availability === 'Disponible'
      ? (isLocation ? 'Loué' : 'Vendu')
      : 'Disponible';

    try {
      await updatePropertyPatch(item._id, { availability });
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de modifier la disponibilité.');
    }
  };

  const openLeaseModal = (item) => {
    setLeaseModal({
      property: item,
      cautionMultiplicateur: String(item.cautionMultiplicateur ?? 2),
      profilsLocataireRecherches: item.profilsLocataireRecherches || [],
      documentsRequis: item.documentsRequis || [],
    });
  };

  const toggleLeaseValue = (field, value) => {
    setLeaseModal(current => {
      const values = current?.[field] || [];
      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter(item => item !== value)
          : [...values, value],
      };
    });
  };

  const saveLeaseTerms = async () => {
    if (!leaseModal?.property?._id) return;
    try {
      await updatePropertyPatch(leaseModal.property._id, {
        cautionMultiplicateur: Number(leaseModal.cautionMultiplicateur || 0),
        profilsLocataireRecherches: leaseModal.profilsLocataireRecherches,
        documentsRequis: leaseModal.documentsRequis,
      });
      setLeaseModal(null);
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de modifier les conditions de bail.');
    }
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

    const amenities = item.amenities || [];
    const visibleAmenities = amenities.slice(0, 3);
    const extraCount = amenities.length - 3;
    const moderationStatus = getModerationStatus(item.statusAdmin);

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

            {isOwnerMode && (
              <View style={[
                styles.moderationBadge,
                moderationStatus.tone === 'published' && styles.moderationBadgePublished,
                moderationStatus.tone === 'rejected' && styles.moderationBadgeRejected,
                moderationStatus.tone === 'pending' && styles.moderationBadgePending,
              ]}>
                <Ionicons
                  name={moderationStatus.tone === 'published' ? 'checkmark-circle' : moderationStatus.tone === 'rejected' ? 'close-circle' : 'time-outline'}
                  size={13}
                  color={moderationStatus.tone === 'published' ? colors.success : moderationStatus.tone === 'rejected' ? colors.error : colors.warning}
                />
                <Text style={[
                  styles.moderationBadgeText,
                  moderationStatus.tone === 'published' && styles.moderationBadgeTextPublished,
                  moderationStatus.tone === 'rejected' && styles.moderationBadgeTextRejected,
                  moderationStatus.tone === 'pending' && styles.moderationBadgeTextPending,
                ]}>
                  {moderationStatus.label}
                </Text>
              </View>
            )}

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
              <Text style={styles.metaText}>{isOwnerMode ? moderationStatus.label : reference}</Text>
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

            {isOwnerMode && isLocation && (
              <View style={styles.leaseBox}>
                <Text style={styles.leaseTitle}>Conditions de bail</Text>
                <Text style={styles.leaseText}>Caution : {item.cautionMultiplicateur ?? 2} mois</Text>
                <Text style={styles.leaseText} numberOfLines={2}>
                  Profils : {item.profilsLocataireRecherches?.length ? item.profilsLocataireRecherches.join(', ') : 'Non précisé'}
                </Text>
                <Text style={styles.leaseText} numberOfLines={2}>
                  Documents : {item.documentsRequis?.length ? item.documentsRequis.join(', ') : 'Non précisé'}
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              {isOwnerMode ? (
                <View style={styles.ownerActions}>
                  <TouchableOpacity
                    style={[styles.ownerActionBtn, styles.ownerActionStatus]}
                    onPress={() => handleToggleAvailability(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.black} />
                    <Text style={styles.ownerActionText}>
                      {item.availability === 'Disponible' ? (isLocation ? 'Marquer occupé' : 'Marquer vendu') : 'Marquer disponible'}
                    </Text>
                  </TouchableOpacity>
                  {isLocation && (
                    <TouchableOpacity
                      style={[styles.ownerActionBtn, styles.ownerActionLease]}
                      onPress={() => openLeaseModal(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="document-text-outline" size={15} color={colors.blue} />
                      <Text style={[styles.ownerActionText, { color: colors.blue }]}>Bail</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={styles.cta}>Voir →</Text>
              )}
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
      {!isOwnerMode && <GreetingBar onPressNotifications={() => {}} />}

      {/* ─── HERO : carrousel de pubs si disponibles, sinon fallback statique ─── */}
      {!isOwnerMode && (pubs.length > 0 ? (
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
      ))}

      {/* ─── Bouton recherche (chevauche hero) ─── */}
      {!isOwnerMode && (
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
      )}

      {/* ─── Quick filters (chips rapides type de bien) ─── */}
      {!isOwnerMode && (
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
      )}

      {/* ─── Carrousel recommandés ─── */}
      {!isOwnerMode && recommended.length > 0 && (
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
      {isOwnerMode ? (
        <View style={styles.ownerPanel}>
          <Text style={styles.ownerTitle}>Espace propriétaire</Text>
          <Text style={styles.ownerSubtitle}>Gérez vos biens, leur disponibilité et les conditions de bail.</Text>
          <View style={styles.ownerLegend}>
            <View style={[styles.ownerLegendDot, styles.ownerLegendPending]} />
            <Text style={styles.ownerLegendText}>Les nouveaux biens restent invisibles au public jusqu'à validation admin.</Text>
          </View>
          <View style={styles.ownerStatsGrid}>
            <View style={styles.ownerStatCard}>
              <Text style={styles.ownerStatValue}>{ownerStats.total}</Text>
              <Text style={styles.ownerStatLabel}>Biens</Text>
            </View>
            <View style={styles.ownerStatCard}>
              <Text style={styles.ownerStatValue}>{ownerStats.disponibles}</Text>
              <Text style={styles.ownerStatLabel}>Disponibles</Text>
            </View>
            <View style={styles.ownerStatCard}>
              <Text style={styles.ownerStatValue}>{ownerStats.occupes}</Text>
              <Text style={styles.ownerStatLabel}>Occupés</Text>
            </View>
            <View style={styles.ownerStatCard}>
              <Text style={styles.ownerStatValue}>{ownerStats.attente}</Text>
              <Text style={styles.ownerStatLabel}>En attente</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ─── Titre catalogue ─── */}
      <Text style={styles.catalogTitle}>{isOwnerMode ? 'Mes biens publiés' : 'À découvrir'}</Text>
    </View>
  );

  return (
    <Screen>
      {leaseModal && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setLeaseModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Conditions de bail</Text>
              <Text style={styles.fieldMiniLabel}>Caution demandée</Text>
              <View style={styles.cautionRow}>
                {[0, 1, 2, 3, 4, 5, 6].map(value => {
                  const selected = leaseModal.cautionMultiplicateur === String(value);
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.cautionChip, selected && styles.cautionChipSelected]}
                      onPress={() => setLeaseModal(current => ({ ...current, cautionMultiplicateur: String(value) }))}
                    >
                      <Text style={[styles.cautionChipText, selected && styles.cautionChipTextSelected]}>{value}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldMiniLabel}>Profils recherchés</Text>
              <View style={styles.modalOptions}>
                {TENANT_PROFILES.map(profile => (
                  <TouchableOpacity key={profile} style={styles.optionRow} onPress={() => toggleLeaseValue('profilsLocataireRecherches', profile)}>
                    <Ionicons name={leaseModal.profilsLocataireRecherches.includes(profile) ? 'checkbox' : 'square-outline'} size={20} color={colors.blue} />
                    <Text style={styles.optionText}>{profile}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldMiniLabel}>Documents requis</Text>
              <View style={styles.modalOptions}>
                {REQUIRED_DOCUMENTS.map(document => (
                  <TouchableOpacity key={document} style={styles.optionRow} onPress={() => toggleLeaseValue('documentsRequis', document)}>
                    <Ionicons name={leaseModal.documentsRequis.includes(document) ? 'checkbox' : 'square-outline'} size={20} color={colors.blue} />
                    <Text style={styles.optionText}>{document}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setLeaseModal(null)}>
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={saveLeaseTerms}>
                  <Text style={styles.modalSaveText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  moderationBadge: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    maxWidth: '68%',
  },
  moderationBadgePublished: {
    backgroundColor: '#DCFCE7',
  },
  moderationBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  moderationBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  moderationBadgeText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  moderationBadgeTextPublished: {
    color: colors.success,
  },
  moderationBadgeTextRejected: {
    color: colors.error,
  },
  moderationBadgeTextPending: {
    color: colors.warning,
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

  ownerPanel: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  ownerSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  ownerLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#FEF3C7',
  },
  ownerLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ownerLegendPending: {
    backgroundColor: colors.warning,
  },
  ownerLegendText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textSub,
  },
  ownerStatsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ownerStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerStatValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.blue,
  },
  ownerStatLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  leaseBox: {
    backgroundColor: colors.blueMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  leaseTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.blue,
    marginBottom: 4,
  },
  leaseText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textSub,
  },
  ownerActions: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ownerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  ownerActionStatus: {
    flex: 1,
    backgroundColor: colors.gold,
  },
  ownerActionLease: {
    backgroundColor: colors.blueMuted,
  },
  ownerActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.black,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: colors.text,
    marginBottom: spacing.md,
  },
  fieldMiniLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  cautionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cautionChip: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cautionChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  cautionChipText: {
    fontFamily: fonts.bodyBold,
    color: colors.textSub,
  },
  cautionChipTextSelected: {
    color: colors.white,
  },
  modalOptions: {
    gap: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCardAlt,
  },
  modalCancelText: {
    fontFamily: fonts.bodyBold,
    color: colors.textSub,
  },
  modalSave: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
  },
  modalSaveText: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
