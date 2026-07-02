import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { initierCinetpay } from '../../services/transactionService';

// ─── Modes de paiement ───────────────────────────────────────────────────────

const MODES = [
  {
    id: 'mtn',
    label: 'MTN Mobile Money',
    desc: 'Paiement via votre compte MTN',
    icon: 'phone-portrait-outline',
    bg: '#FFCC00',
    iconColor: '#0A0A0A',
    channel: 'MOBILE_MONEY',
  },
  {
    id: 'airtel',
    label: 'Airtel Money',
    desc: 'Paiement via votre compte Airtel',
    icon: 'phone-portrait-outline',
    bg: '#EF4444',
    iconColor: '#FFFFFF',
    channel: 'MOBILE_MONEY',
  },
  {
    id: 'card',
    label: 'Carte bancaire',
    desc: 'Visa / Mastercard',
    icon: 'card-outline',
    bg: '#185FA5',
    iconColor: '#FFFFFF',
    channel: 'CREDIT_CARD',
  },
  {
    id: 'virement',
    label: 'Virement bancaire',
    desc: 'RIB + preuve de virement',
    icon: 'business-outline',
    bg: '#1E3A5F',
    iconColor: '#FFFFFF',
    channel: null,
  },
];

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// ─── Carte de méthode de paiement ────────────────────────────────────────────

const ModeCard = memo(function ModeCard({ mode, index, selected, onSelect, styles, c }) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(mode.id);
  }, [mode.id, onSelect]);

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(280).springify().damping(18)}>
      <TouchableOpacity
        style={[styles.methodCard, selected && styles.methodCardSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={mode.label}
        accessibilityState={{ selected }}
      >
        <View style={[styles.methodIcon, { backgroundColor: mode.bg }]}>
          <Ionicons name={mode.icon} size={22} color={mode.iconColor} />
        </View>

        <View style={styles.methodInfo}>
          <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
            {mode.label}
          </Text>
          <Text style={styles.methodDesc}>{mode.desc}</Text>
        </View>

        <View style={[styles.methodCheck, selected && styles.methodCheckSelected]}>
          {selected && <Ionicons name="checkmark" size={14} color="#0A0A0A" />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) => prev.selected === next.selected && prev.styles === next.styles);

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
  const styles  = useMemo(() => makeStyles(c), [c]);
  const insets  = useSafeAreaInsets();

  const [modeSelected, setMode]   = useState(null);
  const [loading,      setLoading] = useState(false);

  const montantFmt = useMemo(() => fmt(montant), [montant]);

  // ─── Handlers ───
  const handleBack   = useCallback(() => navigation.goBack(), [navigation]);
  const handleSelect = useCallback((id) => setMode(id), []);

  const initierPaiement = useCallback(async () => {
    if (!modeSelected) {
      Alert.alert('Mode requis', 'Veuillez choisir un mode de paiement.');
      return;
    }
    if (!transactionId) {
      Alert.alert('Erreur', 'Transaction introuvable. Retournez à votre dossier.');
      return;
    }
    setLoading(true);
    try {
      if (modeSelected === 'virement') {
        navigation.navigate('Profil', {
          screen: 'VirementScreen',
          params: { transactionId, montant, bien },
        });
        return;
      }

      const data = await initierCinetpay(transactionId, {
        methode:  modeSelected === 'card' ? 'cinetpay_carte' : 'cinetpay_mobile',
        provider: modeSelected,
      });

      if (data?.paymentUrl) {
        const result = await WebBrowser.openBrowserAsync(data.paymentUrl);
        if (result.type === 'dismiss' || result.type === 'cancel') {
          navigation.goBack();
        }
      }
    } catch (err) {
      Alert.alert(
        'Erreur de paiement',
        err.response?.data?.message || "Impossible d'initier le paiement. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }, [modeSelected, transactionId, montant, bien, navigation]);

  const isDisabled = !modeSelected || loading;

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
          <Animated.View
            entering={FadeInDown.delay(0).duration(320).springify().damping(18)}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Montant à payer</Text>
            <Text style={styles.heroAmount}>{montantFmt} FCFA</Text>
            {bien ? (
              <Text style={styles.heroBien} numberOfLines={1}>{bien}</Text>
            ) : null}
          </Animated.View>

          {/* ─── Méthodes de paiement ─── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(300).springify().damping(18)}
          >
            <Text style={styles.sectionTitle}>Mode de paiement</Text>
          </Animated.View>

          <View style={styles.methodsList}>
            {MODES.map((m, i) => (
              <ModeCard
                key={m.id}
                mode={m}
                index={i}
                selected={modeSelected === m.id}
                onSelect={handleSelect}
                styles={styles}
                c={c}
              />
            ))}
          </View>

          {/* ─── Récapitulatif ─── */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(300).springify().damping(18)}
          >
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            <View style={styles.summaryCard}>
              {bien        && <SummaryRow label="Bien"   value={bien}        styles={styles} />}
              {description && <SummaryRow label="Détail" value={description} styles={styles} />}
              {type        && <SummaryRow label="Type"   value={type}        styles={styles} />}
              {duree       && <SummaryRow label="Durée"  value={duree}       styles={styles} />}

              <View style={styles.divider} />

              <SummaryRow
                label={`Total`}
                value={`${montantFmt} FCFA`}
                styles={styles}
                total
              />
            </View>
          </Animated.View>

          {/* ─── Mention sécurité ─── */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(280)}
            style={styles.securityRow}
          >
            <Ionicons name="lock-closed-outline" size={13} color={c.textMuted} />
            <Text style={styles.securityText}>Paiement sécurisé par CinetPay</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* ─── CTA fixe en bas ─── */}
      <View style={[styles.ctaSafe, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          onPress={initierPaiement}
          disabled={isDisabled}
          activeOpacity={0.85}
          style={[styles.ctaBtn, isDisabled && styles.ctaBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Initialisation en cours…' : `Payer ${montantFmt} FCFA`}
          accessibilityState={{ disabled: isDisabled }}
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

  // ─── Méthodes ───
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
  methodDesc: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
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
