import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { colors } from '../../theme/colors';
import api from '../../services/api';

const STATUS_COLOR = {
  planifiee:  colors.info,
  confirmee:  colors.success,
  effectuee:  colors.textMuted,
  annulee:    colors.error,
};

const STATUS_LABEL = {
  planifiee:  'Planifiée',
  confirmee:  'Confirmée',
  effectuee:  'Effectuée',
  annulee:    'Annulée',
};

export default function VisitesScreen() {
  const [visites,  setVisites]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/visites')
      .then(res => setVisites(res.data?.data?.visites || res.data?.visites || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, statut) => {
    try {
      await api.patch(`/visites/${id}`, { statut });
      setVisites(prev => prev.map(v => v._id === id ? { ...v, statut } : v));
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour.');
    }
  };

  const renderVisite = ({ item }) => {
    const isOpen = selected === item._id;
    const statusColor = STATUS_COLOR[item.statut] || colors.textMuted;
    const date = item.date ? format(new Date(item.date), 'EEEE d MMMM yyyy', { locale: fr }) : '—';
    const heure = item.heure || item.time || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelected(isOpen ? null : item._id)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bien} numberOfLines={1}>
              {item.property?.title || item.bien?.titre || 'Bien immobilier'}
            </Text>
            <Text style={styles.date}>{date}{heure ? ` — ${heure}` : ''}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
            <Text style={[styles.badgeTxt, { color: statusColor }]}>
              {STATUS_LABEL[item.statut] || item.statut}
            </Text>
          </View>
        </View>

        {isOpen && (
          <View style={styles.actions}>
            {item.statut === 'planifiee' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.success }]}
                onPress={() => updateStatus(item._id, 'confirmee')}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                <Text style={[styles.actionTxt, { color: colors.success }]}>Confirmer</Text>
              </TouchableOpacity>
            )}
            {['planifiee', 'confirmee'].includes(item.statut) && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.error }]}
                onPress={() => Alert.alert('Annuler la visite ?', '', [
                  { text: 'Non', style: 'cancel' },
                  { text: 'Oui', style: 'destructive', onPress: () => updateStatus(item._id, 'annulee') },
                ])}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                <Text style={[styles.actionTxt, { color: colors.error }]}>Annuler</Text>
              </TouchableOpacity>
            )}
            {item.statut === 'confirmee' && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.primary }]}
                onPress={() => updateStatus(item._id, 'effectuee')}
              >
                <Ionicons name="flag-outline" size={16} color={colors.primary} />
                <Text style={[styles.actionTxt, { color: colors.primary }]}>Effectuée</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Mes Visites</Text>

      {loading
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={visites}
            keyExtractor={(item, i) => item._id || String(i)}
            renderItem={renderVisite}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTxt}>Aucune visite planifiée</Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  title:       { fontSize: 24, fontWeight: '800', color: colors.text, padding: 16, paddingBottom: 8 },
  card:        { backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  bien:        { fontSize: 15, fontWeight: '700', color: colors.text },
  date:        { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeTxt:    { fontSize: 11, fontWeight: '700' },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  actionTxt:   { fontSize: 13, fontWeight: '600' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:    { color: colors.textMuted, fontSize: 16 },
});
