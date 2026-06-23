import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { colors, typography, spacing } from '../../theme';

// ─── Helpers date ──────────────────────────────────────────────
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const formatDateSep = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, today)) return "Aujourd'hui";
  if (isSameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// ─── Composant indicateur "en train d'écrire" ──────────────────
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const animateDot = (anim, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.2, duration: 400, useNativeDriver: true,
        }),
      ])
    );
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 150);
    const a3 = animateDot(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingBubble}>
      <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { conversation, contact } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const flatRef = useRef(null);

  // Custom header via navigation.setOptions
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: colors.surface,
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headerTintColor: colors.text,
      headerBackTitleVisible: false,
      headerTitleAlign: 'left',
      headerTitle: () => (
        <View style={styles.customHeader}>
          {contact?.photo ? (
            <Image source={{ uri: contact.photo }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInitial}>
                {(contact?.name?.[0] || '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{contact?.name || 'Contact'}</Text>
            {isOnline && (
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>En ligne</Text>
              </View>
            )}
          </View>
        </View>
      ),
    });
  }, [navigation, contact, isOnline]);

  // ─── Fetch + polling (socket commenté) ──────────────────────
  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/${conversation._id}`);
      const msgs = res.data?.data?.messages || res.data?.messages || [];
      setMessages(msgs.reverse());
    } catch {}
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [conversation._id]);

  // TODO: réactiver quand socket.io serveur est prêt
  // useEffect(() => {
  //   const socket = connectSocket(token);
  //   socket.emit('join-room', conversation._id);
  //   socket.on('new-message', (msg) => {
  //     setMessages(prev => [msg, ...prev]);
  //   });
  //   socket.on('typing', ({ userId }) => {
  //     if (userId !== user._id) setTyping(true);
  //     setTimeout(() => setTyping(false), 2000);
  //   });
  //   return () => {
  //     socket.off('new-message');
  //     socket.off('typing');
  //   };
  // }, []);

  // ─── Envoi optimiste ───────────────────────────────────────
  const sendMessage = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');

    const tempMsg = {
      _id: `temp-${Date.now()}`,
      content,
      sender: user,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [tempMsg, ...prev]);

    try {
      const res = await api.post('/messages', {
        conversationId: conversation._id,
        content,
      });
      const saved = res.data?.data?.message || res.data?.message;
      if (saved) {
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? saved : m));
        // TODO: réactiver quand socket.io serveur est prêt
        // getSocket()?.emit('send-message', { ...saved, receiverId: contact._id });
      }
    } catch {
      setMessages(prev => prev.map(
        m => m._id === tempMsg._id ? { ...m, error: true } : m
      ));
    }
  };

  const onTyping = (val) => {
    setText(val);
    // TODO: réactiver quand socket.io serveur est prêt
    // getSocket()?.emit('typing', { conversationId: conversation._id, userId: user._id });
  };

  const isMe = (msg) => (msg.sender?._id || msg.sender) === user?._id;

  // ─── Render ─────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const mine = isMe(item);
    // In inverted list : index+1 is the older message
    const olderMsg = messages[index + 1];
    const showDateSep = !olderMsg
      || !isSameDay(new Date(item.createdAt), new Date(olderMsg.createdAt));

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSepWrap}>
            <Text style={styles.dateSepText}>
              {formatDateSep(item.createdAt)}
            </Text>
          </View>
        )}
        <View style={mine ? styles.bubbleRowMe : styles.bubbleRowThem}>
          <View style={mine ? styles.bubbleMe : styles.bubbleThem}>
            <Text style={mine ? styles.bubbleTextMe : styles.bubbleTextThem}>
              {item.content}
            </Text>
          </View>
        </View>
        <View style={[
          styles.metaRow,
          mine ? styles.metaRowMe : styles.metaRowThem,
        ]}>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          {mine ? (
            <Ionicons
              name={
                item.pending ? 'time-outline'
                : item.error ? 'alert-circle-outline'
                : 'checkmark-done'
              }
              size={12}
              color={item.error ? colors.error : colors.textMuted}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.msgList}
          ListHeaderComponent={typing ? <TypingDots /> : null}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={onTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !text.trim() && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ─── Header custom ───
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  headerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  onlineText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // ─── Liste ───
  msgList: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // ─── Date sep ───
  dateSepWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateSepText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // ─── Bulles ───
  bubbleRowMe: {
    alignItems: 'flex-end',
  },
  bubbleRowThem: {
    alignItems: 'flex-start',
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: '78%',
  },
  bubbleThem: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '78%',
  },
  bubbleTextMe: {
    ...typography.body,
    color: '#000',
  },
  bubbleTextThem: {
    ...typography.body,
    color: colors.text,
  },

  // ─── Méta (heure + statut) ───
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaRowMe: {
    alignSelf: 'flex-end',
  },
  metaRowThem: {
    alignSelf: 'flex-start',
  },
  timeText: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // ─── Typing dots ───
  typingBubble: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: spacing.md,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },

  // ─── Input bar ───
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    ...typography.body,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
