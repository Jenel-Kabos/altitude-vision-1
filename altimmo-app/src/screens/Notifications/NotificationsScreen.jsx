import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fonts, fontSize, spacing } from '../../theme';
import api from '../../services/api';
import {
  getNotifications,
  markRead,
  markAllRead,
  clearRead,
} from '../../services/notificationApiService';
import { connectSocket, getSocket } from '../../services/socketService';
import { getCurrentUserId } from '../../services/notificationsService';

// ─── Config icônes par type ───────────────────────────────────────────────────

const TYPE_CONFIG = {
  new_message:           { icon: 'chatbubble',            color: '#3B82F6', label: 'Message'      },
  new_staff_message:     { icon: 'chatbubbles',           color: '#3B82F6', label: 'Message'      },
  visite_new:            { icon: 'home',                  color: '#10B981', label: 'Visite'       },
  visite_status:         { icon: 'calendar',              color: '#10B981', label: 'Visite'       },
  visite_cancelled:      { icon: 'calendar-clear',        color: '#EF4444', label: 'Visite'       },
  visite_demandee:       { icon: 'calendar', color: '#D4A017', label: 'Rendez-vous' },
  visite_a_confirmer:    { icon: 'time', color: '#D4A017', label: 'Rendez-vous' },
  visite_reprogrammee:   { icon: 'calendar', color: '#3B82F6', label: 'Rendez-vous' },
  visite_rappel:         { icon: 'alarm', color: '#8B5CF6', label: 'Rendez-vous' },
  visite_en_cours:       { icon: 'play-circle', color: '#8B5CF6', label: 'Rendez-vous' },
  visite_terminee:       { icon: 'checkmark-circle', color: '#10B981', label: 'Rendez-vous' },
  visite_annulation_demandee: { icon: 'alert-circle', color: '#F59E0B', label: 'Rendez-vous' },
  visite_client_absent:  { icon: 'person-remove', color: '#EF4444', label: 'Rendez-vous' },
  visite_incident:       { icon: 'warning', color: '#EF4444', label: 'Rendez-vous' },
  transaction_created:   { icon: 'swap-horizontal',       color: '#F59E0B', label: 'Transaction'  },
  transaction_finalized: { icon: 'checkmark-circle',      color: '#10B981', label: 'Transaction'  },
  quote_received:        { icon: 'document-text',         color: '#8B5CF6', label: 'Devis'        },
  quote_status:          { icon: 'document-text-outline', color: '#8B5CF6', label: 'Devis'        },
  quote_response:        { icon: 'mail',                  color: '#8B5CF6', label: 'Devis'        },
  payment_success:       { icon: 'cash',                  color: '#10B981', label: 'Paiement'     },
  payment_failed:        { icon: 'alert-circle',          color: '#EF4444', label: 'Paiement'     },
  contrat_new:           { icon: 'reader',                color: '#F59E0B', label: 'Contrat'      },
  contrat_updated:       { icon: 'reader-outline',        color: '#F59E0B', label: 'Contrat'      },
  loyer_paye:            { icon: 'wallet',                color: '#10B981', label: 'Loyer'        },
  loyer_en_retard:       { icon: 'warning',               color: '#EF4444', label: 'Loyer'        },
  account_verified:      { icon: 'shield-checkmark',      color: '#10B981', label: 'Compte'       },
  account_suspended:     { icon: 'ban',                   color: '#EF4444', label: 'Compte'       },
};

