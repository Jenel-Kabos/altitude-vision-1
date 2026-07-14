import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button, Checkbox } from '../../components';
import PageHeader from '../../components/PageHeader';
import { fonts, fontSize, spacing, radius } from '../../theme';
import api from '../../services/api';

// Regex Congo : accepte +242XXXXXXXXX ou 00242XXXXXXXXX ou 0XXXXXXXXX
// ou XXXXXXXXX (9 chiffres) — format Airtel/MTN Congo
const PHONE_REGEX = /^(\+242|00242|0)?[0-9]{9}$/;

const ROLES = [
  { value: 'Client',       icon: 'person-outline', label: 'Client',       desc: 'Chercher et louer des biens' },
  { value: 'Proprietaire', icon: 'home-outline',   label: 'Propriétaire', desc: 'Publier et gérer vos biens' },
];

const CERTS = [
  { key: 'informationsVraies',   label: 'Je certifie que les informations fournies sont vraies' },
  { key: 'estProprietaireLegal', label: 'Je suis bien le propriétaire légal du bien' },
  { key: 'engagementHonnetete',  label: "Je m'engage à être honnête dans mes transactions" },
  { key: 'commissionAcceptee',   label: "J'accepte la commission de l'agence" },
  { key: 'contratAccepte',       label: "J'accepte les conditions générales" },
];

const CONTRAT_CONDENSE = `Contrat d'hébergement — Altitude Vision / Altimmo

En qualité de Propriétaire ou apporteur d'affaires, vous confiez à Altitude Vision le mandat de gérer la mise en location de votre (vos) bien(s) via la plateforme Altimmo.

• Durée : indéterminée, résiliable avec un préavis de 30 jours par email.
• Commission : l'Agence perçoit 80 % du premier loyer mensuel ; vous recevez 30 % de cette commission (~24 % du loyer). Exemple : loyer 150 000 FCFA → votre gain : 36 000 FCFA.
• Vos obligations : fournir des informations exactes, être le propriétaire légal (ou mandaté), informer l'Agence de tout changement de disponibilité, ne pas contourner l'Agence avec un locataire présenté par elle.
• Litiges : résolution amiable en priorité, à défaut tribunal compétent de Brazzaville.

En cochant les certifications ci-dessous et en confirmant votre inscription, vous acceptez électroniquement les termes du présent contrat.`;

const Field = ({ label, icon, value, onChangeText, placeholder, styles, c, inputRef, keyboardType, returnKeyType, onSubmitEditing, borderColor }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.fieldInputWrap, borderColor && { borderColor }]}>
      <Ionicons name={icon} size={17} color={c.textMuted} style={styles.fieldIcon} />
      <TextInput
        ref={inputRef}
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={keyboardType === 'phone-pad' ? 'none' : 'words'}
        autoCorrect={false}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        returnKeyType={returnKeyType || 'done'}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={label}
      />
    </View>
  </View>
);

