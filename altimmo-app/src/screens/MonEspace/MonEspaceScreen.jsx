// GL-MOBILE-CLIENT-SPACE-01 — "Mon espace" : dashboard personnel Client.
//
// Réutilise :
//   - useAuth (identité), useTheme (design system Altimmo)
//   - Écrans existants via navigation (Favoris, Visites, Transactions,
//     MyDocuments, MyHotelReservations, MyAccommodationReservations,
//     RealEstateApplications, TenantPortal, Notifications, EditProfile)
//   - Hook useMonEspaceOverview (compteurs backend réels + statut locataire)
//
// L'espace locataire n'est présenté QUE si le backend confirme
// tenantLink.linked === true. Le TenantPortal existant est ouvert par la
// route TenantPortal — aucune duplication.

import React, { useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Image as NativeImage,
  RefreshControl, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import { useMonEspaceOverview } from '../../hooks/useMonEspaceOverview';

const MON_ESPACE_HERO = require('../../../assets/images/mon-espace-hero.png');

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
};

function computeUserStatus({ role, tenantLinked }) {
  const parts = [];
  if (role === 'Proprietaire') parts.push('Propriétaire');
  else parts.push('Client');
  if (tenantLinked) parts.push('Locataire');
  return parts.join(' & ');
}

function StatCard({ icon, label, value, loading, onPress, c }) {
  const display = loading ? '—' : (value == null ? '·' : String(value));
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.statCard, { backgroundColor: c.bgCard, borderColor: c.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${display}`}
    >
      <View style={[styles.statIconWrap, { backgroundColor: colors.goldLight }]}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{display}</Text>
      <Text
        style={[styles.statLabel, { color: c.textSub }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ServiceTile({ icon, label, onPress, badge, disabled, c }) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.7}
      disabled={disabled}
      style={[
        styles.serviceTile,
        { backgroundColor: c.bgCard, borderColor: c.border, opacity: disabled ? 0.5 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.serviceIconWrap, { backgroundColor: colors.goldLight }]}>
        <Ionicons name={icon} size={22} color={colors.gold} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.serviceLabel, { color: c.text }]} numberOfLines={3}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MonEspaceScreen({ navigation }) {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const { stats, tenantLink, refresh, refreshing } = useMonEspaceOverview();

  const goto = useCallback((route, params) => navigation.navigate(route, params), [navigation]);

  const status = useMemo(
    () => computeUserStatus({ role: user?.role, tenantLinked: tenantLink.linked }),
    [user?.role, tenantLink.linked],
  );

  const services = useMemo(() => {
    const list = [
      { key: 'annonces', icon: 'home-outline', label: 'Mes annonces', route: 'MesAnnonces',
        show: user?.role === 'Proprietaire' || user?.role === 'Admin' },
      { key: 'visites', icon: 'calendar-outline', label: 'Mes visites', route: 'Visites' },
      { key: 'transactions', icon: 'card-outline', label: 'Mes transactions', route: 'Transactions' },
      { key: 'favoris', icon: 'heart-outline', label: 'Mes favoris', route: 'Favoris' },
      { key: 'tenant', icon: 'key-outline', label: 'Espace locataire', route: 'TenantPortal',
        show: tenantLink.linked },
      { key: 'documents', icon: 'folder-open-outline', label: 'Mes documents', route: 'MyDocuments' },
      { key: 'hotel', icon: 'bed-outline', label: 'Mes réservations hôtel', route: 'MyHotelReservations' },
      { key: 'accom', icon: 'business-outline', label: 'Mes hébergements', route: 'MyAccommodationReservations' },
      { key: 'candidatures', icon: 'document-text-outline', label: 'Mes candidatures', route: 'RealEstateApplications' },
    ];
    return list.filter((item) => item.show !== false);
  }, [user?.role, tenantLink.linked]);

  const openVisites = () => navigation.getParent()?.navigate('Visites') ?? goto('Visites');

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <View accessible={false} accessibilityLabel="Hero immobilier Altimmo" style={styles.hero}>
          <View accessible={false} accessibilityLabel="Ruban orange Altimmo" style={styles.header}>
            <NativeImage
              source={MON_ESPACE_HERO}
              resizeMode="cover"
              pointerEvents="none"
              accessible
              accessibilityLabel="Bannière immobilière Altimmo"
              style={styles.heroPhoto}
            />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Mon espace</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => goto('Notifications')}
                  accessibilityLabel="Notifications"
                  accessibilityRole="button"
                  style={styles.headerIconBtn}
                >
                  <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => goto('ProfilHome', { settingsOnly: true })}
                  accessibilityLabel="Ouvrir les réglages du compte"
                  accessibilityRole="button"
                  style={styles.headerIconBtn}
                >
                  <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View
            accessible={false}
            accessibilityLabel="Carte profil"
            style={[styles.userCard, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <View style={styles.userRow}>
              {user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.goldLight }]}>
                  <Text style={[styles.avatarInitials, { color: colors.goldDark }]}>{getInitials(user?.name)}</Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>
                  {user?.name || 'Utilisateur'}
                </Text>
                <View style={[styles.statusChip, { backgroundColor: colors.goldLight, borderColor: colors.borderGold }]}>
                  <Text style={[styles.statusChipText, { color: colors.goldDark }]}>{status}</Text>
                </View>
                {user?.email ? (
                  <Text style={[styles.userMeta, { color: c.textSub }]} numberOfLines={1}>
                    <Ionicons name="mail-outline" size={12} color={c.textSub} /> {user.email}
                  </Text>
                ) : null}
                {user?.phone ? (
                  <Text style={[styles.userMeta, { color: c.textSub }]} numberOfLines={1}>
                    <Ionicons name="call-outline" size={12} color={c.textSub} /> {user.phone}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => goto('EditProfile')}
                accessibilityRole="button"
                accessibilityLabel="Modifier mon profil"
                style={[styles.editProfileBtn, { backgroundColor: c.bgCardAlt }]}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.gold} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsRow}>
          <StatCard icon="heart-outline" label="Favoris"
            value={stats.favorites.count} loading={stats.favorites.loading}
            onPress={() => goto('Favoris')} c={c} />
          <StatCard icon="calendar-outline" label="Visites"
            value={stats.visits.count} loading={stats.visits.loading}
            onPress={openVisites} c={c} />
          <StatCard icon="folder-open-outline" label="Documents"
            value={stats.documents.count} loading={stats.documents.loading}
            onPress={() => goto('MyDocuments')} c={c} />
          <StatCard icon="card-outline" label="Transactions"
            value={stats.transactions.count} loading={stats.transactions.loading}
            onPress={() => goto('Transactions')} c={c} />
        </View>

        {/* Bloc Espace locataire (uniquement si linked) */}
        {tenantLink.linked ? (
          <TouchableOpacity
            onPress={() => goto('TenantPortal')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l'espace locataire"
            style={[styles.tenantBanner, { borderColor: colors.borderGold }]}
          >
            <LinearGradient
              colors={[colors.goldLight, '#FFFFFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.tenantBannerInner}
            >
              <View style={[styles.tenantIconWrap, { backgroundColor: colors.gold }]}>
                <Ionicons name="key-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.tenantBannerText}>
                <Text style={[styles.tenantBannerTitle, { color: c.text }]}>Espace locataire</Text>
                <Text style={[styles.tenantBannerSubtitle, { color: c.textSub }]} numberOfLines={2}>
                  Bail, paiements, documents, maintenance et préavis.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gold} />
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {/* Grille services */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Mes services</Text>
        <View style={styles.servicesGrid}>
          {services.map((svc) => (
            <ServiceTile
              key={svc.key}
              icon={svc.icon}
              label={svc.label}
              onPress={() => svc.key === 'visites' ? openVisites() : goto(svc.route)}
              c={c}
            />
          ))}
        </View>

        {/* Sécurité / footer secondaire */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  hero: { marginHorizontal: -spacing.md },

  header: {
    height: 190,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden',
    // Fallback opaque requis : certains dev-clients Android ne peignent pas
    // LinearGradient. Le hero reste alors orange et le texte lisible.
    backgroundColor: '#E85D04',
  },
  heroPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  headerRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  userCard: {
    marginTop: -60,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  editProfileBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontFamily: fonts.bodyBold, fontSize: fontSize.lg },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontFamily: fonts.displaySemi, fontSize: 18 },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 2,
  },
  statusChipText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs },
  userMeta: { fontFamily: fonts.body, fontSize: fontSize.xs, marginTop: 1 },

  statsRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontFamily: fonts.bodyBold, fontSize: fontSize.md },
  statLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, textAlign: 'center', minHeight: 24 },

  tenantBanner: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tenantBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  tenantIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  tenantBannerText: { flex: 1 },
  tenantBannerTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSize.md },
  tenantBannerSubtitle: { fontFamily: fonts.body, fontSize: fontSize.sm, marginTop: 2 },

  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceTile: {
    width: '31%',
    minHeight: 112,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  serviceIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  serviceLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.bodyBold },
});
