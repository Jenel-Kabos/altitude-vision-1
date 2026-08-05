import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';
import {
  activateTenantInvitation, createTenantMaintenance, getTenantDashboard,
  downloadTenantDocument, getTenantDocuments, getTenantLeases,
  getTenantMaintenance, getTenantNotice, getTenantPayments, getTenantProfile,
} from '../../services/tenantPortalService';

const SECTIONS = [
  ['dashboard', 'Accueil', 'grid-outline'], ['lease', 'Mon bail', 'key-outline'],
  ['payments', 'Paiements', 'wallet-outline'], ['documents', 'Documents', 'folder-open-outline'],
  ['notice', 'Préavis', 'calendar-outline'], ['maintenance', 'Maintenance', 'construct-outline'],
];
const SECTION_ALIASES = { bail: 'lease', paiements: 'payments', documents: 'documents', preavis: 'notice', maintenance: 'maintenance' };
const CATEGORIES = ['plomberie', 'electricite', 'structure', 'equipement', 'nuisible', 'serrurerie', 'peinture', 'autre'];
const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const date = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '—';
const titleCase = (value) => String(value || '—').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const initialState = { dashboard: null, profile: null, leases: [], payments: { payments: [], summary: {}, pagination: {} }, documents: { documents: [], pagination: {} }, notice: null, maintenance: { tickets: [], pagination: {} } };

