import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, fontSize, spacing } from '../theme';

export default function GreetingBar({ onPressNotifications }) {
  const { user } = useAuth();

  const fullName = user?.name || '';
  const prenom = fullName.trim().split(' ')[0] || 'Invité';
  const initiale = (prenom[0] || '?').toUpperCase();
  const hasPhoto = Boolean(user?.photo);

  return (
    <View style={styles.row}>
      {/* Avatar (photo ou placeholder avec initiale) */}
      {hasPhoto ? (
        <Image source={{ uri: user.photo }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.initiale}>{initiale}</Text>
        </View>
      )}

      {/* Greeting */}
      <View style={styles.textWrap}>
        <Text style={styles.hello}>Bonjour</Text>
        <Text style={styles.prenom} numberOfLines={1}>{prenom}</Text>
      </View>

      {/* Notification */}
      <TouchableOpacity
        style={styles.notifBtn}
        onPress={onPressNotifications}
        activeOpacity={0.7}
        hitSlop={6}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  // ─── Avatar ───
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCardAlt,
  },
  avatarPlaceholder: {
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiale: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
  },

  // ─── Greeting ───
  textWrap: {
    flex: 1,
  },
  hello: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  prenom: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
  },

  // ─── Notification ───
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