const DEFAULT_CONFIG = { icon: 'notifications', color: '#C8960C', label: 'Notification' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "À l'instant";
  if (mins  < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days  <  7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// ─── Navigation helper ────────────────────────────────────────────────────────

function getNavTarget(notif) {
  const { type, data = {} } = notif;

  // 'Chat' est imbriqué dans MessagerieStack (onglet 'Messages') — naviguer
  // directement vers 'Chat' depuis un autre onglet (Annonces) échoue, il faut
  // passer par le tab parent avec les params imbriqués.
  if (data?.screen === 'Chat') {
    return { screen: 'Messages', params: { screen: 'Chat', params: data.params } };
  }
  if (data?.screen) return { screen: data.screen, params: data.params };

  const MAP = {
    new_message:           { screen: 'Messages', params: { screen: 'Chat' } },
    new_staff_message:     { screen: 'Messages', params: { screen: 'Chat' } },
    visite_new:            { screen: 'Visites'  },
    visite_status:         { screen: 'Visites'  },
    visite_cancelled:      { screen: 'Visites'  },
    visite_demandee:       { screen: 'Visites'  },
    visite_a_confirmer:    { screen: 'Visites'  },
    visite_reprogrammee:   { screen: 'Visites'  },
    visite_rappel:         { screen: 'Visites'  },
    visite_en_cours:       { screen: 'Visites'  },
    visite_terminee:       { screen: 'Visites'  },
    visite_annulation_demandee: { screen: 'Visites' },
    visite_client_absent:  { screen: 'Visites' },
    visite_incident:       { screen: 'Visites' },
    transaction_created:   { screen: 'Profil',  params: { screen: 'Transactions' } },
    transaction_finalized: { screen: 'Profil',  params: { screen: 'Transactions' } },
    payment_success:       { screen: 'Profil',  params: { screen: 'Transactions' } },
    payment_failed:        { screen: 'Profil',  params: { screen: 'Transactions' } },
  };
  return MAP[type] || null;
}

// ─── NotifRow ─────────────────────────────────────────────────────────────────

const NotifRow = memo(function NotifRow({ item, index, onPress, onDelete, styles, c }) {
  const cfg   = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
  const time  = formatRelativeTime(item.createdAt);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 280)).duration(240)}>
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => onPress(item)}
        onLongPress={() => onDelete(item)}
        activeOpacity={0.75}
        accessibilityLabel={item.title}
        accessibilityHint="Appui long pour supprimer"
      >
        {/* Indicateur non-lu */}
        {!item.read && <View style={styles.unreadBar} />}

        {/* Icône */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.color + '18' }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        {/* Contenu */}
        <View style={styles.content}>
          <View style={styles.rowTop}>
            <View style={[styles.typePill, { backgroundColor: cfg.color + '18' }]}>
              <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.time}>{time}</Text>
          </View>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item._id  === next.item._id  &&
  prev.item.read === next.item.read &&
  prev.styles    === next.styles
);

const RowSeparator = memo(({ style }) => <View style={style} />);

// ─── Écran ────────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',    label: 'Toutes'  },
  { key: 'unread', label: 'Non lues' },
];