function Metric({ icon, label, value, detail, styles, c }) {
  return <Card style={styles.metric}><Ionicons name={icon} size={21} color={c.gold}/><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value ?? '—'}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</Card>;
}
function Row({ icon = 'ellipse-outline', title, subtitle, right, onPress, styles, c }) {
  const Content = <><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={c.gold}/></View><View style={styles.rowBody}><Text style={styles.rowTitle}>{title}</Text>{subtitle ? <Text style={styles.detail}>{subtitle}</Text> : null}</View>{right || (onPress ? <Ionicons name="chevron-forward" size={17} color={c.textMuted}/> : null)}</>;
  return onPress ? <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>{Content}</TouchableOpacity> : <View style={styles.row}>{Content}</View>;
}
function SectionTitle({ children, styles }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
function Empty({ title, subtitle }) { return <EmptyState icon="document-text-outline" title={title} subtitle={subtitle}/>; }

export default function TenantPortalScreen({ navigation, route }) {
  const { themeColors: c } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c, width >= 700), [c, width]);
  const incoming = route.params?.section;
  const [section, setSection] = useState(SECTION_ALIASES[incoming] || incoming || 'dashboard');
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'plomberie', description: '', photos: [] });
  const [saving, setSaving] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(null);

  useEffect(() => { if (incoming) setSection(SECTION_ALIASES[incoming] || incoming); }, [incoming]);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const results = await Promise.all([
        getTenantDashboard(), getTenantProfile(), getTenantLeases(), getTenantPayments(),
        getTenantDocuments(), getTenantNotice(), getTenantMaintenance(),
      ]);
      setState({
        dashboard: results[0].data?.dashboard, profile: results[1].data?.locataire,
        leases: results[2].data?.leases || [], payments: results[3].data || initialState.payments,
        documents: results[4].data || initialState.documents, notice: results[5].data?.notice || null,
        maintenance: results[6].data || initialState.maintenance,
      });
      setOffline(results.some((result) => result.offline));
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.normalized?.message || 'Impossible de charger votre espace locataire.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const token = route.params?.token;
    if (!token) return;
    activateTenantInvitation(token).then(() => load({ refresh: true })).catch((activationError) => {
      Alert.alert('Activation impossible', activationError.response?.data?.message || 'Le lien est invalide ou expiré.');
    });
  }, [load, route.params?.token]);

  const loadMore = useCallback(async (kind) => {
    const current = state[kind]; const page = current.pagination?.page || 1; const pages = current.pagination?.pages || 1;
    if (page >= pages) return;
    const getter = kind === 'payments' ? getTenantPayments : kind === 'documents' ? getTenantDocuments : getTenantMaintenance;
    try {
      const result = await getter({ page: page + 1 }); const next = result.data;
      const listKey = kind === 'payments' ? 'payments' : kind === 'documents' ? 'documents' : 'tickets';
      setState((previous) => ({ ...previous, [kind]: { ...next, [listKey]: [...previous[kind][listKey], ...(next[listKey] || [])] } }));
      setOffline((value) => value || result.offline);
    } catch (loadError) { Alert.alert('Chargement impossible', loadError.normalized?.message || 'Veuillez réessayer.'); }
  }, [state]);

  const pickPhotos = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission requise', 'Autorisez l’accès aux photos pour joindre des images.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 5, quality: 0.8 });
    if (!result.canceled) setForm((current) => ({ ...current, photos: result.assets.slice(0, 5) }));
  }, []);

  const submitMaintenance = useCallback(async () => {
    if (offline) return Alert.alert('Mode hors connexion', 'La création d’une demande nécessite une connexion réseau.');
    if (form.description.trim().length < 5) return Alert.alert('Description requise', 'Décrivez le problème en au moins 5 caractères.');
    setSaving(true);
    try {
      await createTenantMaintenance(form);
      setForm({ category: 'plomberie', description: '', photos: [] });
      await load({ refresh: true });
      Alert.alert('Demande envoyée', 'Votre gestionnaire a été informé.');
    } catch (saveError) { Alert.alert('Envoi impossible', saveError.response?.data?.message || saveError.normalized?.message || 'Veuillez réessayer.'); }
    finally { setSaving(false); }
  }, [form, load, offline]);

  const openDocument = useCallback(async (document, download = false) => {
    setDocumentBusy(document._id);
    try {
      const uri = await downloadTenantDocument(document._id, document.nom || 'document');
      if (!download) return;
      if (!(await Sharing.isAvailableAsync())) Alert.alert('Document téléchargé', uri);
    } catch (documentError) { Alert.alert('Document indisponible', documentError.response?.data?.message || 'Impossible d’ouvrir ce document.'); }
    finally { setDocumentBusy(null); }
  }, []);

  const d = state.dashboard || {}; const lease = d.bailActif || state.leases[0];
  const renderDashboard = () => <>
    <View style={styles.hero}><Text style={styles.eyebrow}>PORTAIL LOCATAIRE</Text><Text style={styles.heroTitle}>Bonjour {state.profile?.prenom || ''}</Text><Text style={styles.heroSub}>{lease?.bien?.title || lease?.adresseBien || 'Votre location'}{lease?.villeBien ? ` · ${lease.villeBien}` : ''}</Text></View>
    <View style={styles.grid}>
      <Metric icon="calendar-outline" label="Prochain paiement" value={d.prochainPaiement ? money(d.prochainPaiement.restant) : 'À jour'} detail={d.prochainPaiement ? `${d.prochainPaiement.mois}/${d.prochainPaiement.annee} · ${titleCase(d.prochainPaiement.statut)}` : null} styles={styles} c={c}/>
      <Metric icon="wallet-outline" label="Montant restant" value={money(d.montantRestant)} styles={styles} c={c}/>
      <Metric icon="time-outline" label="Durée restante" value={d.dureeRestanteJours == null ? '—' : `${d.dureeRestanteJours} jours`} styles={styles} c={c}/>
      <Metric icon="shield-checkmark-outline" label="Caution" value={lease?.caution?.statut ? titleCase(lease.caution.statut) : lease?.cautionVersee ? 'Versée' : 'Non versée'} detail={money(lease?.montantCaution)} styles={styles} c={c}/>
    </View>
    <SectionTitle styles={styles}>Bail actif</SectionTitle><Card><Row icon="location-outline" title={lease?.adresseBien || lease?.bien?.title || 'Adresse non renseignée'} subtitle={lease?.villeBien || lease?.bien?.address?.city} styles={styles} c={c}/><Row icon="git-branch-outline" title={titleCase(lease?.cycleVie || lease?.statut)} subtitle={`${date(lease?.dateEntree)} → ${date(lease?.dateFinBail)}`} styles={styles} c={c}/><Row icon="person-outline" title={lease?.proprietaire ? `${lease.proprietaire.prenom || ''} ${lease.proprietaire.nom || ''}`.trim() : 'Propriétaire non renseigné'} subtitle="Propriétaire" styles={styles} c={c}/><Row icon="business-outline" title="Altitude Vision" subtitle="Agence gestionnaire" styles={styles} c={c}/></Card>
    {(d.preavisActif || d.maintenanceOuverte > 0) && <><SectionTitle styles={styles}>Alertes importantes</SectionTitle><Card>{d.preavisActif && <Row icon="warning-outline" title={`Préavis ${titleCase(d.preavisActif.statut)}`} subtitle={`Départ prévu le ${date(d.preavisActif.dateDepartPrevue)}`} onPress={() => setSection('notice')} styles={styles} c={c}/>} {d.maintenanceOuverte > 0 && <Row icon="construct-outline" title={`${d.maintenanceOuverte} demande(s) ouverte(s)`} onPress={() => setSection('maintenance')} styles={styles} c={c}/>}</Card></>}
  </>;

  const renderLease = () => !state.leases.length ? <Empty title="Aucun bail" subtitle="Aucun bail n’est rattaché à votre dossier."/> : <>{state.leases.map((item) => <Card key={item._id} style={styles.block}><Text style={styles.cardTitle}>{item.bien?.title || item.adresseBien || 'Bail de location'}</Text><Text style={styles.status}>{titleCase(item.cycleVie || item.statut)}</Text><Info label="Période" value={`${date(item.dateEntree)} → ${date(item.dateFinBail)}`} styles={styles}/><Info label="Loyer" value={money(item.montantLoyer)} styles={styles}/><Info label="Charges" value={item.chargesIncluses ? 'Incluses' : money(item.montantCharges)} styles={styles}/><Info label="Préavis contractuel" value={`${item.dureePreavis || '—'} mois`} styles={styles}/><Info label="Caution" value={`${money(item.montantCaution)} · ${titleCase(item.caution?.statut || (item.cautionVersee ? 'versee' : 'non_versee'))}`} styles={styles}/>{item.avenants?.length > 0 && <Timeline title="Avenants et renouvellements" items={item.avenants.map((entry) => ({ title: titleCase(entry.type), date: entry.dateEffet || entry.createdAt, detail: entry.motif }))} styles={styles} c={c}/>} {item.cycleHistory?.length > 0 && <Timeline title="Cycle de vie" items={item.cycleHistory.map((entry) => ({ title: titleCase(entry.action), date: entry.at, detail: `${titleCase(entry.from)} → ${titleCase(entry.to)}` }))} styles={styles} c={c}/>} {item.etatsDesLieux?.length > 0 && <Timeline title="États des lieux / inspections" items={item.etatsDesLieux.map((entry) => ({ title: `État des lieux ${entry.type}`, date: entry.date, detail: entry.validatedByStaff ? 'Validé par l’agence' : 'En attente de validation' }))} styles={styles} c={c}/>} {item.caution?.historique?.length > 0 && <Timeline title="Historique de la caution" items={item.caution.historique.map((entry) => ({ title: `${titleCase(entry.action)} · ${money(entry.montant)}`, date: entry.at, detail: entry.motif }))} styles={styles} c={c}/>}</Card>)}</>;

  const renderPayments = () => <><View style={styles.grid}><Metric icon="receipt-outline" label="Total dû" value={money(state.payments.summary?.du)} styles={styles} c={c}/><Metric icon="checkmark-circle-outline" label="Total reçu" value={money(state.payments.summary?.recu)} styles={styles} c={c}/><Metric icon="alert-circle-outline" label="Reste" value={money(state.payments.summary?.restant)} detail={`Pénalités ${money(state.payments.summary?.penalites)}`} styles={styles} c={c}/></View><SectionTitle styles={styles}>Échéancier</SectionTitle>{state.payments.payments.length ? <Card>{state.payments.payments.map((item) => <Row key={item._id} icon={item.statut === 'payé' ? 'checkmark-circle-outline' : 'time-outline'} title={`${item.mois}/${item.annee} · ${titleCase(item.statut)}`} subtitle={`${money(item.montantTotal ?? item.montant)} · reçu ${money(item.montantRecu)} · reste ${money(item.restant)}${item.reference ? ` · réf. ${item.reference}` : ''}`} styles={styles} c={c}/>)}</Card> : <Empty title="Aucun paiement" subtitle="Votre échéancier apparaîtra ici."/>}<LoadMore kind="payments" state={state} loadMore={loadMore}/></>;

  const renderDocuments = () => <>{state.documents.documents.length ? <Card>{state.documents.documents.map((item) => <Row key={item._id} icon={item.type === 'etat_des_lieux' ? 'clipboard-outline' : 'document-text-outline'} title={item.nom} subtitle={`${titleCase(item.type)} · ${date(item.dateGeneration)}`} right={<View style={styles.actions}><TouchableOpacity onPress={() => openDocument(item)} accessibilityLabel={`Aperçu ${item.nom}`}><Ionicons name="eye-outline" size={21} color={c.info}/></TouchableOpacity><TouchableOpacity disabled={documentBusy === item._id} onPress={() => openDocument(item, true)} accessibilityLabel={`Télécharger ${item.nom}`}><Ionicons name="download-outline" size={21} color={c.gold}/></TouchableOpacity></View>} styles={styles} c={c}/>)}</Card> : <Empty title="Coffre vide" subtitle="Baux, quittances, états des lieux, préavis et factures autorisées apparaîtront ici."/>}<LoadMore kind="documents" state={state} loadMore={loadMore}/></>;

  const renderNotice = () => !state.notice ? <Empty title="Aucun préavis actif" subtitle="Votre cycle de préavis apparaîtra ici lorsqu’il sera initié."/> : <><View style={styles.grid}><Metric icon="calendar-outline" label="Date de dépôt" value={date(state.notice.dateDepot)} styles={styles} c={c}/><Metric icon="checkmark-outline" label="Validation" value={date(state.notice.dateValidation)} styles={styles} c={c}/><Metric icon="exit-outline" label="Départ prévu" value={date(state.notice.dateDepartPrevue)} styles={styles} c={c}/><Metric icon="hourglass-outline" label="Jours restants" value={`${state.notice.joursRestants} jours`} detail={state.notice.verrouille ? 'Préavis validé' : titleCase(state.notice.statut)} styles={styles} c={c}/></View>{state.notice.historique?.length > 0 && <Card style={styles.block}><Timeline title="Étapes du préavis" items={state.notice.historique.map((item) => ({ title: titleCase(item.action), date: item.at, detail: item.comment }))} styles={styles} c={c}/></Card>}{lease?.etatsDesLieux?.filter((item) => item.type === 'sortie').map((item, index) => <Card key={index} style={styles.block}><Text style={styles.cardTitle}>Inspection de sortie</Text><Info label="Date" value={date(item.date)} styles={styles}/><Info label="Validation" value={item.validatedByStaff ? 'Validée' : 'À valider'} styles={styles}/><Info label="Maintenance" value={item.maintenanceRequired ? 'Requise' : 'Non requise'} styles={styles}/></Card>)}</>;

  const renderMaintenance = () => <><Card style={styles.block}><Text style={styles.cardTitle}>Nouvelle demande</Text><Text style={styles.label}>Catégorie</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{CATEGORIES.map((category) => <TouchableOpacity key={category} style={[styles.chip, form.category === category && styles.chipActive]} onPress={() => setForm((current) => ({ ...current, category }))} accessibilityState={{ selected: form.category === category }}><Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{titleCase(category)}</Text></TouchableOpacity>)}</ScrollView><Text style={styles.label}>Description</Text><TextInput value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} multiline placeholder="Décrivez précisément le problème" placeholderTextColor={c.placeholder} style={styles.input} editable={!offline}/><Button label={form.photos.length ? `${form.photos.length} photo(s) sélectionnée(s)` : 'Ajouter des photos'} icon="camera-outline" variant="outline" onPress={pickPhotos} disabled={offline}/><Button label={offline ? 'Connexion requise' : 'Envoyer la demande'} icon="send-outline" onPress={submitMaintenance} loading={saving} disabled={offline} fullWidth style={styles.submit}/></Card><SectionTitle styles={styles}>Suivi des interventions</SectionTitle>{state.maintenance.tickets.length ? <Card>{state.maintenance.tickets.map((item) => <Row key={item._id} icon="construct-outline" title={`${titleCase(item.category)} · ${titleCase(item.status)}`} subtitle={`${item.description} · créée le ${date(item.createdAt)}${item.scheduledFor ? ` · intervention le ${date(item.scheduledFor)}` : ''}`} styles={styles} c={c}/>)}</Card> : <Empty title="Aucune intervention" subtitle="Vous n’avez aucune demande de maintenance."/>}<LoadMore kind="maintenance" state={state} loadMore={loadMore}/></>;

  const renderContent = () => ({ dashboard: renderDashboard, lease: renderLease, payments: renderPayments, documents: renderDocuments, notice: renderNotice, maintenance: renderMaintenance }[section] || renderDashboard)();

  if (loading) return <SafeAreaView style={styles.safe}><PageHeader title="Espace locataire" onBack={navigation.goBack}/><View style={styles.loading}>{[1, 2, 3, 4].map((key) => <Skeleton key={key} width="100%" height={100} style={styles.skeleton}/>)}</View></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.safe}><PageHeader title="Espace locataire" onBack={navigation.goBack}/><EmptyState icon="link-outline" title="Espace locataire indisponible" subtitle={`${error}\nVotre compte doit être rattaché à un dossier locataire validé.`} actionLabel="Réessayer" onAction={load}/></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><PageHeader title="Espace locataire" subtitle={offline ? 'Lecture hors connexion' : 'Portail sécurisé'} onBack={navigation.goBack} rightIcon="refresh" onRightPress={() => load({ refresh: true })}/>{offline && <View style={styles.offline}><Ionicons name="cloud-offline-outline" color={c.warning} size={15}/><Text style={styles.offlineText}>Données en cache · modifications désactivées</Text></View>}<View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{SECTIONS.map(([key, label, icon]) => <TouchableOpacity key={key} style={[styles.tab, section === key && styles.tabActive]} onPress={() => setSection(key)} accessibilityRole="tab" accessibilityState={{ selected: section === key }}><Ionicons name={icon} size={16} color={section === key ? c.onAccent : c.textSub}/><Text style={[styles.tabText, section === key && styles.tabTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View><ScrollView style={styles.content} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={c.gold}/>} keyboardShouldPersistTaps="handled">{renderContent()}</ScrollView></SafeAreaView>;
}

function Info({ label, value, styles }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || '—'}</Text></View>; }
function Timeline({ title, items, styles }) { return <View style={styles.timeline}><Text style={styles.subTitle}>{title}</Text>{items.map((item, index) => <View key={`${item.title}-${item.date}-${index}`} style={styles.timelineRow}><View style={styles.timelineDot}/><View style={styles.rowBody}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.detail}>{date(item.date)}{item.detail ? ` · ${item.detail}` : ''}</Text></View></View>)}</View>; }
function LoadMore({ kind, state, loadMore }) { const page = state[kind].pagination?.page || 1; const pages = state[kind].pagination?.pages || 1; return page < pages ? <Button label="Charger la suite" variant="outline" onPress={() => loadMore(kind)} style={{ marginTop: spacing.md }}/> : null; }

