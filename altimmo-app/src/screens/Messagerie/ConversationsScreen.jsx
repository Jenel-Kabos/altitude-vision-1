import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList,
  TouchableOpacity, StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerConversations();
  }, []);

  const chargerConversations = async () => {
    try {
      const response = await api.get('/conversations');
      setConversations(
        response.data.data ||
        response.data || []
      );
    } catch (error) {
      console.log('Erreur conversations:', error.message);
    } finally {
      setLoading(false);
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
          💬 Messages
        </Text>
        <TouchableOpacity>
          <Ionicons
            name="create-outline"
            size={24}
            color="#C8960C"
          />
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.centré}>
          <Ionicons
            name="chatbubbles-outline"
            size={60}
            color="#333"
          />
          <Text style={styles.vide}>
            Aucun message pour l'instant
          </Text>
          <Text style={styles.videDesc}>
            Contactez un propriétaire depuis une annonce pour démarrer une conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item._id || item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.conversation}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>
                  {item.nom?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nom}>
                  {item.nom || 'Inconnu'}
                </Text>
                <Text
                  style={styles.dernier}
                  numberOfLines={1}
                >
                  {item.dernierMessage || 'Nouveau message'}
                </Text>
              </View>
            </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  conversation: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    alignItems: 'center'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#C8960C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarTxt: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold'
  },
  info: { flex: 1 },
  nom: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  dernier: {
    color: '#666',
    fontSize: 13
  }
});
