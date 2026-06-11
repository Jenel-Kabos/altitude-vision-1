import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../../theme/colors';
import api from '../../services/api';

const MODES = [
  { id: 'mtn',    label: 'MTN Mobile Money',  icon: '📱', color: '#FFC107' },
  { id: 'airtel', label: 'Airtel Money',       icon: '📱', color: '#EF4444' },
  { id: 'card',   label: 'Carte bancaire',     icon: '💳', color: '#3B82F6' },
];

const fmt = (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`;

export default function PaiementScreen({ route, navigation }) {
  const { montant = 0, description = 'Paiement', bien = '' } = route.params || {};
  const [modeSelected, setMode] = useState(null);
  const [loading, setLoading]   = useState(false);

  const initierPaiement = async () => {
    if (!modeSelected) return Alert.alert('Mode requis', 'Choisissez un mode de paiement.');
    setLoading(true);
    try {
      const transactionId = `AV-${Date.now()}`;
      const res = await api.post('/paiements/initier', {
        montant,
        description,
        transactionId,
        channels: modeSelected === 'card' ? 'CREDIT_CARD' : 'MOBILE_MONEY',
        currency: 'XAF',
      });
      const paymentUrl = res.data?.paymentUrl;
      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl);
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible d\'initier le paiement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement sécurisé</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Résumé */}
      <View style={styles.summaryCard}>
        <Ionicons name="shield-checkmark-outline" size={32} color={colors.success} />
        <Text style={styles.summaryLabel}>Montant à payer</Text>
        <Text style={styles.summaryAmount}>{fmt(montant)}</Text>
        {description ? <Text style={styles.summaryDesc}>{description}</Text> : null}
        {bien ? <Text style={styles.summaryBien}>📍 {bien}</Text> : null}
      </View>

      {/* Modes de paiement */}
      <Text style={styles.sectionTitle}>Choisir le mode de paiement</Text>
      <View style={styles.modeList}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.modeCard, modeSelected === m.id && styles.modeCardActive]}
            onPress={() => setMode(m.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.modeIcon}>{m.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeLabel}>{m.label}</Text>
            </View>
            <View style={[styles.radio, modeSelected === m.id && styles.radioActive]}>
              {modeSelected === m.id && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bouton payer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={initierPaiement} disabled={!modeSelected || loading} activeOpacity={0.85}>
          <LinearGradient
            colors={(!modeSelected || loading) ? ['#555','#555'] : [colors.primaryDark, colors.primary]}
            style={styles.payBtn}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <>
                  <Ionicons name="lock-closed" size={18} color="#000" />
                  <Text style={styles.payBtnTxt}>Payer {fmt(montant)}</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.securityRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
          <Text style={styles.securityTxt}>Paiement sécurisé par CinetPay</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryCard:  { backgroundColor: colors.backgroundCard, borderRadius: 20, margin: 16, padding: 24, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  summaryAmount:{ fontSize: 32, fontWeight: '900', color: colors.primary },
  summaryDesc:  { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  summaryBien:  { fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, paddingHorizontal: 16, marginBottom: 10 },
  modeList:     { paddingHorizontal: 16, gap: 10 },
  modeCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.border },
  modeCardActive:{ borderColor: colors.primary },
  modeIcon:     { fontSize: 22 },
  modeLabel:    { fontSize: 15, fontWeight: '600', color: colors.text },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioActive:  { borderColor: colors.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  footer:       { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  payBtn:       { borderRadius: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  payBtnTxt:    { fontSize: 16, fontWeight: '800', color: '#000' },
  securityRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  securityTxt:  { fontSize: 12, color: colors.textMuted },
});
