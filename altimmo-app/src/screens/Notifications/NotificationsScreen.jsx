import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { fonts, fontSize, spacing, radius } from '../../theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "À l'instant";
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days  <  7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
};

// ─── ConvRow ─────────────────────────────────────────────────────────────────

const ConvRow = memo(function ConvRow({ item, index, selfId, onPress, styles, c }) {
  // Identifie le bon interlocuteur en excluant l'utilisateur courant
  const contact = useMemo(
    () => item.participants?.find(p => p?._id && p._id !== selfId) || {},
    [item.participants, selfId],
  );
  const name     = contact.name || contact.firstName || 'Équipe Altitude Vision';
  const isUnread = (item.unreadCount || 0) > 0;
  const preview  = item.lastMessage || 'Nouvelle conversation';
  const time     = formatRelativeTime(item.updatedAt || item.createdAt);

  const handlePress = useCallback(
    () => onPress(item, contact),
    [item, contact, onPress],
  );

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(280)}>
      <TouchableOpacity
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={handlePress}
        activeOpacity={0.75}
        accessibilityLabel={`Message de ${name} : ${preview}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isUnread }}
      >
        {/* Avatar initiales */}
        <View style={[styles.avatar, isUnread && styles.avatarUnread]}>
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        {/* Contenu */}
        <View style={styles.content}>
          <View style={styles.rowTop}>
            <Text
              style={[styles.name, isUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <Text
            style={[styles.preview, isUnread && styles.previewUnread]}
            numberOfLines={2}
          >
            {preview}
          </Text>
        </View>

        {/* Badge non-lus */}
        {isUnread && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.unreadCount > 9 ? '9+' : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item._id          === next.item._id          &&
  prev.item.unreadCount  === next.item.unreadCount   &&
  prev.item.lastMessage  === next.item.lastMessage   &&
  prev.item.updatedAt    === next.item.updatedAt     &&
  prev.styles            === next.styles
);

// ─── Séparateur ───────────────────────────────────────────────────────────────

const RowSeparator = memo(function RowSeparator({ style }) {
  return <View style={style} />;
});

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }) {
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles  = useMemo(() => makeStyles(c), [c]);
  const selfId  = user?._id;

  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  // ─── Chargement ───
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/conversations');
      const raw = res.data?.data?.conversations || res.data?.conversations || [];
      // Conversations non lues en premier, puis par date décroissante
      const sorted = [...raw].sort((a, b) => {
        const unreadDiff = (b.unreadCount || 0) - (a.unreadCount || 0);
        if (unreadDiff !== 0) return unreadDiff;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
      setConversations(sorted);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ─── Handlers ───
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handlePress = useCallback((conv, contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Messages', {
      screen:  'Chat',
      params:  { conversation: conv, contact },
    });
  }, [navigation]);

  const keyExtractor    = useCallback((item) => item._id, []);
  const ItemSeparator   = useCallback(() => <RowSeparator style={styles.separator} />, [styles]);

  const renderItem = useCallback(({ item, index }) => (
    <ConvRow
      item={item}
      index={index}
      selfId={selfId}
      onPress={handlePress}
      styles={styles}
      c={c}
    />
  ), [selfId, handlePress, styles, c]);

  const unreadTotal = useMemo(
    () => conversations.reduce((s, cv) => s + (cv.unreadCount || 0), 0),
    [conversations],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Ionicons name="notifications-outline" size={18} color={c.gold} />
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadTotal > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </Text>
            </View>
          )}
        </View>

        {/* Spacer symétrique */}
        <View style={styles.headerBtn} />
      </View>

      {/* ─── Contenu ─── */}
      {loading ? (
        <LoadingSpinner />
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={36} color={c.gold} />
          </View>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>
            Vos messages et alertes apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
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
    width: 40,
    height: 40,
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

  // ─── Liste ───
  list: { paddingVertical: spacing.sm },
  separator: {
    height: 1,
    backgroundColor: c.border,
    marginLeft: 72,
  },

  // ─── Ligne conversation ───
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: c.bg,
  },
  rowUnread: { backgroundColor: c.bgCard },

  // ─── Avatar ───
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnread: { backgroundColor: c.goldMuted },
  avatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.goldDark,
  },
  unreadDot: {
    position: 'absolute',
    top: 1, right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.gold,
    borderWidth: 2,
    borderColor: c.bgCard,
  },

  // ─── Contenu ───
  content:  { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textSub,
    marginRight: spacing.sm,
  },
  nameUnread: { fontFamily: fonts.bodyBold, color: c.text },
  time: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    flexShrink: 0,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 18,
  },
  previewUnread: { color: c.textSub },

  // ─── Badge non-lus ───
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#0A0A0A',
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
    width: 72,
    height: 72,
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
