import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components';
import api from '../../services/api';

// ─── Force du mot de passe ───────────────────────────────────────────────────
const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pwd.length >= 8)          score++;
  if (pwd.length >= 12)         score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Faible',    color: '#E53E3E' };
  if (score <= 2) return { score, label: 'Moyen',     color: '#DD6B20' };
  if (score <= 3) return { score, label: 'Bon',       color: '#C8960C' };
  return             { score, label: 'Excellent', color: '#38A169' };
};

// ─── PasswordField ───────────────────────────────────────────────────────────
function PasswordField({ label, value, onChangeText, show, onToggleShow,
  placeholder, styles, c, inputRef, returnKeyType, onSubmitEditing, autoComplete }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <Ionicons name="lock-closed-outline" size={17} color={c.textMuted} style={styles.fieldIcon} />
        <TextInput
          ref={inputRef}
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete || 'password'}
          placeholder={placeholder}
          placeholderTextColor={c.placeholder}
          cursorColor={c.gold}
          selectionColor={c.borderGold}
          returnKeyType={returnKeyType || 'done'}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
        />
        <TouchableOpacity
          onPress={onToggleShow}
          hitSlop={8}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={show ? 'Masquer' : 'Afficher'}
        >
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ChangePasswordScreen ────────────────────────────────────────────────────
export default function ChangePasswordScreen({ navigation }) {
  const { refreshSession } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPassConf]        = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');
  const [done, setDone]       = useState(false);

  const newPassRef     = useRef(null);
  const confirmPassRef = useRef(null);

  const strength = useMemo(() => getStrength(password), [password]);

  const enregistrer = useCallback(async () => {
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

      const newToken = res.data?.token;
      const updated  = res.data?.data?.user || res.data?.user;
      await refreshSession(newToken, updated);

      setDone(true);
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  }, [passwordCurrent, password, passwordConfirm, refreshSession]);

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

            <Animated.View entering={FadeInDown.delay(0).springify().damping(18)} style={styles.heroIconWrap}>
              <View style={styles.heroIcon}>
                <Ionicons
                  name={done ? 'checkmark-outline' : 'key-outline'}
                  size={28}
                  color={done ? '#38A169' : 'rgba(200,150,12,0.9)'}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text style={styles.heroTitle}>
                {done ? 'Mot de passe\nmis à jour !' : 'Changer le mot\nde passe'}
              </Text>
              <Text style={styles.heroSub}>
                {done ? 'Session sécurisée avec vos nouveaux identifiants' : 'Minimum 8 caractères, différent de l\'actuel'}
              </Text>
            </Animated.View>
          </View>

          {/* ─── Carte ─────────────────────────────────────────── */}
          <View style={styles.card}>

            {/* ─── État : formulaire ───────────────────────── */}
            {!done && (
              <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>

                {/* Mot de passe actuel */}
                <PasswordField
                  label="Mot de passe actuel"
                  value={passwordCurrent}
                  onChangeText={(v) => { setPasswordCurrent(v); setErreur(''); }}
                  show={showCurrent}
                  onToggleShow={() => setShowCurrent(v => !v)}
                  placeholder="Votre mot de passe actuel"
                  styles={styles} c={c}
                  autoComplete="password"
                  returnKeyType="next"
                  onSubmitEditing={() => newPassRef.current?.focus()}
                />

                {/* Nouveau mot de passe */}
                <PasswordField
                  label="Nouveau mot de passe"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErreur(''); }}
                  show={showNew}
                  onToggleShow={() => setShowNew(v => !v)}
                  placeholder="Min. 8 caractères"
                  styles={styles} c={c}
                  inputRef={newPassRef}
                  autoComplete="password-new"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPassRef.current?.focus()}
                />

                {/* Indicateur de force */}
                {password.length > 0 && (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.strengthWrap}>
                    <View style={styles.strengthBars}>
                      {[1, 2, 3, 4].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.strengthBar,
                            { backgroundColor: i <= Math.ceil(strength.score / 1.25) ? strength.color : c.border },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </Animated.View>
                )}

                {/* Confirmation */}
                <PasswordField
                  label="Confirmer le nouveau mot de passe"
                  value={passwordConfirm}
                  onChangeText={(v) => { setPassConf(v); setErreur(''); }}
                  show={showConfirm}
                  onToggleShow={() => setShowConfirm(v => !v)}
                  placeholder="Saisissez à nouveau"
                  styles={styles} c={c}
                  inputRef={confirmPassRef}
                  autoComplete="password-new"
                  returnKeyType="done"
                  onSubmitEditing={enregistrer}
                />

                {/* Correspondance temps réel */}
                {passwordConfirm.length > 0 && (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.matchRow}>
                    <Ionicons
                      name={password === passwordConfirm ? 'checkmark-circle' : 'close-circle'}
                      size={15}
                      color={password === passwordConfirm ? '#38A169' : c.error}
                    />
                    <Text style={[styles.matchText, { color: password === passwordConfirm ? '#38A169' : c.error }]}>
                      {password === passwordConfirm ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
                    </Text>
                  </Animated.View>
                )}

                {/* Erreur */}
                {erreur ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                    <Text style={styles.errorText}>{erreur}</Text>
                  </Animated.View>
                ) : null}

                <Button
                  label="Mettre à jour le mot de passe"
                  onPress={enregistrer}
                  loading={loading}
                  variant="primary"
                  style={styles.ctaBtn}
                  accessibilityLabel="Changer le mot de passe"
                />

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
            )}

            {/* ─── État : succès ────────────────────────────── */}
            {done && (
              <Animated.View
                entering={FadeInDown.delay(80).springify().damping(18)}
                style={styles.doneWrap}
              >
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                </View>
                <Text style={styles.doneTitle}>Sécurité renforcée</Text>
                <Text style={styles.doneSub}>
                  Votre mot de passe a été modifié. Votre session a été automatiquement mise à jour — aucune reconnexion nécessaire.
                </Text>
                <Button
                  label="Retour au profil"
                  onPress={() => navigation.goBack()}
                  variant="primary"
                  style={styles.ctaBtn}
                />
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
    color: 'rgba(240,237,232,0.5)',
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

  // ─── Champs ───
  field: {
    marginBottom: spacing.sm,
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
  eye: {
    padding: spacing.xs,
  },

  // ─── Force ───
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    minWidth: 56,
    textAlign: 'right',
  },

  // ─── Correspondance ───
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  matchText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
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
    marginTop: spacing.xs,
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

  // ─── Succès ───
  doneWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#38A169',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    textAlign: 'center',
  },
  doneSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
