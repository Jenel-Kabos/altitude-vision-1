import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Alert,
  ActivityIndicator, SafeAreaView, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, typography, spacing } from '../../theme';
import Button from '../../components/ui/Button';
import { uploadToCloudinary, creerAnnonce } from '../../services/annonceService';
import api from '../../services/api';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';
import { AMENITIES } from '../../constants/amenities';

const STEPS = [
  { id: 1, label: 'Info' },
  { id: 2, label: 'Type' },
  { id: 3, label: 'Photos' },
  { id: 4, label: 'Prix' },
  { id: 5, label: 'Localisation' },
  { id: 6, label: 'Commodités' },
  { id: 7, label: 'Récap' },
];

const STEP_TITLES = [
  'Informations',
  'Type de bien',
  'Photos',
  'Prix',
  'Localisation',
  'Caractéristiques',
  'Récapitulatif',
];

const TYPES = PROPERTY_TYPES;

const TRANSACTIONS = [
  { value: 'Vente',    icon: 'cash-outline',     desc: 'Mettre en vente' },
  { value: 'Location', icon: 'calendar-outline', desc: 'Mettre en location' },
];

const PERIODS = ['Mensuel', 'Annuel'];
const TENANT_PROFILES = ['Salarié', 'Étudiant', 'Indépendant/Affairiste', 'Fonctionnaire', 'Retraité'];
const REQUIRED_DOCUMENTS = [
  'CNI',
  'Justificatif de revenus',
  '2 derniers bulletins de salaire',
  'Caution bancaire',
  'Attestation de travail',
  'Quittance de loyer précédente',
];

const COMMODITES = AMENITIES;

const initialForm = {
  titre: '',
  description: '',
  type: '',
  categorie: '',
  period: 'Mensuel',
  prix: '',
  ville: '',
  arrondissement: '',
  rue: '',
  surface: 0,
  chambres: 0,
  bathrooms: 0,
  livingRooms: 0,
  kitchens: 0,
  etage: 0,
  cautionMultiplicateur: 2,
  profilsLocataireRecherches: [],
  documentsRequis: [],
};

