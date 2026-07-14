import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { cache } from '../../services/cacheService';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import IllustrationNoVisites from '../../components/illustrations/IllustrationNoVisites';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const DAYS_SHORT  = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const formatVisiteDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()} à ${h}h${m}`;
};

const isActive = (v) => v.statut !== 'Annulée' && v.statut !== 'Terminée';

// ─── VisiteCard ───────────────────────────────────────────────────────────────
const VisiteCard = React.memo(function VisiteCard({ item, onCancel, showCancel, styles, c }) {
  const property  = item.property || {};
  const title     = property.title || 'Bien immobilier';
  const arrond    = property.address?.arrondissement || '';
  const city      = property.address?.city || '';
  const address   = [arrond, city].filter(Boolean).join(', ');
  const imgUri    = property.images?.[0];
  const statut    = (item.statut || 'en attente').toLowerCase();
  const dateStr   = item.dateConfirmee || item.dateProposee;
  const dateLabel = dateStr ? formatVisiteDate(dateStr) : 'En attente de proposition';
  const isPending = !dateStr;

  const { color, bg, border, icon } = useMemo(() => {
    if (statut === 'confirmée' || statut === 'confirmee')
      return { color: c.success, bg: 'rgba(56,161,105,0.12)',  border: 'rgba(56,161,105,0.3)',  icon: 'checkmark-circle' };
    if (statut === 'annulée' || statut === 'annulee')
      return { color: c.error,   bg: 'rgba(229,62,62,0.12)',   border: 'rgba(229,62,62,0.3)',   icon: 'close-circle' };
    if (statut === 'terminée' || statut === 'terminee')
      return { color: c.textSub, bg: 'rgba(100,100,100,0.12)', border: 'rgba(100,100,100,0.3)', icon: 'checkmark-done-circle' };
    return   { color: c.warning, bg: 'rgba(221,107,32,0.12)',  border: 'rgba(221,107,32,0.3)',  icon: 'time-outline' };
  }, [statut, c]);

  return (
    <View style={styles.card}>
      {/* ─── Image thumb ─── */}
      {imgUri ? (
        <Image
          source={{ uri: imgUri }}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="home-outline" size={24} color={c.gold} />
        </View>
      )}

      {/* ─── Corps ─── */}
      <View style={styles.cardBody}>
        {/* Badge statut */}
        <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
          <Ionicons name={icon} size={12} color={color} />
          <Text style={[styles.badgeText, { color }]}>{item.statut || 'En attente'}</Text>
        </View>

        {/* Titre */}
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>

        {/* Adresse */}
        {address ? (
          <View style={styles.addrRow}>
            <Ionicons name="location-outline" size={12} color={c.textMuted} />
            <Text style={styles.addrText} numberOfLines={1}>{address}</Text>
          </View>
        ) : null}

        {/* Date */}
        <View style={styles.dateRow}>
          <Ionicons
            name={isPending ? 'hourglass-outline' : 'calendar-outline'}
            size={13}
            color={isPending ? c.warning : c.textSub}
          />
          <Text style={[styles.dateText, isPending && styles.datePending]}>
            {dateLabel}
          </Text>
        </View>

        {/* Note du propriétaire */}
        {item.note ? (
          <View style={styles.noteWrap}>
            <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text>
          </View>
        ) : null}

        {/* Bouton annuler */}
        {showCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Annuler la visite pour ${title}`}
          >
            <Ionicons name="close-circle-outline" size={15} color={c.error} />
            <Text style={styles.cancelBtnText}>Annuler la visite</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}, (prev, next) =>
  prev.item._id === next.item._id &&
  prev.item.statut === next.item.statut &&
  prev.showCancel === next.showCancel &&
  prev.styles === next.styles);

// ─── VisitesScreen ────────────────────────────────────────────────────────────
export default function VisitesScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [visites, setVisites]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]             = useState('venir');

  const chargerVisites = useCallback(async (forceRefresh = false) => {
    const KEY = 'visites:my';
    if (!forceRefresh) {
      const hit = cache.get(KEY);
      if (hit) { setVisites(hit); setLoading(false); return; }
    }
    try {
      const res  = await api.get('/visites/my');
      const data = res.data?.data?.visites || [];
      const list = Array.isArray(data) ? data : [];
      cache.set(KEY, list, 2 * 60 * 1000);
      setVisites(list);
    } catch {
      setVisites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { chargerVisites(); }, [chargerVisites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    chargerVisites(true);
  }, [chargerVisites]);

  const annulerVisite = useCallback((visite) => {
    const dateAffichee = formatVisiteDate(visite.dateConfirmee || visite.dateProposee);
    const msg = dateAffichee
      ? `Confirmer l'annulation de la visite du ${dateAffichee} ?`
      : "Confirmer l'annulation de cette demande de visite ?";

    Alert.alert('Annuler la visite', msg, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler la visite', style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/visites/${visite._id}/cancel`);
            cache.invalidate('visites:');
            chargerVisites(true);
          } catch {
            Alert.alert('Erreur', "Impossible d'annuler la visite.");
          }
        },
      },
    ]);
  }, [chargerVisites]);

  const filtered = useMemo(() =>
    visites.filter(v => tab === 'venir' ? isActive(v) : !isActive(v)),
  [visites, tab]);

  const renderVisite = useCallback(({ item }) => (
    <VisiteCard
      item={item}
      onCancel={() => annulerVisite(item)}
      showCancel={tab === 'venir'}
      styles={styles}
      c={c}
    />
  ), [annulerVisite, tab, styles, c]);

  const keyExtractor = useCallback((item) => item._id || item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <PageHeader
        title="Mes visites"
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      {/* ─── Tabs ────────────────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        {[
          { key: 'venir',   label: 'À venir', icon: 'calendar-outline' },
          { key: 'passees', label: 'Passées',  icon: 'checkmark-done-outline' },
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Voir les visites ${t.label.toLowerCase()}`}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? '#0A0A0A' : c.textMuted}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
              {t.key === 'venir' && filtered.length > 0 && active && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{filtered.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Liste ───────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderVisite}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.gold}
            colors={[c.gold]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            illustration={IllustrationNoVisites}
            title={tab === 'venir' ? 'Aucune visite à venir' : 'Aucune visite passée'}
            subtitle={tab === 'venir' ? 'Demandez une visite depuis une annonce.' : ''}
          />
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  // ─── Tabs ───
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: c.bgCard,
    borderRadius: 100,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 100,
  },
  tabActive: { backgroundColor: c.gold },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  tabTextActive: {
    fontFamily: fonts.bodyBold,
    color: '#0A0A0A',
  },
  tabBadge: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#0A0A0A',
  },

  // ─── Liste ───
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },

  // ─── Card ───
  card: {
    backgroundColor: c.bgCard,
    borderRadius: radius.sm,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
  },

  // ─── Thumb ───
  thumb: {
    width: 90,
    aspectRatio: 3 / 4,
    backgroundColor: c.bgCardAlt,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Corps ───
  cardBody: {
    flex: 1,
    padding: spacing.sm,
    gap: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
    lineHeight: 20,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addrText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
    flex: 1,
  },
  datePending: {
    fontFamily: fonts.bodyItalic,
    color: c.warning,
  },
  noteWrap: {
    backgroundColor: c.bgCardAlt,
    borderRadius: 6,
    padding: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: c.gold,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
    lineHeight: 16,
  },

  // ─── Bouton annuler ───
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(229,62,62,0.4)',
    backgroundColor: 'rgba(229,62,62,0.07)',
  },
  cancelBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: c.error,
  },
});
