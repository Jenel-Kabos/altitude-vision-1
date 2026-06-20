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

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('DetailAnnonce', { annonce: item })}
        activeOpacity={0.85}
      >
        <Card>
          <Image
            source={{ uri: item.images?.[0] || item.photos?.[0] || PLACEHOLDER_IMG }}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.body}>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
              <Text style={styles.metaText}>{reference}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>

            <Text style={styles.location} numberOfLines={1}>
              {addressText}
            </Text>

            <PrixFCFA montant={item.price} style={styles.price} />
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
          value={recherche}
          onChangeText={setRecherche}
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
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.none,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGoldFull,
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
  location: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  price: {
    marginTop: spacing.xs,
  },
});
