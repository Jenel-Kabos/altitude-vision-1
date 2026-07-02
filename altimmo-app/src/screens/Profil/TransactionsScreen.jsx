import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import { getMyTransactions } from '../../services/transactionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';

const dateStr = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_CFG = {
  'Réussie':             { icon: 'checkmark-circle', color: '#16A34A', bg: '#F0FDF4', label: 'Réussie'             },
  'En cours':            { icon: 'time-outline',     color: '#185FA5', bg: '#EFF6FF', label: 'En cours'            },
  'Paiement en attente': { icon: 'alert-circle',     color: '#C8960C', bg: '#FFFBEB', label: 'Paiement en attente' },
  'Annulée':             { icon: 'close-circle',     color: '#A32D2D', bg: '#FEF2F2', label: 'Annulée'             },
  'Litigée':             { icon: 'warning',          color: '#A32D2D', bg: '#FEF2F2', label: 'Litigée'             },
};

const PAYMENT_LABELS = {
  non_initié: { label: 'Paiement requis',    color: '#C8960C' },
  en_attente: { label: 'Paiement en attente', color: '#2E7BB5' },
  confirmé:   { label: 'Paiement confirmé',  color: '#16A34A' },
  échoué:     { label: 'Paiement échoué',    color: '#D42B2B' },
  remboursé:  { label: 'Remboursé',          color: '#64748B' },
};

const TYPE_CFG = {
  vente:    { label: 'Vente',    color: '#185FA5' },
  location: { label: 'Location', color: '#C8960C' },
};

