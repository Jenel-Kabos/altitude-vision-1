import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, TextInput,
  ScrollView, RefreshControl, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { colors, typography, spacing } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';

const FILTERS = [
  { value: 'tous',        label: 'Tous' },
  { value: 'vente',       label: 'Vente' },
  { value: 'location',    label: 'Location' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison',      label: 'Maison' },
  { value: 'terrain',     label: 'Terrain' },
];

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x400/1A1A1A/C8960C?text=Altimmo';

const formatPrice = (n) =>
  Number(n || 0).toLocaleString('fr-FR');

export default function ListeAnnoncesScreen({ navigation }) {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [erreur, setErreur] = useState('');

  const chargerAnnonces = async () => {
    try {
      const response = await api.get(
        '/properties?limit=50&statusAdmin=Validée'
      );
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

  useEffect(() => { chargerAnnonces(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    chargerAnnonces();
  };

  const annoncesFiltrées = annonces.filter(a => {
    const q = recherche.trim().toLowerCase();
    const matchRecherche = !q
      || a.title?.toLowerCase().includes(q)
      || a.address?.city?.toLowerCase().includes(q)
      || a.address?.district?.toLowerCase().includes(q)
      || a.location?.city?.toLowerCase().includes(q);

    const matchFiltre = filtre === 'tous'
      || a.transactionType?.toLowerCase() === filtre
      || a.type?.toLowerCase() === filtre
      || a.typeTransaction?.toLowerCase() === filtre;

    return matchRecherche && matchFiltre;
  });

  const renderAnnonce = ({ item }) => {
    const isLocation =
      item.transactionType?.toLowerCase() === 'location' ||
      item.type?.toLowerCase() === 'location' ||
      item.typeTransaction?.toLowerCase() === 'location';

    const district = item.address?.district || item.location?.neighborhood || '';
    const city = item.address?.city || item.location?.city || 'Brazzaville';
    const addressText = district ? `${district}, ${city}` : city;

    const surface = item.surface || item.area;
    const pieces = (item.bedrooms || 0) + (item.livingRooms || 0);

    const ownerName = item.owner?.name || 'Propriétaire';
    const ownerInitial = (ownerName[0] || '?').toUpperCase();
    const ownerPhoto = item.owner?.photo;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('DetailAnnonce', { annonce: item })}
        activeOpacity={0.85}
        style={styles.card}
      >
        {/* Image area */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: item.images?.[0] || item.photos?.[0] || PLACEHOLDER_IMG }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Badge type */}
          <View style={[
            styles.badgeType,
            { backgroundColor: isLocation ? colors.info : colors.success },
          ]}>
            <Text style={styles.badgeTypeText}>
              {isLocation ? 'LOCATION' : 'VENTE'}
            </Text>
          </View>
          {/* Badge prix */}
          <View style={styles.badgePrice}>
            <Text style={styles.badgePriceText}>
              {formatPrice(item.price)} FCFA{isLocation ? '/mois' : ''}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Adresse */}
          <View style={styles.row}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {addressText}
            </Text>
          </View>

          {/* Features */}
          {(surface > 0 || item.bedrooms > 0 || pieces > 0) && (
            <View style={styles.featuresRow}>
              {surface > 0 && (
                <View style={styles.feature}>
                  <Ionicons name="resize-outline" size={14} color={colors.primary} />
                  <Text style={styles.featureText}>{surface} m²</Text>
                </View>
              )}
              {item.bedrooms > 0 && (
                <View style={styles.feature}>
                  <Ionicons name="bed-outline" size={14} color={colors.primary} />
                  <Text style={styles.featureText}>{item.bedrooms} ch.</Text>
                </View>
              )}
              {pieces > 0 && (
                <View style={styles.feature}>
                  <Ionicons name="grid-outline" size={14} color={colors.primary} />
                  <Text style={styles.featureText}>{pieces} pièces</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.separator} />

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.ownerInfo}>
              {ownerPhoto ? (
                <Image source={{ uri: ownerPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{ownerInitial}</Text>
                </View>
              )}
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </Text>
            </View>
            <Button
              size="sm"
              variant="outline"
              label="Voir"
              onPress={() => navigation.navigate('DetailAnnonce', { annonce: item })}
            />
          </View>
        </View>
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>Annonces</Text>
            <Text style={styles.sousTitre}>
              {annoncesFiltrées.length} bien{annoncesFiltrées.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un bien..."
            placeholderTextColor={colors.textMuted}
            value={recherche}
            onChangeText={setRecherche}
          />
          {recherche ? (
            <TouchableOpacity onPress={() => setRecherche('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {FILTERS.map(f => {
            const active = filtre === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFiltre(f.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="home-outline"
              title="Aucune annonce trouvée"
              subtitle="Essayez un autre filtre ou revenez plus tard."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  titre: {
    ...typography.h1,
    color: colors.text,
  },
  sousTitre: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ─── Search bar ───────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },

  // ─── Filter chips ─────────────────────────────────────────
  filtersScroll: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 100,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },

  // ─── List ─────────────────────────────────────────────────
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },

  // ─── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  imageWrap: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeType: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  badgeTypeText: {
    ...typography.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  badgePrice: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: '#0A0A0A80',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  badgePriceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  ownerName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});
