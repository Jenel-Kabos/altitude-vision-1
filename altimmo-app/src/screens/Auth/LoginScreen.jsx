import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Erreur', 'Email et mot de passe requis.');
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('Connexion échouée', err.response?.data?.message || 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[colors.primaryDark, colors.primary]}
            style={styles.logoBox}
          >
            <Text style={styles.logoText}>AV</Text>
          </LinearGradient>
          <Text style={styles.brand}>Altimmo</Text>
          <Text style={styles.subtitle}>Altitude Vision — Immobilier</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.title}>Connexion</Text>

          {/* Email */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Adresse email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          {/* Mot de passe */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Mot de passe"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          {/* Bouton connexion */}
          <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.btnPrimary}>
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.btnPrimaryText}>Se connecter</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={styles.sepLine} />
            <Text style={styles.sepText}>ou</Text>
            <View style={styles.sepLine} />
          </View>

          {/* Google (futur) */}
          <TouchableOpacity style={styles.btnGoogle} activeOpacity={0.85}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.btnGoogleText}>Continuer avec Google</Text>
          </TouchableOpacity>

          {/* Lien inscription */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.registerLink}
          >
            <Text style={styles.registerText}>
              Pas de compte ?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBox:     { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText:    { fontSize: 28, fontWeight: '900', color: '#000' },
  brand:       { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  subtitle:    { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  form:        { backgroundColor: colors.backgroundCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border },
  title:       { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundLight, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 14 },
  eyeBtn:      { padding: 6 },
  forgotBtn:   { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText:  { color: colors.primary, fontSize: 13 },
  btnPrimary:  { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
  separator:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sepLine:     { flex: 1, height: 1, backgroundColor: colors.border },
  sepText:     { color: colors.textMuted, marginHorizontal: 12, fontSize: 13 },
  btnGoogle:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, gap: 10, marginBottom: 20 },
  googleIcon:  { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  btnGoogleText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  registerLink:  { alignItems: 'center' },
  registerText:  { fontSize: 14, color: colors.textSecondary },
});
