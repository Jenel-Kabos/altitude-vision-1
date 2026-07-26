import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import {
  StepHeader, StepFooter, ChipMultiSelect, PhotoManager, SummaryRow, Counter,
} from '../../components/publication';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import {
  FURNISHED_ACCOMMODATION_TYPES, HOTEL_ACCOMMODATION_TYPES,
} from '../../constants/accommodation';
import { ACCOMMODATION_AMENITY_GROUPS } from '../../constants/accommodationAmenities';
import { furnishedAccommodationSchema, hotelAccommodationSchema } from '../../utils/publicationValidation';
import {
  buildFurnishedAccommodationPropertyPayload, buildFurnishedAccommodationProfilePayload,
  buildHotelPropertyPayload, buildHotelProfilePayload, buildAccommodationRatePayload,
} from '../../services/publicationPayloads';
import { createFullAccommodationMobile, uploadToCloudinary } from '../../services/annonceService';
import { useDraftAnnonce } from '../../hooks/useDraftAnnonce';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';
import HotelEstablishmentScreen from './HotelEstablishmentScreen';

// Terrain/Bureau/Commerce/Entrepôt n'ont aucun sens pour un hébergement meublé
// (mission §6) — Property.type reste néanmoins requis par le schéma backend même
// pour un bien "hebergement" (voir buildBasePropertyData), donc on restreint la liste
// plutôt que de la masquer entièrement.
const STEP_TITLES = {
  info: 'Type et informations',
  location: 'Localisation',
  features: 'Caractéristiques',
  price: 'Tarif et disponibilité',
  photos: 'Photos',
  summary: 'Vérification et publication',
};

const baseForm = {
  titre: '', establishmentName: '', description: '', accommodationType: '',
  ville: '', arrondissement: '', rue: '', surface: '',
  bedrooms: 0, bathrooms: 1, capaciteAdultes: 2, capaciteEnfants: 0, beds: 0,
  checkInTime: '14:00', checkOutTime: '11:00',
  tarifNuit: '', securityDeposit: '', cleaningFee: '',
  accommodationAmenities: {},
  starRating: '', hasReception: false, hotelServices: {},
};

const HOTEL_SERVICES = [
  ['reception24h', 'Réception 24h/24'], ['restaurant', 'Restaurant'], ['parking', 'Parking'],
  ['wifi', 'Wi-Fi'], ['piscine', 'Piscine'], ['salleConference', 'Salle de réunion'],
  ['navette', 'Navette'], ['spa', 'Spa'], ['salleSport', 'Salle de sport'],
];

