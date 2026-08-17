import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert, Modal,
  RefreshControl, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const TENANT_PROFILES = [
  'Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité',
];
const REQUIRED_DOCUMENTS = [
  'CNI', 'Justificatif de revenus', '2 derniers bulletins de salaire',
  'Caution bancaire', 'Attestation de travail', 'Quittance de loyer précédente',
];

const PLACEHOLDER_IMG = require('../../../assets/Logo_Altitude_transparent.png');

const getModerationInfo = (statusAdmin) => {
  if (statusAdmin === 'Validée') return { label: 'Publié',       tone: 'success', icon: 'checkmark-circle' };
  if (statusAdmin === 'Rejetée') return { label: 'Rejeté',       tone: 'error',   icon: 'close-circle' };
  return                                { label: 'En validation', tone: 'warning', icon: 'time-outline' };
};

// ─── BienCard ─────────────────────────────────────────────────────────────────
const BienCard = React.memo(function BienCard({
  item, onEdit, onDelete, onToggleAvailability, onRentalRequest, onBail, styles, c,
}) {
  const statusKey  = item.status?.toLowerCase();
  const isLocation = statusKey === 'location';
  const isHebergement = statusKey === 'hebergement';
  const modInfo    = getModerationInfo(item.statusAdmin);
  const city       = item.address?.city || 'Brazzaville';
  const arrond     = item.address?.arrondissement;
  const adresse    = arrond ? `${arrond} · ${city}` : city;
  const prix       = item.price ? Number(item.price).toLocaleString('fr-FR') : '—';
  const disponible = item.availability === 'Disponible';
  const imgUri     = item.images?.[0];
  const rental     = item._rental;

  const toneColor = { success: c.success, error: c.error, warning: c.warning }[modInfo.tone];
  const toneBg    = { success: c.successMuted, error: c.dangerMuted, warning: c.warningMuted }[modInfo.tone];
  const toneBorder = toneColor;

  return (
    <View style={styles.card}>
      {/* ─── Image ─── */}
      <View style={styles.imageWrap}>
        <Image
          source={imgUri ? { uri: imgUri } : PLACEHOLDER_IMG}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
        />

        {/* Badge modération — haut-gauche */}
        <View style={[styles.modBadge, { backgroundColor: toneBg, borderColor: toneBorder }]}>
          <Ionicons name={modInfo.icon} size={12} color={toneColor} />
          <Text style={[styles.modBadgeText, { color: toneColor }]}>{modInfo.label}</Text>
        </View>

        {/* Badge type — haut-droite */}
        <View style={[styles.typeBadge, isHebergement ? styles.typeBadgeHeb : isLocation ? styles.typeBadgeLoc : styles.typeBadgeVente]}>
          <Text style={[styles.typeBadgeText, isHebergement ? styles.typeBadgeTextHeb : isLocation ? styles.typeBadgeTextLoc : styles.typeBadgeTextVente]}>
            {isHebergement ? 'HÉBERGEMENT' : isLocation ? 'LOCATION' : 'VENTE'}
          </Text>
        </View>
      </View>

      {/* ─── Corps ─── */}
      <View style={styles.body}>
        <Text style={styles.titre} numberOfLines={1}>{item.title || 'Sans titre'}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaType}>{(item.type || '').toUpperCase()}</Text>
          <View style={[
            styles.dispBadge,
            { backgroundColor: disponible ? 'rgba(56,161,105,0.12)' : 'rgba(229,62,62,0.12)' },
          ]}>
            <View style={[styles.dispDot, { backgroundColor: disponible ? c.success : c.error }]} />
            <Text style={[styles.dispText, { color: disponible ? c.success : c.error }]}>
              {item.availability || 'Disponible'}
            </Text>
          </View>
        </View>

        <View style={styles.addrRow}>
          <Ionicons name="location-outline" size={12} color={c.textMuted} />
          <Text style={styles.adresse} numberOfLines={1}>{adresse}</Text>
        </View>

        <Text style={styles.prix}>{prix} FCFA{isLocation ? '/mois' : ''}</Text>
        {rental && <View style={{ marginBottom: 8 }}><Text style={styles.bailResumeText}>Gestion locative · {rental.displayStatus} · {rental.publicationStatus}</Text><Text style={styles.bailResumeText}>Attendu {Number(rental.paymentSummary?.expected || 0).toLocaleString('fr-FR')} · Payé {Number(rental.paymentSummary?.paid || 0).toLocaleString('fr-FR')} · Solde {Number(rental.paymentSummary?.remaining || 0).toLocaleString('fr-FR')} FCFA</Text>{rental.activeLease?.dateFinBail && <Text style={styles.bailResumeText}>Fin contrat : {new Date(rental.activeLease.dateFinBail).toLocaleDateString('fr-FR')}</Text>}{(rental.paymentSummary?.overdueCount > 0 || rental.paymentSummary?.partialCount > 0) && <Text style={[styles.bailResumeText,{color:c.error}]}>{rental.paymentSummary.overdueCount || 0} impayé(s) · {rental.paymentSummary.partialCount || 0} partiel(s)</Text>}</View>}

        {/* Résumé bail */}
        {isLocation && (
          <View style={styles.bailResume}>
            <Ionicons name="document-text-outline" size={12} color={c.blue} />
            <Text style={styles.bailResumeText}>
              Caution {item.cautionMultiplicateur ?? 2} mois
              {item.profilsLocataireRecherches?.length
                ? ` · ${item.profilsLocataireRecherches.length} profil(s)`
                : ''}
            </Text>
          </View>
        )}

        {/* ─── Actions ─── */}
        <View style={styles.actions}>
          {!rental && <TouchableOpacity
            style={[styles.actionBtn, styles.actionEdit]}
            onPress={onEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Modifier l'annonce"
          >
            <Ionicons name="create-outline" size={15} color={c.blue} />
            <Text style={[styles.actionText, { color: c.blue }]}>Modifier</Text>
          </TouchableOpacity>}

          {rental?.allowedActions?.includes('request_publish') && <TouchableOpacity style={[styles.actionBtn, styles.actionDisp]} onPress={()=>onRentalRequest(rental,'request-publish')}><Text style={[styles.actionText,{color:c.gold}]}>Demander publication</Text></TouchableOpacity>}
          {rental?.allowedActions?.includes('request_suspension') && <TouchableOpacity style={[styles.actionBtn, styles.actionDisp]} onPress={()=>onRentalRequest(rental,'request-suspension')}><Text style={[styles.actionText,{color:c.gold}]}>Demander suspension</Text></TouchableOpacity>}
          {rental?.allowedActions?.includes('report_maintenance') && <TouchableOpacity style={[styles.actionBtn, styles.actionDelete]} onPress={()=>onRentalRequest(rental,'report-maintenance')}><Text style={[styles.actionText,{color:c.error}]}>Maintenance</Text></TouchableOpacity>}

          {!rental && <TouchableOpacity
            style={[styles.actionBtn, styles.actionDisp]}
            onPress={onToggleAvailability}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={disponible
              ? (isHebergement ? 'Marquer comme indisponible' : isLocation ? 'Marquer comme loué' : 'Marquer comme vendu')
              : 'Marquer comme disponible'}
          >
            <Ionicons
              name={disponible ? (isHebergement ? 'close-circle' : isLocation ? 'home' : 'bag-check') : 'checkmark-circle-outline'}
              size={15}
              color={c.gold}
            />
            <Text style={[styles.actionText, { color: c.gold }]}>
              {disponible ? (isHebergement ? 'Indisponible' : isLocation ? 'Loué' : 'Vendu') : 'Libre'}
            </Text>
          </TouchableOpacity>}

          {isLocation && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBail]}
              onPress={onBail}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Conditions de bail"
            >
              <Ionicons name="document-text-outline" size={15} color={c.blue} />
              <Text style={[styles.actionText, { color: c.blue }]}>Bail</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionDelete]}
            onPress={onDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Supprimer l'annonce"
          >
            <Ionicons name="trash-outline" size={15} color={c.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}, (prev, next) => prev.item._id === next.item._id &&
  prev.item.statusAdmin === next.item.statusAdmin &&
  prev.item.availability === next.item.availability &&
  prev.item._rental?.updatedAt === next.item._rental?.updatedAt &&
  prev.styles === next.styles);

