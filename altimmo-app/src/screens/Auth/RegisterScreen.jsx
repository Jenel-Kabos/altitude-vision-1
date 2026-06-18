import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme';
import Button from '../../components/ui/Button';

const ROLES = [
  {
    value: 'Client',
    icon: 'person-outline',
    label: 'Client',
    desc: 'Chercher et louer des biens',
  },
  {
    value: 'Proprietaire',
    icon: 'home-outline',
    label: 'Propriétaire',
    desc: 'Publier et gérer vos biens',
  },
];

const CERTS = [
  { key: 'contratAccepte',       label: "J'accepte le contrat d'hébergement Altimmo" },
  { key: 'informationsVraies',   label: 'Les informations que je fournis sont exactes' },
  { key: 'estProprietaireLegal', label: 'Je suis le propriétaire légal des biens publiés' },
  { key: 'engagementHonnetete',  label: "Je m'engage à agir honnêtement" },
  { key: 'commissionAcceptee',   label: "J'accepte la commission d'Altimmo" },
];

const STEP_LABELS = ['Infos', 'Profil', 'Engagements'];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Client');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(null);
  const [certs, setCerts] = useState({
    contratAccepte: false,
    informationsVraies: false,
    estProprietaireLegal: false,
    engagementHonnetete: false,
    commissionAcceptee: false,
  });
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const isProprietaire = role === 'Proprietaire';
  const allCertsChecked = Object.values(certs).every(Boolean);

  const validateStep1 = () => {
    if (!name.trim() || !email.trim() || !password) {
      setErreur('Tous les champs sont requis');
      return false;
    }
    if (password.length < 8) {
      setErreur('Mot de passe trop court (8 caractères minimum)');
      return false;
    }
    setErreur('');
    return true;
  };

  const toggleCert = (key) => {
    setCerts(c => ({ ...c, [key]: !c[key] }));
  };

  const goNext = () => {
    if (validateStep1()) setStep(2);
  };

  const goBack = () => {
    setErreur('');
    setStep(s => Math.max(1, s - 1));
  };

  const handleStep2Next = () => {
    setErreur('');
    if (isProprietaire) {
      setStep(3);
    } else {
      handleRegister();
    }
  };

  const handleRegister = async () => {
    if (isProprietaire && !allCertsChecked) {
      setErreur('Cochez tous les engagements');
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      const payload = isProprietaire
        ? {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            passwordConfirm: password,
            role,
            ...certs,
          }
        : {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            passwordConfirm: password,
            role,
          };
      await register(payload);
      Alert.alert(
        'Inscription réussie',
        'Vérifiez votre email pour activer votre compte.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
      );
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Stepper renderers ────────────────────────────────────────

  const renderDot = (n) => {
    const isDisabled = n === 3 && role === 'Client';
    const isCompleted = n < step && !isDisabled;
    const isActive = n === step && !isDisabled;

    if (isCompleted) {
      return (
        <View style={[styles.dot, styles.dotCompleted]}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
      );
    }
    if (isActive) {
      return (
        <View style={[styles.dot, styles.dotActive]}>
          <Text style={styles.dotNumActive}>{n}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.dot, styles.dotFuture]}>
        <Text style={styles.dotNumFuture}>{n}</Text>
      </View>
    );
  };

  const renderLabel = (n) => {
    const isDisabled = n === 3 && role === 'Client';
    if (isDisabled) return null;
    const isActive = n === step;
    return (
      <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
        {STEP_LABELS[n - 1]}
      </Text>
    );
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
          {/* Brand header */}
          <View style={styles.header}>
            <Text style={styles.brand}>ALTIMMO</Text>
            <View style={styles.brandRule} />
            <Text style={styles.subtitle}>
              Votre partenaire immobilier
            </Text>
          </View>

          {/* Stepper */}
          <View style={styles.stepperRow}>
            <View style={styles.stepCol}>
              {renderDot(1)}
              {renderLabel(1)}
            </View>
            <View style={styles.barCol}>
              <View style={[styles.bar, step > 1 && styles.barCompleted]} />
            </View>
            <View style={styles.stepCol}>
              {renderDot(2)}
              {renderLabel(2)}
            </View>
            <View style={styles.barCol}>
              <View style={[styles.bar, step > 2 && styles.barCompleted]} />
            </View>
            <View style={styles.stepCol}>
              {renderDot(3)}
              {renderLabel(3)}
            </View>
          </View>

          {/* Étape 1 — Infos */}
          {step === 1 && (
            <View style={styles.form}>
              {/* Nom */}
              <View style={[styles.inputWrap, focused === 'name' && styles.inputWrapFocused]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nom complet"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              {/* Email */}
              <View style={[styles.inputWrap, focused === 'email' && styles.inputWrapFocused]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
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

              {/* Mot de passe */}
              <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe (min 8 caractères)"
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

              {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

              <Button
                label="Suivant"
                onPress={goNext}
                fullWidth
                variant="primary"
                icon="arrow-forward"
              />
            </View>
          )}

          {/* Étape 2 — Profil */}
          {step === 2 && (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Quel est votre profil ?</Text>

              <View style={styles.rolesCol}>
                {ROLES.map(r => {
                  const selected = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleCard, selected && styles.roleCardSelected]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                        <Ionicons
                          name={r.icon}
                          size={24}
                          color={selected ? colors.primary : colors.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>
                          {r.label}
                        </Text>
                        <Text style={styles.roleDesc}>{r.desc}</Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

              <View style={styles.actionsRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Précédent"
                    onPress={goBack}
                    variant="outline"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={isProprietaire ? 'Suivant' : "S'inscrire"}
                    onPress={handleStep2Next}
                    loading={!isProprietaire && loading}
                    variant="primary"
                    fullWidth
                    icon={isProprietaire ? 'arrow-forward' : undefined}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Étape 3 — Engagements (proprietaire uniquement) */}
          {step === 3 && (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Engagements propriétaire</Text>

              <View style={styles.certsList}>
                {CERTS.map(c => {
                  const checked = certs[c.key];
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={styles.certRow}
                      onPress={() => toggleCert(c.key)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : null}
                      </View>
                      <Text style={styles.certLabel}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

              <View style={styles.actionsRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Précédent"
                    onPress={goBack}
                    variant="outline"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="S'inscrire"
                    onPress={handleRegister}
                    loading={loading}
                    disabled={!allCertsChecked}
                    variant="primary"
                    fullWidth
                  />
                </View>
              </View>
            </View>
          )}

          {/* Lien vers Login */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.linkWrap}
          >
            <Text style={styles.linkText}>
              Déjà un compte ?{' '}
              <Text style={styles.linkAccent}>Se connecter</Text>
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
    padding: spacing.xl,
  },

  // Brand
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  stepCol: {
    width: 80,
    alignItems: 'center',
  },
  barCol: {
    flex: 1,
    paddingTop: 15,
  },
  bar: {
    height: 2,
    backgroundColor: colors.border,
  },
  barCompleted: {
    backgroundColor: colors.success,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotFuture: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  dotNumActive: {
    ...typography.caption,
    color: '#000',
    fontWeight: '700',
  },
  dotNumFuture: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  stepLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Form
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
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Role cards
  rolesCol: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  roleCardSelected: {
    borderColor: colors.primary,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: {
    backgroundColor: colors.primary + '22',
  },
  roleLabel: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  roleLabelSelected: {
    color: colors.primary,
  },
  roleDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Certs
  certsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  certLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  // Login link
  linkWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
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
