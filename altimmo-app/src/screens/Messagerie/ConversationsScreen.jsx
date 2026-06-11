import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { colors } from '../../theme/colors';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ConversationsScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get('/conversations')
      .then(res => setConversations(res.data?.data?.conversations || res.data?.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = conversations.filter(c => {
    const other = c.participants?.find(p => p._id !== user?._id);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const renderItem = ({ item }) => {
    const other    = item.participants?.find(p => p._id !== user?._id) || {};
    const lastMsg  = item.lastMessage || item.messages?.[item.messages.length - 1];
    const unread   = item.unreadCount || 0;
    const timeAgo  = lastMsg?.createdAt
      ? formatDistanceToNow(new Date(lastMsg.createdAt), { locale: fr, addSuffix: true })
      : '';

    return (
      <TouchableOpacity
        style={styles.convRow}
        onPress={() => navigation.navigate('Chat', { conversation: item, contact: other })}
        activeOpacity={0.8}
      >
        {other.photo
          ? <Image source={{ uri: other.photo }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{other.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
        }
        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <Text style={styles.contactName} numberOfLines={1}>{other.name || 'Contact'}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
          <View style={styles.convBottom}>
            <Text style={[styles.lastMsg, unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>
              {lastMsg?.content || 'Nouvelle conversation'}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Messages</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => item._id || String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTxt}>Aucune conversation</Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  title:       { fontSize: 24, fontWeight: '800', color: colors.text, padding: 16, paddingBottom: 8 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundLight, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 },
  convRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar:      { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ fontSize: 20, fontWeight: '800', color: '#000' },
  convBody:    { flex: 1 },
  convTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  contactName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  timeAgo:     { fontSize: 12, color: colors.textMuted },
  convBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg:     { fontSize: 13, color: colors.textMuted, flex: 1 },
  lastMsgUnread: { color: colors.text, fontWeight: '600' },
  badge:       { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeTxt:    { fontSize: 11, fontWeight: '800', color: '#000' },
  sep:         { height: 1, backgroundColor: colors.divider, marginLeft: 78 },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:    { color: colors.textMuted, fontSize: 16 },
});
