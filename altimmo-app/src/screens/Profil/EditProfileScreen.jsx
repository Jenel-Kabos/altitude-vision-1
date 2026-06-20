import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { Screen, Input, Button } from '../../components';
import { colors, fonts, fontSize, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const emailVerified = !!user?.isEmailVerified;

  const [name, setName]     = useState(user?.name  || '');
  const [email, setEmail]   = useState(user?.email || '');
  const [phone, setPhone]   = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');

  const enregistrer = async () => {
    setErreur('');

    if (!name.trim()) {
      setErreur('Le nom est requis.');
      return;
    }
    if (!emailVerified && !email.trim()) {
      setErreur("L'email est requis.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name:  name.trim(),
        phone: phone.trim(),
      };
      // Email : envoyé uniquement si non vérifié
      if (!emailVerified) {
        payload.email = email.trim().toLowerCase();
      }

      const res = await api.patch('/users/updateMe', payload);
      const updated = res.data?.data?.user || res.data?.user;
      if (updated && updateUser) {
        updateUser(updated);
      }

      Alert.alert(
        'Profil mis à jour',
        'Vos informations ont été enregistrées.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Erreur lors de l'enregistrement. Réessayez.";
      setErreur(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Modifier mon profil</Text>
        <Text style={styles.subtitle}>
          Mettez à jour vos informations personnelles.
        </Text>
      </View>

      <Input
        label="Nom complet"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Jean Dupont"
        style={styles.input}
      />

      {emailVerified ? (
        <View style={styles.input}>
          <Text style={styles.readOnlyLabel}>Email (vérifié)</Text>
          <Text style={styles.readOnlyValue}>{email}</Text>
        </View>
      ) : (
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
      )}

      <Input
        label="Téléphone (optionnel)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCorrect={false}
        autoComplete="tel"
        placeholder="+242 06 000 00 00"
        style={styles.input}
      />

      {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

      <Button
        label="Enregistrer"
        onPress={enregistrer}
        loading={loading}
        variant="primary"
        style={styles.button}
      />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backLink}
        hitSlop={8}
      >
        <Text style={styles.backText}>← Annuler</Text>
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
  readOnlyLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textSub,
    marginBottom: spacing.xs,
  },
  readOnlyValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
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
