import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import {
  StepHeader, StepFooter, ChipMultiSelect, PhotoManager, SummaryRow, Counter,
} from '../../components/publication';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { AMENITIES } from '../../constants/amenities';
import { salePropertySchema, getPropertyVisibleFields, sanitizePropertyFieldsForType } from '../../utils/publicationValidation';
import { buildSalePropertyPayload } from '../../services/publicationPayloads';
import { creerAnnonce, uploadToCloudinary } from '../../services/annonceService';
import { useDraftAnnonce } from '../../hooks/useDraftAnnonce';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';

const STEP_TITLES = {
  info: 'Informations générales',
  location: 'Localisation',
  features: 'Caractéristiques',
  price: 'Prix',
  photos: 'Photos',
  summary: 'Vérification et publication',
};

const initialForm = {
  titre: '', description: '', type: '',
  ville: '', arrondissement: '', rue: '',
  surface: '', bedrooms: 0, bathrooms: 0, livingRooms: 0, kitchens: 0,
  amenities: [],
  prix: '', honoraires: '', fraisVisite: '',
};

export default function AddSalePropertyScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { loadDraft, saveDraft, clearDraft } = useDraftAnnonce('vente');

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
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
        'Vous avez une annonce de vente en cours de rédaction. Reprendre ?',
        [
          { text: 'Supprimer', style: 'destructive', onPress: () => clearDraft() },
          { text: 'Reprendre', onPress: () => setForm((prev) => ({ ...prev, ...draft })) },
        ],
      );
    });
  }, [loadDraft, clearDraft]);

  useEffect(() => { saveDraft(form); }, [form, saveDraft]);

  const visibleFields = useMemo(() => getPropertyVisibleFields(form.type), [form.type]);
  const step = salePropertySchema.steps[stepIndex];

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const onSelectType = useCallback((type) => {
    setForm((prev) => sanitizePropertyFieldsForType(prev, type));
    setErrors((prev) => ({ ...prev, type: undefined }));
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
    if (submitting) return;
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(photos.map((p, index) => uploadToCloudinary(p.uri, { index, total: photos.length })));
      const payload = buildSalePropertyPayload(form, uploaded);
      await creerAnnonce(payload);
      await clearDraft();
      Alert.alert(
        'Annonce envoyée',
        'Votre bien est en attente de validation par notre équipe.',
        [
          { text: 'Voir mes annonces', onPress: () => navigation.navigate('Profil', { screen: 'MesAnnonces' }) },
          { text: "Retour à l'accueil", onPress: () => navigation.navigate('Annonces', { screen: 'ListeAnnonces' }) },
        ],
      );
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible de publier ce bien.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, photos, form, clearDraft, navigation]);

  const goNext = useCallback(() => {
    const stepErrors = salePropertySchema.validateStep(step, { form, photos });
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (stepIndex === salePropertySchema.steps.length - 1) {
      handlePublish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [step, form, photos, stepIndex, handlePublish]);

  return (
    <Screen scroll avoidKeyboard>
      <StepHeader
        title={STEP_TITLES[step]}
        stepIndex={stepIndex}
        stepCount={salePropertySchema.steps.length}
        onBack={goBack}
      />

      {step === 'info' && (
        <View>
          <ChipMultiSelect
            label="Type de bien"
            options={PROPERTY_TYPES}
            value={form.type}
            onChange={onSelectType}
            error={errors.type}
          />
          <Input label="Titre" placeholder="Ex: Belle villa à Bacongo" value={form.titre} onChangeText={(v) => setField('titre', v)} error={errors.titre} style={styles.field} />
          <Input label="Description" placeholder="Décrivez le bien…" multiline value={form.description} onChangeText={(v) => setField('description', v)} error={errors.description} style={styles.field} />
        </View>
      )}

      {step === 'location' && (
        <View>
          <ChipMultiSelect label="Ville" options={VILLES.map((v) => ({ value: v, label: v }))} value={form.ville} onChange={onSelectVille} error={errors.ville} />
          <ChipMultiSelect label="Arrondissement" options={getArrondissementsFor(form.ville).map((a) => ({ value: a, label: a }))} value={form.arrondissement} onChange={(v) => setField('arrondissement', v)} error={errors.arrondissement} />
          <Input label="Rue / quartier (optionnel)" value={form.rue} onChangeText={(v) => setField('rue', v)} style={styles.field} />
        </View>
      )}

      {step === 'features' && (
        <View>
          <Input label="Surface (m²)" keyboardType="numeric" value={String(form.surface)} onChangeText={(v) => setField('surface', v)} error={errors.surface} style={styles.field} />
          {visibleFields.bedrooms && <Counter label="Chambres" value={form.bedrooms} onChange={(v) => setField('bedrooms', v)} />}
          {visibleFields.bathrooms && <Counter label="Salles de bain" value={form.bathrooms} onChange={(v) => setField('bathrooms', v)} />}
          <Counter label="Salon" value={form.livingRooms} onChange={(v) => setField('livingRooms', v)} />
          <Counter label="Cuisine" value={form.kitchens} onChange={(v) => setField('kitchens', v)} />
          <ChipMultiSelect
            label="Commodités"
            options={AMENITIES}
            value={form.amenities}
            onChange={(v) => setField('amenities', v)}
            multiple
            getLabel={(o) => o.value}
            getValue={(o) => o.value}
          />
        </View>
      )}

      {step === 'price' && (
        <View>
          <Input label="Prix de vente (FCFA)" keyboardType="numeric" value={String(form.prix)} onChangeText={(v) => setField('prix', v)} error={errors.prix} style={styles.field} />
          <Input label="Honoraires d'agence (optionnel)" keyboardType="numeric" value={String(form.honoraires)} onChangeText={(v) => setField('honoraires', v)} style={styles.field} />
          <Input label="Frais de visite (optionnel)" keyboardType="numeric" value={String(form.fraisVisite)} onChangeText={(v) => setField('fraisVisite', v)} style={styles.field} />
        </View>
      )}

      {step === 'photos' && (
        <PhotoManager photos={photos} onChange={setPhotos} error={errors.photos} />
      )}

      {step === 'summary' && (
        <View>
          <Text style={styles.summaryTitle}>Récapitulatif</Text>
          <SummaryRow label="Type" value={form.type} />
          <SummaryRow label="Titre" value={form.titre} />
          <SummaryRow label="Ville" value={[form.arrondissement, form.ville].filter(Boolean).join(' · ')} />
          <SummaryRow label="Surface" value={form.surface ? `${form.surface} m²` : ''} />
          <SummaryRow label="Prix" value={form.prix ? `${form.prix} FCFA` : ''} />
          <SummaryRow label="Photos" value={`${photos.length} photo(s)`} />
        </View>
      )}

      <StepFooter
        onBack={goBack}
        onNext={goNext}
        isLast={stepIndex === salePropertySchema.steps.length - 1}
        loading={submitting}
      />
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  field: { marginBottom: spacing.sm },
  summaryTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, marginBottom: spacing.sm },
});