export default function PublierBienScreen({ navigation, route }) {
  const editProperty = route?.params?.editProperty || null;
  const isEditing = !!editProperty?._id;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState([]);
  const [commodites, setCommodites] = useState([]);
  const [coords, setCoords] = useState(null);
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const scrollRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1 / STEPS.length)).current;

  useEffect(() => {
    if (!editProperty) {
      setForm(initialForm);
      setPhotos([]);
      setCommodites([]);
      setCoords(null);
      setStep(1);
      return;
    }

    setForm({
      titre: editProperty.title || editProperty.titre || '',
      description: editProperty.description || '',
      type: editProperty.type || '',
      categorie: editProperty.status === 'location' ? 'Location' : 'Vente',
      period: 'Mensuel',
      prix: String(editProperty.price || editProperty.prix || ''),
      ville: editProperty.address?.city || 'Brazzaville',
      arrondissement: editProperty.address?.arrondissement || '',
      rue: editProperty.address?.street || '',
      surface: editProperty.surface || 0,
      chambres: editProperty.bedrooms || editProperty.chambres || 0,
      bathrooms: editProperty.bathrooms || 0,
      livingRooms: editProperty.livingRooms || 0,
      kitchens: editProperty.kitchens || 0,
      etage: editProperty.floor || editProperty.etage || 0,
      cautionMultiplicateur: editProperty.cautionMultiplicateur ?? 2,
      profilsLocataireRecherches: editProperty.profilsLocataireRecherches || [],
      documentsRequis: editProperty.documentsRequis || [],
    });
    setPhotos((editProperty.images || editProperty.photos || []).map(url => ({ uri: url, url, uploading: false, existing: true })));
    setCommodites(editProperty.amenities || []);
    setCoords(editProperty.latitude && editProperty.longitude
      ? { lat: editProperty.latitude, lng: editProperty.longitude }
      : null);
    setStep(1);
  }, [editProperty?._id]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const adjustNum = (k, delta) =>
    setForm(f => ({ ...f, [k]: Math.max(0, (Number(f[k]) || 0) + delta) }));
  const toggleCommodite = (v) =>
    setCommodites(arr => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const toggleFormArray = (field, value) =>
    setForm(current => {
      const values = current[field] || [];
      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter(item => item !== value)
          : [...values, value],
      };
    });

  // ─── Validation par étape ───────────────────────────────────
  const validateStep = (n) => {
    const e = {};
    if (n === 1) {
      if (!form.titre.trim()) e.titre = 'Titre requis';
      if (!form.description.trim()) e.description = 'Description requise';
    }
    if (n === 2) {
      if (!form.type) e.type = 'Choisissez un type de bien';
      if (!form.categorie) e.categorie = 'Choisissez vente ou location';
    }
    if (n === 3) {
      if (photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    }
    if (n === 4) {
      if (!form.prix || isNaN(Number(form.prix)) || Number(form.prix) <= 0) {
        e.prix = 'Prix valide requis';
      }
    }
    if (n === 5) {
      if (!form.ville.trim()) e.ville = 'Ville requise';
      if (!form.arrondissement.trim()) e.arrondissement = 'Arrondissement requis';
    }
    if (n === 6) {
      if (!form.surface || form.surface <= 0) e.surface = 'Surface requise';
    }
    return e;
  };

  const goNext = () => {
    const stepErrors = validateStep(step);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    setStep(s => Math.min(STEPS.length, s + 1));
  };

  const goBack = () => {
    setErrors({});
    setStep(s => Math.max(1, s - 1));
  };

  // ─── Photos ─────────────────────────────────────────────────
  const ajouterPhotos = async () => {
    if (photos.length >= 10) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie requis.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10 - photos.length,
      mediaTypes: ['images'],
    });
    if (!res.canceled && res.assets?.length) {
      const additions = res.assets.map(a => ({
        uri: a.uri, uploading: false, url: null,
      }));
      setPhotos(prev => [...prev, ...additions]);
    }
  };

  const supprimerPhoto = (idx) =>
    setPhotos(prev => prev.filter((_, i) => i !== idx));

  // ─── Géolocalisation ────────────────────────────────────────
  const utiliserMaPosition = async () => {
    setLocationLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la géolocalisation pour utiliser cette fonction.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      try {
        const places = await Location.reverseGeocodeAsync(loc.coords);
        if (places[0]) {
          const p = places[0];
          // Auto-fill ville/arrondissement seulement si la valeur correspond
          // à un choix valide (sinon l'utilisateur devra sélectionner via chips).
          // p.district ici est un champ de expo-location, sans rapport avec
          // notre ancien champ Mongoose.
          setForm(f => {
            const ville = f.ville
              || (VILLES.includes(p.city) ? p.city : '');
            const arronds = getArrondissementsFor(ville);
            const arr = f.arrondissement
              || (arronds.includes(p.district) ? p.district : '');
            return {
              ...f,
              ville,
              arrondissement: arr,
              rue: f.rue || p.street || '',
            };
          });
        }
      } catch {}
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ─── Publish ────────────────────────────────────────────────
  const handlePublish = async () => {
    setSubmitting(true);
    try {
      const working = [...photos];
      for (let i = 0; i < working.length; i++) {
        if (working[i].url) continue;
        working[i] = { ...working[i], uploading: true };
        setPhotos([...working]);
        const url = await uploadToCloudinary(working[i].uri);
        working[i] = { ...working[i], uploading: false, url };
        setPhotos([...working]);
      }

      const payload = {
        titre: form.titre.trim(),
        description: form.description.trim(),
        prix: Number(form.prix),
        superficie: form.surface || null,
        chambres: form.chambres || null,
        bathrooms: form.bathrooms || null,
        livingRooms: form.livingRooms || null,
        kitchens: form.kitchens || null,
        ville: form.ville.trim(),
        arrondissement: form.arrondissement.trim(),
        type: form.type,
        categorie: form.categorie,
        photos: working.map(p => p.url),
        amenities: commodites,
        latitude: coords?.lat,
        longitude: coords?.lng,
        cautionMultiplicateur: form.categorie === 'Location' ? form.cautionMultiplicateur : undefined,
        profilsLocataireRecherches: form.categorie === 'Location' ? form.profilsLocataireRecherches : [],
        documentsRequis: form.categorie === 'Location' ? form.documentsRequis : [],
      };

      if (isEditing) {
        await api.put(`/properties/${editProperty._id}`, {
          title: payload.titre,
          description: payload.description,
          price: payload.prix,
          surface: payload.superficie,
          bedrooms: payload.chambres || 0,
          bathrooms: payload.bathrooms || 0,
          livingRooms: payload.livingRooms || 0,
          kitchens: payload.kitchens || 0,
          amenities: payload.amenities,
          address: {
            city: payload.ville,
            arrondissement: payload.arrondissement,
            street: form.rue || '',
          },
          type: payload.type,
          status: typeof payload.categorie === 'string' ? payload.categorie.toLowerCase() : payload.categorie,
          latitude: payload.latitude ?? -4.2661,
          longitude: payload.longitude ?? 15.2832,
          existingImages: working.map(p => p.url).filter(Boolean),
          cautionMultiplicateur: payload.cautionMultiplicateur,
          profilsLocataireRecherches: payload.profilsLocataireRecherches,
          documentsRequis: payload.documentsRequis,
        });
      } else {
        await creerAnnonce(payload);
      }

      Alert.alert(
        isEditing ? 'Publication modifiée' : 'Annonce envoyée',
        isEditing
          ? "Votre publication a été mise à jour."
          : "Votre bien est en cours de validation par l'administrateur. Il sera publié après validation.",
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible de publier.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Helpers de rendu ───────────────────────────────────────
  const renderTextInput = (name, opts = {}) => (
    <View style={styles.field}>
      <TextInput
        style={[
          styles.input,
          opts.multiline && styles.inputMultiline,
          focused === name && styles.inputFocused,
        ]}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textMuted}
        value={form[name]}
        onChangeText={(v) => setField(name, v)}
        onFocus={() => setFocused(name)}
        onBlur={() => setFocused(null)}
        multiline={opts.multiline}
        numberOfLines={opts.multiline ? 4 : 1}
        keyboardType={opts.keyboardType || 'default'}
        textAlignVertical={opts.multiline ? 'top' : 'center'}
      />
      {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
    </View>
  );

  const renderStepperField = (name, label, unit) => (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
      <View style={styles.numberRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => adjustNum(name, -1)}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={styles.numberInput}
          value={String(form[name])}
          onChangeText={(v) => setField(name, Math.max(0, Number(v.replace(/[^0-9]/g, '')) || 0))}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => adjustNum(name, 1)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
    </View>
  );

  // ─── Step content ───────────────────────────────────────────
  const renderStepContent = () => {
    if (step === 1) {
      return (
        <View>
          <Text style={styles.fieldLabel}>Titre du bien</Text>
          {renderTextInput('titre', { placeholder: 'Ex : Appartement T3 vue mer' })}
          <Text style={styles.fieldLabel}>Description</Text>
          {renderTextInput('description', { placeholder: 'Décrivez votre bien…', multiline: true })}
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text style={styles.fieldLabel}>Type de bien</Text>
          <View style={styles.grid2}>
            {TYPES.map(t => {
              const sel = form.type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeCard, sel && styles.cardSelected]}
                  onPress={() => setField('type', t.value)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={t.icon}
                    size={28}
                    color={sel ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.typeLabel, sel && { color: colors.primary }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.type ? <Text style={styles.errorText}>{errors.type}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Transaction</Text>
          <View style={styles.grid2}>
            {TRANSACTIONS.map(t => {
              const sel = form.categorie === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.txCard, sel && styles.cardSelected]}
                  onPress={() => setField('categorie', t.value)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={t.icon}
                    size={28}
                    color={sel ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.typeLabel, sel && { color: colors.primary }]}>
                    {t.value}
                  </Text>
                  <Text style={styles.txDesc}>{t.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.categorie ? <Text style={styles.errorText}>{errors.categorie}</Text> : null}
        </View>
      );
    }

    if (step === 3) {
      const remaining = 10 - photos.length;
      return (
        <View>
          <Text style={styles.fieldLabel}>Photos ({photos.length}/10)</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, idx) => (
              <View key={`${p.uri}-${idx}`} style={styles.photoCell}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
                {p.uploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => supprimerPhoto(idx)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {remaining > 0 && (
              <TouchableOpacity
                style={styles.photoEmpty}
                onPress={ajouterPhotos}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {errors.photos ? <Text style={styles.errorText}>{errors.photos}</Text> : null}

          <View style={{ marginTop: spacing.lg }}>
            <Button
              label="Ajouter des photos"
              variant="outline"
              fullWidth
              icon="image-outline"
              onPress={ajouterPhotos}
            />
          </View>
        </View>
      );
    }

    if (step === 4) {
      return (
        <View>
          <Text style={styles.fieldLabel}>Prix</Text>
          <View style={styles.field}>
            <View style={[
              styles.priceWrap,
              focused === 'prix' && styles.inputFocused,
            ]}>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={form.prix}
                onChangeText={(v) => setField('prix', v.replace(/[^0-9]/g, ''))}
                onFocus={() => setFocused('prix')}
                onBlur={() => setFocused(null)}
                keyboardType="numeric"
              />
              <Text style={styles.priceSuffix}>FCFA</Text>
            </View>
            {errors.prix ? <Text style={styles.errorText}>{errors.prix}</Text> : null}
          </View>

          {form.categorie === 'Location' && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.fieldLabel}>Période</Text>
              <View style={styles.chipsRow}>
                {PERIODS.map(p => {
                  const sel = form.period === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setField('period', p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Caution demandée</Text>
              <View style={styles.chipsRow}>
                {[0, 1, 2, 3, 4, 5, 6].map(value => {
                  const sel = Number(form.cautionMultiplicateur) === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setField('cautionMultiplicateur', value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {value} mois
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Profils recherchés</Text>
              <View style={styles.commoditesGrid}>
                {TENANT_PROFILES.map(profile => {
                  const checked = form.profilsLocataireRecherches.includes(profile);
                  return (
                    <TouchableOpacity
                      key={profile}
                      style={styles.commoditeRow}
                      onPress={() => toggleFormArray('profilsLocataireRecherches', profile)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.commoditeText}>{profile}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Documents requis</Text>
              <View style={styles.commoditesGrid}>
                {REQUIRED_DOCUMENTS.map(document => {
                  const checked = form.documentsRequis.includes(document);
                  return (
                    <TouchableOpacity
                      key={document}
                      style={styles.commoditeRow}
                      onPress={() => toggleFormArray('documentsRequis', document)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.commoditeText}>{document}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    }

    if (step === 5) {
      const arrondsList = form.ville ? getArrondissementsFor(form.ville) : [];

      const handleVilleSelect = (v) => {
        setForm(f => ({
          ...f,
          ville: v,
          arrondissement: getArrondissementsFor(v).includes(f.arrondissement)
            ? f.arrondissement
            : '',
        }));
      };

      return (
        <View>
          <Text style={styles.fieldLabel}>Ville</Text>
          <View style={styles.chipsWrap}>
            {VILLES.map(v => {
              const sel = form.ville === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => handleVilleSelect(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.ville ? <Text style={styles.errorText}>{errors.ville}</Text> : null}

          {form.ville ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                Arrondissement
              </Text>
              <View style={styles.chipsWrap}>
                {arrondsList.map(a => {
                  const sel = form.arrondissement === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setField('arrondissement', a)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {a}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.arrondissement ? (
                <Text style={styles.errorText}>{errors.arrondissement}</Text>
              ) : null}
            </>
          ) : null}

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Rue (optionnel)</Text>
          {renderTextInput('rue', { placeholder: 'Ex : 24 Rue Mfoa' })}

          <Button
            label={locationLoading ? 'Récupération…' : 'Utiliser ma position'}
            variant="outline"
            fullWidth
            icon="location-outline"
            onPress={utiliserMaPosition}
            loading={locationLoading}
          />
          {coords && (
            <Text style={styles.coordsText}>
              📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
          )}
        </View>
      );
    }

    if (step === 6) {
      return (
        <View>
          {renderStepperField('surface', 'Surface', 'm²')}
          {renderStepperField('chambres', 'Chambres')}
          {renderStepperField('bathrooms', 'Salles de bain')}
          {renderStepperField('livingRooms', 'Salon')}
          {renderStepperField('kitchens', 'Cuisine')}
          {renderStepperField('etage', 'Étage (optionnel)')}

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Commodités</Text>
          <View style={styles.commoditesGrid}>
            {COMMODITES.map(c => {
              const checked = commodites.includes(c.value);
              return (
                <TouchableOpacity
                  key={c.value}
                  style={styles.commoditeRow}
                  onPress={() => toggleCommodite(c.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Ionicons name={c.icon} size={16} color={colors.primary} />
                  <Text style={styles.commoditeText}>{c.value}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 7) {
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
      const isLocation = form.categorie === 'Location';
      return (
        <View style={styles.recapCard}>
          {photos[0] && (
            <Image
              source={{ uri: photos[0].uri }}
              style={styles.recapThumb}
              resizeMode="cover"
            />
          )}

          <Text style={styles.recapSectionTitle}>{form.titre || 'Sans titre'}</Text>
          <Text style={styles.recapDesc} numberOfLines={4}>
            {form.description || 'Pas de description'}
          </Text>

          <View style={styles.recapDivider} />

          <Text style={styles.recapPrice}>
            {fmt(form.prix)} FCFA{isLocation ? ` / ${form.period}` : ''}
          </Text>

          <View style={styles.recapDivider} />

          <RecapRow label="Type" value={form.type} />
          <RecapRow label="Transaction" value={form.categorie} />
          {isLocation && <RecapRow label="Caution" value={`${form.cautionMultiplicateur} mois`} />}
          {isLocation && form.profilsLocataireRecherches.length > 0 && (
            <RecapRow label="Profils" value={form.profilsLocataireRecherches.join(', ')} />
          )}
          {isLocation && form.documentsRequis.length > 0 && (
            <RecapRow label="Documents" value={form.documentsRequis.join(', ')} />
          )}
          <RecapRow label="Ville" value={form.ville} />
          <RecapRow label="Arrondissement" value={form.arrondissement} />
          {form.rue ? <RecapRow label="Rue" value={form.rue} /> : null}

          <View style={styles.recapDivider} />

          {form.surface > 0 && <RecapRow label="Surface" value={`${form.surface} m²`} />}
          {form.chambres > 0 && <RecapRow label="Chambres" value={String(form.chambres)} />}
          {form.bathrooms > 0 && <RecapRow label="Salles de bain" value={String(form.bathrooms)} />}
          {form.livingRooms > 0 && <RecapRow label="Salon" value={String(form.livingRooms)} />}
          {form.kitchens > 0 && <RecapRow label="Cuisine" value={String(form.kitchens)} />}
          {form.etage > 0 && <RecapRow label="Étage" value={String(form.etage)} />}

          {commodites.length > 0 && (
            <>
              <View style={styles.recapDivider} />
              <RecapRow label="Commodités" value={commodites.join(', ')} />
            </>
          )}

          <Text style={styles.recapWarn}>
            Vérifiez vos informations avant de publier
          </Text>
        </View>
      );
    }

    return null;
  };

  // ─── Render principal ───────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const isLastStep = step === STEPS.length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="close-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEditing ? `Modifier · ${STEP_TITLES[step - 1]}` : STEP_TITLES[step - 1]}
          </Text>
          <Text style={styles.headerStep}>{step}/{STEPS.length}</Text>
        </View>

        {/* Stepper horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepperContent}
        >
          {STEPS.map((s, idx) => {
            const completed = step > s.id;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <View style={styles.stepCol}>
                  <View style={[
                    styles.stepCircle,
                    completed && styles.stepCircleCompleted,
                    active && styles.stepCircleActive,
                    !completed && !active && styles.stepCircleFuture,
                  ]}>
                    {completed ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : (
                      <Text style={active ? styles.stepNumActive : styles.stepNumFuture}>
                        {s.id}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[styles.stepLabel, active && styles.stepLabelActive]}
                    numberOfLines={1}
                  >
                    {s.label}
                  </Text>
                </View>
                {idx < STEPS.length - 1 && (
                  <View style={[
                    styles.connector,
                    step > s.id && styles.connectorFilled,
                  ]} />
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Step content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.stepScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Button
              label="Précédent"
              variant="outline"
              fullWidth
              disabled={step === 1}
              onPress={goBack}
            />
          </View>
          <View style={{ width: spacing.md }} />
          <View style={{ flex: 2 }}>
            <Button
              label={isLastStep ? (isEditing ? 'Enregistrer' : 'Publier') : 'Suivant'}
              variant="primary"
              fullWidth
              loading={submitting}
              onPress={isLastStep ? handlePublish : goNext}
              icon={isLastStep ? undefined : 'arrow-forward'}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RecapRow({ label, value }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  headerStep: {
    color: colors.textSecondary,
    fontSize: 13,
    minWidth: 28,
    textAlign: 'right',
  },

  // ─── Stepper ───
  stepperContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepCol: {
    alignItems: 'center',
    width: 64,
  },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleCompleted: { backgroundColor: colors.success },
  stepCircleActive:    { backgroundColor: colors.primary },
  stepCircleFuture:    { backgroundColor: colors.card },
  stepNumActive: { color: '#000', fontWeight: '700', fontSize: 13 },
  stepNumFuture: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  stepLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  stepLabelActive: { color: colors.primary, fontWeight: '600' },
  connector: {
    width: 24, height: 2,
    backgroundColor: colors.border,
    marginTop: 13,
  },
  connectorFilled: { backgroundColor: colors.success },

  // ─── Progress bar ───
  progressTrack: {
    height: 3,
    backgroundColor: colors.card,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
  },

  // ─── Step content ───
  stepScroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  // ─── Inputs ───
  field: { marginBottom: spacing.md },
  fieldLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFocused: { borderColor: colors.primary },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.xs,
  },

  // ─── Step 2 : type cards ───
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: colors.primary },
  typeLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  txCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  txDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Step 3 : photos ───
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCell: {
    width: 100, height: 100,
    borderRadius: 8,
    position: 'relative',
    overflow: 'visible',
  },
  photoImg: {
    width: 100, height: 100,
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  photoEmpty: {
    width: 100, height: 100,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── Step 4 : prix ───
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  priceSuffix: {
    color: colors.textMuted,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 100,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },

  // ─── Step 5 : localisation ───
  coordsText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ─── Step 6 : stepper +/- ───
  numberField: {
    marginBottom: spacing.md,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  numberInput: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    padding: 0,
  },

  // ─── Commodités ───
  commoditesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commoditeRow: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  commoditeText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },

  // ─── Récap ───
  recapCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
  },
  recapThumb: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  recapSectionTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  recapDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  recapPrice: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '800',
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  recapLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  recapValue: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'right',
    flex: 1,
  },
  recapDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  recapWarn: {
    color: colors.warning,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ─── Footer ───
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
