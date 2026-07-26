import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import { ChipMultiSelect, Counter, PhotoManager, StepFooter, StepHeader, SummaryRow } from '../../components/publication';
import { HOTEL_ACCOMMODATION_TYPES, HOTEL_ROOM_CATEGORY_TYPES, HOTEL_RATE_TYPES } from '../../constants/accommodation';
import { ACCOMMODATION_AMENITY_GROUPS } from '../../constants/accommodationAmenities';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { createHotelRoomCategory, getHotelCategoryTotals, validateHotelCategories } from '../../utils/hotelPublication';
import { buildHotelProfilePayload, buildHotelPropertyPayload, buildHotelRoomCategoriesPayload } from '../../services/publicationPayloads';
import { createFullAccommodationMobile, uploadToCloudinary } from '../../services/annonceService';
import { useDraftAnnonce } from '../../hooks/useDraftAnnonce';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';

const STEPS = ['identity', 'location', 'inventory', 'categories', 'rates', 'services', 'policies', 'photos', 'summary'];
const TITLES = {
  identity: "Identité de l'établissement", location: 'Localisation et contacts', inventory: 'Capacité et inventaire',
  categories: 'Catégories de chambres', rates: 'Tarifs par catégorie', services: 'Services et équipements',
  policies: 'Politiques et horaires', photos: "Photos de l'hôtel", summary: 'Vérification et publication',
};
const HOTEL_SERVICES = [
  ['reception24h', 'Réception 24h/24'], ['restaurant', 'Restaurant'], ['bar', 'Bar'], ['parking', 'Parking'],
  ['wifi', 'Wi-Fi'], ['piscine', 'Piscine'], ['salleConference', 'Salle de conférence'],
  ['navette', 'Navette'], ['spa', 'Spa'], ['salleSport', 'Salle de sport'],
];
const initialForm = {
  establishmentName: '', description: '', accommodationType: 'hotel', starRating: '',
  hotelPhone: '', hotelEmail: '', hotelWebsite: '', ville: '', arrondissement: '', rue: '',
  checkInTime: '14:00', checkOutTime: '11:00', hotelServices: {},
  roomCategories: [], houseRules: [],
};

