import React, { useState } from 'react';
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    Alert.alert(
      'Debug',
      `Email: ${email}\nPassword: ${password}\nAPI: https://altitude-vision.onrender.com/api`
    );

    if (!email || !password) {
      setErreur('Email et mot de passe requis');
      return;
    }

    setLoading(true);
    setErreur('');

    try {
      const response = await fetch(
        'https://altitude-vision.onrender.com/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await response.json();
      Alert.alert('Réponse API', JSON.stringify(data));

      if (data.token) {
        await login(email, password);
      } else {
        setErreur(data.message || 'Identifiants incorrects');
      }
    } catch (error) {
      Alert.alert('Erreur réseau', error.message);
      setErreur(error.message);
    } finally {
      setLoading(false);
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
        style={[styles.bouton, loading && { opacity: 0.7 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.boutonTexte}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </Text>
      </TouchableOpacity>
      {erreur ? (
        <Text style={{ color: '#ff4444', marginTop: 10, textAlign: 'center', fontSize: 14 }}>
          {erreur}
        </Text>
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
  lien: {
    color: '#C8960C',
    fontSize: 14,
    marginTop: 10,
  },
});
