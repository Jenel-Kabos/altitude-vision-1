import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { cache, CACHE_CATEGORIES } from '../../services/cacheService';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';

function StatCard({ icon, label, value, sub, styles, c }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color={c.gold} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function CategoryRow({ cat, onClear, clearing, styles, c }) {
  const isEmpty = cat.count === 0;
  return (
    <View style={[styles.catRow, isEmpty && styles.catRowEmpty]}>
      <View style={[styles.catIcon, isEmpty && styles.catIconEmpty]}>
        <Ionicons name={cat.icon} size={16} color={isEmpty ? c.textMuted : c.gold} />
      </View>
      <View style={styles.catInfo}>
        <Text style={[styles.catLabel, isEmpty && styles.catLabelEmpty]}>{cat.label}</Text>
        <Text style={styles.catCount}>
          {cat.count} entrée{cat.count !== 1 ? 's' : ''} en mémoire
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.catClearBtn, isEmpty && styles.catClearBtnDisabled]}
        onPress={() => onClear(cat)}
        disabled={isEmpty || clearing === cat.key}
        hitSlop={8}
        activeOpacity={0.7}
      >
        {clearing === cat.key
          ? <ActivityIndicator size="small" color={c.gold} />
          : <Ionicons name="trash-outline" size={16} color={isEmpty ? c.textMuted : c.gold} />
        }
      </TouchableOpacity>
    </View>
  );
}

