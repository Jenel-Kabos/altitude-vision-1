import React, {
  useState, useEffect, useRef, useLayoutEffect,
  useMemo, useCallback, memo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { fonts, fontSize, spacing } from '../../theme';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate()  === b.getDate();

const formatDateSep = (dateStr) => {
  const d         = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, today))     return "Aujourd'hui";
  if (isSameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ─── Indicateur "en train d'écrire" ──────────────────────────────────────────

const TypingDots = memo(function TypingDots({ bubbleStyle, dotStyle }) {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const anim = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1,   duration: 400, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0.2, duration: 400, useNativeDriver: true }),
      ])
    );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={bubbleStyle}>
      <Animated.View style={[dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[dotStyle, { opacity: dot3 }]} />
    </View>
  );
});

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen({ route, navigation }) {
  const { conversation, contact }  = route.params;
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [typing,   setTyping]   = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // ─── Header personnalisé ───
  const HeaderTitle = useCallback(() => (
    <View style={styles.customHeader}>
      {contact?.photo ? (
        <Image
          source={{ uri: contact.photo }}
          style={styles.headerAvatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
        />
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
  ), [contact, isOnline, styles]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: c.bgCard,
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      headerTintColor:        c.text,
      headerBackTitleVisible: false,
      headerTitleAlign:       'left',
      headerTitle:            HeaderTitle,
    });
  }, [navigation, c, HeaderTitle]);

  // ─── Chargement messages ───
  const fetchMessages = useCallback(async () => {
    try {
      const res  = await api.get(`/messages/${conversation._id}`);
      const msgs = res.data?.data?.messages || res.data?.messages || [];
      setMessages(msgs.reverse());
    } catch {}
  }, [conversation._id]);

  // ─── Socket.IO + polling de rattrapage ───
  useEffect(() => {
    fetchMessages();

    let isMounted = true;
    let socketRef = null;

    const handleNewMessage = (payload) => {
      const msg = payload?.message ?? payload;
      setMessages(prev => {
        const exists = prev.some(m => m._id === msg._id);
        return exists
          ? prev.map(m => m._id === msg._id ? msg : m)
          : [msg, ...prev];
      });
    };

    const handleTyping = ({ userId: typingUserId }) => {
      if (typingUserId !== user._id) {
        setTyping(true);
        setTimeout(() => setTyping(false), 2000);
      }
    };

    connectSocket().then(socket => {
      if (!isMounted) return;
      socketRef = socket;
      socket.emit('join-room', conversation._id);
      socket.on('new-message', handleNewMessage);
      socket.on('typing',      handleTyping);
    });

    // Polling uniquement si le socket est mort
    const fallback = setInterval(() => {
      if (!getSocket()?.connected) fetchMessages();
    }, 30_000);

    return () => {
      isMounted = false;
      socketRef?.off('new-message', handleNewMessage);
      socketRef?.off('typing',      handleTyping);
      clearInterval(fallback);
    };
  }, [conversation._id, user._id, fetchMessages]);

  // ─── Envoi optimiste ───
  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!content) return;
    setText('');

    const tempMsg = {
      _id:       `temp-${Date.now()}`,
      content,
      sender:    user,
      createdAt: new Date().toISOString(),
      pending:   true,
    };
    setMessages(prev => [tempMsg, ...prev]);

    try {
      const res   = await api.post('/messages', { conversationId: conversation._id, content });
      const saved = res.data?.data?.message || res.data?.message;
      if (saved) {
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? saved : m));
        getSocket()?.emit('send-message', { ...saved, receiverId: contact._id });
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m._id === tempMsg._id ? { ...m, error: true } : m)
      );
    }
  }, [text, user, conversation._id, contact]);

  const onTyping = useCallback((val) => {
    setText(val);
    getSocket()?.emit('typing', { conversationId: conversation._id, userId: user._id });
  }, [conversation._id, user._id]);

  const isMe = useCallback(
    (msg) => (msg.sender?._id || msg.sender) === user?._id,
    [user],
  );

  const keyExtractor = useCallback((item, i) => item._id || String(i), []);

  // Indicateur de frappe mémorisé — évite unmount/remount à chaque render FlatList
  const typingHeader = useMemo(() => {
    if (!typing) return null;
    return <TypingDots bubbleStyle={styles.typingBubble} dotStyle={styles.typingDot} />;
  }, [typing, styles]);

  // ─── Rendu message ───
  const renderMessage = useCallback(({ item, index }) => {
    const mine        = isMe(item);
    const olderMsg    = messages[index + 1];
    const showDateSep = !olderMsg
      || !isSameDay(new Date(item.createdAt), new Date(olderMsg.createdAt));

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSepWrap}>
            <Text style={styles.dateSepText}>{formatDateSep(item.createdAt)}</Text>
          </View>
        )}
        <View style={mine ? styles.bubbleRowMe : styles.bubbleRowThem}>
          <View style={mine ? styles.bubbleMe : styles.bubbleThem}>
            <Text style={mine ? styles.bubbleTextMe : styles.bubbleTextThem}>
              {item.content}
            </Text>
          </View>
        </View>
        <View style={[styles.metaRow, mine ? styles.metaRowMe : styles.metaRowThem]}>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          {mine && (
            <Ionicons
              name={
                item.pending ? 'time-outline'
                : item.error ? 'alert-circle-outline'
                : 'checkmark-done'
              }
              size={12}
              color={item.error ? c.error : c.textMuted}
            />
          )}
        </View>
      </View>
    );
  }, [isMe, messages, styles, c]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.msgList}
          ListHeaderComponent={typingHeader}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={onTyping}
            multiline
            maxLength={1000}
            accessibilityLabel="Écrire un message"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },

  // ─── Header ───
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
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: c.gold,
  },
  headerName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
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
    backgroundColor: c.success,
  },
  onlineText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textSub,
  },

  // ─── Liste ───
  msgList: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // ─── Séparateur de date ───
  dateSepWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateSepText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
  },

  // ─── Bulles ───
  bubbleRowMe:   { alignItems: 'flex-end' },
  bubbleRowThem: { alignItems: 'flex-start' },
  bubbleMe: {
    backgroundColor: c.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: '78%',
  },
  bubbleThem: {
    backgroundColor: c.bgCard,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '78%',
  },
  bubbleTextMe: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: '#0A0A0A',
  },
  bubbleTextThem: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
  },

  // ─── Méta (heure + statut) ───
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaRowMe:   { alignSelf: 'flex-end' },
  metaRowThem: { alignSelf: 'flex-start' },
  timeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: c.textMuted,
  },

  // ─── Typing dots ───
  typingBubble: {
    backgroundColor: c.bgCard,
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
    backgroundColor: c.textMuted,
  },

  // ─── Barre de saisie ───
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: c.bgCard,
    borderTopWidth: 1,
    borderTopColor: c.border,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: c.bgCardAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
