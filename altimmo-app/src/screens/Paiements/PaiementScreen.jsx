import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { initierPaiement, verifierPaiement } from '../../services/transactionService';

// ─── Opérateurs Mobile Money ──────────────────────────────────────────────────

const OPERATORS = [
  { id: 'AIRTEL', label: 'Airtel Money', icon: 'phone-portrait-outline', bg: '#EF4444', iconColor: '#FFFFFF' },
  { id: 'MTN',    label: 'MTN Mobile Money', icon: 'phone-portrait-outline', bg: '#FFCC00', iconColor: '#0A0A0A' },
];

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_COUNT    = 36; // 36 × 5s = 3 minutes

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// ─── Carte opérateur ──────────────────────────────────────────────────────────

const OperatorCard = memo(function OperatorCard({ op, selected, onSelect, styles }) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(op.id);
  }, [op.id, onSelect]);

  return (
    <TouchableOpacity
      style={[styles.methodCard, selected && styles.methodCardSelected]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={op.label}
      accessibilityState={{ selected }}
    >
      <View style={[styles.methodIcon, { backgroundColor: op.bg }]}>
        <Ionicons name={op.icon} size={22} color={op.iconColor} />
      </View>
      <View style={styles.methodInfo}>
        <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>{op.label}</Text>
      </View>
      <View style={[styles.methodCheck, selected && styles.methodCheckSelected]}>
        {selected && <Ionicons name="checkmark" size={14} color="#0A0A0A" />}
      </View>
    </TouchableOpacity>
  );
});

// ─── Ligne récapitulatif ──────────────────────────────────────────────────────

