import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, fonts, fontSize } from '../../theme';
import Button from '../../components/ui/Button';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID =
  '872164120879-o3j19vs2ro8l7pm93u3g1po8v10tgruv.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(null);
  const { login, loginWithGoogle } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication.accessToken);
    }
  }, [response]);

  const handleGoogleLogin = async (accessToken) => {
    try {
      setLoading(true);
      const userInfoRes = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userInfo = await userInfoRes.json();

      await loginWithGoogle({
        email:    userInfo.email,
        name:     userInfo.name,
        googleId: userInfo.id,
        avatar:   userInfo.picture,
      });
      // Nav vers app principale : géré par AppNavigator qui switch sur user/token
    } catch (err) {
      console.log('Google login error:', err.message);
      Alert.alert('Erreur', 'Connexion Google échouée. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>ALTIMMO</Text>
            <View style={styles.brandRule} />
            <Text style={styles.subtitle}>
              Votre partenaire immobilier
            </Text>
          </View>

          <View style={styles.form}>
            {/* Email */}
            <View style={[
              styles.inputWrap,
              focused === 'email' && styles.inputWrapFocused,
            ]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <View style={[
              styles.inputWrap,
              focused === 'password' && styles.inputWrapFocused,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}
              hitSlop={8}
            >
              <Text style={{
                fontFamily: fonts.body,
                fontSize: fontSize.sm,
                color: colors.gold,
              }}>
                Mot de passe oublié ?
              </Text>
            </TouchableOpacity>

            {erreur ? (
              <Text style={styles.error}>{erreur}</Text>
            ) : null}

            <Button
              label="Se connecter"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              variant="primary"
            />

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: spacing.md,
            }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{
                marginHorizontal: spacing.sm,
                color: colors.textMuted,
                fontFamily: fonts.body,
                fontSize: fontSize.xs,
              }}>
                ou
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <Button
              variant="outline"
              label="Continuer avec Google"
              onPress={() => promptAsync()}
              disabled={!request || loading}
              fullWidth
              style={{ marginBottom: spacing.md }}
            />
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.linkWrap}
          >
            <Text style={styles.linkText}>
              Pas encore de compte ?{' '}
              <Text style={styles.linkAccent}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
  },
  brandRule: {
    width: 60,
    height: 2,
    backgroundColor: colors.primary,
    marginVertical: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.lg,
  },
  eyeBtn: {
    padding: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  linkWrap: {
    alignItems: 'center',
  },
  linkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  linkAccent: {
    color: colors.primary,
    fontWeight: '600',
  },
});
