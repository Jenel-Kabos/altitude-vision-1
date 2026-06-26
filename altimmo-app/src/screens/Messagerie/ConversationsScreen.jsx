import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, Image, RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Divider from '../../components/ui/Divider';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

export default function ConversationsScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const chargerConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(
        res.data?.data?.conversations ||
        res.data?.conversations || []
      );
    } catch (error) {
      console.log('Erreur conversations:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Rechargement à chaque fois que l'écran redevient visible (retour depuis Chat)
  useFocusEffect(useCallback(() => { chargerConversations(); }, []));

  useEffect(() => {
    // Socket.IO — mise à jour en temps réel des badges + lastMessage
    const token = api.defaults?.headers?.common?.Authorization?.replace('Bearer ', '');
    const socket = connectSocket(token);

    socket.on('new-message', ({ conversationId, message }) => {
      if (!conversationId || !message) return;
      setConversations(prev => prev.map(conv => {
        if (conv._id !== conversationId.toString()) return conv;
        return {
          ...conv,
          lastMessage: message.content,
          updatedAt: message.createdAt,
          unreadCount: (conv.unreadCount || 0) + 1,
        };
      }));
    });

    // Fallback polling 30s — synchronise si le socket a été silencieux
    const id = setInterval(chargerConversations, 30000);

    return () => {
      socket.off('new-message');
      clearInterval(id);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    chargerConversations();
  };

  // unreadCount est un nombre scalaire (extrait côté serveur pour l'utilisateur courant)
  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);

  // Filtered list
  const filtered = conversations.filter(c => {
    if (!search.trim()) return true;
    const other = c.participants?.find(p => p._id !== user?._id);
    const name = (other?.name || '').toLowerCase();
    const last = (c.lastMessage || '').toLowerCase();
    const q = search.trim().toLowerCase();
    return name.includes(q) || last.includes(q);
  });

  const renderItem = ({ item }) => {
    const other = item.participants?.find(p => p._id !== user?._id);
    const name = other?.name || other?.firstName || 'Utilisateur';
    const initial = (name[0] || '?').toUpperCase();
    const unread = Number(item.unreadCount || 0);
    const lastMessage = item.lastMessage || 'Nouvelle conversation';
    const time = formatTime(item.updatedAt);

    return (
      <TouchableOpacity
        style={styles.conv}
        onPress={() => navigation.navigate('Chat', { conversation: item, contact: other })}
        activeOpacity={0.7}
      >
        {other?.photo ? (
          <Image source={{ uri: other.photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        <View style={styles.right}>
          <View style={styles.row1}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <View style={styles.row2}>
            <Text style={styles.lastMsg} numberOfLines={1}>{lastMessage}</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une conversation..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item._id || item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <Divider style={styles.itemSeparator} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Aucune conversation"
            subtitle="Contactez un propriétaire depuis une annonce."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  titleBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 100,
    minWidth: 24,
    alignItems: 'center',
  },
  titleBadgeText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },

  conv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  right: {
    flex: 1,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: spacing.sm,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastMsg: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 100,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },

  itemSeparator: {
    marginLeft: 72,
    marginVertical: 0,
  },
});
