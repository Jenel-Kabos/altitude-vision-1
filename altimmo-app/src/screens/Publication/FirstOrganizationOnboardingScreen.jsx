import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { createTenantApplication, deleteTenantApplicationDocument, getFirstOrganizationOnboardingStatus, getMyTenantApplication, openTenantApplicationDocument, submitTenantApplication, updateTenantApplication, uploadTenantApplicationDocument } from '../../services/platformTenantService';
import { fonts, fontSize, spacing } from '../../theme';

const CATEGORIES = Object.freeze([
  ['responsible_person_identity', 'Identité du responsable'],
  ['professional_business_existence', 'Existence professionnelle / activité'],
  ['establishment_authority', 'Lien avec l’établissement'],
  ['establishment_context', 'Éléments concernant l’établissement'],
]);
const ALLOWED_MIME = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_BYTES = 10 * 1024 * 1024;
const APPLICATION_STATES = new Set(['DRAFT', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'REJECTED']);
const EMPTY_FORM = Object.freeze({ organizationName: '', organizationType: '', email: '', phone: '', address: '', city: '', country: 'Congo', businessDeclaration: '', establishmentName: '', establishmentAddress: '', establishmentCity: '' });
const ERROR_MESSAGES = Object.freeze({ TENANT_APPLICATION_INCOMPLETE: 'Votre dossier est incomplet. Vérifiez les champs et les quatre catégories de justificatifs.', TENANT_APPLICATION_DOCUMENT_LIMIT: 'La limite de justificatifs est atteinte.', TENANT_APPLICATION_LOCKED: 'Votre demande est verrouillée pendant son examen.', TENANT_APPLICATION_DOCUMENTS_LOCKED: 'Les justificatifs ne peuvent plus être modifiés dans cet état.' });

const fromApplication = (item) => ({ organizationName: item?.organizationName || '', organizationType: item?.organizationType || '', email: item?.professionalContact?.email || '', phone: item?.professionalContact?.phone || '', address: item?.professionalContact?.address || '', city: item?.professionalContact?.city || '', country: item?.professionalContact?.country || 'Congo', businessDeclaration: item?.businessDeclaration || '', establishmentName: item?.establishmentContext?.name || '', establishmentAddress: item?.establishmentContext?.address || '', establishmentCity: item?.establishmentContext?.city || '' });
const toPayload = (form) => ({ organizationName: form.organizationName.trim(), organizationType: form.organizationType.trim(), professionalContact: { email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim(), city: form.city.trim(), country: form.country.trim() }, businessDeclaration: form.businessDeclaration.trim(), establishmentContext: { name: form.establishmentName.trim(), address: form.establishmentAddress.trim(), city: form.establishmentCity.trim() } });

