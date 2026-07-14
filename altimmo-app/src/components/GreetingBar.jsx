import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { fonts, fontSize } from '../theme';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bon après-midi';
  if (h >= 18 && h < 22) return 'Bonsoir';
  return 'Bonne nuit';
};

export default function GreetingBar({ onPressNotifications }) {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [greeting,    setGreeting]    = useState(getGreeting);

  const fullName = user?.name || '';
  const prenom = fullName.trim().split(' ')[0] || 'Invité';
  const initiale = (prenom[0] || '?').toUpperCase();
  const hasPhoto = Boolean(user?.photo);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get('/conversations/count/unread');
      setUnreadCount(res.data?.data?.unreadCount || 0);
    } catch {
      // silencieux — le badge reste à 0
    }
  }, []);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  // Met à jour la salutation toutes les minutes (passage minuit / midi / 18h / 22h)
  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchUnread();
  }, [fetchUnread]));

  return (
    <View style={styles.row}>
      {hasPhoto ? (
        <Image source={{ uri: user.photo }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.initiale}>{initiale}</Text>
        </View>
      )}

      <View style={styles.textWrap}>
        <Text style={styles.hello}>{greeting}</Text>
        <Text style={styles.prenom} numberOfLines={1}>{prenom}</Text>
      </View>

      <TouchableOpacity
        onPress={onPressNotifications}
        activeOpacity={0.7}
        hitSlop={6}
        accessibilityLabel={unreadCount > 0 ? `${unreadCount} notifications non lues` : 'Notifications'}
        accessibilityRole="button"
      >
        <View style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={20} color={c.textSub} />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: c.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: 12,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.bgCardAlt,
    borderWidth: 2,
    borderColor: c.borderGold,
  },
  avatarPlaceholder: {
    backgroundColor: c.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiale: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: c.gold,
  },

  textWrap: {
    flex: 1,
  },
  hello: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  prenom: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    lineHeight: 24,
  },

  bellWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.bgCardAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.gold,
    borderWidth: 1.5,
    borderColor: c.bgCard,
  },
});
