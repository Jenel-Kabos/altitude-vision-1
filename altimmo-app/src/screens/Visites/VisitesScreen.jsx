import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList,
  TouchableOpacity, StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function VisitesScreen() {
  const [visites, setVisites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerVisites();
  }, []);

  const chargerVisites = async () => {
    try {
      const response = await api.get('/visites');
      setVisites(
        response.data.data ||
        response.data || []
      );
    } catch (error) {
      console.log('Erreur visites:', error.message);
      setVisites([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'confirmée': return '#22C55E';
      case 'annulée': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  if (loading) {
    return (
      <View style={styles.centré}>
        <ActivityIndicator
          size={40}
          color="#C8960C"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>
          📅 Mes Visites
        </Text>
      </View>

      {visites.length === 0 ? (
        <View style={styles.centré}>
          <Ionicons
            name="calendar-outline"
            size={60}
            color="#333"
          />
          <Text style={styles.vide}>
            Aucune visite planifiée
          </Text>
          <Text style={styles.videDesc}>
            Demandez une visite depuis une annonce immobilière
          </Text>
        </View>
      ) : (
        <FlatList
          data={visites}
          keyExtractor={item => item._id || item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.bienNom}>
                  {item.bien?.title || 'Bien immobilier'}
                </Text>
                <View style={[
                  styles.statut,
                  { backgroundColor: getStatutColor(item.statut) }
                ]}>
                  <Text style={styles.statutTxt}>
                    {item.statut || 'En attente'}
                  </Text>
                </View>
              </View>
              <View style={styles.dateRow}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color="#C8960C"
                />
                <Text style={styles.date}>
                  {new Date(item.date)
                    .toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                </Text>
              </View>
            </View>
          )}
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
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A'
  },
  titre: {
    color: '#C8960C',
    fontSize: 24,
    fontWeight: 'bold'
  },
  centré: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30
  },
  vide: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center'
  },
  videDesc: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  bienNom: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1
  },
  statut: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  statutTxt: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  date: {
    color: '#999',
    fontSize: 13
  }
});