export default function NotificationsScreen({ navigation }) {
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles  = useMemo(() => makeStyles(c), [c]);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState('all');
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(true);
  const loadingMore = useRef(false);

  // ─── Chargement ───
  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && loadingMore.current) return;
    if (!reset) loadingMore.current = true;

    try {
      const data = await getNotifications(p, filter);
      const list = data?.notifications || [];
      if (reset) {
        setNotifications(list);
        setPage(2);
      } else {
        setNotifications((prev) => [...prev, ...list]);
        setPage((prev) => prev + 1);
      }
      setUnreadCount(data?.unreadCount ?? 0);
      setHasMore(p < (data?.pagination?.pages ?? 1));
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingMore.current = false;
    }
  }, [filter, page]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setPage(1);
    load(true);
  }, [filter])); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Temps réel — pousse les nouvelles notifications sans attendre le focus ───
  useEffect(() => {
    let socket;
    let cancelled = false;

    connectSocket().then((s) => {
      if (cancelled) return;
      socket = s || getSocket();
      socket?.on('notification', handleIncoming);
    });

    function handleIncoming(notif) {
      if (filter === 'unread' && notif.read) return;
      setNotifications((prev) => [notif, ...prev]);
      if (!notif.read) setUnreadCount((c) => c + 1);
    }

    return () => {
      cancelled = true;
      socket?.off('notification', handleIncoming);
    };
  }, [filter]);

  // ─── Actions ───
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore.current) load(false);
  }, [hasMore, load]);

  const handlePress = useCallback(async (notif) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Marquer lu localement immédiatement
    if (!notif.read) {
      setNotifications((prev) =>
        prev.map((n) => n._id === notif._id ? { ...n, read: true } : n),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      markRead(notif._id).catch(() => {});
    }

    // Enrichir la navigation pour les messages — data ne contient que
    // conversationId, il faut charger la conversation complète (participants,
    // relatedProperty) avant de naviguer vers ChatScreen.
    const { type, data = {} } = notif;
    const MESSAGE_TYPES = ['new_message', 'new_staff_message', 'message_staff'];
    if (MESSAGE_TYPES.includes(type) && data.conversationId) {
      try {
        const res = await api.get(`/conversations/${data.conversationId}`);
        const conversation = res.data?.data?.conversation;
        if (conversation) {
          const currentUserId = await getCurrentUserId();
          const contact = conversation.participants?.find(
            (p) => p._id?.toString() !== currentUserId
          ) || { name: 'Équipe Altitude Vision' };
          navigation.navigate('Messages', {
            screen: 'Chat',
            params: { conversation, contact },
          });
          return;
        }
      } catch {}
      // Fallback : ouvre la liste des conversations
      navigation.navigate('Messages', {});
      return;
    }

    // Autres types : navigation standard
    const target = getNavTarget(notif);
    if (target) {
      navigation.navigate(target.screen, target.params);
    }
  }, [navigation]);

  const handleDelete = useCallback((notif) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Supprimer', 'Supprimer cette notification ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setNotifications((prev) => prev.filter((n) => n._id !== notif._id));
          if (!notif.read) setUnreadCount((c) => Math.max(0, c - 1));
          import('../../services/notificationApiService')
            .then(({ deleteNotification }) => deleteNotification(notif._id))
            .catch(() => {});
        },
      },
    ]);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllRead().catch(() => {});
  }, []);

  const handleClearRead = useCallback(() => {
    Alert.alert('Nettoyer', 'Supprimer toutes les notifications lues ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Nettoyer',
        style: 'destructive',
        onPress: async () => {
          setNotifications((prev) => prev.filter((n) => !n.read));
          import('../../services/notificationApiService')
            .then(({ clearRead }) => clearRead())
            .catch(() => {});
        },
      },
    ]);
  }, []);

  const keyExtractor   = useCallback((item) => item._id, []);
  const ItemSeparator  = useCallback(() => <RowSeparator style={styles.separator} />, [styles]);

  const renderItem = useCallback(({ item, index }) => (
    <NotifRow
      item={item}
      index={index}
      onPress={handlePress}
      onDelete={handleDelete}
      styles={styles}
      c={c}
    />
  ), [handlePress, handleDelete, styles, c]);

  const hasRead = useMemo(() => notifications.some((n) => n.read), [notifications]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Ionicons name="notifications-outline" size={18} color={c.gold} />
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              hitSlop={8}
              accessibilityLabel="Tout marquer comme lu"
            >
              <Ionicons name="checkmark-done-outline" size={22} color={c.gold} />
            </TouchableOpacity>
          )}
          {hasRead && (
            <TouchableOpacity
              onPress={handleClearRead}
              hitSlop={8}
              accessibilityLabel="Supprimer les lues"
            >
              <Ionicons name="trash-outline" size={20} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Filtres ─── */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
            {f.key === 'unread' && unreadCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Contenu ─── */}
      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={36} color={c.gold} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'unread'
              ? 'Vous êtes à jour !'
              : 'Vos alertes de visites, transactions et messages apparaîtront ici.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.gold}
              colors={[c.gold]}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.bgCard,
  },
  headerBtn: {
    width: 40, height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.md,
    color: c.text,
  },
  headerBadge: {
    backgroundColor: c.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#0A0A0A',
  },
  headerActions: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },

  // ─── Filtres ───
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: c.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: c.bgCardAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: {
    backgroundColor: c.goldMuted,
    borderColor: c.borderGold,
  },
  filterChipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  filterChipTextActive: {
    fontFamily: fonts.bodyBold,
    color: c.gold,
  },
  filterBadge: {
    backgroundColor: c.gold,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#0A0A0A',
  },

  // ─── Liste ───
  list: { paddingVertical: spacing.xs },
  separator: {
    height: 1,
    backgroundColor: c.border,
    marginLeft: 72,
  },

  // ─── Ligne notification ───
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: c.bg,
  },
  rowUnread: { backgroundColor: c.bgCard },

  unreadBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: c.gold,
    borderRadius: 2,
  },

  // ─── Icône ───
  iconWrap: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },

  // ─── Contenu ───
  content: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    flexShrink: 0,
  },
  notifTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: c.textSub,
  },
  notifTitleUnread: {
    fontFamily: fonts.bodyBold,
    color: c.text,
  },
  notifBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 18,
  },

  // ─── État vide ───
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: c.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderGold,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
