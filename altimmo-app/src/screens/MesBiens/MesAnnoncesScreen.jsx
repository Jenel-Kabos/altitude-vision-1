import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, Alert, Modal,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// ─── Constantes bail ─────────────────────────────────────────────────────────
const TENANT_PROFILES = [
  'Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité',
];
const REQUIRED_DOCUMENTS = [
  'CNI', 'Justificatif de revenus', '2 derniers bulletins de salaire',
  'Caution bancaire', 'Attestation de travail', 'Quittance de loyer précédente',
];

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/600x450/F5F5F2/C8960C?text=Altimmo';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getModerationInfo = (statusAdmin) => {
  if (statusAdmin === 'Validée')   return { label: 'Publié',       tone: 'success', icon: 'checkmark-circle' };
  if (statusAdmin === 'Rejetée')   return { label: 'Rejeté',       tone: 'error',   icon: 'close-circle' };
  return                                   { label: 'En validation', tone: 'warning', icon: 'time-outline' };
};

// ─── Composant ───────────────────────────────────────────────────────────────
export default function MesAnnoncesScreen({ navigation }) {
  const { user } = useAuth();

  const [biens, setBiens]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaseModal, setLeaseModal] = useState(null);

  // ─── Stats dérivées ──────────────────────────────────────────────────────
  const stats = {
    total:      biens.length,
    publies:    biens.filter(b => b.statusAdmin === 'Validée').length,
    attente:    biens.filter(b => !b.statusAdmin || b.statusAdmin === 'En attente').length,
    rejetes:    biens.filter(b => b.statusAdmin === 'Rejetée').length,
    disponibles: biens.filter(b => b.availability === 'Disponible').length,
    occupes:    biens.filter(b => ['Loué', 'Vendu'].includes(b.availability)).length,
  };

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/properties/my-properties');
      const data = res.data?.data?.properties || res.data?.properties || [];
      setBiens(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger vos biens.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { charger(); }, []));

  const onRefresh = () => { setRefreshing(true); charger(true); };

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleEdit = (item) =>
    navigation.navigate('PublierBien', { editProperty: item });

  const handleDelete = (item) => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${item.title || 'ce bien'}" définitivement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/properties/${item._id}`);
              setBiens(prev => prev.filter(b => b._id !== item._id));
            } catch (e) {
              Alert.alert('Erreur', e.response?.data?.message || 'Impossible de supprimer.');
            }
          },
        },
      ],
    );
  };

  const handleToggleAvailability = async (item) => {
    const isLocation = item.status?.toLowerCase() === 'location';
    const next = item.availability === 'Disponible'
      ? (isLocation ? 'Loué' : 'Vendu')
      : 'Disponible';
    try {
      const res = await api.put(`/properties/${item._id}`, { availability: next });
      const updated = res.data?.data?.property || res.data?.property;
      if (updated) setBiens(prev => prev.map(b => b._id === item._id ? updated : b));
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de modifier.');
    }
  };

  const openLeaseModal = (item) =>
    setLeaseModal({
      property: item,
      cautionMultiplicateur: String(item.cautionMultiplicateur ?? 2),
      profilsLocataireRecherches: item.profilsLocataireRecherches || [],
      documentsRequis: item.documentsRequis || [],
    });

  const toggleLeaseValue = (field, value) =>
    setLeaseModal(cur => {
      const arr = cur?.[field] || [];
      return {
        ...cur,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });

  const saveLeaseTerms = async () => {
    if (!leaseModal?.property?._id) return;
    try {
      const res = await api.put(`/properties/${leaseModal.property._id}`, {
        cautionMultiplicateur: Number(leaseModal.cautionMultiplicateur || 0),
        profilsLocataireRecherches: leaseModal.profilsLocataireRecherches,
        documentsRequis: leaseModal.documentsRequis,
      });
      const updated = res.data?.data?.property || res.data?.property;
      if (updated) setBiens(prev => prev.map(b => b._id === updated._id ? updated : b));
      setLeaseModal(null);
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de sauvegarder.');
    }
  };

  // ─── Rendu carte ─────────────────────────────────────────────────────────
  const renderBien = ({ item }) => {
    const isLocation = item.status?.toLowerCase() === 'location';
    const modInfo    = getModerationInfo(item.statusAdmin);
    const city       = item.address?.city || 'Brazzaville';
    const arrond     = item.address?.arrondissement;
    const adresse    = arrond ? `${arrond} · ${city}` : city;
    const prix       = item.price ? Number(item.price).toLocaleString('fr-FR') : '—';
    const disponible = item.availability === 'Disponible';

    const toneColor = {
      success: colors.success,
      error:   colors.error,
      warning: colors.warning,
    }[modInfo.tone];

    const toneBg = {
      success: '#DCFCE7',
      error:   '#FEE2E2',
      warning: '#FEF3C7',
    }[modInfo.tone];

    return (
      <View style={styles.card}>
        {/* Image + badges */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: item.images?.[0] || PLACEHOLDER_IMG }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Badge modération */}
          <View style={[styles.modBadge, { backgroundColor: toneBg }]}>
            <Ionicons name={modInfo.icon} size={12} color={toneColor} />
            <Text style={[styles.modBadgeText, { color: toneColor }]}>
              {modInfo.label}
            </Text>
          </View>
          {/* Badge type */}
          <View style={[styles.typeBadge, isLocation ? styles.typeBadgeLoc : styles.typeBadgeVente]}>
            <Text style={[styles.typeBadgeText, isLocation ? styles.typeBadgeTextLoc : styles.typeBadgeTextVente]}>
              {isLocation ? 'LOCATION' : 'VENTE'}
            </Text>
          </View>
        </View>

        {/* Contenu */}
        <View style={styles.body}>
          <Text style={styles.titre} numberOfLines={1}>{item.title || 'Sans titre'}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaType}>{(item.type || '').toUpperCase()}</Text>
            <View style={[styles.dispBadge, disponible ? styles.dispBadgeOk : styles.dispBadgeOff]}>
              <View style={[styles.dispDot, { backgroundColor: disponible ? colors.success : colors.error }]} />
              <Text style={[styles.dispText, { color: disponible ? colors.success : colors.error }]}>
                {item.availability || 'Disponible'}
              </Text>
            </View>
          </View>

          <Text style={styles.adresse} numberOfLines={1}>{adresse}</Text>
          <Text style={styles.prix}>{prix} FCFA{isLocation ? '/mois' : ''}</Text>

          {/* Résumé bail si location */}
          {isLocation && (
            <View style={styles.bailResume}>
              <Ionicons name="document-text-outline" size={12} color={colors.blue} />
              <Text style={styles.bailResumeText}>
                Caution {item.cautionMultiplicateur ?? 2} mois
                {item.profilsLocataireRecherches?.length
                  ? ` · ${item.profilsLocataireRecherches.length} profil(s)`
                  : ''}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionEdit]}
              onPress={() => handleEdit(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color={colors.blue} />
              <Text style={[styles.actionText, { color: colors.blue }]}>Modifier</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDisp]}
              onPress={() => handleToggleAvailability(item)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={disponible ? 'toggle' : 'toggle-outline'}
                size={15}
                color={colors.black}
              />
              <Text style={styles.actionText}>
                {disponible
                  ? (isLocation ? 'Louer' : 'Vendre')
                  : 'Disponible'}
              </Text>
            </TouchableOpacity>

            {isLocation && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBail]}
                onPress={() => openLeaseModal(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={15} color={colors.blue} />
                <Text style={[styles.actionText, { color: colors.blue }]}>Bail</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDelete]}
              onPress={() => handleDelete(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={15} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── Header liste ─────────────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Banner stats */}
      <LinearGradient
        colors={[colors.black, '#123B5E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <Text style={styles.bannerEyebrow}>Portfolio immobilier</Text>
        <View style={styles.bannerTitleRow}>
          <Text style={styles.bannerTitle}>Mes biens</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalValue}>{stats.total}</Text>
            <Text style={styles.totalLabel}>biens</Text>
          </View>
        </View>
        <Text style={styles.bannerSub}>
          Gérez la disponibilité et les conditions de bail de vos publications.
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.statValue}>{stats.publies}</Text>
            <Text style={styles.statLabel}>Publiés</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={styles.statValue}>{stats.attente}</Text>
            <Text style={styles.statLabel}>Validation</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="close-circle" size={18} color={colors.error} />
            <Text style={styles.statValue}>{stats.rejetes}</Text>
            <Text style={styles.statLabel}>Rejetés</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="home-outline" size={18} color={colors.gold} />
            <Text style={styles.statValue}>{stats.disponibles}</Text>
            <Text style={styles.statLabel}>Disponibles</Text>
          </View>
        </View>

        <View style={styles.pendingNote}>
          <View style={[styles.noteDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.noteText}>
            Les nouveaux biens restent invisibles jusqu'à validation admin.
          </Text>
        </View>
      </LinearGradient>

      {/* Bouton ajouter */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('PublierBien', {})}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={20} color={colors.white} />
        <Text style={styles.addBtnText}>Ajouter un bien</Text>
      </TouchableOpacity>

      <Text style={styles.listTitle}>Mes publications</Text>
    </>
  );

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mes annonces</Text>
        <View style={{ width: 36 }} />
      </View>
      <LoadingSpinner />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mes annonces</Text>
        <TouchableOpacity
          style={styles.addIconBtn}
          onPress={() => navigation.navigate('PublierBien', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={biens}
        renderItem={renderBien}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="home-outline"
            title="Aucun bien publié"
            subtitle="Ajoutez votre premier bien pour le mettre en vitrine."
            actionLabel="Publier un bien"
            onAction={() => navigation.navigate('PublierBien', {})}
          />
        }
      />

      {/* Modal conditions de bail */}
      {leaseModal && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setLeaseModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Conditions de bail</Text>
              <Text style={styles.modalProp} numberOfLines={1}>
                {leaseModal.property?.title}
              </Text>

              <Text style={styles.fieldLabel}>Caution demandée</Text>
              <View style={styles.cautionRow}>
                {[0, 1, 2, 3, 4, 5, 6].map(val => {
                  const sel = leaseModal.cautionMultiplicateur === String(val);
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.cautionChip, sel && styles.cautionChipSel]}
                      onPress={() => setLeaseModal(c => ({ ...c, cautionMultiplicateur: String(val) }))}
                    >
                      <Text style={[styles.cautionChipText, sel && styles.cautionChipTextSel]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Profils recherchés</Text>
              <View style={styles.optionsList}>
                {TENANT_PROFILES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={styles.optionRow}
                    onPress={() => toggleLeaseValue('profilsLocataireRecherches', p)}
                  >
                    <Ionicons
                      name={leaseModal.profilsLocataireRecherches.includes(p) ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={colors.blue}
                    />
                    <Text style={styles.optionText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Documents requis</Text>
              <View style={styles.optionsList}>
                {REQUIRED_DOCUMENTS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={styles.optionRow}
                    onPress={() => toggleLeaseValue('documentsRequis', d)}
                  >
                    <Ionicons
                      name={leaseModal.documentsRequis.includes(d) ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={colors.blue}
                    />
                    <Text style={styles.optionText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setLeaseModal(null)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={saveLeaseTerms}
                >
                  <Text style={styles.modalSaveText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // NavBar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
  },
  addIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },

  // Liste
  list: { paddingBottom: spacing.lg * 2 },

  // Banner stats
  banner: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bannerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bannerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  bannerTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
  },
  totalBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 56,
  },
  totalValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  bannerSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.white,
    marginTop: 2,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  noteDot: {
    width: 7, height: 7, borderRadius: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.72)',
  },

  // Bouton ajouter
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
  },
  addBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.white,
  },

  listTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // Carte bien
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: colors.bgCardAlt,
  },

  // Badge modération (haut-gauche)
  modBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  modBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },

  // Badge type (haut-droite)
  typeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  typeBadgeVente: { backgroundColor: colors.goldMuted },
  typeBadgeLoc:   { backgroundColor: colors.blueMuted },
  typeBadgeText:  { fontSize: 10, letterSpacing: 1.2, fontFamily: fonts.bodyBold, textTransform: 'uppercase' },
  typeBadgeTextVente: { color: colors.goldDark },
  typeBadgeTextLoc:   { color: colors.blue },

  // Corps carte
  body: { padding: spacing.md },
  titre: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaType: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dispBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  dispBadgeOk:  { backgroundColor: '#DCFCE7' },
  dispBadgeOff: { backgroundColor: '#FEE2E2' },
  dispDot: { width: 6, height: 6, borderRadius: 3 },
  dispText: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs },

  adresse: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  prix: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
    marginTop: 2,
  },

  // Résumé bail
  bailResume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.blueMuted,
    borderRadius: radius.xs,
  },
  bailResumeText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.blue,
  },

  // Barre d'actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  actionEdit:   { flex: 1.2, backgroundColor: colors.blueMuted },
  actionDisp:   { flex: 1.5, backgroundColor: colors.goldMuted },
  actionBail:   { flex: 0.9, backgroundColor: colors.blueMuted },
  actionDelete: { backgroundColor: '#FEE2E2', paddingHorizontal: spacing.md },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.black,
  },

  // Modal bail
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  modalProp: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cautionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  cautionChip: {
    width: 40, height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cautionChipSel: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  cautionChipText:    { fontFamily: fonts.bodyBold, color: colors.textSub },
  cautionChipTextSel: { color: colors.white },
  optionsList: { gap: spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1, alignItems: 'center',
    padding: spacing.md, borderRadius: radius.sm,
    backgroundColor: colors.bgCardAlt,
  },
  modalCancelText: { fontFamily: fonts.bodyBold, color: colors.textSub },
  modalSaveBtn: {
    flex: 1, alignItems: 'center',
    padding: spacing.md, borderRadius: radius.sm,
    backgroundColor: colors.blue,
  },
  modalSaveText: { fontFamily: fonts.bodyBold, color: colors.white },
});
