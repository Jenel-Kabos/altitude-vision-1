import React, {
  useState, useEffect, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import IllustrationNoMessages from '../../components/illustrations/IllustrationNoMessages';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Divider from '../../components/ui/Divider';
import PageHeader from '../../components/PageHeader';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const STAFF_ROLES = ['Admin', 'Collaborateur'];

// Badge rôle — uniquement pertinent côté staff (item.isStaffInbox === true) ;
// un client ne voit jamais ce badge dans ses propres conversations 1-à-1.
const ROLE_COLORS = (c) => ({
  'Proprietaire': { bg: c.goldMuted, text: c.goldDark, label: 'Propriétaire' },
  'Client':       { bg: c.blueMuted, text: c.blue,     label: 'Client' },
  'Prestataire':  { bg: '#EDE9FE',   text: '#6D28D9',  label: 'Prestataire' },
});

// ─── Item de conversation ─────────────────────────────────────────────────────

const ConvItem = memo(function ConvItem({ item, currentUserId, onPress, styles }) {
  const { themeColors: c } = useTheme();
  const roleColors = useMemo(() => ROLE_COLORS(c), [c]);

  const { name, subtitle, photo, role } = useMemo(() => {
    if (item.isStaffInbox) {
      const client = item.participants?.[0];
      return {
        name:     client?.name || client?.firstName || 'Client',
        subtitle: item.relatedProperty?.title
          ? `Bien : ${item.relatedProperty.title}`
          : 'Demande de contact',
        photo: client?.photo || null,
        role:  client?.role || null,
      };
    }
    const other = item.participants?.find(p => p._id !== currentUserId);
    return {
      name:     other?.name || other?.firstName || 'Utilisateur',
      subtitle: null,
      photo:    other?.photo || null,
      role:     null,
    };
  }, [item, currentUserId]);

  const initial     = (name[0] || '?').toUpperCase();
  const unread      = Number(item.unreadCount || 0);
  const lastMessage = item.lastMessage || 'Nouvelle conversation';
  const time        = formatTime(item.updatedAt);

  return (
    <TouchableOpacity
      style={styles.conv}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Conversation avec ${name}`}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={styles.right}>
        <View style={styles.row1}>
          <View style={styles.nameWrap}>
            <Text
              style={[styles.name, unread > 0 && styles.nameUnread]}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
          <Text style={styles.time}>{time}</Text>
        </View>

        {/* Badge rôle — uniquement dispo côté staff (item.isStaffInbox) */}
        {role && roleColors[role] && (
          <View style={{
            backgroundColor: roleColors[role].bg,
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingVertical: 2,
            alignSelf: 'flex-start',
            marginTop: 2,
            marginBottom: 2,
          }}>
            <Text style={{
              fontSize: 10,
              fontFamily: fonts.bodyBold,
              color: roleColors[role].text,
            }}>
              {roleColors[role].label}
            </Text>
          </View>
        )}

        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}

        <View style={styles.row2}>
          <Text
            style={[styles.lastMsg, unread > 0 && styles.lastMsgUnread]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.item._id         === next.item._id         &&
  prev.item.unreadCount === next.item.unreadCount  &&
  prev.item.updatedAt   === next.item.updatedAt    &&
  prev.item.lastMessage === next.item.lastMessage  &&
  prev.styles           === next.styles
);

// ─── Séparateur stable ───────────────────────────────────────────────────────

const ConvSeparator = memo(function ConvSeparator({ style }) {
  return <Divider style={style} />;
});

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function ConversationsScreen({ navigation }) {
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles  = useMemo(() => makeStyles(c), [c]);
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');

  // ─── Chargement ───
  const chargerConversations = useCallback(async () => {
    try {
      const endpoint = isStaff ? '/conversations/staff-inbox' : '/conversations';
      const res = await api.get(endpoint);
      setConversations(res.data?.data?.conversations || []);
    } catch {
      // silencieux — l'utilisateur peut refresh manuellement
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff]);

  // Rechargement à chaque focus (retour depuis ChatScreen)
  useFocusEffect(useCallback(() => {
    chargerConversations();
  }, [chargerConversations]));

  // ─── Socket.IO + polling de rattrapage ───
  useEffect(() => {
    let isMounted = true;
    let socketRef = null;

    const handleIncoming = ({ conversationId, message }) => {
      if (!conversationId || !message) return;
      setConversations(prev => prev.map(conv =>
        conv._id !== conversationId.toString() ? conv : {
          ...conv,
          lastMessage: message.content,
          updatedAt:   message.createdAt,
          unreadCount: (conv.unreadCount || 0) + 1,
        }
      ));
    };

    connectSocket().then(socket => {
      if (!isMounted) return;
      socketRef = socket;
      socket.on('new-message', handleIncoming);
      if (isStaff) socket.on('new-staff-message', handleIncoming);
    });

    // Polling uniquement si le socket est mort (réseau instable, arrière-plan)
    const id = setInterval(() => {
      if (!getSocket()?.connected) chargerConversations();
    }, 30_000);

    return () => {
      isMounted = false;
      socketRef?.off('new-message',       handleIncoming);
      if (isStaff) socketRef?.off('new-staff-message', handleIncoming);
      clearInterval(id);
    };
  }, [isStaff, chargerConversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter(conv => {
      const last = (conv.lastMessage || '').toLowerCase();
      const getName = () => {
        if (conv.isStaffInbox) {
          const cl = conv.participants?.[0];
          return (cl?.name || cl?.firstName || '').toLowerCase();
        }
        const other = conv.participants?.find(p => p._id !== user?._id);
        return (other?.name || other?.firstName || '').toLowerCase();
      };
      const sub = (conv.relatedProperty?.title || '').toLowerCase();
      return getName().includes(q) || last.includes(q) || sub.includes(q);
    });
  }, [conversations, search, user]);

  // ─── Callbacks ───
  const onRefresh    = useCallback(() => { setRefreshing(true); chargerConversations(); }, [chargerConversations]);
  const onClearSearch= useCallback(() => setSearch(''), []);
  const keyExtractor = useCallback((item) => item._id || item.id, []);

  const renderItem = useCallback(({ item }) => {
    const contact = item.isStaffInbox
      ? item.participants?.[0]
      : item.participants?.find(p => p._id !== user?._id);

    return (
      <ConvItem
        item={item}
        currentUserId={user?._id}
        onPress={() => navigation.navigate('Chat', { conversation: item, contact })}
        styles={styles}
      />
    );
  }, [navigation, user, styles]);

  const ItemSeparator = useCallback(
    () => <ConvSeparator style={styles.itemSeparator} />,
    [styles],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageHeader title={isStaff ? 'Boîte staff' : 'Messages'} />

      {/* ─── Barre de recherche ─── */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={c.gold} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une conversation..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Rechercher une conversation"
          />
          {search ? (
            <TouchableOpacity
              onPress={onClearSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
            >
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ─── Liste ─── */}
      <FlatList
        data={filtered}
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
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <IllustrationNoMessages />
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptySubtitle}>
              {isStaff
                ? 'Aucune demande client pour le moment.'
                : 'Posez une question à notre équipe directement.'}
            </Text>
            {!isStaff && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('Chatbot')}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#0A0A0A" />
                <Text style={styles.emptyBtnText}>Contacter l'agence</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ─── FAB contacter l'agence ─── */}
      {!isStaff && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Chatbot')}
          activeOpacity={0.85}
          accessibilityLabel="Contacter l'agence"
          accessibilityRole="button"
        >
          <Ionicons name="chatbubbles-outline" size={22} color="#0A0A0A" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  header: {
    backgroundColor: c.bg,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.bgCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    padding: 0,
  },

  conv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: c.gold,
  },
  right: { flex: 1 },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  name: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    flexShrink: 1,
  },
  nameUnread: {
    fontFamily: fonts.bodyBold,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.gold,
    marginBottom: 2,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    marginLeft: spacing.sm,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastMsg: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: c.textSub,
    flex: 1,
  },
  lastMsgUnread: {
    fontFamily: fonts.bodyBold,
    color: c.text,
  },
  unreadBadge: {
    backgroundColor: c.gold,
    minWidth: 20,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 100,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#0A0A0A',
  },

  itemSeparator: {
    marginLeft: 80,
    marginVertical: 0,
  },

  // ─── FAB ───
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },

  // ─── Empty state ───
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: c.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.gold,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: '#0A0A0A',
  },
});
