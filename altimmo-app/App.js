import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.titre}>
        🏠 Altimmo
      </Text>
      <Text style={styles.sousTitre}>
        Votre agence immobilière
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  titre: {
    color: '#C8960C',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sousTitre: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