const makeStyles = (c, tablet) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, content: { flex: 1 }, scroll: { padding: spacing.md, paddingBottom: spacing.xxl, maxWidth: tablet ? 900 : undefined, width: '100%', alignSelf: 'center' },
  loading: { padding: spacing.md }, skeleton: { marginBottom: spacing.md }, tabs: { gap: spacing.xs, padding: spacing.sm, backgroundColor: c.bgCard, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: 20 }, tabActive: { backgroundColor: c.gold }, tabText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.textSub }, tabTextActive: { color: c.onAccent },
  offline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 7, backgroundColor: c.goldLight }, offlineText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.warning },
  hero: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.borderGold, borderRadius: radius.md, padding: spacing.xl, marginBottom: spacing.md }, eyebrow: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: c.gold, letterSpacing: 1.5 }, heroTitle: { fontFamily: fonts.display, fontSize: 30, color: c.text, marginTop: spacing.xs }, heroSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metric: { width: tablet ? '31%' : '47%', minWidth: 145, flexGrow: 1, padding: spacing.md }, metricLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub, marginTop: spacing.sm }, metricValue: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, marginTop: 3 },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm }, block: { marginBottom: spacing.md }, cardTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text }, subTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text, marginTop: spacing.md, marginBottom: spacing.sm }, status: { alignSelf: 'flex-start', fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: c.success, backgroundColor: c.successMuted, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 12, marginVertical: spacing.sm },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: spacing.sm }, rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.goldLight, alignItems: 'center', justifyContent: 'center' }, rowBody: { flex: 1 }, rowTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text }, detail: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textSub, marginTop: 3, lineHeight: 17 }, actions: { flexDirection: 'row', gap: spacing.md, paddingLeft: spacing.sm },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: spacing.sm }, infoLabel: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub }, infoValue: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text }, timeline: { marginTop: spacing.sm }, timelineRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs }, timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.gold, marginTop: 5 },
  label: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text, marginTop: spacing.md, marginBottom: spacing.xs }, chips: { gap: spacing.xs, paddingBottom: spacing.sm }, chip: { borderWidth: 1, borderColor: c.inputBorder, borderRadius: 18, paddingHorizontal: spacing.sm, paddingVertical: 8 }, chipActive: { backgroundColor: c.gold, borderColor: c.gold }, chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.textSub }, chipTextActive: { color: c.onAccent }, input: { minHeight: 110, textAlignVertical: 'top', borderWidth: 1, borderColor: c.inputBorder, borderRadius: radius.sm, padding: spacing.sm, color: c.text, fontFamily: fonts.body, marginBottom: spacing.md }, submit: { marginTop: spacing.sm },
});
