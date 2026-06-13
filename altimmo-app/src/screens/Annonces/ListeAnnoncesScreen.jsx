import React from 'react';
import {
  View, Text, StyleSheet,
  SafeAreaView
} from 'react-native';

export default function ListeAnnoncesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>
          🏠 Annonces
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.texte}>
          Liste des annonces à venir...
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  titre: {
    color: '#C8960C',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texte: {
    color: '#FFFFFF',
    fontSize: 16,
  }
});