const SummaryRow = memo(function SummaryRow({ label, value, styles, total = false }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={total ? styles.totalLabel : styles.summaryLabel}>{label}</Text>
      <Text style={[total ? styles.totalValue : styles.summaryValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
});

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function PaiementScreen({ route, navigation }) {
  const {
    transactionId = null,
    montant       = 0,
    description   = 'Paiement',
    bien          = '',
    type          = '',
    duree         = '',
  } = route.params || {};

  const { themeColors: c } = useTheme();
  const { user }  = useAuth();
  const styles    = useMemo(() => makeStyles(c), [c]);
  const insets    = useSafeAreaInsets();

  const [phone,     setPhone]     = useState('');
  const [operator,  setOperator]  = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [loading,   setLoading]   = useState(false);

  const [intentId,       setIntentId]       = useState(null);
  const [pollingStatus,  setPollingStatus]  = useState('idle'); // idle | waiting | success | failed
  const [pollingCount,   setPollingCount]   = useState(0);

  const montantFmt = useMemo(() => fmt(montant), [montant]);

  // Pré-remplit nom/prénom depuis le profil si disponible
  useEffect(() => {
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
  }, [user]);

  // ─── Handlers ───
  const handleBack     = useCallback(() => navigation.goBack(), [navigation]);
  const handleOperator  = useCallback((id) => setOperator(id), []);
  const handlePhone     = useCallback((v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 12)), []);

  const lancerPaiement = useCallback(async () => {
    if (phone.length !== 12) {
      Alert.alert('Téléphone invalide', 'Entrez un numéro au format 242XXXXXXXXX (12 chiffres).');
      return;
    }
    if (!operator) {
      Alert.alert('Opérateur requis', 'Choisissez AIRTEL ou MTN.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Identité requise', 'Renseignez votre nom et prénom.');
      return;
    }
    if (!transactionId) {
      Alert.alert('Erreur', 'Transaction introuvable. Retournez à votre dossier.');
      return;
    }
    setLoading(true);
    try {
      const result = await initierPaiement(transactionId, { phone, operator, firstName, lastName });
      setIntentId(result.intentId);
      setPollingCount(0);
      setPollingStatus('waiting');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'initier le paiement");
    } finally {
      setLoading(false);
    }
  }, [phone, operator, firstName, lastName, transactionId]);

  const annulerAttente = useCallback(() => {
    setPollingStatus('idle');
    setIntentId(null);
    setPollingCount(0);
  }, []);

  const reessayer = useCallback(() => {
    setPollingStatus('idle');
    setIntentId(null);
    setPollingCount(0);
  }, []);

  // ─── Polling du statut YabetooPay ───
  useEffect(() => {
    if (pollingStatus !== 'waiting' || !intentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await verifierPaiement(transactionId, intentId);
        if (res.statut === 'Payé') {
          clearInterval(interval);
          setPollingStatus('success');
        } else if (res.statut === 'Échoué') {
          clearInterval(interval);
          setPollingStatus('failed');
        } else {
          setPollingCount((cnt) => {
            if (cnt + 1 >= POLL_MAX_COUNT) {
              clearInterval(interval);
              setPollingStatus('failed');
            }
            return cnt + 1;
          });
        }
      } catch {
        // on ignore les erreurs réseau ponctuelles, le polling continue
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pollingStatus, intentId, transactionId]);

  const isFormDisabled = loading;
  const tempsRestant   = Math.max(0, POLL_MAX_COUNT - pollingCount) * (POLL_INTERVAL_MS / 1000);
  const minutes        = Math.floor(tempsRestant / 60);
  const secondes        = String(tempsRestant % 60).padStart(2, '0');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        >
          {/* ─── Bouton retour ─── */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Ionicons name="arrow-back" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* ─── Hero montant ─── */}
          <Animated.View entering={FadeInDown.delay(0).duration(320).springify().damping(18)} style={styles.hero}>
            <Text style={styles.heroLabel}>Montant à payer</Text>
            <Text style={styles.heroAmount}>{montantFmt} FCFA</Text>
            {bien ? <Text style={styles.heroBien} numberOfLines={1}>{bien}</Text> : null}
          </Animated.View>

          {pollingStatus === 'idle' && (
            <>
              {/* ─── Formulaire ─── */}
              <Animated.View entering={FadeInDown.delay(80).duration(300).springify().damping(18)}>
                <Text style={styles.sectionTitle}>Opérateur Mobile Money</Text>
              </Animated.View>

              <View style={styles.methodsList}>
                {OPERATORS.map((op) => (
                  <OperatorCard
                    key={op.id}
                    op={op}
                    selected={operator === op.id}
                    onSelect={handleOperator}
                    styles={styles}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Numéro de téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={handlePhone}
                placeholder="242XXXXXXXXX"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={12}
                editable={!isFormDisabled}
              />

              <Text style={styles.sectionTitle}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Votre prénom"
                placeholderTextColor={c.textMuted}
                editable={!isFormDisabled}
              />

              <Text style={styles.sectionTitle}>Nom</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Votre nom"
                placeholderTextColor={c.textMuted}
                editable={!isFormDisabled}
              />

              {/* ─── Récapitulatif ─── */}
              <Animated.View entering={FadeInDown.delay(320).duration(300).springify().damping(18)}>
                <Text style={styles.sectionTitle}>Récapitulatif</Text>
                <View style={styles.summaryCard}>
                  {bien        && <SummaryRow label="Bien"   value={bien}        styles={styles} />}
                  {description && <SummaryRow label="Détail" value={description} styles={styles} />}
                  {type        && <SummaryRow label="Type"   value={type}        styles={styles} />}
                  {duree       && <SummaryRow label="Durée"  value={duree}       styles={styles} />}
                  <View style={styles.divider} />
                  <SummaryRow label="Total" value={`${montantFmt} FCFA`} styles={styles} total />
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(400).duration(280)} style={styles.securityRow}>
                <Ionicons name="lock-closed-outline" size={13} color={c.textMuted} />
                <Text style={styles.securityText}>Paiement sécurisé par YabetooPay</Text>
              </Animated.View>
            </>
          )}

          {pollingStatus === 'waiting' && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.stateWrap}>
              <ActivityIndicator size="large" color={c.gold} />
              <Text style={styles.stateTitle}>En attente de confirmation…</Text>
              <Text style={styles.stateText}>
                Vérifiez votre téléphone et confirmez le paiement sur votre application{' '}
                {operator === 'AIRTEL' ? 'Airtel' : 'MTN'} Mobile Money.
              </Text>
              <Text style={styles.stateCountdown}>{minutes}:{secondes}</Text>
              <TouchableOpacity onPress={annulerAttente} style={styles.cancelBtn} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {pollingStatus === 'success' && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.stateWrap}>
              <View style={[styles.resultIcon, { backgroundColor: '#16A34A22' }]}>
                <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
              </View>
              <Text style={styles.stateTitle}>Paiement confirmé !</Text>
              <Text style={styles.stateText}>Votre paiement de {montantFmt} FCFA a bien été reçu.</Text>
              <TouchableOpacity onPress={handleBack} style={styles.ctaBtn} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Retour</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {pollingStatus === 'failed' && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.stateWrap}>
              <View style={[styles.resultIcon, { backgroundColor: '#DC262622' }]}>
                <Ionicons name="close-circle" size={48} color="#DC2626" />
              </View>
              <Text style={styles.stateTitle}>Paiement échoué ou expiré</Text>
              <Text style={styles.stateText}>Le paiement n'a pas pu être confirmé. Vous pouvez réessayer.</Text>
              <TouchableOpacity onPress={reessayer} style={styles.ctaBtn} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Réessayer</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ─── CTA fixe en bas (formulaire uniquement) ─── */}
      {pollingStatus === 'idle' && (
        <View style={[styles.ctaSafe, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TouchableOpacity
            onPress={lancerPaiement}
            disabled={isFormDisabled}
            activeOpacity={0.85}
            style={[styles.ctaBtn, isFormDisabled && styles.ctaBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Initialisation en cours…' : `Payer ${montantFmt} FCFA`}
            accessibilityState={{ disabled: isFormDisabled }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0A0A0A" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color="#0A0A0A" />
                <Text style={styles.ctaText}>Payer {montantFmt} FCFA</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: c.bg },
  safeTop: { flex: 1 },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // ─── Retour ───
  topRow: { marginBottom: spacing.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Hero ───
  hero: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: c.gold,
    letterSpacing: -0.5,
  },
  heroBien: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginTop: 2,
  },

  // ─── Titres sections ───
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // ─── Input texte ───
  input: {
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
  },

  // ─── Méthodes / opérateurs ───
  methodsList: { gap: spacing.sm },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  methodCardSelected: {
    borderColor: c.gold,
    backgroundColor: c.goldMuted,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo:  { flex: 1 },
  methodLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.md,
    color: c.text,
  },
  methodLabelSelected: {
    fontFamily: fonts.bodyBold,
    color: c.goldDark,
  },
  methodCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCheckSelected: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },

  // ─── Récapitulatif ───
  summaryCard: {
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: 2,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    flexShrink: 0,
  },
  summaryValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
    flexShrink: 0,
  },
  totalValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.gold,
    textAlign: 'right',
    flex: 1,
  },

  // ─── Sécurité ───
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  securityText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },

  // ─── États attente / succès / échec ───
  stateWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stateTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: c.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  stateText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
  stateCountdown: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: c.gold,
    marginTop: spacing.md,
  },
  cancelBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textDecorationLine: 'underline',
  },

  // ─── CTA ───
  ctaSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  ctaBtn: {
    backgroundColor: c.gold,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaBtnDisabled: { opacity: 0.45 },
  ctaText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
  },
});
