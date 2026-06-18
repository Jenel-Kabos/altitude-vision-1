import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { Screen, Input, Button } from '../../components';
import { colors, fonts, fontSize, spacing } from '../../theme';
import api from '../../services/api';

export default function ResetPasswordScreen({ route, navigation }) {
  const token = route?.params?.token;

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const reinitialiser = async () => {
    setErreur('');

    if (!token) {
      setErreur('Lien invalide ou expiré. Demandez un nouveau lien.');
      return;
    }
    if (!password || !passwordConfirm) {
      setErreur('Tous les champs sont requis.');
      return;
    }
    if (password.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/auth/reset-password/${token}`, {
        password,
        passwordConfirm,
      });
      Alert.alert(
        'Mot de passe réinitialisé',
        'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
        [{
          text: 'Se connecter',
          onPress: () => navigation.navigate('Login'),
        }],
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Erreur lors de la réinitialisation. Le lien est peut-être expiré.';
      setErreur(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>
          Choisissez un mot de passe d'au moins 8 caractères.
        </Text>
      </View>

      <Input
        label="Nouveau mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password-new"
        placeholder="Min. 8 caractères"
        style={styles.input}
      />

      <Input
        label="Confirmer le mot de passe"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password-new"
        placeholder="Saisissez à nouveau"
        style={styles.input}
      />

      {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

      <Button
        label="Réinitialiser"
        onPress={reinitialiser}
        loading={loading}
        variant="primary"
        style={styles.button}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
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
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.error,
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
