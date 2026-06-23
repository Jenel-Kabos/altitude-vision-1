import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, Alert, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { colors, typography, spacing } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const DAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const formatVisiteDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const day = DAYS_SHORT[d.getDay()];
  const num = d.getDate();
  const month = MONTHS_LONG[d.getMonth()];
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${num} ${month} ${year} à ${h}h${m}`;
};

const STATUT_COLOR = {
  'confirmée': colors.success,
  'confirmee': colors.success,
  'en attente': colors.warning,
  'annulée':   colors.error,
  'annulee':   colors.error,
};

export default function VisitesScreen() {
  const [visites, setVisites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('venir');

  const chargerVisites = async () => {
    try {
      const response = await api.get('/visites');
      const data = response.data?.data?.visites
        || response.data?.data
        || response.data?.visites
        || response.data
        || [];
      setVisites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Erreur visites:', error.message);
      setVisites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerVisites(); }, []);

  const now = new Date();
  const isFuture = (v) => {
    const d = new Date(v.date);
    return !isNaN(d) && d.getTime() >= now.getTime();
  };

  const filtered = visites.filter(v =>
    tab === 'venir' ? isFuture(v) : !isFuture(v)
  );

  const annulerVisite = (visite) => {
    Alert.alert(
      'Annuler la visite',
      `Confirmer l'annulation de la visite du ${formatVisiteDate(visite.date)} ?`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la visite',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: confirmer l'endpoint exact côté backend
              await api.patch(`/visites/${visite._id}`, { statut: 'annulée' });
              chargerVisites();
            } catch {
              Alert.alert('Erreur', 'Impossible d\'annuler la visite.');
            }
          },
        },
      ],
    );
  };

  const renderVisite = ({ item }) => {
    const bien = item.bien || item.property || {};
    const title = bien.title || bien.titre || 'Bien immobilier';
    const arrondissement = bien.address?.arrondissement || bien.location?.neighborhood || '';
    const city = bien.address?.city || bien.location?.city || '';
    const address = [arrondissement, city].filter(Boolean).join(', ');
    const image = bien.images?.[0] || bien.photos?.[0];
    const statut = (item.statut || 'en attente').toLowerCase();
    const statutColor = STATUT_COLOR[statut] || colors.warning;
    const showCancel = tab === 'venir' && !statut.includes('annul');

    return (
      <View style={styles.card}>
        <View style={[styles.badge, { backgroundColor: statutColor }]}>
          <Text style={styles.badgeText}>{item.statut || 'En attente'}</Text>
        </View>

        <View style={styles.row}>
          {image ? (
            <Image source={{ uri: image }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Ionicons name="home-outline" size={28} color={colors.primary} />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {address ? (
              <Text style={styles.address} numberOfLines={1}>{address}</Text>
            ) : null}
            <Text style={styles.date}>{formatVisiteDate(item.date)}</Text>
          </View>
        </View>

        {showCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => annulerVisite(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes visites</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tab, tab === 'venir' && styles.tabActive]}
          onPress={() => setTab('venir')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'venir' && styles.tabTextActive]}>
            À venir
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'passees' && styles.tabActive]}
          onPress={() => setTab('passees')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'passees' && styles.tabTextActive]}>
            Passées
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item._id || item.id}
        renderItem={renderVisite}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          tab === 'venir' ? (
            <EmptyState
              icon="calendar-outline"
              title="Aucune visite à venir"
              subtitle="Demandez une visite depuis une annonce."
            />
          ) : (
            <EmptyState
              icon="time-outline"
              title="Aucune visite passée"
              subtitle=""
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    padding: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text,
  },

  // Tabs
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 100,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 100,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // List
  list: {
    paddingBottom: spacing.xxl,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 100,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingRight: 80,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  thumbFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  address: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Cancel button
  cancelBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  cancelBtnText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
});
