import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image,
  ScrollView, RefreshControl,
} from 'react-native';
import api from '../../services/api';
import { Screen, Card, Chip, Input, PrixFCFA } from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const FILTERS = [
  { value: 'tous',        label: 'Tous' },
  { value: 'vente',       label: 'Vente' },
  { value: 'location',    label: 'Location' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison',      label: 'Maison' },
  { value: 'terrain',     label: 'Terrain' },
];

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x450/111111/C8960C?text=Altimmo';

export default function ListeAnnoncesScreen({ navigation, route }) {
  const filterOwner = route?.params?.filterOwner;

  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rechercheInput, setRechercheInput] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [erreur, setErreur] = useState('');

  // Debounce — la valeur de filtrage suit l'input avec 300ms de délai
  useEffect(() => {
    const timer = setTimeout(() => setRecherche(rechercheInput), 300);
    return () => clearTimeout(timer);
  }, [rechercheInput]);

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

  const annoncesFiltrées = annonces.filter(a => {
    const q = recherche.trim().toLowerCase();
    const matchRecherche = !q || [
      a.title,
      a.description,
      a.type,
      a.address?.city,
      a.address?.district,
      a.address?.street,
      a.location?.city,
    ].some(field => field?.toLowerCase().includes(q));

    const matchFiltre = filtre === 'tous'
      || a.status?.toLowerCase() === filtre
      || a.type?.toLowerCase() === filtre;

    return matchRecherche && matchFiltre;
  });

  const renderAnnonce = ({ item, index }) => {
    const isLocation = item.status?.toLowerCase() === 'location';

    const district = item.address?.district || item.location?.neighborhood || '';
    const city = item.address?.city || item.location?.city || 'Brazzaville';
    const addressText = district ? `${district} · ${city}` : city;

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
            <View style={[
              styles.badge,
              isLocation ? styles.badgeLoc : styles.badgeVente,
            ]}>
              <Text style={styles.badgeText}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
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

            <PrixFCFA montant={item.price} style={styles.price} />

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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.titre}>Annonces</Text>
        <Text style={styles.sousTitre}>
          {annoncesFiltrées.length} bien{annoncesFiltrées.length !== 1 ? 's' : ''}
        </Text>

        <Input
          placeholder="Rechercher"
          value={rechercheInput}
          onChangeText={setRechercheInput}
          style={styles.search}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {FILTERS.map(f => (
            <Chip
              key={f.value}
              label={f.label}
              active={filtre === f.value}
              onPress={() => setFiltre(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {filterOwner ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}>
          <Text style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}>
            Affichage : mes annonces uniquement
          </Text>
          <TouchableOpacity
            onPress={() => navigation.setParams({ filterOwner: undefined })}
            style={{ marginLeft: spacing.sm }}
            hitSlop={8}
          >
            <Text style={{ color: colors.gold, fontSize: fontSize.sm }}>
              Voir tout
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
              tintColor={colors.gold}
              colors={[colors.gold]}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ─── Header ───
  header: {
    paddingBottom: spacing.md,
  },
  titre: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    color: colors.text,
  },
  sousTitre: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  search: {
    marginBottom: spacing.md,
  },
  filtersScroll: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },

  // ─── List ───
  list: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },

  // ─── Card ───
  imageWrap: {
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.none,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGoldFull,
  },

  // Badge statut (overlay sur image, haut-droite)
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 1,
  },
  badgeVente: {
    backgroundColor: 'rgba(59, 130, 246, 0.72)',
  },
  badgeLoc: {
    backgroundColor: 'rgba(34, 197, 94, 0.72)',
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
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

  // Stats pastilles
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

  // Divider or — 32px (entre location et description)
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

  price: {
    marginTop: spacing.xs,
  },

  // CTA footer
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