export default function FirstOrganizationOnboardingScreen({ navigation, route }) {
  const { refreshUser } = useAuth(); const { themeColors: c } = useTheme(); const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState(route?.params?.initialStatus || null); const [application, setApplication] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM); const [introAccepted, setIntroAccepted] = useState(false);
  const [busy, setBusy] = useState(false); const [uploadingCategory, setUploadingCategory] = useState(null); const [error, setError] = useState('');
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const refresh = useCallback(async () => {
    if (busy) return;
    try {
      const next = await getFirstOrganizationOnboardingStatus(); setState(next);
      if (APPLICATION_STATES.has(next)) { const current = await getMyTenantApplication(); setApplication(current); setForm(fromApplication(current)); }
      if (next === 'ALREADY_ONBOARDED') await refreshUser?.();
    } catch (requestError) { setError(requestError.normalized?.message || 'Impossible d’actualiser votre demande.'); }
  }, [busy, refreshUser]);
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') refresh(); }); return () => subscription.remove(); }, [refresh]);

  const save = async () => {
    if (busy) return;
    if (form.organizationName.trim().length < 2) { setError('Saisissez le nom de votre organisation.'); return; }
    setBusy(true); setError('');
    try { const saved = application?.id ? await updateTenantApplication(application.id, toPayload(form)) : await createTenantApplication(toPayload(form)); setApplication(saved); setForm(fromApplication(saved)); setState('DRAFT'); setIntroAccepted(true); }
    catch (requestError) { setError(ERROR_MESSAGES[requestError.response?.data?.code] || requestError.normalized?.message || 'Enregistrement impossible. Vous pouvez réessayer.'); }
    finally { setBusy(false); }
  };

  const pickAndUpload = async (category) => {
    if (!application?.id || uploadingCategory) return; const documents = application.documents || [];
    if (documents.length >= 12 || documents.filter((item) => item.category === category).length >= 3) { Alert.alert('Limite atteinte', 'Maximum 3 justificatifs par catégorie et 12 par dossier.'); return; }
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_MIME, multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return; const file = result.assets[0];
    if (!ALLOWED_MIME.includes(file.mimeType)) { Alert.alert('Format non accepté', 'Choisissez un fichier PDF, JPEG ou PNG.'); return; }
    if ((file.size || 0) > MAX_BYTES) { Alert.alert('Fichier trop volumineux', 'Chaque justificatif doit faire au maximum 10 Mo.'); return; }
    setUploadingCategory(category); setError('');
    try { await uploadTenantApplicationDocument(application.id, category, file); setApplication(await getMyTenantApplication()); }
    catch (requestError) { setError(ERROR_MESSAGES[requestError.response?.data?.code] || requestError.normalized?.message || 'Téléversement impossible. Réessayez.'); }
    finally { setUploadingCategory(null); }
  };

  const removeDocument = (document) => Alert.alert('Retirer ce document ?', 'Le justificatif sera retiré de votre brouillon.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: async () => { try { await deleteTenantApplicationDocument(application.id, document.id); setApplication(await getMyTenantApplication()); } catch (requestError) { setError(ERROR_MESSAGES[requestError.response?.data?.code] || 'Suppression impossible.'); } } }]);
  const submit = async () => { if (busy || !application?.id) return; setBusy(true); setError(''); try { const submitted = await submitTenantApplication(application.id); setApplication(submitted); setState('PENDING_REVIEW'); } catch (requestError) { setError(ERROR_MESSAGES[requestError.response?.data?.code] || requestError.normalized?.message || 'Soumission impossible.'); } finally { setBusy(false); } };
  const continueToHotel = async () => { await refreshUser?.(); navigation.replace('AddAccommodation', { publicationKind: 'hotel_establishment' }); };

  if (!state) return <Screen><Text accessibilityLiveRegion="polite" style={styles.description}>Vérification de votre activation professionnelle…</Text></Screen>;
  if (state === 'NO_APPLICATION' && !introAccepted) return <Screen scroll><Text style={styles.title}>Activation professionnelle</Text><Text style={styles.description}>Votre organisation doit être vérifiée avant de pouvoir publier un établissement hôtelier. Vos justificatifs resteront privés. L’activation de votre organisation vous permettra ensuite de créer un hôtel, qui conservera son propre processus de validation et de publication.</Text><Button label="Commencer ma demande" onPress={() => setIntroAccepted(true)} fullWidth /><Button label="Retour" onPress={() => navigation.goBack()} variant="outline" fullWidth style={styles.secondary} /></Screen>;
  if (state === 'PENDING_REVIEW') return <StatusView styles={styles} title="Demande en cours de vérification" body="Notre équipe examine votre demande d’activation professionnelle." application={application} onRefresh={refresh} />;
  if (state === 'REJECTED') return <StatusView styles={styles} title="Demande non approuvée" body={application?.rejectionReason || 'Votre demande n’a pas été approuvée. Consultez les canaux d’assistance disponibles dans l’application.'} application={application} onRefresh={refresh} />;
  if (['REVIEW_REQUIRED', 'AMBIGUOUS'].includes(state)) return <StatusView styles={styles} title="Vérification nécessaire" body="Votre situation nécessite une vérification par notre équipe avant de pouvoir créer un hôtel." onRefresh={refresh} />;
  if (state === 'FORBIDDEN') return <StatusView styles={styles} title="Accès non autorisé" body="Ce parcours d’activation professionnelle est réservé aux propriétaires éligibles." onRefresh={refresh} />;
  if (state === 'ALREADY_ONBOARDED') return <Screen scroll><Text style={styles.title}>Votre organisation est activée</Text><Text style={styles.description}>Vous pouvez maintenant créer votre hôtel. Celui-ci suivra ensuite son processus normal de validation et de publication.</Text><Button label="Continuer vers la création de l’hôtel" onPress={continueToHotel} fullWidth /></Screen>;
  if (!['DRAFT', 'ADDITIONAL_INFO_REQUIRED', 'NO_APPLICATION'].includes(state)) return <StatusView styles={styles} title="Vérification impossible" body="L’état reçu est inconnu. La création d’hôtel reste bloquée par sécurité." onRefresh={refresh} />;

  const complement = state === 'ADDITIONAL_INFO_REQUIRED'; const reopened = new Set(application?.reopenedFields || []); const editable = (field) => !complement || reopened.has(field); const requestedCategories = new Set(application?.additionalInfo?.requestedDocumentCategories || []); const documents = application?.documents || []; const missingCategories = CATEGORIES.filter(([key]) => !documents.some((item) => item.category === key)).map(([, label]) => label);
  return <Screen scroll avoidKeyboard>
    <Text style={styles.title}>{complement ? 'Informations complémentaires requises' : 'Demande d’activation professionnelle'}</Text>
    {complement ? <Text accessibilityRole="alert" style={styles.notice}>{application?.additionalInfo?.reason}</Text> : null}
    <Input label="Nom de l’organisation" value={form.organizationName} onChangeText={setField('organizationName')} editable={editable('organizationName')} />
    <Input label="Type d’organisation" value={form.organizationType} onChangeText={setField('organizationType')} editable={editable('organizationType')} />
    <Text style={styles.section}>Contact professionnel</Text>
    <Input label="E-mail professionnel" value={form.email} onChangeText={setField('email')} keyboardType="email-address" editable={editable('professionalContact')} />
    <Input label="Téléphone professionnel" value={form.phone} onChangeText={setField('phone')} keyboardType="phone-pad" editable={editable('professionalContact')} />
    <Input label="Adresse professionnelle" value={form.address} onChangeText={setField('address')} editable={editable('professionalContact')} />
    <Input label="Ville" value={form.city} onChangeText={setField('city')} editable={editable('professionalContact')} />
    <Input label="Pays" value={form.country} onChangeText={setField('country')} editable={editable('professionalContact')} />
    <Input label="Présentation de l’activité" value={form.businessDeclaration} onChangeText={setField('businessDeclaration')} multiline editable={editable('businessDeclaration')} />
    <Text style={styles.section}>Premier établissement</Text>
    <Input label="Nom de l’établissement" value={form.establishmentName} onChangeText={setField('establishmentName')} editable={editable('establishmentContext')} />
    <Input label="Adresse de l’établissement" value={form.establishmentAddress} onChangeText={setField('establishmentAddress')} editable={editable('establishmentContext')} />
    <Input label="Ville de l’établissement" value={form.establishmentCity} onChangeText={setField('establishmentCity')} editable={editable('establishmentContext')} />
    <Button label={application?.id ? 'Enregistrer le brouillon' : 'Créer mon dossier'} onPress={save} loading={busy} disabled={busy} fullWidth style={styles.secondary} />
    {application?.id ? <><Text style={styles.section}>Justificatifs privés ({documents.length}/12)</Text>{CATEGORIES.map(([key, label]) => { const categoryDocuments = documents.filter((item) => item.category === key); const canAdd = !complement || requestedCategories.has(key); return <View key={key} style={styles.category}><Text style={styles.categoryTitle}>{label} ({categoryDocuments.length}/3)</Text>{categoryDocuments.map((document) => <View key={document.id} style={styles.document}><Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${document.displayName}`} onPress={() => openTenantApplicationDocument(application.id, document)}><Text style={styles.documentName}>{document.displayName} · version {document.revision}</Text></Pressable>{state === 'DRAFT' ? <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${document.displayName}`} onPress={() => removeDocument(document)}><Text style={styles.remove}>Retirer</Text></Pressable> : null}</View>)}{canAdd ? <Button label={uploadingCategory === key ? 'Téléversement…' : 'Ajouter un justificatif'} onPress={() => pickAndUpload(key)} loading={uploadingCategory === key} disabled={Boolean(uploadingCategory) || categoryDocuments.length >= 3} variant="outline" size="sm" /> : null}</View>; })}<Text style={styles.section}>Résumé du dossier</Text><Text style={styles.summary}>Organisation : {form.organizationName || 'À compléter'}{`\n`}Contact : {form.email || form.phone || 'À compléter'}{`\n`}Établissement : {form.establishmentName || 'À compléter'}{`\n`}Justificatifs : {documents.length}</Text>{missingCategories.length ? <Text accessibilityRole="alert" style={styles.error}>Catégories manquantes : {missingCategories.join(', ')}</Text> : null}<Button label={complement ? 'Renvoyer ma demande' : 'Soumettre ma demande'} onPress={submit} loading={busy} disabled={busy} fullWidth style={styles.submit} /></> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Button label="Retour" onPress={() => navigation.goBack()} variant="outline" disabled={busy} fullWidth style={styles.secondary} />
  </Screen>;
}

