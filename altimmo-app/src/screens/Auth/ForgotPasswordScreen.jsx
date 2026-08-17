import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components';
import { fonts, fontSize, spacing, radius } from '../../theme';
import api from '../../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [sent, setSent]     = useState(false);

  const envoyerLien = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErreur('Adresse email requise');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setErreur('Adresse email invalide');
      return;
    }

    setLoading(true);
    setErreur('');
    try {
      await api.post('/auth/forgot-password', { email: trimmed });
    } catch {
      // Anti-énumération : on affiche toujours la confirmation,
      // quelle que soit la réponse du serveur.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }, [email]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ─── Hero ──────────────────────────────────────────── */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#0A0A0A', '#1C1408', '#2D1E04']}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Bouton retour */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Ionicons name="arrow-back" size={22} color="rgba(240,237,232,0.7)" />
            </TouchableOpacity>

            <Animated.View
              entering={FadeInDown.delay(0).springify().damping(18)}
              style={styles.heroIconWrap}
            >
              <View style={styles.heroIcon}>
                <Ionicons name="lock-closed-outline" size={28} color="rgba(200,150,12,0.9)" />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text style={styles.heroTitle}>Mot de passe{'\n'}oublié ?</Text>
              <Text style={styles.heroSub}>
                {sent
                  ? 'Email envoyé avec succès'
                  : 'Nous vous enverrons un lien de réinitialisation'}
              </Text>
            </Animated.View>
          </View>

          {/* ─── Carte ─────────────────────────────────────────── */}
          <View style={styles.card}>

            {/* ─── État : formulaire ───────────────────────── */}
            {!sent && (
              <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
                <Text style={styles.cardTitle}>Réinitialisation</Text>
                <Text style={styles.cardSub}>
                  Entrez l'email associé à votre compte. Vous recevrez un lien valable 10 minutes.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Adresse email</Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons name="mail-outline" size={18} color={c.textMuted} style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      value={email}
                      onChangeText={(v) => { setEmail(v); setErreur(''); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      autoFocus
                      placeholder="vous@exemple.com"
                      placeholderTextColor={c.placeholder}
                      cursorColor={c.gold}
                      selectionColor={c.borderGold}
                      returnKeyType="send"
                      onSubmitEditing={envoyerLien}
                      accessibilityLabel="Adresse email"
                    />
                  </View>
                </View>

                {erreur ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                    <Text style={styles.errorText}>{erreur}</Text>
                  </Animated.View>
                ) : null}

                <Button
                  label="Envoyer le lien"
                  onPress={envoyerLien}
                  loading={loading}
                  variant="primary"
                  style={styles.ctaBtn}
                />

                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backLink}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Retour à la connexion"
                >
                  <Ionicons name="arrow-back-outline" size={15} color={c.textMuted} />
                  <Text style={styles.backLinkText}>Retour à la connexion</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ─── État : confirmation envoyée ─────────────── */}
            {sent && (
              <Animated.View
                entering={FadeInDown.delay(80).springify().damping(18)}
                style={styles.sentWrap}
              >
                <View style={styles.sentIcon}>
                  <Ionicons name="paper-plane-outline" size={32} color={c.gold} />
                </View>

                <Text style={styles.sentTitle}>Email envoyé</Text>
                <Text style={styles.sentBody}>
                  Si l'adresse{' '}
                  <Text style={styles.sentEmail}>{email.trim().toLowerCase()}</Text>
                  {' '}est associée à un compte, vous recevrez un lien de réinitialisation dans quelques minutes.
                </Text>
                <Text style={styles.sentHint}>Vérifiez aussi vos spams.</Text>

                <Button
                  label="Retour à la connexion"
                  onPress={() => navigation.navigate('Login')}
                  variant="primary"
                  style={styles.ctaBtn}
                />

                <TouchableOpacity
                  onPress={() => { setSent(false); setEmail(''); }}
                  style={styles.backLink}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Ressaisir l'email"
                >
                  <Ionicons name="refresh-outline" size={15} color={c.textMuted} />
                  <Text style={styles.backLinkText}>Ressaisir l'email</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0A0A0A' },
  scroll: { flexGrow: 1 },

  // ─── Hero ───
  hero: {
    height: 240,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrap: {
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(200,150,12,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,150,12,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.displayItalic,
    fontSize: 30,
    color: '#F0EDE8',
    lineHeight: 36,
    marginBottom: spacing.xs,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.72)',
    letterSpacing: 0.3,
  },

  // ─── Carte ───
  card: {
    flex: 1,
    backgroundColor: c.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
    marginBottom: spacing.xs,
  },
  cardSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },

  // ─── Champ ───
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.xs,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
  },
  fieldIcon: {
    marginRight: spacing.xs,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    paddingVertical: spacing.sm,
  },

  // ─── Erreur ───
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(163,45,45,0.1)',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(163,45,45,0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.error,
    flex: 1,
  },

  // ─── CTA ───
  ctaBtn: {
    marginBottom: spacing.sm,
  },

  // ─── Lien retour ───
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  backLinkText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },

  // ─── État confirmation ───
  sentWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  sentIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(200,150,12,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,150,12,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  sentTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    textAlign: 'center',
  },
  sentBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
    textAlign: 'center',
    lineHeight: 20,
  },
  sentEmail: {
    fontFamily: fonts.bodyBold,
    color: c.text,
  },
  sentHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
  },
});
