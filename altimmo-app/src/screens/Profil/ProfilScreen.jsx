import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ScrollView, Alert, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const ROLE_COLOR = {
  admin:         colors.error,
  collaborateur: colors.warning,
  proprietaire:  colors.success,
  client:        colors.info,
  user:          colors.info,
};

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  const inits = parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');
  return inits || '?';
};

function MenuRow({ icon, label, onPress, danger, toggle, toggleVal, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, danger && styles.menuRowDanger]}
      onPress={onPress}
      disabled={!!toggle}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={24}
        color={danger ? colors.error : colors.primary}
      />
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>
        {label}
      </Text>
      {toggle ? (
        <Switch
          value={toggleVal}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfilScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [stats, setStats] = useState({ biens: 0, vues: 0 });

  const role = user?.role?.toLowerCase();
  const isProprietaire = role === 'proprietaire';
  const isAdmin        = role === 'admin';
  const canSeeMyBiens  = isProprietaire || isAdmin;
  const roleColor = ROLE_COLOR[role] || colors.info;
  const roleLabel = user?.role || 'Utilisateur';

  // Persistance toggle notifications
  useEffect(() => {
    AsyncStorage.getItem('notifications_enabled').then((val) => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const toggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notifications_enabled', String(value));
  };

  // Stats Proprietaire — best-effort fetch
  useEffect(() => {
    if (!isProprietaire) return;
    (async () => {
      try {
        const res = await api.get('/properties/my-properties');
        const biens = res.data?.data?.properties || res.data?.properties || [];
        const vues = biens.reduce((s, b) => s + (b.views || b.viewCount || 0), 0);
        setStats({ biens: biens.length, vues });
      } catch {
        setStats({ biens: 0, vues: 0 });
      }
    })();
  }, [isProprietaire]);

  const pickAndUploadAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission requise');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;

    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    });
    try {
      const res = await api.patch('/users/updateMe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data?.data?.user || {});
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={pickAndUploadAvatar} activeOpacity={0.8}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{getInitials(user?.name)}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.name}>{user?.name || 'Utilisateur'}</Text>

          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Stats Proprietaire */}
        {isProprietaire && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.biens}</Text>
              <Text style={styles.statLabel}>Biens publiés</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.vues}</Text>
              <Text style={styles.statLabel}>Vues totales</Text>
            </View>
          </View>
        )}

        {/* Mes biens — Proprietaire / Admin only */}
        {canSeeMyBiens && (
          <>
            <Text style={styles.sectionTitle}>Mes biens</Text>
            <MenuRow
              icon="business-outline"
              label="Mes annonces"
              onPress={() => navigation.navigate('Annonces', {
                screen: 'ListeAnnonces',
                params: { filterOwner: user?._id },
              })}
            />
            <MenuRow
              icon="calendar-outline"
              label="Mes visites"
              onPress={() => navigation.navigate('Visites')}
            />
            {/* TODO: brancher quand PaiementsStack sera enregistré dans TabNavigator
            <MenuRow
              icon="card-outline"
              label="Mes paiements"
              onPress={() => navigation.navigate('Paiements')}
            />
            */}
          </>
        )}

        {/* Compte */}
        <Text style={styles.sectionTitle}>Compte</Text>
        <MenuRow
          icon="person-outline"
          label="Modifier mon profil"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <MenuRow
          icon="lock-closed-outline"
          label="Changer le mot de passe"
          onPress={() => navigation.navigate('ChangePassword')}
        />

        {/* Préférences */}
        <Text style={styles.sectionTitle}>Préférences</Text>
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          toggle
          toggleVal={notificationsEnabled}
          onToggle={toggleNotifications}
        />

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <MenuRow
          icon="help-circle-outline"
          label="Aide"
          onPress={() => Linking.openURL('mailto:contact@altitudevision.agency?subject=Aide%20Altimmo')}
        />
        <MenuRow
          icon="flag-outline"
          label="Signaler un problème"
          onPress={() => Linking.openURL('mailto:contact@altitudevision.agency?subject=Signalement%20Altimmo')}
        />

        {/* Danger zone */}
        <View style={styles.dangerZone}>
          <MenuRow
            icon="log-out-outline"
            label="Se déconnecter"
            danger
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },

  // Header
  header: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.md,
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 100,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Section title
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Menu row
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  menuRowDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
  },
  menuLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  // Danger zone
  dangerZone: {
    marginTop: spacing.xl,
  },
});
