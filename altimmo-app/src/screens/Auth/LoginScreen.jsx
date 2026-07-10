import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ImmobilierHero from '../../components/illustrations/ImmobilierHero';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components';
import { fonts, fontSize, spacing, radius } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT = '3869205293-5d0vk1p5vanhoocdk3d4hr442pg8li6q.apps.googleusercontent.com';
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');

  const passRef = useRef(null);

  const { login, loginWithGoogle } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT,
  });

  // Envoie le idToken Google brut au backend — c'est le backend qui vérifie
  // son authenticité via google-auth-library (jamais de confiance aveugle
  // dans des champs email/name reconstruits côté client).
  const handleGoogleLogin = useCallback(async (idToken) => {
    setLoading(true);
    setErreur('');
    try {
      await loginWithGoogle({ idToken });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Connexion Google échouée. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle]);

  // expo-auth-session ne renvoie pas les mêmes codes d'erreur que
  // @react-native-google-signin/google-signin (SIGN_IN_CANCELLED, etc.) —
  // on gère ici les types réels de AuthSessionResult.
  useEffect(() => {
    if (!response) return;

    switch (response.type) {
      case 'success':
        handleGoogleLogin(response.authentication?.idToken);
        break;
      case 'cancel':
      case 'dismiss':
        // L'utilisateur a annulé — rien à faire.
        break;
      case 'locked':
        // Une demande de connexion est déjà en cours — on l'ignore.
        break;
      case 'error':
        Alert.alert('Erreur', response.error?.message || 'La connexion Google a échoué.');
        break;
      default:
        break;
    }
  }, [response, handleGoogleLogin]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password) {
      setErreur('Email et mot de passe requis');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErreur('Adresse email invalide');
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setErreur(err.response?.data?.message || err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero ─────────────────────────────────────────── */}
          <ImmobilierHero title="Bon retour !" subtitle="Connectez-vous à votre espace" imageUri="https://images.unsplash.com/photo-1643818657367-491080baeece?auto=format&fit=crop&w=900&q=80" />

          {/* ─── Carte formulaire ─────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(160).springify().damping(18)}
            style={styles.card}
          >
            {/* ─── Email ─── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={c.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErreur(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  autoFocus
                  placeholder="vous@exemple.com"
                  placeholderTextColor={c.textMuted}
                  returnKeyType="next"
                  onSubmitEditing={() => passRef.current?.focus()}
                  accessibilityLabel="Adresse email"
                />
              </View>
            </View>

            {/* ─── Mot de passe ─── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={c.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passRef}
                  style={[styles.textInput, styles.textInputPassword]}
                  value={password}
                  onChangeText={(v) => { setPass(v); setErreur(''); }}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  placeholder="Votre mot de passe"
                  placeholderTextColor={c.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Mot de passe"
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={c.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── Mot de passe oublié ─── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotWrap}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mot de passe oublié"
            >
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {/* ─── Erreur ─── */}
            {erreur ? (
              <Animated.View
                entering={FadeInDown.duration(250)}
                style={styles.errorWrap}
              >
                <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                <Text style={styles.errorText}>{erreur}</Text>
              </Animated.View>
            ) : null}

            {/* ─── CTA connexion ─── */}
            <Button
              label="Se connecter"
              onPress={handleLogin}
              loading={loading}
              variant="primary"
              style={styles.loginBtn}
            />

            {/* ─── Divider ─── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ─── Google ─── */}
            <TouchableOpacity
              style={[styles.googleBtn, (!request || loading) && styles.googleBtnDisabled]}
              onPress={() => promptAsync()}
              disabled={!request || loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continuer avec Google"
            >
              <AntDesign name="google" size={18} color="#EA4335" />
              <Text style={styles.googleBtnText}>Continuer avec Google</Text>
            </TouchableOpacity>

            {/* ─── Lien inscription ─── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.signupLink}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Créer un compte"
            >
              <Text style={styles.signupText}>
                Pas encore de compte ?{' '}
                <Text style={styles.signupAccent}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    flexGrow: 1,
  },

  // ─── Hero ───
  hero: {
    height: 280,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  logoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  logo: {
    width: 90,
    height: 90,
    opacity: 0.9,
  },
  heroText: {
    paddingHorizontal: spacing.lg,
  },
  heroTitle: {
    fontFamily: fonts.displayItalic,
    fontSize: 36,
    color: '#F0EDE8',
    lineHeight: 42,
    marginBottom: spacing.xs,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.55)',
    letterSpacing: 0.3,
  },

  // ─── Carte formulaire ───
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

  // ─── Champs ───
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    paddingVertical: spacing.sm,
  },
  textInputPassword: {
    paddingRight: spacing.xs,
  },
  eyeBtn: {
    padding: spacing.xs,
  },

  // ─── Mot de passe oublié ───
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.gold,
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

  // ─── Bouton connexion ───
  loginBtn: {
    marginBottom: spacing.md,
  },

  // ─── Divider ───
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },

  // ─── Bouton Google ───
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.xs,
    backgroundColor: c.bgCard,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  googleBtnDisabled: {
    opacity: 0.45,
  },
  googleBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.md,
    color: c.text,
  },

  // ─── Lien inscription ───
  signupLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  signupText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
  },
  signupAccent: {
    fontFamily: fonts.bodyBold,
    color: c.gold,
  },
});