export default function HotelEstablishmentScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { loadDraft, saveDraft, clearDraft } = useDraftAnnonce('hotel_establishment');
  const requestId = useRef(Crypto.randomUUID());
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({ ...initialForm, publicationRequestId: requestId.current });
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const promptShown = useRef(false);
  const totals = useMemo(() => getHotelCategoryTotals(form.roomCategories), [form.roomCategories]);
  const step = STEPS[stepIndex];

  useEffect(() => {
    if (promptShown.current) return;
    promptShown.current = true;
    loadDraft().then((draft) => {
      if (!draft) return;
      Alert.alert('Configuration hôtelière trouvée', 'Reprendre ce brouillon ?', [
        { text: 'Supprimer', style: 'destructive', onPress: clearDraft },
        { text: 'Reprendre', onPress: () => setForm((previous) => ({ ...previous, ...draft })) },
      ]);
    });
  }, [clearDraft, loadDraft]);
  useEffect(() => { saveDraft(form); }, [form, saveDraft]);

  const setField = useCallback((key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }, []);
  const updateCategory = useCallback((index, patchValue) => setForm((previous) => ({
    ...previous,
    roomCategories: previous.roomCategories.map((category, categoryIndex) => (
      categoryIndex === index ? { ...category, ...patchValue } : category
    )),
  })), []);
  const addCategory = useCallback(() => setForm((previous) => ({
    ...previous, roomCategories: [...previous.roomCategories, createHotelRoomCategory(previous.roomCategories.length)],
  })), []);
  const duplicateCategory = useCallback((index) => setForm((previous) => {
    const source = previous.roomCategories[index];
    const clone = { ...source, clientKey: Crypto.randomUUID(), name: `${source.name} (copie)`, code: `${source.code}2` };
    return { ...previous, roomCategories: [...previous.roomCategories.slice(0, index + 1), clone, ...previous.roomCategories.slice(index + 1)] };
  }), []);
  const removeCategory = useCallback((index) => setForm((previous) => ({
    ...previous, roomCategories: previous.roomCategories.filter((_, categoryIndex) => categoryIndex !== index),
  })), []);
  const moveCategory = useCallback((index, direction) => setForm((previous) => {
    const target = index + direction;
    if (target < 0 || target >= previous.roomCategories.length) return previous;
    const next = [...previous.roomCategories];
    [next[index], next[target]] = [next[target], next[index]];
    return { ...previous, roomCategories: next };
  }), []);

  const validateStep = useCallback(() => {
    const next = {};
    if (step === 'identity') {
      if (!form.establishmentName.trim()) next.establishmentName = "Nom de l'établissement requis";
      if (!form.description.trim()) next.description = 'Description commerciale requise';
      if (!form.accommodationType) next.accommodationType = "Type d'établissement requis";
    }
    if (step === 'location') {
      if (!form.ville) next.ville = 'Ville requise';
      if (!form.arrondissement) next.arrondissement = 'Arrondissement requis';
      if (!form.hotelPhone.trim()) next.hotelPhone = 'Téléphone principal requis';
    }
    if (step === 'categories' || step === 'rates' || step === 'summary') Object.assign(next, validateHotelCategories(form.roomCategories));
    if (step === 'photos' && !photos.length) next.photos = 'Ajoutez au moins une photo générale';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, photos.length, step]);

  const publish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(photos.map((photo) => photo.url || uploadToCloudinary(photo.uri)));
      setPhotos((previous) => previous.map((photo, index) => ({ ...photo, url: uploaded[index] })));
      await createFullAccommodationMobile({
        publicationRequestId: form.publicationRequestId,
        publicationKind: 'hotel_establishment',
        property: buildHotelPropertyPayload(form, uploaded),
        accommodation: buildHotelProfilePayload({ ...form, hotelGallery: uploaded }),
        roomCategories: buildHotelRoomCategoriesPayload(form),
      });
      await clearDraft();
      Alert.alert('Établissement envoyé', 'Votre configuration hôtelière complète est en attente de validation.', [
        { text: 'Voir mes annonces', onPress: () => navigation.navigate('Profil', { screen: 'MesAnnonces' }) },
      ]);
    } catch (error) {
      Alert.alert('Erreur', error.message || "Impossible de publier l'établissement.");
    } finally { setSubmitting(false); }
  }, [clearDraft, form, navigation, photos, submitting]);
  const next = useCallback(() => {
    if (!validateStep()) return;
    if (stepIndex === STEPS.length - 1) { publish(); return; }
    setStepIndex((value) => value + 1);
  }, [publish, stepIndex, validateStep]);
  const back = useCallback(() => {
    if (stepIndex === 0) navigation.goBack(); else setStepIndex((value) => value - 1);
  }, [navigation, stepIndex]);

  return <Screen scroll avoidKeyboard>
    <StepHeader title={TITLES[step]} stepIndex={stepIndex} stepCount={STEPS.length} onBack={back} />
    {['inventory', 'categories', 'rates', 'summary'].includes(step) && <View style={styles.totalCard}>
      <Text style={styles.totalStrong}>{totals.totalRooms} chambres · {form.roomCategories.length} catégories</Text>
      <Text style={styles.totalText}>{totals.totalCapacity} personnes · {totals.totalBeds} lits</Text>
      <Text style={styles.totalText}>{totals.minNightlyRate ? `${totals.minNightlyRate.toLocaleString('fr-FR')} à ${totals.maxNightlyRate.toLocaleString('fr-FR')} FCFA / nuit` : 'Tarifs à configurer'}</Text>
    </View>}
    {step === 'identity' && <View>
      <ChipMultiSelect label="Type d'établissement" options={HOTEL_ACCOMMODATION_TYPES} value={form.accommodationType} onChange={(value) => setField('accommodationType', value)} error={errors.accommodationType} />
      <Input label="Nom de l'hôtel" value={form.establishmentName} onChangeText={(value) => setField('establishmentName', value)} error={errors.establishmentName} style={styles.field} />
      <Input label="Description commerciale" multiline value={form.description} onChangeText={(value) => setField('description', value)} error={errors.description} style={styles.field} />
      <ChipMultiSelect label="Classement" options={[{ value: '', label: 'Non classé' }, ...[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} étoile${value > 1 ? 's' : ''}` }))]} value={String(form.starRating)} onChange={(value) => setField('starRating', value)} />
    </View>}
    {step === 'location' && <View>
      <ChipMultiSelect label="Ville" options={VILLES.map((value) => ({ value, label: value }))} value={form.ville} onChange={(value) => { setField('ville', value); setField('arrondissement', ''); }} error={errors.ville} />
      <ChipMultiSelect label="Arrondissement" options={getArrondissementsFor(form.ville).map((value) => ({ value, label: value }))} value={form.arrondissement} onChange={(value) => setField('arrondissement', value)} error={errors.arrondissement} />
      <Input label="Adresse complète" value={form.rue} onChangeText={(value) => setField('rue', value)} style={styles.field} />
      <Input label="Téléphone principal" keyboardType="phone-pad" value={form.hotelPhone} onChangeText={(value) => setField('hotelPhone', value)} error={errors.hotelPhone} style={styles.field} />
      <Input label="Email professionnel (optionnel)" keyboardType="email-address" value={form.hotelEmail} onChangeText={(value) => setField('hotelEmail', value)} style={styles.field} />
      <Input label="Site web (optionnel)" value={form.hotelWebsite} onChangeText={(value) => setField('hotelWebsite', value)} style={styles.field} />
    </View>}
    {step === 'inventory' && <View><Text style={styles.heading}>Capacité calculée automatiquement</Text><Text style={styles.help}>Les totaux proviennent des quantités, capacités et lits déclarés dans chaque catégorie. Ils ne sont jamais saisis deux fois.</Text></View>}
    {step === 'categories' && <View>
      {form.roomCategories.map((category, index) => <CategoryCard key={category.clientKey} category={category} index={index} errors={errors} styles={styles} update={updateCategory} duplicate={duplicateCategory} remove={removeCategory} move={moveCategory} />)}
      {errors.roomCategories && <Text style={styles.error}>{errors.roomCategories}</Text>}
      <ActionButton label="＋ Ajouter une catégorie" onPress={addCategory} styles={styles} />
    </View>}
    {step === 'rates' && <View>{form.roomCategories.map((category, index) => <RateCard key={category.clientKey} category={category} index={index} update={updateCategory} error={errors[`roomCategories.${index}.ratePlans`]} styles={styles} />)}</View>}
    {step === 'services' && <ChipMultiSelect label="Services de l'établissement" options={HOTEL_SERVICES.map(([value, label]) => ({ value, label }))} value={Object.keys(form.hotelServices).filter((key) => form.hotelServices[key])} onChange={(values) => setField('hotelServices', Object.fromEntries(HOTEL_SERVICES.map(([key]) => [key, values.includes(key)])))} multiple />}
    {step === 'policies' && <View><Input label="Heure de check-in" value={form.checkInTime} onChangeText={(value) => setField('checkInTime', value)} style={styles.field} /><Input label="Heure de check-out" value={form.checkOutTime} onChangeText={(value) => setField('checkOutTime', value)} style={styles.field} /></View>}
    {step === 'photos' && <PhotoManager photos={photos} onChange={setPhotos} error={errors.photos} />}
    {step === 'summary' && <View>
      <Text style={styles.heading}>Récapitulatif professionnel</Text>
      <SummaryRow label="Établissement" value={form.establishmentName} /><SummaryRow label="Localisation" value={`${form.arrondissement} · ${form.ville}`} />
      <SummaryRow label="Inventaire" value={`${totals.totalRooms} chambres · ${totals.totalCapacity} personnes · ${totals.totalBeds} lits`} />
      <SummaryRow label="Tarification" value={`${totals.minNightlyRate.toLocaleString('fr-FR')} à ${totals.maxNightlyRate.toLocaleString('fr-FR')} FCFA / nuit`} />
      {form.roomCategories.map((category) => <SummaryRow key={category.clientKey} label={`${category.name} (${category.code})`} value={`${category.quantity} unité(s) · ${category.adultCapacity + category.childCapacity} pers./chambre · ${Number(category.ratePlans[0]?.amount || 0).toLocaleString('fr-FR')} FCFA`} />)}
      <SummaryRow label="Arrivée / départ" value={`${form.checkInTime} / ${form.checkOutTime}`} /><SummaryRow label="Photos" value={`${photos.length} photo(s)`} />
    </View>}
    <StepFooter onBack={back} onNext={next} isLast={stepIndex === STEPS.length - 1} loading={submitting} />
  </Screen>;
}

function CategoryCard({ category, index, errors, styles, update, duplicate, remove, move }) {
  const error = (field) => errors[`roomCategories.${index}.${field}`];
  return <View style={styles.categoryCard}>
    <Text style={styles.heading}>Catégorie {index + 1}</Text>
    <ChipMultiSelect label="Type" options={HOTEL_ROOM_CATEGORY_TYPES} value={category.categoryType} onChange={(value) => update(index, { categoryType: value })} />
    <Input label="Nom commercial" value={category.name} onChangeText={(value) => update(index, { name: value })} error={error('name')} style={styles.field} />
    <Input label="Code court" autoCapitalize="characters" value={category.code} onChangeText={(value) => update(index, { code: value.toUpperCase() })} error={error('code')} style={styles.field} />
    <Counter label="Nombre d'unités" value={Number(category.quantity)} onChange={(value) => update(index, { quantity: value })} min={1} error={error('quantity')} />
    <Counter label="Adultes par chambre" value={Number(category.adultCapacity)} onChange={(value) => update(index, { adultCapacity: value })} min={1} error={error('adultCapacity')} />
    <Counter label="Enfants par chambre" value={Number(category.childCapacity)} onChange={(value) => update(index, { childCapacity: value })} min={0} />
    <Counter label="Lits par chambre" value={Number(category.beds)} onChange={(value) => update(index, { beds: value })} min={1} error={error('beds')} />
    <Input label="Surface moyenne (m², optionnel)" keyboardType="numeric" value={String(category.surface)} onChangeText={(value) => update(index, { surface: value })} style={styles.field} />
    {ACCOMMODATION_AMENITY_GROUPS.slice(1, 3).map((group) => <ChipMultiSelect key={group.key} label={group.label} options={group.options.map((value) => ({ value, label: value }))} value={category.amenities?.[group.key] || []} onChange={(values) => update(index, { amenities: { ...category.amenities, [group.key]: values } })} multiple />)}
    <View style={styles.actionRow}><SmallAction label="↑" onPress={() => move(index, -1)} styles={styles} /><SmallAction label="↓" onPress={() => move(index, 1)} styles={styles} /><SmallAction label="Dupliquer" onPress={() => duplicate(index)} styles={styles} /><SmallAction label="Supprimer" onPress={() => remove(index)} styles={styles} danger /></View>
  </View>;
}
function RateCard({ category, index, update, error, styles }) {
  const rates = category.ratePlans || [];
  const setRate = (rateIndex, patchValue) => update(index, { ratePlans: rates.map((rate, current) => current === rateIndex ? { ...rate, ...patchValue } : rate) });
  const addRate = () => {
    const nextType = HOTEL_RATE_TYPES.find((type) => !rates.some((rate) => rate.rateType === type.value))?.value;
    if (nextType) update(index, { ratePlans: [...rates, { rateType: nextType, amount: '', currency: 'XAF' }] });
  };
  return <View style={styles.categoryCard}><Text style={styles.heading}>{category.name || `Catégorie ${index + 1}`}</Text>
    {rates.map((rate, rateIndex) => <View key={rate.rateType}><ChipMultiSelect label="Niveau tarifaire" options={HOTEL_RATE_TYPES} value={rate.rateType} onChange={(value) => setRate(rateIndex, { rateType: value })} /><Input label="Prix par nuit (FCFA)" keyboardType="numeric" value={String(rate.amount)} onChangeText={(value) => setRate(rateIndex, { amount: value })} error={rate.rateType === 'public' ? error : undefined} style={styles.field} /></View>)}
    <SmallAction label="Ajouter un tarif" onPress={addRate} styles={styles} /></View>;
}
const ActionButton = ({ label, onPress, styles }) => <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.primaryAction}><Text style={styles.primaryActionText}>{label}</Text></TouchableOpacity>;
const SmallAction = ({ label, onPress, styles, danger }) => <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.smallAction}><Text style={[styles.smallActionText, danger && styles.danger]}>{label}</Text></TouchableOpacity>;
const makeStyles = (c) => StyleSheet.create({
  field: { marginBottom: spacing.sm }, heading: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, marginBottom: spacing.sm },
  help: { fontFamily: fonts.body, color: c.textSub, lineHeight: 21 }, error: { color: c.error, marginBottom: spacing.sm },
  totalCard: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  totalStrong: { fontFamily: fonts.bodyBold, color: c.text, fontSize: fontSize.md }, totalText: { color: c.textSub, marginTop: 4 },
  categoryCard: { borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md, backgroundColor: c.bgCard },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, smallAction: { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  smallActionText: { color: c.gold, fontFamily: fonts.bodyBold }, danger: { color: c.error },
  primaryAction: { backgroundColor: c.gold, borderRadius: 12, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md }, primaryActionText: { color: c.onAccent, fontFamily: fonts.bodyBold },
});