export default function CacheManagementScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [stats,       setStats]       = useState(null);
  const [clearing,    setClearing]    = useState(null);
  const [clearingImg, setClearingImg] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [lastCleared, setLastCleared] = useState(null);

  const loadStats = useCallback(() => { setStats(cache.getStats()); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const clearCategory = useCallback(async (cat) => {
    setClearing(cat.key);
    await new Promise(r => setTimeout(r, 350));
    cache.invalidate(cat.prefix);
    setLastCleared(`Cache "${cat.label}" vidé`);
    loadStats();
    setClearing(null);
  }, [loadStats]);

  const clearImageCache = useCallback(async () => {
    setClearingImg(true);
    try {
      await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
      setLastCleared('Cache images vidé');
    } catch {
      Alert.alert('Erreur', 'Impossible de vider le cache images.');
    } finally {
      setClearingImg(false);
    }
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert(
      'Vider tout le cache',
      "Toutes les données en cache (annonces, carte, images…) seront supprimées. L'application les rechargera depuis internet.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: async () => {
            setClearingAll(true);
            try {
              cache.clear();
              await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
              setLastCleared('Tout le cache a été vidé');
              loadStats();
            } catch {
              Alert.alert('Erreur', 'Erreur lors du nettoyage.');
            } finally {
              setClearingAll(false);
            }
          },
        },
      ],
    );
  }, [loadStats]);

  const totalEntries = stats?.total ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion du cache</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadStats} hitSlop={10}>
          <Ionicons name="refresh-outline" size={20} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {lastCleared && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.successText}>{lastCleared}</Text>
            <TouchableOpacity hitSlop={8} onPress={() => setLastCleared(null)}>
              <Ionicons name="close" size={14} color="#059669" />
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.statsRow}>
          <StatCard icon="server-outline"  label="Données API" value={totalEntries} sub="entrées en mémoire" styles={styles} c={c} />
          <StatCard icon="images-outline"  label="Images"      value="Disk"         sub="cache expo-image"   styles={styles} c={c} />
          <StatCard icon="time-outline"    label="Auto-expiration" value="TTL"      sub="2 – 15 min"         styles={styles} c={c} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={c.blue || '#185FA5'} />
          <Text style={styles.infoText}>
            Le cache accélère l'affichage en évitant de recharger les données depuis internet à chaque ouverture. Il s'efface automatiquement après expiration.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(280)}>
          <Text style={styles.sectionLabel}>Cache données</Text>
          <View style={styles.card}>
            {(stats?.byCategory || CACHE_CATEGORIES).map((cat, i) => (
              <React.Fragment key={cat.key}>
                <CategoryRow cat={cat} onClear={clearCategory} clearing={clearing} styles={styles} c={c} />
                {i < CACHE_CATEGORIES.length - 1 && <View style={styles.rowSep} />}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(280)}>
          <Text style={styles.sectionLabel}>Cache images</Text>
          <View style={styles.card}>
            <View style={styles.imgCacheRow}>
              <View style={styles.catIcon}>
                <Ionicons name="images-outline" size={16} color={c.gold} />
              </View>
              <View style={styles.catInfo}>
                <Text style={styles.catLabel}>Photos & médias</Text>
                <Text style={styles.catCount}>Stockées sur le disque par expo-image</Text>
              </View>
              <TouchableOpacity style={styles.catClearBtn} onPress={clearImageCache} disabled={clearingImg} hitSlop={8} activeOpacity={0.7}>
                {clearingImg
                  ? <ActivityIndicator size="small" color={c.gold} />
                  : <Ionicons name="trash-outline" size={16} color={c.gold} />
                }
              </TouchableOpacity>
            </View>
            <View style={styles.rowSep} />
            <View style={styles.imgCacheRow}>
              <View style={[styles.catIcon, { backgroundColor: 'rgba(46,123,181,0.10)' }]}>
                <Ionicons name="flash-outline" size={16} color={c.blue || '#185FA5'} />
              </View>
              <View style={styles.catInfo}>
                <Text style={styles.catLabel}>Mémoire vive</Text>
                <Text style={styles.catCount}>Libérée automatiquement par le système</Text>
              </View>
              <TouchableOpacity
                style={[styles.catClearBtn, { borderColor: c.blue || '#185FA5' }]}
                onPress={async () => { setClearingImg(true); await Image.clearMemoryCache(); setLastCleared('Cache mémoire vidé'); setClearingImg(false); }}
                disabled={clearingImg}
                hitSlop={8}
                activeOpacity={0.7}
              >
                {clearingImg
                  ? <ActivityIndicator size="small" color={c.blue || '#185FA5'} />
                  : <Ionicons name="trash-outline" size={16} color={c.blue || '#185FA5'} />
                }
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(280)}>
          <TouchableOpacity
            style={[styles.clearAllBtn, clearingAll && styles.clearAllBtnLoading]}
            onPress={clearAll}
            disabled={clearingAll}
            activeOpacity={0.85}
          >
            {clearingAll
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            }
            <Text style={styles.clearAllText}>
              {clearingAll ? 'Nettoyage en cours…' : 'Vider tout le cache'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Après le nettoyage, les données seront rechargées depuis internet lors de la prochaine ouverture de chaque écran.
          </Text>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },

  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(5,150,105,0.10)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(5,150,105,0.25)',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  successText: { fontFamily: fonts.body, fontSize: 13, color: '#059669', flex: 1 },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: c.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: c.border,
    alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 4, gap: 3,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 9, backgroundColor: c.goldMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue:  { fontFamily: fonts.bodyBold, fontSize: 18, color: c.text },
  statLabel:  { fontFamily: fonts.bodyBold, fontSize: 11, color: c.text, textAlign: 'center' },
  statSub:    { fontFamily: fonts.body, fontSize: 10, color: c.textMuted, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(46,123,181,0.07)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(46,123,181,0.15)',
    padding: spacing.md,
  },
  infoText: { fontFamily: fonts.body, fontSize: 13, color: c.textSub, flex: 1, lineHeight: 19 },

  sectionLabel: {
    fontFamily: fonts.bodyBold, fontSize: 11, color: c.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  card: { backgroundColor: c.bgCard, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  rowSep: { height: 1, backgroundColor: c.border, marginHorizontal: spacing.md },

  catRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },
  catRowEmpty:    { opacity: 0.55 },
  catIcon:        { width: 34, height: 34, borderRadius: 9, backgroundColor: c.goldMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catIconEmpty:   { backgroundColor: c.bgCardAlt },
  catInfo:        { flex: 1 },
  catLabel:       { fontFamily: fonts.bodyBold, fontSize: 14, color: c.text, marginBottom: 2 },
  catLabelEmpty:  { color: c.textSub },
  catCount:       { fontFamily: fonts.body, fontSize: 11, color: c.textMuted },
  catClearBtn:         { width: 34, height: 34, borderRadius: 9, backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.borderGold, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catClearBtnDisabled: { borderColor: c.border, opacity: 0.4 },

  imgCacheRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },

  clearAllBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 16 },
  clearAllBtnLoading: { opacity: 0.7 },
  clearAllText:       { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  disclaimer:         { fontFamily: fonts.body, fontSize: 12, color: c.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
});
