import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';

export default function ChatScreen({ route, navigation }) {
  const { conversation, contact } = route.params;
  const { user, token } = useAuth();
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [typing,    setTyping]    = useState(false);
  const flatRef = useRef(null);

  useEffect(() => {
    // Charger les messages existants
    api.get(`/messages/${conversation._id}`)
      .then(res => {
        const msgs = res.data?.data?.messages || res.data?.messages || [];
        setMessages(msgs.reverse());
      })
      .catch(() => {});

    // Socket
    const socket = connectSocket(token);
    socket.emit('join-room', conversation._id);
    socket.on('new-message', (msg) => {
      setMessages(prev => [msg, ...prev]);
    });
    socket.on('typing', ({ userId }) => {
      if (userId !== user._id) setTyping(true);
      setTimeout(() => setTyping(false), 2000);
    });

    return () => {
      socket.off('new-message');
      socket.off('typing');
    };
  }, []);

  const sendMessage = async () => {
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
      const res = await api.post('/messages', {
        conversationId: conversation._id,
        content,
      });
      const saved = res.data?.data?.message || res.data?.message;
      if (saved) {
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? saved : m));
        getSocket()?.emit('send-message', { ...saved, receiverId: contact._id });
      }
    } catch {
      setMessages(prev => prev.map(m => m._id === tempMsg._id ? { ...m, error: true } : m));
    }
  };

  const onTyping = (val) => {
    setText(val);
    getSocket()?.emit('typing', { conversationId: conversation._id, userId: user._id });
  };

  const isMe = (msg) => (msg.sender?._id || msg.sender) === user?._id;

  const renderMessage = ({ item }) => {
    const mine = isMe(item);
    return (
      <View style={[styles.msgRow, mine && styles.msgRowMe]}>
        {!mine && (
          contact.photo
            ? <Image source={{ uri: contact.photo }} style={styles.msgAvatar} />
            : <View style={styles.msgAvatarPlaceholder}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#000' }}>
                  {contact.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <View style={styles.bubbleMeta}>
            <Text style={styles.bubbleTime}>
              {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {mine && (
              <Ionicons
                name={item.pending ? 'time-outline' : item.error ? 'alert-circle-outline' : 'checkmark-done'}
                size={12}
                color={item.error ? colors.error : 'rgba(255,255,255,0.6)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        {contact.photo
          ? <Image source={{ uri: contact.photo }} style={styles.headerAvatar} />
          : <View style={styles.headerAvatarPlaceholder}>
              <Text style={{ fontWeight: '800', color: '#000' }}>{contact.name?.[0] || '?'}</Text>
            </View>
        }
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{contact.name || 'Contact'}</Text>
          {typing && <Text style={styles.typingTxt}>en train d'écrire…</Text>}
        </View>
        <TouchableOpacity style={{ padding: 4 }}>
          <Ionicons name="call-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.msgList}
        />

        {/* Barre de saisie */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={onTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!text.trim()}>
            <Ionicons name="send" size={18} color={text.trim() ? '#000' : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerAvatar:  { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerName:    { fontSize: 15, fontWeight: '700', color: colors.text },
  typingTxt:     { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  msgList:       { padding: 16, gap: 8 },
  msgRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe:      { justifyContent: 'flex-end' },
  msgAvatar:     { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  bubble:        { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMe:      { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: colors.backgroundCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText:    { fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bubbleTime:    { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.backgroundLight },
  chatInput:     { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn:       { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
});
