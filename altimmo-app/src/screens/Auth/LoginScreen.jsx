import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { Screen, Input, Button } from '../../components';
import { colors, fonts, fontSize, spacing } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID =
  '872164120879-o3j19vs2ro8l7pm93u3g1po8v10tgruv.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
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
    <Screen scroll avoidKeyboard style={styles.scroll}>
      <View style={styles.header}>
        <Image
          source={require('../../../assets/Logo_Altitude_transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>
          Votre partenaire immobilier
        </Text>
      </View>

      <View style={styles.form}>
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

        <Input
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          placeholder="Votre mot de passe"
          style={styles.input}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.forgotWrap}
          hitSlop={8}
        >
          <Text style={styles.forgotText}>
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
          variant="primary"
          style={styles.button}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          variant="outline"
          label="Continuer avec Google"
          onPress={() => promptAsync()}
          disabled={!request || loading}
        />
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
        style={styles.signupLink}
        hitSlop={8}
      >
        <Text style={styles.signupText}>
          Pas encore de compte ?{' '}
          <Text style={styles.signupAccent}>S'inscrire</Text>
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.bodyItalic,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  form: {
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    marginBottom: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  signupText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  signupAccent: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },
});
