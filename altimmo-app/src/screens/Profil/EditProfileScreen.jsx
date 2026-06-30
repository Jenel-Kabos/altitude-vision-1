import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components';
import api from '../../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
};

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const emailVerified = !!user?.isEmailVerified;

  const [name, setName]     = useState(user?.name  || '');
  const [email, setEmail]   = useState(user?.email || '');
  const [phone, setPhone]   = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');
  const [saved, setSaved]     = useState(false);

  const emailRef = useRef(null);
  const phoneRef = useRef(null);

  const isDirty = name !== (user?.name || '') ||
    (!emailVerified && email !== (user?.email || '')) ||
    phone !== (user?.phone || '');

  const enregistrer = useCallback(async () => {
    setErreur('');

    if (!name.trim()) {
      setErreur('Le nom est requis.');
      return;
    }
    if (!emailVerified) {
      if (!email.trim()) { setErreur("L'email est requis."); return; }
      if (!EMAIL_RE.test(email.trim())) { setErreur('Adresse email invalide.'); return; }
    }

    setLoading(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim() };
      if (!emailVerified) payload.email = email.trim().toLowerCase();

      const res     = await api.patch('/users/updateMe', payload);
      const updated = res.data?.data?.user || res.data?.user;
      if (updated && updateUser) updateUser(updated);

      setSaved(true);
      setTimeout(() => navigation.goBack(), 1400);
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [name, email, phone, emailVerified, updateUser, navigation]);

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

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Ionicons name="arrow-back" size={22} color="rgba(240,237,232,0.7)" />
            </TouchableOpacity>

            <Animated.View entering={FadeInDown.delay(0).springify().damping(18)} style={styles.avatarWrap}>
              {user?.photo ? (
                <Image
                  source={{ uri: user.photo }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{getInitials(user?.name)}</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text style={styles.heroTitle}>{user?.name || 'Mon profil'}</Text>
              <Text style={styles.heroSub}>{user?.email || ''}</Text>
            </Animated.View>
          </View>

          {/* ─── Carte formulaire ──────────────────────────────── */}
          <View style={styles.card}>

            {/* Bandeau succès */}
            {saved && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.savedBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#38A169" />
                <Text style={styles.savedText}>Profil mis à jour avec succès</Text>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>

              {/* ─── Nom ─── */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nom complet</Text>
                <View style={styles.fieldInputWrap}>
                  <Ionicons name="person-outline" size={17} color={c.textMuted} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={name}
                    onChangeText={(v) => { setName(v); setErreur(''); }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus
                    placeholder="Jean Dupont"
                    placeholderTextColor={c.textMuted}
                    returnKeyType={emailVerified ? 'next' : 'next'}
                    onSubmitEditing={() => emailVerified ? phoneRef.current?.focus() : emailRef.current?.focus()}
                    accessibilityLabel="Nom complet"
                  />
                </View>
              </View>

              {/* ─── Email ─── */}
              {emailVerified ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={[styles.fieldInputWrap, styles.fieldInputWrapReadOnly]}>
                    <Ionicons name="mail-outline" size={17} color={c.textMuted} style={styles.fieldIcon} />
                    <Text style={styles.readOnlyValue} numberOfLines={1}>{email}</Text>
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#38A169" />
                      <Text style={styles.verifiedText}>Vérifié</Text>
                    </View>
                  </View>
                  <Text style={styles.fieldHint}>L'email ne peut pas être modifié après vérification.</Text>
                </View>
              ) : (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons name="mail-outline" size={17} color={c.textMuted} style={styles.fieldIcon} />
                    <TextInput
                      ref={emailRef}
                      style={styles.fieldInput}
                      value={email}
                      onChangeText={(v) => { setEmail(v); setErreur(''); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      placeholder="vous@exemple.com"
                      placeholderTextColor={c.textMuted}
                      returnKeyType="next"
                      onSubmitEditing={() => phoneRef.current?.focus()}
                      accessibilityLabel="Adresse email"
                    />
                  </View>
                </View>
              )}

              {/* ─── Téléphone ─── */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Téléphone <Text style={styles.optionalHint}>(optionnel)</Text>
                </Text>
                <View style={styles.fieldInputWrap}>
                  <Ionicons name="call-outline" size={17} color={c.textMuted} style={styles.fieldIcon} />
                  <TextInput
                    ref={phoneRef}
                    style={styles.fieldInput}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setErreur(''); }}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                    autoComplete="tel"
                    placeholder="+242 06 000 00 00"
                    placeholderTextColor={c.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={enregistrer}
                    accessibilityLabel="Numéro de téléphone"
                  />
                </View>
              </View>

              {/* ─── Erreur ─── */}
              {erreur ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                  <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                  <Text style={styles.errorText}>{erreur}</Text>
                </Animated.View>
              ) : null}

              {/* ─── CTA ─── */}
              <Button
                label="Enregistrer les modifications"
                onPress={enregistrer}
                loading={loading}
                disabled={!isDirty || saved}
                variant="primary"
                style={styles.ctaBtn}
                accessibilityLabel="Enregistrer les modifications"
              />

              {/* ─── Annuler ─── */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.cancelLink}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Annuler"
              >
                <Ionicons name="close-outline" size={16} color={c.textMuted} />
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>

            </Animated.View>
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
    alignItems: 'flex-start',
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
  avatarWrap: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(200,150,12,0.6)',
  },
  avatarFallback: {
    backgroundColor: '#1C1408',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: 'rgba(200,150,12,0.85)',
  },
  heroTitle: {
    fontFamily: fonts.displayItalic,
    fontSize: 28,
    color: '#F0EDE8',
    lineHeight: 34,
    marginBottom: spacing.xs,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.45)',
    letterSpacing: 0.2,
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

  // ─── Bandeau succès ───
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(56,161,105,0.12)',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(56,161,105,0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  savedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: '#38A169',
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
  optionalHint: {
    fontFamily: fonts.body,
    color: c.textMuted,
    fontSize: fontSize.xs,
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
  fieldInputWrapReadOnly: {
    backgroundColor: c.bgCard,
    borderColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
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
  readOnlyValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textMuted,
    paddingVertical: spacing.sm,
  },
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: spacing.xs,
  },

  // ─── Badge email vérifié ───
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56,161,105,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: spacing.xs,
  },
  verifiedText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#38A169',
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

  // ─── Annuler ───
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
});