export default function CompleterProfilScreen() {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { markProfileCompleted } = useAuth();

  const [step, setStep]         = useState(1);
  const [prenom, setPrenom]     = useState('');
  const [nom, setNom]           = useState('');
  const [telephone, setTelephone] = useState('');
  const [role, setRole]         = useState('Client');
  const [certs, setCerts] = useState({
    informationsVraies: false, estProprietaireLegal: false,
    engagementHonnetete: false, commissionAcceptee: false, contratAccepte: false,
  });
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');

  const nomRef = useRef(null);
  const telRef = useRef(null);

  const isProprietaire  = role === 'Proprietaire';
  const allCertsChecked = Object.values(certs).every(Boolean);
  const toggleCert = useCallback((key) => setCerts(prev => ({ ...prev, [key]: !prev[key] })), []);

  const telClean   = telephone.trim().replace(/\s/g, '');
  const telValide  = PHONE_REGEX.test(telClean);
  const telBorder  = !telephone.trim() ? undefined : (telValide ? '#2E7D32' : c.error);

  const validateStep1 = useCallback(() => {
    if (!prenom.trim() || !nom.trim()) {
      setErreur('Prénom et nom sont requis');
      return false;
    }
    if (!telClean) {
      setErreur('Le numéro de téléphone est requis');
      return false;
    }
    if (!telValide) {
      setErreur('Format invalide. Ex: +242066000000 ou 066000000');
      return false;
    }
    setErreur('');
    return true;
  }, [prenom, nom, telClean, telValide]);

  const soumettreCompletion = useCallback(async () => {
    if (isProprietaire && !allCertsChecked) {
      setErreur('Cochez tous les engagements pour continuer');
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      const res = await api.patch('/users/complete-profile', {
        prenom: prenom.trim(),
        nom:    nom.trim(),
        telephone: telClean,
        role,
        ...(isProprietaire && { certifications: certs }),
      });

      const updatedUser = res.data?.data?.user;
      markProfileCompleted(updatedUser);
      // Pas de navigation manuelle : AppNavigator bascule automatiquement
      // sur Main dès que needsProfileCompletion repasse à false.
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de compléter le profil.');
    } finally {
      setLoading(false);
    }
  }, [isProprietaire, allCertsChecked, prenom, nom, telClean, role, certs, markProfileCompleted]);

  const goNext = useCallback(() => {
    if (!validateStep1()) return;
    if (isProprietaire) setStep(2);
    else soumettreCompletion();
  }, [validateStep1, isProprietaire, soumettreCompletion]);

  const goBack = useCallback(() => { setErreur(''); setStep(1); }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PageHeader title="Compléter mon profil" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Bienvenue !</Text>
            <Text style={styles.subtitle}>Complétez votre profil pour commencer.</Text>

            {/* ─── Étape 1 — Informations de base ─────────────── */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
                <Field
                  label="Prénom" icon="person-outline" value={prenom}
                  onChangeText={(v) => { setPrenom(v); setErreur(''); }}
                  placeholder="Votre prénom" styles={styles} c={c}
                  returnKeyType="next" onSubmitEditing={() => nomRef.current?.focus()}
                />
                <Field
                  label="Nom" icon="person-outline" value={nom}
                  onChangeText={(v) => { setNom(v); setErreur(''); }}
                  placeholder="Votre nom de famille" styles={styles} c={c}
                  inputRef={nomRef} returnKeyType="next"
                  onSubmitEditing={() => telRef.current?.focus()}
                />
                <Field
                  label="Téléphone" icon="call-outline" value={telephone}
                  onChangeText={(v) => { setTelephone(v); setErreur(''); }}
                  placeholder="+242 06 XXX XX XX" styles={styles} c={c}
                  inputRef={telRef} keyboardType="phone-pad"
                  returnKeyType="done" onSubmitEditing={goNext}
                  borderColor={telBorder}
                />
                <Text style={styles.helperText}>Format : +242 06 XXX XX XX ou 06 XXX XX XX</Text>

                <Text style={styles.stepHeading}>Quel est votre profil ?</Text>
                <View style={styles.rolesCol}>
                  {ROLES.map(r => {
                    const selected = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        onPress={() => setRole(r.value)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Sélectionner le profil ${r.label}`}
                        style={[styles.roleCard, { borderColor: selected ? c.gold : c.border, backgroundColor: selected ? 'rgba(200,150,12,0.08)' : 'transparent' }]}
                      >
                        <View style={styles.roleCardInner}>
                          <View style={[styles.roleIcon, selected && { backgroundColor: 'rgba(200,150,12,0.12)' }]}>
                            <Ionicons name={r.icon} size={22} color={selected ? c.gold : c.textSub} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.roleLabel, selected && { color: c.gold }]}>{r.label}</Text>
                            <Text style={styles.roleDesc}>{r.desc}</Text>
                          </View>
                          {selected
                            ? <Ionicons name="checkmark-circle" size={20} color={c.gold} />
                            : <Ionicons name="radio-button-off" size={20} color={c.border} />
                          }
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {erreur ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                    <Text style={styles.errorText}>{erreur}</Text>
                  </Animated.View>
                ) : null}

                <Button
                  label={isProprietaire ? 'Suivant' : 'Terminer'}
                  onPress={goNext}
                  loading={!isProprietaire && loading}
                  variant="primary"
                  style={styles.ctaBtn}
                />
              </Animated.View>
            )}

            {/* ─── Étape 2 — Contrat Propriétaire ─────────────── */}
            {step === 2 && (
              <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
                <Text style={styles.stepHeading}>Engagements propriétaire</Text>
                <Text style={styles.stepSubheading}>
                  Lisez le contrat et acceptez chaque engagement pour finaliser votre inscription
                </Text>

                <ScrollView style={styles.contratBox} nestedScrollEnabled>
                  <Text style={styles.contratText}>{CONTRAT_CONDENSE}</Text>
                </ScrollView>

                <View style={styles.certsList}>
                  {CERTS.map(cert => (
                    <Checkbox
                      key={cert.key}
                      checked={certs[cert.key]}
                      onPress={() => toggleCert(cert.key)}
                      label={cert.label}
                    />
                  ))}
                </View>

                <View style={styles.certsProgress}>
                  <View style={[styles.certsProgressBar, {
                    width: `${(Object.values(certs).filter(Boolean).length / CERTS.length) * 100}%`,
                  }]} />
                </View>
                <Text style={styles.certsProgressLabel}>
                  {Object.values(certs).filter(Boolean).length}/{CERTS.length} engagements acceptés
                </Text>

                {erreur ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                    <Text style={styles.errorText}>{erreur}</Text>
                  </Animated.View>
                ) : null}

                <View style={styles.actionsRow}>
                  <Button label="Précédent" onPress={goBack} variant="outline" style={{ flex: 1 }} />
                  <Button
                    label="Confirmer l'inscription"
                    onPress={soumettreCompletion}
                    loading={loading}
                    disabled={!allCertsChecked}
                    variant="primary"
                    style={{ flex: 1 }}
                  />
                </View>
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

  card: {
    flex: 1,
    backgroundColor: c.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  title: {
    fontFamily: fonts.displayItalic,
    fontSize: 28,
    color: c.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.lg,
  },

  field: { marginBottom: spacing.md },
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
  fieldIcon: { marginRight: spacing.xs },
  fieldInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    paddingVertical: spacing.sm,
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },

  stepHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: c.text,
    marginBottom: spacing.xs,
  },
  stepSubheading: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: c.textSub,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },

  rolesCol: { gap: spacing.sm, marginBottom: spacing.lg },
  roleCard: { borderRadius: radius.sm, borderWidth: 2 },
  roleCardInner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
  },
  roleIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.bgCardAlt, alignItems: 'center', justifyContent: 'center',
  },
  roleLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: c.text, marginBottom: 2 },
  roleDesc:  { fontFamily: fonts.body, fontSize: 13, color: c.textSub },

  contratBox: {
    maxHeight: 220,
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  contratText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: c.textSub,
    lineHeight: 18,
  },

  certsList: { gap: spacing.sm, marginBottom: spacing.md },
  certsProgress: {
    height: 4, backgroundColor: c.border, borderRadius: 2,
    marginBottom: spacing.xs, overflow: 'hidden',
  },
  certsProgressBar: { height: 4, backgroundColor: c.gold, borderRadius: 2 },
  certsProgressLabel: {
    fontFamily: fonts.body, fontSize: 11, color: c.textMuted,
    textAlign: 'right', marginBottom: spacing.lg,
  },

  errorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: 'rgba(163,45,45,0.1)', borderRadius: radius.xs,
    borderWidth: 1, borderColor: 'rgba(163,45,45,0.25)',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.md,
  },
  errorText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.error, flex: 1 },

  ctaBtn: { marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
