import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { colors, typography, spacing } from '../../theme';
import api from '../../services/api';

const MODES = [
  {
    id: 'mtn',
    label: 'MTN Mobile Money',
    desc: 'Paiement via votre compte MTN',
    icon: 'phone-portrait-outline',
    bg: '#FFCC00',
    iconColor: '#000000',
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
    bg: colors.info,
    iconColor: '#FFFFFF',
    channel: 'CREDIT_CARD',
  },
];

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function PaiementScreen({ route, navigation }) {
  const {
    montant = 0,
    description = 'Paiement',
    bien = '',
    type = '',
    duree = '',
  } = route.params || {};

  const [modeSelected, setMode] = useState(null);
  const [loading, setLoading] = useState(false);

  const initierPaiement = async () => {
    if (!modeSelected) {
      Alert.alert('Mode requis', 'Choisissez un mode de paiement.');
      return;
    }
    setLoading(true);
    try {
      const mode = MODES.find(m => m.id === modeSelected);
      const transactionId = `AV-${Date.now()}`;
      const res = await api.post('/paiements/initier', {
        montant,
        description,
        transactionId,
        channels: mode.channel,
        currency: 'XAF',
      });
      const paymentUrl = res.data?.paymentUrl;
      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl);
      }
    } catch (err) {
      Alert.alert(
        'Erreur',
        err.response?.data?.message || "Impossible d'initier le paiement.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header back */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Paiement</Text>
          <Text style={styles.headerAmount}>{fmt(montant)} FCFA</Text>
          {bien ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{bien}</Text>
          ) : null}
        </View>

        {/* Méthodes de paiement */}
        <Text style={styles.sectionTitle}>Mode de paiement</Text>
        <View style={styles.methodsList}>
          {MODES.map(m => {
            const selected = modeSelected === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodCard, selected && styles.methodCardSelected]}
                onPress={() => setMode(m.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.methodIcon, { backgroundColor: m.bg }]}>
                  <Ionicons name={m.icon} size={22} color={m.iconColor} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodDesc}>{m.desc}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Récapitulatif */}
        <Text style={styles.sectionTitle}>Récapitulatif</Text>
        <View style={styles.summaryCard}>
          {bien ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bien</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{bien}</Text>
            </View>
          ) : null}
          {description ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Détail</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>{description}</Text>
            </View>
          ) : null}
          {type ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>{type}</Text>
            </View>
          ) : null}
          {duree ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Durée</Text>
              <Text style={styles.summaryValue}>{duree}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmt(montant)} FCFA</Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.securityText}>Paiement sécurisé par CinetPay</Text>
        </View>
      </ScrollView>

      {/* CTA fixe */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          onPress={initierPaiement}
          disabled={!modeSelected || loading}
          activeOpacity={0.85}
          style={[
            styles.ctaBtn,
            (!modeSelected || loading) && styles.ctaBtnDisabled,
          ]}
        >
          <Text style={styles.ctaText}>
            {loading ? 'Initialisation…' : 'Payer maintenant'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 120 },

  topRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  headerAmount: {
    ...typography.display,
    fontWeight: '800',
    color: colors.primary,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Section
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },

  // Méthodes
  methodsList: {
    paddingHorizontal: spacing.lg,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  methodDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Récap
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },

  // Security
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  securityText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // CTA
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
