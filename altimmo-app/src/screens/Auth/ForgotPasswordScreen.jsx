import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { Screen, Input, Button } from '../../components';
import { colors, fonts, fontSize, spacing } from '../../theme';
import api from '../../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const envoyerLien = async () => {
    if (!email.trim()) {
      Alert.alert('Email requis', 'Veuillez saisir votre adresse email.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
    } catch (err) {
      // Anti-énumération : même alerte qu'en cas de succès,
      // peu importe l'erreur réseau ou serveur.
      console.log('forgot-password error (silencieux):', err.message);
    } finally {
      setLoading(false);
      Alert.alert(
        'Vérifiez vos emails',
        'Si cette adresse existe, vous recevrez un lien dans quelques minutes. Vérifiez aussi vos spams.',
        [{
          text: 'Retour à la connexion',
          onPress: () => navigation.navigate('Login'),
        }],
      );
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Entrez votre adresse email. Vous recevrez un lien pour réinitialiser votre mot de passe.
        </Text>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        placeholder="vous@exemple.com"
        style={styles.input}
      />

      <Button
        label="Envoyer le lien"
        onPress={envoyerLien}
        loading={loading}
        variant="primary"
        style={styles.button}
      />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backLink}
        hitSlop={8}
      >
        <Text style={styles.backText}>← Retour à la connexion</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  input: {
    marginBottom: spacing.md,
  },
  button: {
    marginBottom: spacing.md,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
});
