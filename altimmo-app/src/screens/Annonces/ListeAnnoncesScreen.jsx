import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

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

  useEffect(() => {
    chargerAnnonces();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    chargerAnnonces();
  };

  const annoncesFiltrées = annonces.filter(a => {
    const matchRecherche =
      a.title?.toLowerCase()
        .includes(recherche.toLowerCase()) ||
      a.location?.city?.toLowerCase()
        .includes(recherche.toLowerCase());
    const matchFiltre =
      filtre === 'tous' ||
      a.transactionType === filtre ||
      a.type === filtre;
    return matchRecherche && matchFiltre;
  });

  const renderAnnonce = ({ item }) => {
    const isLocation =
      item.transactionType === 'location' ||
      item.transactionType === 'Location' ||
      item.transactionType === 'LOCATION' ||
      item.type === 'location' ||
      item.type === 'Location' ||
      item.typeTransaction === 'location' ||
      item.typeTransaction === 'Location';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate(
          'DetailAnnonce', { annonce: item }
        )}
      >
        <Image
          source={{
            uri: item.images?.[0] ||
              item.photos?.[0] ||
              'https://via.placeholder.com/300x200/1A1A1A/C8960C?text=Altimmo'
          }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={[
          styles.badge,
          { backgroundColor: isLocation ? '#3B82F6' : '#22C55E' }
        ]}>
          <Text style={styles.badgeTexte}>
            {isLocation ? 'LOCATION' : 'VENTE'}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.titre}
            numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.localisation}>
            <Ionicons
              name="location"
              size={14}
              color="#C8960C"
            />
            <Text style={styles.ville}>
              {item.location?.neighborhood ||
               item.location?.city ||
               'Brazzaville'}
            </Text>
          </View>
          <Text style={styles.prix}>
            {item.price?.toLocaleString('fr-FR')}
            {' '}FCFA
            {isLocation ? '/mois' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centré}>
        <ActivityIndicator
          size={40}
          color="#C8960C"
        />
        <Text style={styles.chargement}>
          Chargement...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitre}>
          🏠 Annonces
        </Text>
        <Text style={styles.headerCount}>
          {annoncesFiltrées.length} bien(s)
        </Text>
      </View>

      {/* Recherche */}
      <View style={styles.recherche}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
        />
        <TextInput
          style={styles.rechercheInput}
          placeholder="Rechercher un bien..."
          placeholderTextColor="#666"
          value={recherche}
          onChangeText={setRecherche}
        />
      </View>

      {/* Filtres */}
      <View style={styles.filtres}>
        {['tous', 'location', 'vente'].map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filtreBtn,
              filtre === f && styles.filtreBtnActif
            ]}
            onPress={() => setFiltre(f)}
          >
            <Text style={[
              styles.filtreTxt,
              filtre === f &&
                styles.filtreTxtActif
            ]}>
              {f.charAt(0).toUpperCase() +
               f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Erreur */}
      {erreur ? (
        <View style={styles.centré}>
          <Text style={{ color: '#ff4444' }}>
            {erreur}
          </Text>
          <TouchableOpacity
            onPress={chargerAnnonces}>
            <Text style={{ color: '#C8960C' }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={annoncesFiltrées}
          renderItem={renderAnnonce}
          keyExtractor={item =>
            item._id || item.id}
          contentContainerStyle={
            styles.liste
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C8960C"
            />
          }
          ListEmptyComponent={
            <View style={styles.centré}>
              <Text style={{ color: '#666' }}>
                Aucune annonce trouvée
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A'
  },
  headerTitre: {
    color: '#C8960C',
    fontSize: 24,
    fontWeight: 'bold'
  },
  headerCount: {
    color: '#666',
    fontSize: 14
  },
  recherche: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A'
  },
  rechercheInput: {
    flex: 1,
    color: '#FFF',
    padding: 12,
    fontSize: 14
  },
  filtres: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8
  },
  filtreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A'
  },
  filtreBtnActif: {
    backgroundColor: '#C8960C',
    borderColor: '#C8960C'
  },
  filtreTxt: {
    color: '#666',
    fontSize: 13
  },
  filtreTxtActif: {
    color: '#000',
    fontWeight: 'bold'
  },
  liste: {
    padding: 12
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A'
  },
  image: {
    width: '100%',
    height: 200
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#C8960C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeTexte: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold'
  },
  cardContent: {
    padding: 12
  },
  titre: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6
  },
  localisation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8
  },
  ville: {
    color: '#999',
    fontSize: 13
  },
  prix: {
    color: '#C8960C',
    fontSize: 18,
    fontWeight: 'bold'
  },
  centré: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  chargement: {
    color: '#666',
    marginTop: 10
  }
});
