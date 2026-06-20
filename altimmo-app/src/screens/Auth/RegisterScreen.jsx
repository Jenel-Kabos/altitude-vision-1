import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Screen, Input, Button, Card, Checkbox } from '../../components';
import { colors, spacing, fonts, fontSize, radius } from '../../theme';

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

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState('Client');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
    if (!name.trim() || !email.trim() || !password || !passwordConfirm) {
      setErreur('Tous les champs sont requis');
      return false;
    }
    if (password.length < 8) {
      setErreur('Mot de passe trop court (8 caractères minimum)');
      return false;
    }
    if (password !== passwordConfirm) {
      setErreur('Les mots de passe ne correspondent pas');
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
            passwordConfirm,
            role,
            ...certs,
          }
        : {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            passwordConfirm,
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
          <Ionicons name="checkmark" size={16} color={colors.white} />
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
    <Screen scroll avoidKeyboard style={styles.scroll}>
      {/* Brand header */}
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
              <Input
                label="Nom complet"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Jean Dupont"
                style={styles.input}
              />

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

              <PasswordField
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword(!showPassword)}
                placeholder="Min. 8 caractères"
              />

              <PasswordField
                label="Confirmer le mot de passe"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                show={showPasswordConfirm}
                onToggleShow={() => setShowPasswordConfirm(!showPasswordConfirm)}
                placeholder="Saisissez à nouveau"
              />

              {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

              <Button
                label="Suivant"
                onPress={goNext}
                variant="primary"
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
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.85}
                    >
                      <Card
                        selected={selected}
                        style={!selected && styles.roleCardUnselected}
                      >
                        <View style={styles.roleCardInner}>
                          <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                            <Ionicons
                              name={r.icon}
                              size={24}
                              color={selected ? colors.gold : colors.textSub}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>
                              {r.label}
                            </Text>
                            <Text style={styles.roleDesc}>{r.desc}</Text>
                          </View>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                          ) : null}
                        </View>
                      </Card>
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
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={isProprietaire ? 'Suivant' : "S'inscrire"}
                    onPress={handleStep2Next}
                    loading={!isProprietaire && loading}
                    variant="primary"
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
                {CERTS.map(c => (
                  <Checkbox
                    key={c.key}
                    checked={certs[c.key]}
                    onPress={() => toggleCert(c.key)}
                    label={c.label}
                  />
                ))}
              </View>

              {erreur ? <Text style={styles.error}>{erreur}</Text> : null}

              <View style={styles.actionsRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Précédent"
                    onPress={goBack}
                    variant="outline"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="S'inscrire"
                    onPress={handleRegister}
                    loading={loading}
                    disabled={!allCertsChecked}
                    variant="primary"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },

  // Brand
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
    backgroundColor: colors.gold,
    borderColor: colors.gold,
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.black,
  },
  dotNumFuture: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  stepLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stepLabelActive: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },

  // Form
  form: {
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
  },

  // PasswordField (eye-toggle)
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
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Role cards (wrapper Card + inner layout)
  rolesCol: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  roleCardUnselected: {
    // Donne un bord complet 1px à la Card non-sélectionnée
    // (par défaut Card a seulement borderBottomWidth: 1)
    borderWidth: 1,
  },
  roleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: {
    backgroundColor: colors.goldMuted,
  },
  roleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: 2,
  },
  roleLabelSelected: {
    color: colors.gold,
  },
  roleDesc: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },

  // Certs
  certsList: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
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
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  linkAccent: {
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },
});