const FILTERS = [
  { key: 'all',                  label: 'Toutes'    },
  { key: 'En cours',             label: 'En cours'  },
  { key: 'Paiement en attente',  label: 'À finaliser'},
  { key: 'Réussie',              label: 'Réussies'  },
  { key: 'Annulée',              label: 'Annulées'  },
];

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function KpiBar({ transactions, styles, c }) {
  const reussies = transactions.filter((t) => t.status === 'Réussie');
  const montant  = reussies.reduce((s, t) => s + (t.finalAmount || 0), 0);

  return (
    <View style={styles.kpiBar}>
      <View style={styles.kpiItem}>
        <Text style={[styles.kpiValue, { color: c.blue || colors.blue }]}>{transactions.length}</Text>
        <Text style={styles.kpiLabel}>Total</Text>
      </View>
      <View style={styles.kpiSep} />
      <View style={styles.kpiItem}>
        <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{reussies.length}</Text>
        <Text style={styles.kpiLabel}>Réussies</Text>
      </View>
      <View style={styles.kpiSep} />
      <View style={styles.kpiItem}>
        <Text style={[styles.kpiValue, { color: colors.gold }]} numberOfLines={1}>{fmt(montant)}</Text>
        <Text style={styles.kpiLabel}>Montant total</Text>
      </View>
    </View>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────

function TxCard({ tx, index, styles, c }) {
  const navigation = useNavigation();
  const status   = STATUS_CFG[tx.status] || STATUS_CFG['En cours'];
  const type     = TYPE_CFG[tx.transactionType] || { label: tx.transactionType, color: '#64748B' };
  const payLabel = PAYMENT_LABELS[tx.paymentStatus] || PAYMENT_LABELS['non_initié'];

  const goToPaiement = () => {
    navigation.navigate('Profil', {
      screen: 'Paiement',
      params: {
        transactionId: tx._id,
        montant:       tx.finalAmount,
        bien:          tx.property?.title || '',
        type:          tx.transactionType === 'vente' ? 'Vente' : 'Location',
        description:   `${tx.transactionType === 'vente' ? 'Achat' : 'Location'} — ${tx.property?.title || 'bien immobilier'}`,
      },
    });
  };

  const canPay = !['Annulée', 'Réussie'].includes(tx.status) && tx.paymentStatus !== 'confirmé';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(280).springify().damping(18)}>
      <View style={styles.card}>
        {/* Top row */}
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {tx.property?.title || 'Bien immobilier'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: `${type.color}18` }]}>
                <Text style={[styles.badgeText, { color: type.color }]}>{type.label}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={11} color={status.color} />
                <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardAmount}>{fmt(tx.finalAmount)}</Text>
            {tx.commission?.total > 0 && (
              <Text style={styles.cardCommission}>
                Commission : {fmt(tx.commission.total)}
              </Text>
            )}
          </View>
        </View>

        {/* Statut paiement */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Ionicons name="wallet-outline" size={13} color={payLabel.color} />
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: payLabel.color }}>
            {payLabel.label}
          </Text>
        </View>

        {/* Separator */}
        <View style={styles.cardSep} />

        {/* Meta row + bouton payer */}
        <View style={[styles.metaRow, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            {tx.agent?.name && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={12} color={colors.blue} />
                <Text style={styles.metaText} numberOfLines={1}>{tx.agent.name}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={colors.gold} />
              <Text style={styles.metaText}>{dateStr(tx.transactionDate)}</Text>
            </View>
            {tx.linkedInvoice && (
              <View style={styles.metaItem}>
                <Ionicons name="receipt-outline" size={12} color="#16A34A" />
                <Text style={[styles.metaText, { color: '#16A34A' }]}>Facture</Text>
              </View>
            )}
          </View>
          {canPay && (
            <TouchableOpacity
              onPress={goToPaiement}
              style={{ backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Payer ce dossier"
            >
              <Ionicons name="card-outline" size={14} color="#0A0A0A" />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: '#0A0A0A' }}>Payer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filter, styles }) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="swap-horizontal-outline" size={48} color="rgba(200,150,12,0.3)" />
      <Text style={styles.emptyTitle}>Aucune transaction</Text>
      <Text style={styles.emptyBody}>
        {filter === 'all'
          ? "Vous n'avez pas encore de transactions immobilières."
          : `Aucune transaction « ${filter} » pour l'instant.`}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TransactionsScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [filter, setFilter]             = useState('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getMyTransactions();
      setTransactions(data);
    } catch {
      setError("Impossible de charger vos transactions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.status === filter);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={c.text || colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes transactions</Text>
        <TouchableOpacity onPress={() => load(false)} style={styles.refreshBtn} accessibilityLabel="Rafraîchir">
          <Ionicons name="refresh-outline" size={20} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadText}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error || '#A32D2D'} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />
          }
          ListHeaderComponent={
            <>
              {transactions.length > 0 && (
                <KpiBar transactions={transactions} styles={styles} c={c} />
              )}
              {/* Filters */}
              <View style={styles.filterRow}>
                {FILTERS.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[styles.filterBtn, filter === key && styles.filterBtnActive]}
                    accessibilityState={{ selected: filter === key }}
                  >
                    <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={<EmptyState filter={filter} styles={styles} />}
          renderItem={({ item, index }) => (
            <TxCard tx={item} index={index} styles={styles} c={c} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c) {
  const bg    = c?.bg    || colors.bg;
  const card  = c?.bgCard || colors.bgCard;
  const text  = c?.text  || colors.text;
  const sub   = c?.textSub  || colors.textSub;
  const muted = c?.textMuted || colors.textMuted;
  const border = c?.border || colors.border;

  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: bg },

    // Header
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border, backgroundColor: card },
    backBtn:     { padding: 4, marginRight: 8 },
    refreshBtn:  { padding: 4, marginLeft: 'auto' },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: '700', color: text, flex: 1 },

    // Loading / error
    loadWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadText:  { fontFamily: fonts.body, fontSize: fontSize.sm, color: muted },
    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
    errorText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.error || '#A32D2D', textAlign: 'center' },
    retryBtn:  { marginTop: 4, paddingVertical: 8, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: `${colors.blue}15` },
    retryText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.blue, fontWeight: '600' },

    // KPI bar
    kpiBar:   { flexDirection: 'row', backgroundColor: card, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: border },
    kpiItem:  { flex: 1, alignItems: 'center', gap: 2 },
    kpiSep:   { width: 1, backgroundColor: border, marginVertical: 4 },
    kpiValue: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: '700', color: text },
    kpiLabel: { fontFamily: fonts.body, fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Filters
    filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 8, flexWrap: 'wrap' },
    filterBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: border, backgroundColor: card },
    filterBtnActive: { borderColor: colors.blue, backgroundColor: `${colors.blue}12` },
    filterText:      { fontFamily: fonts.body, fontSize: fontSize.xs, color: muted },
    filterTextActive: { color: colors.blue, fontWeight: '600' },

    // List
    list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },

    // Card
    card:      { backgroundColor: card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: border },
    cardRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cardLeft:  { flex: 1, gap: 6 },
    cardRight: { alignItems: 'flex-end', flexShrink: 0 },
    cardTitle: { fontFamily: fonts.body, fontSize: fontSize.md, fontWeight: '700', color: text },
    cardAmount: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: '700', color: colors.gold },
    cardCommission: { fontFamily: fonts.body, fontSize: 10, color: muted, marginTop: 2 },

    // Badges
    badgeRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    badge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
    badgeText:  { fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },

    // Card separator
    cardSep: { height: 1, backgroundColor: border, marginVertical: spacing.sm },

    // Meta
    metaRow:  { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontFamily: fonts.body, fontSize: 12, color: sub },

    // Empty
    emptyWrap:  { alignItems: 'center', justifyContent: 'center', padding: spacing.xl * 2, gap: 12 },
    emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, fontWeight: '700', color: text },
    emptyBody:  { fontFamily: fonts.body, fontSize: fontSize.sm, color: muted, textAlign: 'center', lineHeight: 20 },
  });
}