function FurnishedAccommodationScreen({ navigation, route }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { loadDraft, saveDraft, clearDraft } = useDraftAnnonce('hebergement');
  const publicationKind = route?.params?.publicationKind || 'furnished_accommodation';
  const isHotel = publicationKind === 'hotel_establishment';
  const schema = isHotel ? hotelAccommodationSchema : furnishedAccommodationSchema;
  const accommodationTypes = isHotel ? HOTEL_ACCOMMODATION_TYPES : FURNISHED_ACCOMMODATION_TYPES;

  // Clé d'idempotence de la publication (correctif robustesse 2026-07) — générée
  // une seule fois par tentative de publication (un seul mount de cet écran) et
  // conservée pour tous les retries (même en cas d'erreur réseau). Persistée dans
  // le brouillon local : si l'app est tuée puis relancée sur "Reprendre", la MÊME
  // clé est réutilisée (jamais régénérée pour un simple retry). Une nouvelle
  // valeur n'apparaît que si l'écran est remonté pour une toute nouvelle
  // publication (nouveau mount → nouvelle référence).
  const publicationRequestIdRef = useRef(null);
  if (!publicationRequestIdRef.current) publicationRequestIdRef.current = Crypto.randomUUID();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => ({ ...baseForm, publicationRequestId: publicationRequestIdRef.current }));
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const draftPromptShown = useRef(false);

  useEffect(() => {
    if (draftPromptShown.current) return;
    draftPromptShown.current = true;
    loadDraft().then((draft) => {
      if (!draft) return;
      Alert.alert(
        'Brouillon trouvé',
        'Vous avez un hébergement en cours de rédaction. Reprendre ?',
        [
          { text: 'Supprimer', style: 'destructive', onPress: () => clearDraft() },
          { text: 'Reprendre', onPress: () => setForm((prev) => ({ ...prev, ...draft })) },
        ],
      );
    });
  }, [loadDraft, clearDraft]);

  useEffect(() => { saveDraft(form); }, [form, saveDraft]);

  const step = schema.steps[stepIndex];

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const onSelectVille = useCallback((ville) => {
    setForm((prev) => ({ ...prev, ville, arrondissement: '' }));
    setErrors((prev) => ({ ...prev, ville: undefined }));
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex === 0) { navigation.goBack(); return; }
    setStepIndex((i) => i - 1);
  }, [stepIndex, navigation]);

  const handlePublish = useCallback(async () => {
    if (submitting) return; // bloque toute double soumission (double-clic ou double-tap)
    setSubmitting(true);
    try {
      // Un retry (après erreur réseau) ne re-télécharge jamais une photo déjà
      // uploadée (`p.url` déjà posé) — évite de dupliquer des actifs Cloudinary
      // à chaque nouvelle tentative avec la même publication.
      const uploaded = await Promise.all(photos.map((p) => (p.url ? Promise.resolve(p.url) : uploadToCloudinary(p.uri))));
      setPhotos((prev) => prev.map((p, i) => (p.url ? p : { ...p, url: uploaded[i] })));

      const propertyPayload = isHotel
        ? buildHotelPropertyPayload(form, uploaded)
        : buildFurnishedAccommodationPropertyPayload(form, uploaded);
      const accommodationPayload = isHotel
        ? buildHotelProfilePayload(form)
        : buildFurnishedAccommodationProfilePayload(form);
      const ratePayload = buildAccommodationRatePayload(form);
      await createFullAccommodationMobile({
        publicationRequestId: form.publicationRequestId,
        publicationKind,
        property: propertyPayload,
        accommodation: accommodationPayload,
        ratePlan: ratePayload,
      });
      await clearDraft();
      Alert.alert(
        'Hébergement envoyé',
        'Votre hébergement est en attente de validation par notre équipe.',
        [
          { text: 'Voir mes annonces', onPress: () => navigation.navigate('Profil', { screen: 'MesAnnonces' }) },
          { text: "Retour à l'accueil", onPress: () => navigation.navigate('Annonces', { screen: 'ListeAnnonces' }) },
        ],
      );
    } catch (err) {
      // Le formulaire (et la clé publicationRequestId) ne sont jamais réinitialisés
      // ici : l'utilisateur peut relancer "Publier" directement, la même clé est
      // renvoyée et le backend garantit qu'aucun doublon n'est créé.
      Alert.alert('Erreur', err.message || "Impossible de publier cet hébergement. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, photos, form, clearDraft, navigation, isHotel, publicationKind]);

  const goNext = useCallback(() => {
    const stepErrors = schema.validateStep(step, { form, photos });
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (stepIndex === schema.steps.length - 1) {
      handlePublish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [step, form, photos, stepIndex, handlePublish, schema]);

  return (
    <Screen scroll avoidKeyboard>
      <StepHeader
        title={STEP_TITLES[step]}
        stepIndex={stepIndex}
        stepCount={schema.steps.length}
        onBack={goBack}
      />

      {step === 'info' && (
        <View>
          <ChipMultiSelect
            label="Catégorie d'hébergement"
            options={accommodationTypes}
            value={form.accommodationType}
            onChange={(v) => setField('accommodationType', v)}
            error={errors.accommodationType}
          />
          <Input
            label={isHotel ? "Nom de l'établissement" : 'Titre'}
            placeholder={isHotel ? 'Ex: Hôtel Panorama' : 'Ex: Villa meublée avec piscine'}
            value={isHotel ? form.establishmentName : form.titre}
            onChangeText={(v) => setField(isHotel ? 'establishmentName' : 'titre', v)}
            error={isHotel ? errors.establishmentName : errors.titre}
            style={styles.field}
          />
          <Input label="Description" placeholder="Décrivez l'hébergement…" multiline value={form.description} onChangeText={(v) => setField('description', v)} error={errors.description} style={styles.field} />
        </View>
      )}

      {step === 'location' && (
        <View>
          <ChipMultiSelect label="Ville" options={VILLES.map((v) => ({ value: v, label: v }))} value={form.ville} onChange={onSelectVille} error={errors.ville} />
          <ChipMultiSelect label="Arrondissement" options={getArrondissementsFor(form.ville).map((a) => ({ value: a, label: a }))} value={form.arrondissement} onChange={(v) => setField('arrondissement', v)} error={errors.arrondissement} />
          <Input label="Adresse (optionnel)" value={form.rue} onChangeText={(v) => setField('rue', v)} style={styles.field} />
        </View>
      )}

      {step === 'features' && (
        <View>
          {isHotel ? (
            <>
              <Text style={styles.summaryTitle}>Capacité hôtelière</Text>
              <Counter label="Capacité globale" value={form.capaciteAdultes} onChange={(v) => setField('capaciteAdultes', v)} min={1} error={errors.capaciteAdultes} />
              <ChipMultiSelect label="Classement (optionnel)" options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: `${v} étoile${v > 1 ? 's' : ''}` }))} value={String(form.starRating)} onChange={(v) => setField('starRating', v)} />
              <Text style={styles.summaryTitle}>Services</Text>
              <ChipMultiSelect
                label="Services de l'établissement"
                options={HOTEL_SERVICES.map(([value, label]) => ({ value, label }))}
                value={Object.keys(form.hotelServices || {}).filter((key) => form.hotelServices[key])}
                onChange={(values) => setField('hotelServices', Object.fromEntries(HOTEL_SERVICES.map(([key]) => [key, values.includes(key)])))}
                multiple
              />
              <Text style={styles.summaryTitle}>Arrivée et départ</Text>
              <Input label="Heure d'arrivée" value={form.checkInTime} onChangeText={(v) => setField('checkInTime', v)} style={styles.field} />
              <Input label="Heure de départ" value={form.checkOutTime} onChangeText={(v) => setField('checkOutTime', v)} style={styles.field} />
            </>
          ) : (
          <>
          <Input label="Surface (m²)" keyboardType="numeric" value={String(form.surface)} onChangeText={(v) => setField('surface', v)} error={errors.surface} style={styles.field} />
          <Counter label="Chambres" value={form.bedrooms} onChange={(v) => setField('bedrooms', v)} />
          <Counter label="Salles de bain" value={form.bathrooms} onChange={(v) => setField('bathrooms', v)} min={1} error={errors.bathrooms} />
          <Counter label="Lits" value={form.beds} onChange={(v) => setField('beds', v)} />
          <Counter label="Capacité — adultes" value={form.capaciteAdultes} onChange={(v) => setField('capaciteAdultes', v)} min={1} error={errors.capaciteAdultes} />
          <Counter label="Capacité — enfants" value={form.capaciteEnfants} onChange={(v) => setField('capaciteEnfants', v)} />
          <Input label="Heure d'arrivée" value={form.checkInTime} onChangeText={(v) => setField('checkInTime', v)} style={styles.field} />
          <Input label="Heure de départ" value={form.checkOutTime} onChangeText={(v) => setField('checkOutTime', v)} style={styles.field} />
          {ACCOMMODATION_AMENITY_GROUPS.map((group) => (
            <ChipMultiSelect
              key={group.key}
              label={group.label}
              options={group.options.map((o) => ({ value: o, label: o }))}
              value={form.accommodationAmenities?.[group.key] || []}
              onChange={(next) => setForm((prev) => ({
                ...prev,
                accommodationAmenities: { ...prev.accommodationAmenities, [group.key]: next },
              }))}
              multiple
            />
          ))}
          </>
          )}
        </View>
      )}

      {step === 'price' && (
        <View>
          <Input label={isHotel ? 'Tarif de base par nuit (FCFA)' : 'Tarif par nuit (FCFA)'} keyboardType="numeric" value={String(form.tarifNuit)} onChangeText={(v) => setField('tarifNuit', v)} error={errors.tarifNuit} style={styles.field} />
          {!isHotel && <Input label="Caution de séjour (optionnel)" keyboardType="numeric" value={String(form.securityDeposit)} onChangeText={(v) => setField('securityDeposit', v)} style={styles.field} />}
          {!isHotel && <Input label="Frais de ménage (optionnel)" keyboardType="numeric" value={String(form.cleaningFee)} onChangeText={(v) => setField('cleaningFee', v)} style={styles.field} />}
        </View>
      )}

      {step === 'photos' && (
        <PhotoManager photos={photos} onChange={setPhotos} error={errors.photos} />
      )}

      {step === 'summary' && (
        <View>
          <Text style={styles.summaryTitle}>Récapitulatif</Text>
          <SummaryRow label="Catégorie" value={accommodationTypes.find((t) => t.value === form.accommodationType)?.label} />
          <SummaryRow label={isHotel ? 'Nom' : 'Titre'} value={isHotel ? form.establishmentName : form.titre} />
          <SummaryRow label="Ville" value={[form.arrondissement, form.ville].filter(Boolean).join(' · ')} />
          {!isHotel && <SummaryRow label="Surface" value={form.surface ? `${form.surface} m²` : ''} />}
          {!isHotel && <SummaryRow label="Chambres" value={String(form.bedrooms)} />}
          {isHotel && <SummaryRow label="Classement" value={form.starRating ? `${form.starRating} étoile(s)` : 'Non classé'} />}
          {isHotel && <SummaryRow label="Arrivée / départ" value={`${form.checkInTime} / ${form.checkOutTime}`} />}
          <SummaryRow label="Capacité" value={`${form.capaciteAdultes} adulte(s), ${form.capaciteEnfants} enfant(s)`} />
          <SummaryRow label="Tarif" value={form.tarifNuit ? `${form.tarifNuit} FCFA / nuit` : ''} />
          <SummaryRow label="Photos" value={`${photos.length} photo(s)`} />
        </View>
      )}

      <StepFooter
        onBack={goBack}
        onNext={goNext}
        isLast={stepIndex === schema.steps.length - 1}
        loading={submitting}
      />
    </Screen>
  );
}

export default function AddAccommodationScreen(props) {
  if (props.route?.params?.publicationKind === 'hotel_establishment') {
    return <HotelEstablishmentScreen {...props} />;
  }
  return <FurnishedAccommodationScreen {...props} />;
}

const makeStyles = (c) => StyleSheet.create({
  field: { marginBottom: spacing.sm },
  summaryTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, marginBottom: spacing.sm },
});