// ─── MesAnnoncesScreen ────────────────────────────────────────────────────────
export default function MesAnnoncesScreen({ navigation }) {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [biens, setBiens]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaseModal, setLeaseModal] = useState(null);

  const stats = useMemo(() => ({
    total:       biens.length,
    publies:     biens.filter(b => b.statusAdmin === 'Validée').length,
    attente:     biens.filter(b => !b.statusAdmin || b.statusAdmin === 'En attente').length,
    rejetes:     biens.filter(b => b.statusAdmin === 'Rejetée').length,
    disponibles: biens.filter(b => b.availability === 'Disponible').length,
  }), [biens]);

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [propertyRes, rentalRes] = await Promise.all([
        api.get('/properties/my-properties'),
        api.get('/rental-management/owner/my').catch(() => ({ data: { data: { rentals: [] } } })),
      ]);
      const data = propertyRes.data?.data?.properties || propertyRes.data?.properties || [];
      const rentals = rentalRes.data?.data?.rentals || [];
      setBiens(data.map(item => ({ ...item, _rental: rentals.find(rental => String(rental.property?._id || rental.property) === String(item._id)) })));
    } catch {
      setBiens([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    charger(true);
  }, [charger]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleEdit = useCallback((item) =>
    navigation.navigate('PublierBien', { editProperty: item }), [navigation]);

  const handleDelete = useCallback((item) => {
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
  }, []);

  const handleToggleAvailability = useCallback(async (item) => {
    const statusKey = item.status?.toLowerCase();
    const isLocation = statusKey === 'location';
    const isHebergement = statusKey === 'hebergement';
    const next = item.availability === 'Disponible'
      ? (isHebergement ? 'Indisponible' : isLocation ? 'Loué' : 'Vendu')
      : 'Disponible';
    try {
      const res = await api.put(`/properties/${item._id}`, { availability: next });
      const updated = res.data?.data?.property || res.data?.property;
      if (updated) setBiens(prev => prev.map(b => b._id === item._id ? updated : b));
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de modifier.');
    }
  }, []);

  const handleRentalRequest = useCallback(async (rental, action) => {
    try {
      await api.post(`/rental-management/${rental._id}/owner/${action}`, { reason: 'Demande depuis l’application mobile' });
      Alert.alert('Demande envoyée', 'Le gestionnaire examinera votre demande.');
      charger(true);
    } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Demande impossible.'); }
  }, [charger]);

  const openLeaseModal = useCallback((item) =>
    setLeaseModal({
      property: item,
      cautionMultiplicateur: String(item.cautionMultiplicateur ?? 2),
      profilsLocataireRecherches: item.profilsLocataireRecherches || [],
      documentsRequis: item.documentsRequis || [],
    }), []);

  const toggleLeaseValue = useCallback((field, value) =>
    setLeaseModal(cur => {
      const arr = cur?.[field] || [];
      return { ...cur, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    }), []);

  const saveLeaseTerms = useCallback(async () => {
    if (!leaseModal?.property?._id) return;
    try {
      const res = await api.put(`/properties/${leaseModal.property._id}`, {
        cautionMultiplicateur:       Number(leaseModal.cautionMultiplicateur || 0),
        profilsLocataireRecherches:  leaseModal.profilsLocataireRecherches,
        documentsRequis:             leaseModal.documentsRequis,
      });
      const updated = res.data?.data?.property || res.data?.property;
      if (updated) setBiens(prev => prev.map(b => b._id === updated._id ? updated : b));
      setLeaseModal(null);
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de sauvegarder.');
    }
  }, [leaseModal]);

  // ─── Rendu ───────────────────────────────────────────────────────────────
  const renderBien = useCallback(({ item }) => (
    <BienCard
      item={item}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
      onToggleAvailability={() => handleToggleAvailability(item)}
      onRentalRequest={handleRentalRequest}
      onBail={() => openLeaseModal(item)}
      styles={styles}
      c={c}
    />
  ), [handleEdit, handleDelete, handleToggleAvailability, handleRentalRequest, openLeaseModal, styles, c]);

  const keyExtractor = useCallback((item) => item._id, []);

  const ListHeader = useMemo(() => (
    <>
      {/* Banner stats */}
      <LinearGradient
        colors={['#0A0A0A', '#123B5E']}
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
          {[
            { icon: 'checkmark-circle', color: '#38A169', value: stats.publies,     label: 'Publiés' },
            { icon: 'time-outline',     color: '#DD6B20', value: stats.attente,     label: 'Validation' },
            { icon: 'close-circle',     color: '#E53E3E', value: stats.rejetes,     label: 'Rejetés' },
            { icon: 'home-outline',     color: '#C8960C', value: stats.disponibles, label: 'Disponibles' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={18} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pendingNote}>
          <View style={[styles.noteDot, { backgroundColor: '#DD6B20' }]} />
          <Text style={styles.noteText}>
            Les nouveaux biens restent invisibles jusqu'à validation admin.
          </Text>
        </View>
      </LinearGradient>

      {/* Bouton ajouter */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('ChoixTypeAnnonce')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Publier une annonce"
      >
        <Ionicons name="add-circle" size={20} color={c.onAccent} />
        <Text style={styles.addBtnText}>Ajouter un bien</Text>
      </TouchableOpacity>

      <Text style={styles.listTitle}>Mes publications</Text>
    </>
  ), [stats, navigation, styles]);

  const NavBar = (
    <View style={styles.navBar}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={22} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.navTitle}>Mes annonces</Text>
      <TouchableOpacity
        style={styles.addIconBtn}
        onPress={() => navigation.navigate('ChoixTypeAnnonce')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Publier une annonce"
      >
        <Ionicons name="add" size={22} color={c.onAccent} />
      </TouchableOpacity>
    </View>
  );

  if (loading) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {NavBar}
      <LoadingSpinner />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {NavBar}

      <FlatList
        data={biens}
        renderItem={renderBien}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.gold} colors={[c.gold]} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="home-outline"
            title="Aucun bien publié"
            subtitle="Ajoutez votre premier bien pour le mettre en vitrine."
            actionLabel="Publier un bien"
            onAction={() => navigation.navigate('ChoixTypeAnnonce')}
          />
        }
      />

      {/* ─── Modal conditions de bail ──────────────────────── */}
      {leaseModal && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setLeaseModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Conditions de bail</Text>
              <Text style={styles.modalProp} numberOfLines={1}>
                {leaseModal.property?.title}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>

                <Text style={styles.fieldLabel}>Caution demandée</Text>
                <View style={styles.cautionRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map(val => {
                    const sel = leaseModal.cautionMultiplicateur === String(val);
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.cautionChip, sel && styles.cautionChipSel]}
                        onPress={() => setLeaseModal(cur => ({ ...cur, cautionMultiplicateur: String(val) }))}
                        accessibilityRole="button"
                        accessibilityLabel={`Caution ${val} mois`}
                        accessibilityState={{ selected: sel }}
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
                  {TENANT_PROFILES.map(p => {
                    const checked = leaseModal.profilsLocataireRecherches.includes(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        style={styles.optionRow}
                        onPress={() => toggleLeaseValue('profilsLocataireRecherches', p)}
                        accessibilityRole="checkbox"
                        accessibilityLabel={p}
                        accessibilityState={{ checked }}
                      >
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={c.blue} />
                        <Text style={styles.optionText}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Documents requis</Text>
                <View style={styles.optionsList}>
                  {REQUIRED_DOCUMENTS.map(d => {
                    const checked = leaseModal.documentsRequis.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={styles.optionRow}
                        onPress={() => toggleLeaseValue('documentsRequis', d)}
                        accessibilityRole="checkbox"
                        accessibilityLabel={d}
                        accessibilityState={{ checked }}
                      >
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={c.blue} />
                        <Text style={styles.optionText}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setLeaseModal(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler"
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={saveLeaseTerms}
                  accessibilityRole="button"
                  accessibilityLabel="Enregistrer"
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  // ─── NavBar ───
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.bgCard,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    textAlign: 'center',
  },
  addIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.gold,
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── Liste ───
  list: { paddingBottom: spacing.xxl },

  // ─── Banner ───
  banner: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bannerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: '#C8960C',
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
    color: '#F0EDE8',
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
    color: '#F0EDE8',
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: 'rgba(240,237,232,0.65)',
  },
  bannerSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.7)',
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
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#F0EDE8',
    marginTop: 2,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(240,237,232,0.65)',
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
  noteDot: { width: 7, height: 7, borderRadius: 4 },
  noteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: 'rgba(240,237,232,0.72)',
  },

  // ─── Bouton ajouter ───
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.gold,
  },
  addBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.onAccent,
  },
  listTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // ─── Card bien ───
  card: {
    backgroundColor: c.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
  },
  imageWrap: { width: '100%' },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: c.bgCardAlt,
  },
  modBadge: {
    position: 'absolute',
    top: spacing.sm, left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  modBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  typeBadge: {
    position: 'absolute',
    top: spacing.sm, right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  typeBadgeVente: { backgroundColor: 'rgba(200,150,12,0.15)', borderColor: 'rgba(200,150,12,0.4)' },
  typeBadgeLoc:   { backgroundColor: 'rgba(24,95,165,0.15)',  borderColor: 'rgba(24,95,165,0.4)' },
  typeBadgeHeb:   { backgroundColor: 'rgba(22,163,74,0.15)',  borderColor: 'rgba(22,163,74,0.4)' },
  typeBadgeText:  { fontSize: 9, letterSpacing: 1, fontFamily: fonts.bodyBold },
  typeBadgeTextVente: { color: '#C8960C' },
  typeBadgeTextLoc:   { color: '#185FA5' },
  typeBadgeTextHeb:   { color: '#16A34A' },

  // ─── Corps card ───
  body: { padding: spacing.md },
  titre: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaType: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  dispBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  dispDot:  { width: 6, height: 6, borderRadius: 3 },
  dispText: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs },

  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  adresse: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    flex: 1,
  },
  prix: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.gold,
    marginTop: 2,
  },

  bailResume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(24,95,165,0.1)',
    borderRadius: radius.xs,
  },
  bailResumeText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.blue,
  },

  // ─── Actions ───
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
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
  actionEdit:   { flex: 1.2, backgroundColor: 'rgba(24,95,165,0.1)' },
  actionDisp:   { flex: 1.5, backgroundColor: c.goldMuted },
  actionBail:   { flex: 0.9, backgroundColor: 'rgba(24,95,165,0.1)' },
  actionDelete: { backgroundColor: 'rgba(229,62,62,0.1)', paddingHorizontal: spacing.md },
  actionText:   { fontFamily: fonts.bodyBold, fontSize: fontSize.xs },

  // ─── Modal bail ───
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
  },
  modalProp: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.text,
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
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cautionChipSel: { backgroundColor: c.blue, borderColor: c.blue },
  cautionChipText:    { fontFamily: fonts.bodyBold, color: c.textSub },
  cautionChipTextSel: { color: '#FFFFFF' },
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
    color: c.textSub,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1, alignItems: 'center',
    padding: spacing.md, borderRadius: radius.sm,
    backgroundColor: c.bgCardAlt,
  },
  modalCancelText: { fontFamily: fonts.bodyBold, color: c.textSub },
  modalSaveBtn: {
    flex: 1, alignItems: 'center',
    padding: spacing.md, borderRadius: radius.sm,
    backgroundColor: c.blue,
  },
  modalSaveText: { fontFamily: fonts.bodyBold, color: '#FFFFFF' },
});
