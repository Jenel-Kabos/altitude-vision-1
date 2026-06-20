import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Button } from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function PasswordField({
  label, value, onChangeText, show, onToggleShow, placeholder,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity
          onPress={onToggleShow}
          hitSlop={8}
          style={styles.eye}
        >
          <Ionicons
            name={show ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={colors.textSub}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen({ navigation }) {
  const { refreshSession } = useAuth();

  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');

  const enregistrer = async () => {
    setErreur('');

    if (!passwordCurrent || !password || !passwordConfirm) {
      setErreur('Tous les champs sont requis.');
      return;
    }
    if (password.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password === passwordCurrent) {
      setErreur("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.patch('/auth/update-my-password', {
        passwordCurrent,
        password,
        passwordConfirm,
      });

      // Le backend incrémente tokenVersion + renvoie un nouveau token.
      // refreshSession persiste le token frais + met à jour le contexte
      // pour éviter une déconnexion silencieuse au prochain appel.
      const newToken = res.data?.token;
      const updated  = res.data?.data?.user || res.data?.user;
      await refreshSession(newToken, updated);

      Alert.alert(
        'Mot de passe modifié',
        'Votre mot de passe a été mis à jour.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Erreur lors du changement de mot de passe.';
      setErreur(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.title}>Changer le mot de passe</Text>
        <Text style={styles.subtitle}>
          Choisissez un nouveau mot de passe d'au moins 8 caractères.
        </Text>
      </View>

      <PasswordField
        label="Mot de passe actuel"
        value={passwordCurrent}
        onChangeText={setPasswordCurrent}
        show={showCurrent}
        onToggleShow={() => setShowCurrent(!showCurrent)}
        placeholder="Votre mot de passe actuel"
      />

      <PasswordField
        label="Nouveau mot de passe"
        value={password}
        onChangeText={setPassword}
        show={showNew}
        onToggleShow={() => setShowNew(!showNew)}
        placeholder="Min. 8 caractères"
      />

      <PasswordField
        label="Confirmer le nouveau mot de passe"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        show={showConfirm}
        onToggleShow={() => setShowConfirm(!showConfirm)}
        placeholder="Saisissez à nouveau"
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

  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textSub,
    marginBottom: spacing.xs,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  eye: {
    padding: spacing.xs,
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
