import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { fonts, fontSize, spacing } from '../theme';

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

  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

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
        style={styles.notifBtn}
        onPress={onPressNotifications}
        activeOpacity={0.7}
        hitSlop={6}
        accessibilityLabel={unreadCount > 0 ? `${unreadCount} notifications non lues` : 'Notifications'}
        accessibilityRole="button"
      >
        <Ionicons
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={22}
          color={unreadCount > 0 ? c.gold : c.text}
        />
        {badgeLabel && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgCardAlt,
    borderWidth: 1.5,
    borderColor: c.borderGold,
  },
  avatarPlaceholder: {
    backgroundColor: c.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiale: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.goldDark,
  },

  textWrap: {
    flex: 1,
  },
  hello: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  prenom: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },

  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: c.bgCardAlt,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