function StatusView({ styles, title, body, application, onRefresh }) { return <Screen scroll><Text style={styles.title}>{title}</Text><Text style={styles.description}>{body}</Text>{application?.organizationName ? <Text style={styles.summary}>Organisation : {application.organizationName}{application.submittedAt ? `\nSoumise le : ${new Date(application.submittedAt).toLocaleDateString('fr-FR')}` : ''}</Text> : null}<Button label="Actualiser" onPress={onRefresh} fullWidth /></Screen>; }
const makeStyles = (c) => StyleSheet.create({ title: { fontFamily: fonts.displaySemi, fontSize: fontSize.display, color: c.text, marginBottom: spacing.sm }, description: { fontFamily: fonts.body, fontSize: fontSize.md, color: c.textSub, lineHeight: 23, marginBottom: spacing.xl }, section: { fontFamily: fonts.bodyBold, fontSize: fontSize.lg, color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm }, notice: { fontFamily: fonts.body, color: c.warning || c.gold, marginBottom: spacing.md, lineHeight: 22 }, category: { backgroundColor: c.bgCard, padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm }, categoryTitle: { fontFamily: fonts.bodyBold, color: c.text, marginBottom: spacing.sm }, document: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }, documentName: { fontFamily: fonts.body, color: c.textSub, flexShrink: 1 }, remove: { color: c.error, fontFamily: fonts.bodyBold, padding: spacing.sm }, summary: { fontFamily: fonts.body, color: c.textSub, lineHeight: 22, backgroundColor: c.bgCard, padding: spacing.md, borderRadius: 12 }, error: { fontFamily: fonts.body, color: c.error, marginTop: spacing.sm, lineHeight: 20 }, submit: { marginTop: spacing.xl }, secondary: { marginTop: spacing.sm } });
