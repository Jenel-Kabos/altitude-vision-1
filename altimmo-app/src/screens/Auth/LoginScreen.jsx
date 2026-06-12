import React, { useState } from 'react';
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      setErreur('');
      await login(email, password);
    } catch (error) {
      setErreur(
        error.response?.data?.message ||
        'Erreur de connexion. Vérifiez vos identifiants.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>
        🏠 Altimmo
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.bouton}
        onPress={handleLogin}
      >
        <Text style={styles.boutonTexte}>
          Se connecter
        </Text>
      </TouchableOpacity>
      {erreur ? (
        <Text style={styles.erreur}>{erreur}</Text>
      ) : null}
      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.lien}>
          Pas de compte ? S'inscrire
        </Text>
      </TouchableOpacity>
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
    marginBottom: 40,
  },
  input: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  bouton: {
    width: '100%',
    backgroundColor: '#C8960C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  boutonTexte: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  erreur: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 10,
  },
  lien: {
    color: '#C8960C',
    fontSize: 14,
  },
});
