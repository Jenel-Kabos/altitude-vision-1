import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ImmobilierHero from '../../components/illustrations/ImmobilierHero';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button, Card, Checkbox } from '../../components';
import { fonts, fontSize, spacing, radius } from '../../theme';

const WEB_CLIENT = '3869205293-ej9uld9a25m8i01o41e37pliaac4eumo.apps.googleusercontent.com';
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  { value: 'Client',       icon: 'person-outline', label: 'Client',       desc: 'Chercher et louer des biens' },
  { value: 'Proprietaire', icon: 'home-outline',   label: 'Propriétaire', desc: 'Publier et gérer vos biens' },
];

const CERTS = [
  { key: 'contratAccepte',       label: "J'accepte le contrat d'hébergement Altimmo" },
  { key: 'informationsVraies',   label: 'Les informations que je fournis sont exactes' },
  { key: 'estProprietaireLegal', label: 'Je suis le propriétaire légal des biens publiés' },
  { key: 'engagementHonnetete', label: "Je m'engage à agir honnêtement" },
  { key: 'commissionAcceptee',   label: "J'accepte la commission d'Altimmo" },
];

const STEP_LABELS = ['Infos', 'Profil', 'Engagements'];

// ─── PasswordField ───────────────────────────────────────────────────────────
function PasswordField({ label, value, onChangeText, show, onToggleShow, placeholder, styles, c, inputRef, returnKeyType, onSubmitEditing }) {
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
          autoComplete="password"
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


// ─── Modal contrat de partenariat ────────────────────────────────────────────
function ContractModal({ visible, onClose, c, styles }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Contrat d'hébergement</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button"
            accessibilityLabel="Fermer le contrat">
            <View style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}>

          <Text style={styles.modalMeta}>
            Altitude Vision — Altimmo{'\n'}
            Rue Mfoa n°24, Poto-Poto, Brazzaville{'\n'}
            contact@altitudevision.agency
          </Text>

          <Text style={styles.modalSection}>ENTRE LES SOUSSIGNÉS</Text>
          <Text style={styles.modalBody}>
            <Text style={styles.modalBold}>ALTITUDE VISION (L'AGENCE)</Text>{' '}— Agence multidisciplinaire spécialisée dans l'immobilier au Congo, opérant la plateforme Altimmo.{'\n\n'}
            <Text style={styles.modalBold}>LE PROPRIÉTAIRE (LE MANDANT)</Text>{' '}— Toute personne physique ou morale s'inscrivant sur la plateforme en tant que Propriétaire et acceptant les présentes conditions.
          </Text>

          {[
            {
              titre: 'Article 1 — OBJET DU CONTRAT',
              corps: `Le présent contrat définit les conditions dans lesquelles le Mandant confie à Altitude Vision le mandat de gérer la mise en location de son (ses) bien(s) immobilier(s) via la plateforme altitudevision.agency/altimmo.`,
            },
            {
              titre: 'Article 2 — DURÉE DU CONTRAT',
              corps: `Le présent contrat prend effet à la date d'acceptation en ligne par le Mandant et est conclu pour une durée indéterminée. Il peut être résilié par chacune des parties avec un préavis de 30 jours adressé par email.`,
            },
            {
              titre: `Article 3 — OBLIGATIONS DE L'AGENCE`,
              corps: `• Publier les annonces du Mandant sur la plateforme Altimmo
• Assurer la mise en relation avec les locataires potentiels
• Percevoir la commission locataire et reverser la part du Mandant
• Assurer le suivi des dossiers de location`,
            },
            {
              titre: 'Article 4 — OBLIGATIONS DU MANDANT',
              corps: `• Fournir des informations exactes concernant son (ses) bien(s)
• Être le propriétaire légal ou avoir mandat du propriétaire légal
• Informer l'Agence de tout changement affectant la disponibilité du bien
• Ne pas contourner l'Agence en concluant directement avec un locataire présenté`,
            },
            {
              titre: 'Article 5 — CONDITIONS DE RÉMUNÉRATION',
              corps: `• L'Agence perçoit une commission équivalente à 80 % du premier loyer mensuel
• Le Mandant reçoit 30 % de cette commission (soit ~24 % du loyer)

Exemple : pour un loyer de 150 000 FCFA → votre gain : 36 000 FCFA`,
            },
            {
              titre: 'Article 6 — CONFIDENTIALITÉ',
              corps: `Les parties s'engagent à préserver la confidentialité des informations échangées dans le cadre du présent contrat. Les données personnelles sont traitées conformément à la réglementation en vigueur.`,
            },
            {
              titre: 'Article 7 — RÉSOLUTION DES LITIGES',
              corps: `En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut d'accord dans un délai de 30 jours, le différend sera soumis au tribunal compétent de Brazzaville, République du Congo.`,
            },
            {
              titre: 'Article 8 — DISPOSITIONS GÉNÉRALES',
              corps: `Le présent contrat est régi par le droit congolais. Toute modification doit faire l'objet d'un avenant écrit signé par les deux parties. La nullité d'une clause n'entraîne pas la nullité du contrat dans son ensemble.`,
            },
          ].map((art, i) => (
            <View key={i} style={styles.modalArticle}>
              <Text style={styles.modalArtTitle}>{art.titre}</Text>
              <Text style={styles.modalBody}>{art.corps}</Text>
            </View>
          ))}

          <View style={styles.modalSignature}>
            <Text style={styles.modalSection}>ACCEPTATION NUMÉRIQUE</Text>
            <Text style={styles.modalBody}>
              En cochant les cases d'engagement et en appuyant sur "S'inscrire", vous acceptez électroniquement les termes du présent contrat. Un exemplaire PDF vous sera envoyé par email après validation de votre compte.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.modalCloseFullBtn} onPress={onClose}
            activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Fermer le contrat">
            <Text style={styles.modalCloseFullTxt}>J'ai lu le contrat — Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── RegisterScreen ──────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { register, loginWithGoogle } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT,
      offlineAccess: false,
    });
  }, []);

  // Rôle par défaut 'Client' — CompleterProfilScreen permettra de choisir
  // Propriétaire (+ téléphone + certifications) pour un nouveau compte ;
  // AppNavigator y bascule automatiquement via needsProfileCompletion.
  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      if (!idToken) throw new Error('Pas de idToken reçu');
      await loginWithGoogle({ idToken, role: 'Client' });
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (error.code === statusCodes.IN_PROGRESS) return;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Erreur', 'Google Play Services requis.');
        return;
      }
      console.log('Google Sign-In error code:', error.code);
      console.log('Google Sign-In error message:', error.message);
      console.log('Google Sign-In error full:', JSON.stringify(error));
      Alert.alert('Erreur', `Code: ${error.code}\n${error.message}`);
    }
  };

  const [step, setStep] = useState(1);
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [passwordConfirm, setPassConf] = useState('');
  const [role, setRole]               = useState('Client');
  const [showPass, setShowPass]       = useState(false);
  const [showPassConf, setShowPassConf] = useState(false);
  const [certs, setCerts] = useState({
    contratAccepte: false, informationsVraies: false, estProprietaireLegal: false,
    engagementHonnetete: false, commissionAcceptee: false,
  });
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');
  const [contratOpen, setContratOpen] = useState(false);

  const emailRef    = useRef(null);
  const passRef     = useRef(null);
  const passConfRef = useRef(null);

  const isProprietaire  = role === 'Proprietaire';
  const allCertsChecked = Object.values(certs).every(Boolean);

  const validateStep1 = useCallback(() => {
    if (!name.trim() || !email.trim() || !password || !passwordConfirm) {
      setErreur('Tous les champs sont requis');
      return false;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErreur('Adresse email invalide');
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
  }, [name, email, password, passwordConfirm]);

  const toggleCert = useCallback((key) => {
    setCerts(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const goNext = useCallback(() => {
    if (validateStep1()) setStep(2);
  }, [validateStep1]);

  const goBack = useCallback(() => {
    setErreur('');
    setStep(s => Math.max(1, s - 1));
  }, []);

  const handleStep2Next = useCallback(() => {
    setErreur('');
    if (isProprietaire) { setStep(3); } else { handleRegister(); }
  }, [isProprietaire]);

  const handleRegister = useCallback(async () => {
    if (isProprietaire && !allCertsChecked) {
      setErreur('Cochez tous les engagements pour continuer');
      return;
    }
    setLoading(true);
    setErreur('');
    try {
      const base = { name: name.trim(), email: email.trim().toLowerCase(), password, passwordConfirm, role };
      await register(isProprietaire ? { ...base, ...certs } : base);
      setStep(4); // écran de confirmation
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }, [isProprietaire, allCertsChecked, name, email, password, passwordConfirm, role, certs, register]);

  // ─── Stepper ─────────────────────────────────────────────────────
  const renderStepper = () => {
    const totalSteps = isProprietaire ? 3 : 2;
    return (
      <View style={styles.stepper}>
        {[1, 2, 3].map((n, idx) => {
          const isNA        = n === 3 && !isProprietaire;
          const isCompleted = n < step && !isNA;
          const isActive    = n === step && !isNA;
          const showBar     = idx < 2;

          return (
            <React.Fragment key={n}>
              <View style={[styles.stepCol, isNA && styles.stepColNA]}>
                <View style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isActive    && styles.dotActive,
                  !isCompleted && !isActive && styles.dotFuture,
                ]}>
                  {isCompleted
                    ? <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    : <Text style={isActive ? styles.dotNumActive : styles.dotNumFuture}>{n}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, isActive && styles.stepLabelActive, isNA && styles.stepLabelNA]}>
                  {STEP_LABELS[n - 1]}
                </Text>
              </View>
              {showBar && (
                <View style={[styles.bar, (step > n || (isNA && n < 2)) && styles.barCompleted]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  // ─── Écran de confirmation ────────────────────────────────────────
  if (step === 4) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.confirmWrap}>
          <LinearGradient
            colors={['#0A0A0A', '#1C1408', '#2D1E04']}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.confirmInner}>
            <View style={styles.confirmIcon}>
              <Ionicons name="checkmark" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.confirmTitle}>Inscription réussie !</Text>
            <Text style={styles.confirmSub}>
              Un email de confirmation a été envoyé à{'\n'}
              <Text style={styles.confirmEmail}>{email.trim().toLowerCase()}</Text>
              {'\n'}Vérifiez votre boîte mail pour activer votre compte.
            </Text>
            <Button
              label="Se connecter"
              variant="primary"
              onPress={() => navigation.navigate('Login')}
              style={styles.confirmBtn}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero ──────────────────────────────────────────── */}
          <ImmobilierHero title="Créer un compte" subtitle="Rejoignez la communauté Altimmo" imageUri="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80" />

          {/* ─── Carte formulaire ──────────────────────────────── */}
          <View style={styles.card}>
            {renderStepper()}

            {/* ─── Étape 1 — Infos ─────────────────────── */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
                {/* Nom */}
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
                      placeholderTextColor={c.placeholder}
                      cursorColor={c.gold}
                      selectionColor={c.borderGold}
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      accessibilityLabel="Nom complet"
                    />
                  </View>
                </View>

                {/* Email */}
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
                      placeholderTextColor={c.placeholder}
                      cursorColor={c.gold}
                      selectionColor={c.borderGold}
                      returnKeyType="next"
                      onSubmitEditing={() => passRef.current?.focus()}
                      accessibilityLabel="Adresse email"
                    />
                  </View>
                </View>

                <PasswordField
                  label="Mot de passe"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErreur(''); }}
                  show={showPass}
                  onToggleShow={() => setShowPass(v => !v)}
                  placeholder="Min. 8 caractères"
                  styles={styles} c={c}
                  inputRef={passRef}
                  returnKeyType="next"
                  onSubmitEditing={() => passConfRef.current?.focus()}
                />

                <PasswordField
                  label="Confirmer le mot de passe"
                  value={passwordConfirm}
                  onChangeText={(v) => { setPassConf(v); setErreur(''); }}
                  show={showPassConf}
                  onToggleShow={() => setShowPassConf(v => !v)}
                  placeholder="Saisissez à nouveau"
                  styles={styles} c={c}
                  inputRef={passConfRef}
                  returnKeyType="done"
                  onSubmitEditing={goNext}
                />

                {erreur ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.errorWrap}>
                    <Ionicons name="alert-circle-outline" size={15} color={c.error} />
                    <Text style={styles.errorText}>{erreur}</Text>
                  </Animated.View>
                ) : null}

                <Button label="Suivant" onPress={goNext} variant="primary" style={styles.ctaBtn} />

                {/* ─── Séparateur ─── */}
                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>ou continuer avec</Text>
                  <View style={styles.separatorLine} />
                </View>

                {/* ─── Google ─── */}
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={() => handleGoogleSignIn()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="S'inscrire avec Google"
                >
                  <AntDesign name="google" size={18} color="#EA4335" />
                  <Text style={styles.googleBtnText}>S'inscrire avec Google</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ─── Étape 2 — Profil ─────────────────────── */}
            {step === 2 && (
              <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
                <Text style={styles.stepHeading}>Quel est votre profil ?</Text>
                <Text style={styles.stepSubheading}>Choisissez votre rôle pour personnaliser votre expérience</Text>

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
                      >
                        <Card selected={selected} style={!selected && styles.roleCardUnselected}>
                          <View style={styles.roleCardInner}>
                            <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                              <Ionicons
                                name={r.icon}
                                size={22}
                                color={selected ? c.gold : c.textSub}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{r.label}</Text>
                              <Text style={styles.roleDesc}>{r.desc}</Text>
                            </View>
                            {selected
                              ? <Ionicons name="checkmark-circle" size={20} color={c.gold} />
                              : <Ionicons name="radio-button-off" size={20} color={c.border} />
                            }
                          </View>
                        </Card>
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

                <View style={styles.actionsRow}>
                  <Button label="Précédent" onPress={goBack} variant="outline" style={{ flex: 1 }} />
                  <Button
                    label={isProprietaire ? 'Suivant' : "S'inscrire"}
                    onPress={handleStep2Next}
                    loading={!isProprietaire && loading}
                    variant="primary"
                    style={{ flex: 1 }}
                  />
                </View>
              </Animated.View>
            )}

            {/* ─── Étape 3 — Engagements (propriétaire) ─── */}
            {step === 3 && (
              <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
                <Text style={styles.stepHeading}>Engagements propriétaire</Text>
                <Text style={styles.stepSubheading}>
                  Lisez et acceptez chaque engagement pour finaliser votre inscription
                </Text>

                {/* Bouton dérouler le contrat */}
                <TouchableOpacity
                  style={styles.contratBtn}
                  onPress={() => setContratOpen(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Lire le contrat de partenariat"
                >
                  <Ionicons name="document-text-outline" size={18} color="#C8960C" />
                  <Text style={styles.contratBtnText}>Lire le contrat de partenariat</Text>
                  <Ionicons name="chevron-forward-outline" size={16} color="#C8960C" />
                </TouchableOpacity>

                <ContractModal
                  visible={contratOpen}
                  onClose={() => setContratOpen(false)}
                  c={c}
                  styles={styles}
                />

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

                {/* Progression certs */}
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
                    label="S'inscrire"
                    onPress={handleRegister}
                    loading={loading}
                    disabled={!allCertsChecked}
                    variant="primary"
                    style={{ flex: 1 }}
                  />
                </View>
              </Animated.View>
            )}

            {/* ─── Lien vers Login ──────────────────────── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Déjà un compte ? Se connecter"
            >
              <Text style={styles.loginLinkText}>
                Déjà un compte ?{' '}
                <Text style={styles.loginLinkAccent}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
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
    height: 220,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  logoWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  logo: {
    width: 70,
    height: 70,
    opacity: 0.9,
  },
  heroTitle: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 30,
    color: '#F0EDE8',
    lineHeight: 36,
    marginBottom: spacing.xs,
  },
  heroSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(240,237,232,0.5)',
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

  // ─── Stepper ───
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stepCol: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepColNA: {
    opacity: 0.3,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotActive: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  dotCompleted: {
    backgroundColor: c.success,
    borderColor: c.success,
  },
  dotFuture: {
    backgroundColor: 'transparent',
    borderColor: c.border,
  },
  dotNumActive: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    color: '#0A0A0A',
  },
  dotNumFuture: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    color: c.textMuted,
  },
  bar: {
    flex: 1,
    height: 2,
    backgroundColor: c.border,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  barCompleted: {
    backgroundColor: c.success,
  },
  stepLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    fontFamily: 'DMSans-Bold',
    color: c.gold,
  },
  stepLabelNA: {
    color: c.textMuted,
  },

  // ─── Heading étapes ───
  stepHeading: {
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    color: c.text,
    marginBottom: spacing.xs,
  },
  stepSubheading: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: c.textSub,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },

  // ─── Champs ───
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
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
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: c.text,
    paddingVertical: spacing.sm,
  },
  eye: {
    padding: spacing.xs,
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
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: c.error,
    flex: 1,
  },

  // ─── CTA btn ───
  ctaBtn: {
    marginTop: spacing.xs,
  },

  // ─── Séparateur ───
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  separatorText: {
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
  },
  googleBtnDisabled: {
    opacity: 0.45,
  },
  googleBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.md,
    color: c.text,
  },

  // ─── Cartes rôle ───
  rolesCol: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleCardUnselected: {
    borderWidth: 1,
  },
  roleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: {
    backgroundColor: 'rgba(200,150,12,0.12)',
  },
  roleLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    color: c.text,
    marginBottom: 2,
  },
  roleLabelSelected: {
    color: c.gold,
  },
  roleDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: c.textSub,
  },

  // ─── Certs ───
  certsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  certsProgress: {
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  certsProgressBar: {
    height: 4,
    backgroundColor: c.gold,
    borderRadius: 2,
  },
  certsProgressLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },

  // ─── Actions ───
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  // ─── Lien login ───
  loginLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  loginLinkText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: c.textSub,
  },
  loginLinkAccent: {
    fontFamily: 'DMSans-Bold',
    color: c.gold,
  },

  // ─── Bouton contrat ───
  contratBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(200,150,12,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.3)',
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  contratBtnText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: '#C8960C',
  },

  // ─── Modal contrat ───
  modalRoot: {
    flex: 1,
    backgroundColor: c.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.bgCard,
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseTxt: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: c.textMuted,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 17,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalSection: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: c.gold,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  modalArticle: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: c.bgCard,
    borderRadius: radius.xs,
    borderLeftWidth: 3,
    borderLeftColor: c.gold,
  },
  modalArtTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.text,
    marginBottom: 6,
  },
  modalBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: c.textSub,
    lineHeight: 20,
  },
  modalBold: {
    fontFamily: fonts.bodyBold,
    color: c.text,
  },
  modalSignature: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(200,150,12,0.06)',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.2)',
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bgCard,
  },
  modalCloseFullBtn: {
    backgroundColor: c.gold,
    borderRadius: radius.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCloseFullTxt: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
  },

  // ─── Écran de confirmation ───
  confirmWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmInner: {
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 320,
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  confirmTitle: {
    fontFamily: 'CormorantGaramond-Bold',
    fontSize: 28,
    color: '#F0EDE8',
    textAlign: 'center',
  },
  confirmSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(240,237,232,0.65)',
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmEmail: {
    fontFamily: 'DMSans-Bold',
    color: 'rgba(240,237,232,0.9)',
  },
  confirmBtn: {
    marginTop: spacing.md,
    width: '100%',
  },
});
