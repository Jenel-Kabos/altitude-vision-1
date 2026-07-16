import React, {
  useState, useEffect, useRef, useLayoutEffect,
  useMemo, useCallback, memo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
  Modal, Pressable, ScrollView, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { fonts, fontSize, spacing, radius } from '../../theme';

const EMOJIS = [
  '😊', '😂', '❤️', '👍', '🙏', '😍', '😭',
  '🔥', '✅', '👋', '🎉', '💪', '😎', '🤝', '💯', '👏', '🙌', '😅', '🥰', '✨',
];

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

// ─── Lecteur audio minimal (play/pause) ──────────────────────────────────────

const AudioPlayer = memo(function AudioPlayer({ url, nom, styles }) {
  const { themeColors: c } = useTheme();
  const [sound,   setSound]   = useState(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(async () => {
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync({ uri: url });
      setSound(s);
      await s.playAsync();
      setPlaying(true);
      return;
    }
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playAsync();
      setPlaying(true);
    }
  }, [sound, playing, url]);

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  return (
    <TouchableOpacity onPress={toggle} style={styles.audioPlayer} activeOpacity={0.8}>
      <Ionicons name={playing ? 'pause' : 'play'} size={20} color={c.gold} />
      <Text style={styles.audioNom} numberOfLines={1}>{nom || 'Audio'}</Text>
    </TouchableOpacity>
  );
});

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen({ route, navigation }) {
  const { conversation, contact } = route?.params ?? {};
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [typing,   setTyping]   = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile,   setSelectedFile]   = useState(null);
  const [showEmoji,      setShowEmoji]      = useState(false);

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
  }, [conversation?._id]);

  // ─── Socket.IO + polling de rattrapage ───
  useEffect(() => {
    if (!conversation) return;
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
  }, [conversation, conversation?._id, user._id, fetchMessages]);

  // ─── Envoi optimiste (texte et/ou pièce jointe) ───
  const sendMessage = useCallback(async () => {
    const content = text.trim();
    if (!content && !selectedFile) return;

    const fileToSend = selectedFile;
    setText('');
    setSelectedFile(null);

    const tempMsg = {
      _id:       `temp-${Date.now()}`,
      content,
      sender:    user,
      createdAt: new Date().toISOString(),
      pending:   true,
      // Aperçu local immédiat (URI locale) — remplacé par l'URL Cloudinary
      // définitive dès que le serveur répond.
      attachments: fileToSend
        ? [{ type: fileToSend.kind, url: fileToSend.uri, nom: fileToSend.name }]
        : undefined,
    };
    setMessages(prev => [tempMsg, ...prev]);

    try {
      let res;
      if (fileToSend) {
        const fd = new FormData();
        if (content) fd.append('content', content);
        fd.append('conversationId', conversation._id);
        fd.append('attachments', {
          uri:  fileToSend.uri,
          name: fileToSend.name || 'fichier',
          type: fileToSend.mimeType || 'application/octet-stream',
        });
        res = await api.post('/messages', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/messages', { conversationId: conversation._id, content });
      }
      const saved = res.data?.data?.message || res.data?.message;
      if (saved) {
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? saved : m));
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m._id === tempMsg._id ? { ...m, error: true } : m)
      );
    }
  }, [text, selectedFile, user, conversation?._id, contact]);

  const onTyping = useCallback((val) => {
    setText(val);
    getSocket()?.emit('typing', { conversationId: conversation._id, userId: user._id });
  }, [conversation?._id, user._id]);

  // ─── Sélection de pièces jointes ───
  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setSelectedFile({ uri: a.uri, name: a.fileName || 'image.jpg', mimeType: a.mimeType || 'image/jpeg', kind: 'image' });
    }
    setShowAttachMenu(false);
  }, []);

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setSelectedFile({ uri: a.uri, name: a.fileName || 'video.mp4', mimeType: a.mimeType || 'video/mp4', kind: 'video' });
    }
    setShowAttachMenu(false);
  }, []);

  const pickAudio = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setSelectedFile({ uri: a.uri, name: a.name || 'audio', mimeType: a.mimeType || 'audio/mpeg', kind: 'audio' });
    }
    setShowAttachMenu(false);
  }, []);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setSelectedFile({ uri: a.uri, name: a.name || 'fichier', mimeType: a.mimeType || 'application/octet-stream', kind: 'file' });
    }
    setShowAttachMenu(false);
  }, []);

  const isMe = useCallback(
    (msg) => (msg.sender?._id || msg.sender) === user?._id,
    [user],
  );

  const keyExtractor = useCallback((item, i) => item._id || String(i), []);

  // ─── Rendu d'une pièce jointe dans une bulle ───
  const renderAttachment = useCallback((att, i) => {
    switch (att.type) {
      case 'image':
        return (
          <Image key={i} source={{ uri: att.url }} style={styles.attachImage}
            contentFit="cover" cachePolicy="memory-disk" />
        );
      case 'video':
        return (
          <Video key={i} source={{ uri: att.url }}
            useNativeControls resizeMode={ResizeMode.CONTAIN}
            style={styles.attachVideo} />
        );
      case 'audio':
        return <AudioPlayer key={i} url={att.url} nom={att.nom} styles={styles} />;
      default:
        return (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(att.url)}
            style={styles.attachFileRow} activeOpacity={0.8}>
            <Ionicons name="document-attach-outline" size={16} color={c.gold} />
            <Text style={styles.attachFileText} numberOfLines={1}>{att.nom || 'Fichier'}</Text>
          </TouchableOpacity>
        );
    }
  }, [styles, c]);

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
            {item.attachments?.map((att, i) => renderAttachment(att, i))}
            {!!item.content && (
              <Text style={mine ? styles.bubbleTextMe : styles.bubbleTextThem}>
                {item.content}
              </Text>
            )}
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
  }, [isMe, messages, styles, c, renderAttachment]);

  if (!conversation) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center',
        alignItems: 'center', backgroundColor: c.bg }}>
        <Ionicons name="chatbubble-outline" size={48}
          color={c.textMuted} />
        <Text style={{ color: c.textMuted, marginTop: 12 }}>
          Conversation introuvable
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: c.gold }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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

        {/* ─── Aperçu de la pièce jointe sélectionnée ─── */}
        {selectedFile && (
          <View style={styles.attachPreview}>
            <Ionicons
              name={
                selectedFile.kind === 'image' ? 'image-outline'
                : selectedFile.kind === 'video' ? 'videocam-outline'
                : selectedFile.kind === 'audio' ? 'musical-notes-outline'
                : 'document-outline'
              }
              size={16}
              color={c.gold}
            />
            <Text style={styles.attachPreviewText} numberOfLines={1}>{selectedFile.name}</Text>
            <TouchableOpacity onPress={() => setSelectedFile(null)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Retirer la pièce jointe">
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Panneau emoji ─── */}
        {showEmoji && (
          <View style={styles.emojiPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScroll}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setText(t => t + e)} hitSlop={4}>
                  <Text style={styles.emojiChar}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => setShowAttachMenu(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Joindre un fichier"
          >
            <Ionicons name="add" size={22} color={c.gold} />
          </TouchableOpacity>

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
            style={styles.emojiBtn}
            onPress={() => setShowEmoji(v => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Emojis"
          >
            <Text style={styles.emojiBtnIcon}>😊</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() && !selectedFile) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() && !selectedFile}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Menu d'attachement ─── */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <Pressable style={styles.attachOverlay} onPress={() => setShowAttachMenu(false)}>
          <Pressable style={styles.attachMenu} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={styles.attachOption} onPress={pickImage} activeOpacity={0.7}>
              <Text style={styles.attachOptionEmoji}>📷</Text>
              <Text style={styles.attachOptionText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickVideo} activeOpacity={0.7}>
              <Text style={styles.attachOptionEmoji}>🎥</Text>
              <Text style={styles.attachOptionText}>Vidéo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickAudio} activeOpacity={0.7}>
              <Text style={styles.attachOptionEmoji}>🎵</Text>
              <Text style={styles.attachOptionText}>Audio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickDocument} activeOpacity={0.7}>
              <Text style={styles.attachOptionEmoji}>📎</Text>
              <Text style={styles.attachOptionText}>Fichier</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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

  // ─── Bouton "+" et emoji ───
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnIcon: {
    fontSize: 20,
  },

  // ─── Aperçu pièce jointe sélectionnée ───
  attachPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.bgCardAlt,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attachPreviewText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
  },

  // ─── Menu d'attachement (modal) ───
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.bgCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  attachOption: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 64,
  },
  attachOptionEmoji: {
    fontSize: 28,
  },
  attachOptionText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
  },

  // ─── Panneau emoji ───
  emojiPanel: {
    backgroundColor: c.bgCard,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingVertical: spacing.xs,
  },
  emojiScroll: {
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  emojiChar: {
    fontSize: 24,
    padding: 4,
  },

  // ─── Pièces jointes dans les bulles ───
  attachImage: {
    width: 200,
    height: 150,
    borderRadius: radius.xs,
    marginBottom: spacing.xs,
  },
  attachVideo: {
    width: 200,
    height: 150,
    borderRadius: radius.xs,
    marginBottom: spacing.xs,
  },
  attachFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  attachFileText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.gold,
    flexShrink: 1,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    minWidth: 160,
  },
  audioNom: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
    flexShrink: 1,
  },
});
