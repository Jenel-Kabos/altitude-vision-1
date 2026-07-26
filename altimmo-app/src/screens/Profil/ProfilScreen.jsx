import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Linking, Share, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, fontSize, typography, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import FormSwitch from '../../components/FormSwitch';

const ROLE_COLOR = {
  admin:         colors.error,
  collaborateur: colors.warning,
  proprietaire:  colors.success,
  client:        colors.info,
  user:          colors.info,
};

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
};

// ─── MenuRow ────────────────────────────────────────────────────────────────
function MenuRow({ icon, label, onPress, danger, toggle, toggleVal, onToggle, styles, c }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, danger && styles.menuRowDanger]}
      onPress={onPress}
      disabled={!!toggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.menuIconWrap, danger && styles.menuIconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? c.error : c.gold} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: c.error }]}>{label}</Text>
      {toggle ? (
        <FormSwitch
          value={toggleVal}
          onValueChange={onToggle}
          accessibilityLabel={label}
        />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ─── ProfilScreen ────────────────────────────────────────────────────────────
export default function ProfilScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const { themeColors: c, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [stats, setStats] = useState({ biens: 0, vues: 0 });

  const role          = user?.role?.toLowerCase();
  const isProprietaire = role === 'proprietaire';
  const isAdmin        = role === 'admin';
  const canSeeMyBiens  = isProprietaire || isAdmin;
  const roleColor      = ROLE_COLOR[role] || colors.info;
  const roleLabel      = user?.role || 'Utilisateur';

  // Persistance toggle notifications
  useEffect(() => {
    AsyncStorage.getItem('notifications_enabled').then((val) => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const toggleNotifications = useCallback(async (value) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notifications_enabled', String(value));
  }, []);

  // Stats propriétaire
  useEffect(() => {
    if (!isProprietaire) return;
    (async () => {
      try {
        const res  = await api.get('/properties/my-properties');
        const biens = res.data?.data?.properties || res.data?.properties || [];
        setStats({ biens: biens.length, vues: biens.reduce((s, b) => s + (b.views || b.viewCount || 0), 0) });
      } catch {
        setStats({ biens: 0, vues: 0 });
      }
    })();
  }, [isProprietaire]);

  const pickAndUploadAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour changer votre photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;

    const formData = new FormData();
    formData.append('photo', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' });
    try {
      const res = await api.patch('/users/updateMe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data?.data?.user || {});
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo.');
    }
  }, [updateUser]);

  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler',      style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  const THEME_OPTIONS = [
    { value: 'light',  label: 'Clair',   icon: 'sunny-outline' },
    { value: 'system', label: 'Système', icon: 'phone-portrait-outline' },
    { value: 'dark',   label: 'Sombre',  icon: 'moon-outline' },
  ];

  const STORE_URL_ANDROID = 'https://play.google.com/store/apps/details?id=com.altitudevision.altimmo';
  const STORE_URL_IOS     = 'https://apps.apple.com/app/altimmo';

  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? STORE_URL_IOS : STORE_URL_ANDROID;
    Linking.openURL(url);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvre Altimmo, l'application immobilière du Congo Brazzaville 🏠\n${STORE_URL_ANDROID}`,
        url: STORE_URL_ANDROID,
        title: 'Altimmo — Immobilier Congo Brazzaville',
      });
    } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── Hero ──────────────────────────────────────────── */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['#0A0A0A', '#1C1408', '#2D1E04']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Avatar */}
          <TouchableOpacity
            onPress={pickAndUploadAvatar}
            activeOpacity={0.85}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de profil"
          >
            {user?.photo ? (
              <Image
                source={{ uri: user.photo }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{getInitials(user?.name)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Infos */}
          <Text style={styles.heroName}>{user?.name || 'Utilisateur'}</Text>
          {user?.email ? (
            <Text style={styles.heroEmail}>{user.email}</Text>
          ) : null}
          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* ─── Stats propriétaire ────────────────────────────── */}
        {isProprietaire && (
          <Animated.View
            entering={FadeInDown.delay(60).springify().damping(18)}
            style={styles.statsRow}
          >
            <View style={styles.statCard}>
              <Ionicons name="business-outline" size={20} color={c.gold} />
              <Text style={styles.statValue}>{stats.biens}</Text>
              <Text style={styles.statLabel}>Biens publiés</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMid]} />
            <View style={styles.statCard}>
              <Ionicons name="eye-outline" size={20} color={c.gold} />
              <Text style={styles.statValue}>{stats.vues}</Text>
              <Text style={styles.statLabel}>Vues totales</Text>
            </View>
          </Animated.View>
        )}

        {/* ─── Mes biens ─────────────────────────────────────── */}
        {canSeeMyBiens && (
          <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
            <Text style={styles.sectionTitle}>Mes biens</Text>
            <View style={styles.menuGroup}>
              <MenuRow
                icon="business-outline"
                label="Mes annonces"
                onPress={() => navigation.navigate('MesAnnonces')}
                styles={styles} c={c}
              />
              <View style={styles.menuSep} />
              <MenuRow
                icon="calendar-outline"
                label="Mes visites"
                onPress={() => navigation.navigate('Visites')}
                styles={styles} c={c}
              />
            </View>
          </Animated.View>
        )}

        {/* ─── Favoris & Transactions ────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
          <Text style={styles.sectionTitle}>Activité</Text>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="heart-outline"
              label="Mes favoris"
              onPress={() => navigation.navigate('Favoris')}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="swap-horizontal-outline"
              label="Mes transactions"
              onPress={() => navigation.navigate('Transactions')}
              styles={styles} c={c}
            />
          </View>
        </Animated.View>

        {/* ─── Compte ────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="person-outline"
              label="Modifier mon profil"
              onPress={() => navigation.navigate('EditProfile')}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="lock-closed-outline"
              label="Changer le mot de passe"
              onPress={() => navigation.navigate('ChangePassword')}
              styles={styles} c={c}
            />
          </View>
        </Animated.View>

        {/* ─── Apparence ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).springify().damping(18)}>
          <Text style={styles.sectionTitle}>Apparence</Text>
          <View style={styles.themeSelector}>
            {THEME_OPTIONS.map(({ value, label, icon }) => {
              const isActive = preference === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.themeBtn, isActive && styles.themeBtnActive]}
                  onPress={() => setPreference(value)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Mode ${label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={isActive ? c.gold : c.textMuted}
                  />
                  {isActive && (
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={c.gold}
                      style={{ position: 'absolute', top: 6, right: 6 }}
                    />
                  )}
                  <Text style={[styles.themeBtnLabel, isActive && styles.themeBtnLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ─── Préférences ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(260).springify().damping(18)}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="notifications-outline"
              label="Notifications"
              toggle
              toggleVal={notificationsEnabled}
              onToggle={toggleNotifications}
              styles={styles} c={c}
            />
          </View>
        </Animated.View>

        {/* ─── Support ───────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuGroup}>
            <MenuRow
              icon="help-circle-outline"
              label="Aide"
              onPress={() => Linking.openURL('mailto:contact@altitudevision.agency?subject=Aide%20Altimmo')}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="flag-outline"
              label="Signaler un problème"
              onPress={() => Linking.openURL('mailto:contact@altitudevision.agency?subject=Signalement%20Altimmo')}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="share-social-outline"
              label="Partager l'application"
              onPress={handleShare}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="cloud-download-outline"
              label="Mettre à jour l'application"
              onPress={handleUpdate}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Politique de confidentialité"
              onPress={() => navigation.navigate('PolitiqueConfidentialite')}
              styles={styles} c={c}
            />
            <View style={styles.menuSep} />
            <MenuRow
              icon="server-outline"
              label="Gestion du cache"
              onPress={() => navigation.navigate('CacheManagement')}
              styles={styles} c={c}
            />
          </View>
        </Animated.View>

        {/* ─── Déconnexion ───────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(340).springify().damping(18)}
          style={styles.dangerZone}
        >
          <View style={styles.menuGroup}>
            <MenuRow
              icon="log-out-outline"
              label="Se déconnecter"
              danger
              onPress={handleLogout}
              styles={styles} c={c}
            />
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: c.bg },
  scroll: { paddingBottom: spacing.xxl },

  // ─── Hero ───
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },

  // ─── Avatar ───
  avatarWrap: {
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
    borderColor: 'rgba(200,150,12,0.7)',
  },
  avatarFallback: {
    backgroundColor: '#1C1408',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: 'rgba(200,150,12,0.9)',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C8960C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },

  // ─── Infos héro ───
  heroName: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: '#F0EDE8',
    textAlign: 'center',
  },
  heroEmail: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.5)',
    textAlign: 'center',
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 100,
    marginTop: spacing.xs,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ─── Stats ───
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.bgCard,
    borderRadius: radius.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statCardMid: {
    flex: 0,
    width: 1,
    backgroundColor: c.border,
    height: 'auto',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.gold,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
    textAlign: 'center',
  },

  // ─── Section title ───
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    color: c.textMuted,
    letterSpacing: 0.9,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },

  // ─── Menu group (carte regroupant plusieurs rows) ───
  menuGroup: {
    backgroundColor: c.bgCard,
    borderRadius: radius.xs,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  menuSep: {
    height: 1,
    backgroundColor: c.border,
    marginLeft: 56,
  },

  // ─── MenuRow ───
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  menuRowDanger: {
    backgroundColor: 'rgba(163,45,45,0.06)',
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(200,150,12,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapDanger: {
    backgroundColor: 'rgba(163,45,45,0.1)',
  },
  menuLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
  },

  // ─── Sélecteur de thème ───
  themeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  themeBtn: {
    flex: 1,
    backgroundColor: c.bgCard,
    borderRadius: radius.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  themeBtnActive: {
    borderColor: c.gold,
    backgroundColor: c.bgCardAlt,
  },
  themeBtnLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  themeBtnLabelActive: {
    fontFamily: fonts.bodyBold,
    color: c.gold,
  },

  // ─── Danger zone ───
  dangerZone: {
    marginTop: spacing.md,
  },
});
