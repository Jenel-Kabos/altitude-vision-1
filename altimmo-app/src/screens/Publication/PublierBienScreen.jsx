import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Alert,
  ActivityIndicator, SafeAreaView, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import VideoPlayer from '../../components/VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { typography, spacing, fonts, fontSize, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/ui/Button';
import { uploadToCloudinary, creerAnnonce } from '../../services/annonceService';
import api from '../../services/api';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';
import { AMENITIES } from '../../constants/amenities';

const STEPS = [
  { id: 1, label: 'Info',        title: 'Informations' },
  { id: 2, label: 'Type',        title: 'Type de bien' },
  { id: 3, label: 'Photos',      title: 'Photos' },
  { id: 4, label: 'Prix',        title: 'Prix' },
  { id: 5, label: 'Localisation',title: 'Localisation' },
  { id: 6, label: 'Caractères',  title: 'Caractéristiques' },
  { id: 7, label: 'Récap',       title: 'Récapitulatif' },
];

// Largeur d'un bloc step (cercle 28px + label) + connecteur (24px)
const STEP_SLOT_W = 88;

const TRANSACTIONS = [
  { value: 'Vente',       icon: 'cash-outline',      desc: 'Mettre en vente' },
  { value: 'Location',    icon: 'calendar-outline',  desc: 'Mettre en location' },
  { value: 'Hebergement', icon: 'bed-outline',       desc: 'Mettre en hébergement meublé' },
];

// status Property (minuscule) → valeur du sélecteur Transaction (capitalisée) —
// mapping explicite pour ne jamais retomber par défaut sur 'Vente'.
const STATUS_TO_CATEGORIE = { vente: 'Vente', location: 'Location', hebergement: 'Hebergement' };

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
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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
  const [showManualGps,   setShowManualGps]   = useState(false);
  const [manualLat,       setManualLat]       = useState('');
  const [manualLng,       setManualLng]       = useState('');

  const scrollRef    = useRef(null);
  const stepperRef   = useRef(null);
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
      categorie: STATUS_TO_CATEGORIE[editProperty.status?.toLowerCase()] || 'Vente',
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
    // Auto-scroll stepper : centre l'étape active
    const offset = Math.max(0, (step - 2) * STEP_SLOT_W);
    stepperRef.current?.scrollTo({ x: offset, animated: true });
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
      if (!form.categorie) e.categorie = 'Choisissez le type de transaction';
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
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: 60,
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

  const isVideo = (uri = '') => /\.(mp4|mov|avi|mkv|webm)$/i.test(uri);

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

  const applyManualCoords = useCallback((lat, lng) => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (
      !isNaN(latN) && !isNaN(lngN) &&
      latN >= -90  && latN <= 90   &&
      lngN >= -180 && lngN <= 180
    ) {
      setCoords({ lat: latN, lng: lngN });
    } else {
      setCoords(null);
    }
  }, []);

  // ─── Publish ────────────────────────────────────────────────
  const handlePublish = async () => {
    setSubmitting(true);
    try {
      // Marquer toutes les photos à uploader comme "en cours"
      const working = photos.map(p => p.url ? p : { ...p, uploading: true });
      setPhotos(working);

      // Upload en parallèle de toutes les photos sans URL
      const uploaded = await Promise.all(
        working.map(async (p) => {
          if (p.url) return p;
          const url = await uploadToCloudinary(p.uri);
          return { ...p, uploading: false, url };
        })
      );
      setPhotos(uploaded);

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
        photos: uploaded.map(p => p.url),
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
          existingImages: uploaded.map(p => p.url).filter(Boolean),
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
        [{
          text: 'OK',
          onPress: () => isEditing ? navigation.goBack() : navigation.navigate('Annonces'),
        }],
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
          !!form[name] && focused !== name && styles.inputFilled,
          focused === name && styles.inputFocused,
        ]}
        placeholder={opts.placeholder}
        placeholderTextColor={c.placeholder}
        cursorColor={c.gold}
        selectionColor={c.borderGold}
        value={form[name]}
        onChangeText={(v) => setField(name, v)}
        onFocus={() => setFocused(name)}
        onBlur={() => setFocused(null)}
        multiline={opts.multiline}
        numberOfLines={opts.multiline ? 4 : 1}
        keyboardType={opts.keyboardType || 'default'}
        textAlignVertical={opts.multiline ? 'top' : 'center'}
        accessibilityLabel={opts.placeholder || name}
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
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Ionicons name="remove" size={18} color={c.gold} />
        </TouchableOpacity>
        <TextInput
          style={styles.numberInput}
          cursorColor={c.gold}
          selectionColor={c.borderGold}
          value={String(form[name])}
          onChangeText={(v) => setField(name, Math.max(0, Number(v.replace(/[^0-9]/g, '')) || 0))}
          keyboardType="numeric"
          accessibilityLabel={`Valeur pour ${label}`}
        />
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => adjustNum(name, 1)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label}`}
        >
          <Ionicons name="add" size={18} color={c.gold} />
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
          <View style={styles.grid3}>
            {PROPERTY_TYPES.map(t => {
              const sel = form.type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeCard, sel && styles.typeCardSelected]}
                  onPress={() => setField('type', t.value)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Sélectionner ${t.label}`}
                  accessibilityState={{ selected: sel }}
                >
                  <Ionicons
                    name={t.icon}
                    size={24}
                    color={sel ? c.gold : c.textSub}
                  />
                  <Text style={[styles.typeLabel, sel && { color: c.gold }]} numberOfLines={2}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.type ? <Text style={styles.errorText}>{errors.type}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Transaction</Text>
          <View style={styles.txToggle}>
            {TRANSACTIONS.map(t => {
              const sel = form.categorie === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.txPill, sel && styles.txPillActive]}
                  onPress={() => setField('categorie', t.value)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t.desc}
                  accessibilityState={{ selected: sel }}
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={sel ? '#0D0B08' : c.textSub}
                  />
                  <Text style={[styles.txPillText, sel && styles.txPillTextActive]}>
                    {t.value}
                  </Text>
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
                {isVideo(p.uri) ? (
                  <VideoPlayer
                    source={p.uri}
                    style={styles.photoImg}
                    contentFit="cover"
                    shouldPlay={false}
                    nativeControls={false}
                    isLooping={false}
                    isMuted
                  />
                ) : (
                  <Image source={{ uri: p.uri }} style={styles.photoImg} accessible={false} />
                )}
                {isVideo(p.uri) && !p.uploading && (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <Ionicons name="play-circle" size={30} color="#FFFFFF" />
                  </View>
                )}
                {p.uploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
                {idx === 0 && (
                  <View style={styles.photoPrimaryBadge} pointerEvents="none">
                    <Text style={styles.photoPrimaryText}>Couverture</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => supprimerPhoto(idx)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la photo"
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
                accessibilityRole="button"
                accessibilityLabel="Ajouter des photos"
              >
                <Ionicons name="add-circle-outline" size={28} color={c.gold} />
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
              !!form.prix && focused !== 'prix' && styles.priceWrapFilled,
              focused === 'prix' && styles.inputFocused,
            ]}>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={c.placeholder}
                cursorColor={c.gold}
                selectionColor={c.borderGold}
                value={form.prix}
                onChangeText={(v) => setField('prix', v.replace(/[^0-9]/g, ''))}
                onFocus={() => setFocused('prix')}
                onBlur={() => setFocused(null)}
                keyboardType="numeric"
                accessibilityLabel="Prix en FCFA"
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
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Période ${p}`}
                      accessibilityState={{ checked: sel }}
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
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Caution ${value} mois`}
                      accessibilityState={{ checked: sel }}
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
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Profil ${profile}`}
                      accessibilityState={{ checked }}
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
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Document requis : ${document}`}
                      accessibilityState={{ checked }}
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
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Ville : ${v}`}
                  accessibilityState={{ checked: sel }}
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
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Arrondissement : ${a}`}
                      accessibilityState={{ checked: sel }}
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

          {/* ─── Bloc GPS ─── */}
          <View style={styles.gpsBlock}>
            <View style={styles.gpsHeader}>
              <View style={[styles.gpsIconWrap, coords && styles.gpsIconWrapOk]}>
                <Ionicons
                  name={coords ? 'location' : 'location-outline'}
                  size={20}
                  color={coords ? '#FFFFFF' : c.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsTitle}>Position GPS du bien</Text>
                <Text style={styles.gpsSubtitle}>
                  {coords
                    ? `Capturée · ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : 'Non capturée — le bien sera placé au centre de Brazzaville sur la carte'
                  }
                </Text>
              </View>
            </View>

            {!coords && (
              <View style={styles.gpsWarn}>
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text style={styles.gpsWarnText}>
                  Rendez-vous physiquement au bien avant de taper ce bouton pour une localisation précise.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.gpsBtn, coords && styles.gpsBtnOk]}
              onPress={utiliserMaPosition}
              disabled={locationLoading}
              activeOpacity={0.8}
            >
              {locationLoading
                ? <ActivityIndicator size="small" color={coords ? '#FFFFFF' : c.gold} />
                : <Ionicons name="locate-outline" size={16} color={coords ? '#FFFFFF' : c.gold} />
              }
              <Text style={[styles.gpsBtnText, coords && styles.gpsBtnTextOk]}>
                {locationLoading ? 'Localisation…' : coords ? 'Recapturer ma position' : 'Utiliser ma position GPS'}
              </Text>
            </TouchableOpacity>

            {/* Toggle saisie manuelle */}
            <TouchableOpacity
              onPress={() => {
                setShowManualGps(v => !v);
                if (showManualGps) { setManualLat(''); setManualLng(''); }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showManualGps ? 'locate-outline' : 'pencil-outline'}
                size={13}
                color={c.textMuted}
              />
              <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted }}>
                {showManualGps
                  ? 'Utiliser la géolocalisation auto'
                  : 'Entrer les coordonnées manuellement'}
              </Text>
            </TouchableOpacity>

            {showManualGps && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={styles.gpsSubtitle}>
                  Copier depuis Google Maps : appui long sur la carte → coordonnées
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.gpsSubtitle, { marginBottom: 4 }]}>Latitude</Text>
                    <TextInput
                      value={manualLat}
                      onChangeText={v => { setManualLat(v); applyManualCoords(v, manualLng); }}
                      placeholder="-4.26340"
                      placeholderTextColor={c.placeholder}
                      cursorColor={c.gold}
                      selectionColor={c.borderGold}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      accessibilityLabel="Latitude"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.gpsSubtitle, { marginBottom: 4 }]}>Longitude</Text>
                    <TextInput
                      value={manualLng}
                      onChangeText={v => { setManualLng(v); applyManualCoords(manualLat, v); }}
                      placeholder="15.24290"
                      placeholderTextColor={c.placeholder}
                      cursorColor={c.gold}
                      selectionColor={c.borderGold}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      accessibilityLabel="Longitude"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
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
            {AMENITIES.map(com => {
              const checked = commodites.includes(com.value);
              return (
                <TouchableOpacity
                  key={com.value}
                  style={styles.commoditeRow}
                  onPress={() => toggleCommodite(com.value)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Commodité : ${com.value}`}
                  accessibilityState={{ checked }}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Ionicons name={com.icon} size={16} color={c.gold} />
                  <Text style={styles.commoditeText}>{com.value}</Text>
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
            <ExpoImage
              source={{ uri: photos[0].uri }}
              style={styles.recapThumb}
              contentFit="cover"
              accessible={false}
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

          <RecapRow label="Type" value={form.type} styles={styles} />
          <RecapRow label="Transaction" value={form.categorie} styles={styles} />
          {isLocation && <RecapRow label="Caution" value={`${form.cautionMultiplicateur} mois`} styles={styles} />}
          {isLocation && form.profilsLocataireRecherches.length > 0 && (
            <RecapRow label="Profils" value={form.profilsLocataireRecherches.join(', ')} styles={styles} />
          )}
          {isLocation && form.documentsRequis.length > 0 && (
            <RecapRow label="Documents" value={form.documentsRequis.join(', ')} styles={styles} />
          )}
          <RecapRow label="Ville" value={form.ville} styles={styles} />
          <RecapRow label="Arrondissement" value={form.arrondissement} styles={styles} />
          {form.rue ? <RecapRow label="Rue" value={form.rue} styles={styles} /> : null}

          <View style={styles.recapDivider} />

          {form.surface > 0 && <RecapRow label="Surface" value={`${form.surface} m²`} styles={styles} />}
          {form.chambres > 0 && <RecapRow label="Chambres" value={String(form.chambres)} styles={styles} />}
          {form.bathrooms > 0 && <RecapRow label="Salles de bain" value={String(form.bathrooms)} styles={styles} />}
          {form.livingRooms > 0 && <RecapRow label="Salon" value={String(form.livingRooms)} styles={styles} />}
          {form.kitchens > 0 && <RecapRow label="Cuisine" value={String(form.kitchens)} styles={styles} />}
          {form.etage > 0 && <RecapRow label="Étage" value={String(form.etage)} styles={styles} />}

          {commodites.length > 0 && (
            <>
              <View style={styles.recapDivider} />
              <RecapRow label="Commodités" value={commodites.join(', ')} styles={styles} />
            </>
          )}

          {/* Statut GPS */}
          <View style={styles.recapDivider} />
          <View style={[styles.recapRow, { alignItems: 'center' }]}>
            <Text style={styles.recapLabel}>Localisation carte</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'flex-end' }}>
              <Ionicons
                name={coords ? 'checkmark-circle' : 'alert-circle-outline'}
                size={14}
                color={coords ? '#16A34A' : '#B45309'}
              />
              <Text style={[styles.recapValue, { color: coords ? '#16A34A' : '#B45309' }]}>
                {coords ? 'GPS capturé ✓' : 'Non localisé — visible au centre BZV'}
              </Text>
            </View>
          </View>

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
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={20} color={c.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEditing ? 'Modifier le bien' : 'Publier un bien'}
          </Text>
          <View style={styles.headerStepPill}>
            <Text style={styles.headerStepText}>{step}/{STEPS.length}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFillWrap, { width: progressWidth }]}>
            <LinearGradient
              colors={['#C8960C', '#A07010']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressFill}
            />
          </Animated.View>
        </View>

        {/* Labels d'étapes (dessous la barre) */}
        <ScrollView
          ref={stepperRef}
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

        {/* Step content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.stepScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>

        {/* Barre de navigation entre étapes */}
        <View style={styles.navBar}>

          {/* Bouton Précédent */}
          {step > 1 && (
            <TouchableOpacity
              style={styles.btnPrev}
              onPress={goBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Précédent"
            >
              <Ionicons name="chevron-back" size={18} color={c.gold} />
              <Text style={styles.btnPrevText}>Précédent</Text>
            </TouchableOpacity>
          )}

          {/* Spacer si pas de bouton précédent */}
          {step === 1 && <View style={{ flex: 1 }} />}

          {/* Bouton Suivant / Publier */}
          <TouchableOpacity
            style={[
              styles.btnNext,
              isLastStep && styles.btnPublish,
            ]}
            onPress={isLastStep ? handlePublish : goNext}
            activeOpacity={0.85}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={isLastStep ? (isEditing ? 'Enregistrer' : 'Publier') : 'Suivant'}
            accessibilityState={{ disabled: submitting }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={isLastStep ? c.bg : c.onAccent} />
            ) : (
              <>
                <Text style={[styles.btnNextText, { color: isLastStep ? c.bg : c.onAccent }]}>
                  {isLastStep
                    ? (isEditing ? 'Enregistrer' : 'Publier')
                    : 'Suivant'}
                </Text>
                {!isLastStep && (
                  <Ionicons name="chevron-forward" size={18} color={c.onAccent} />
                )}
                {isLastStep && (
                  <Ionicons name="checkmark" size={18} color={c.bg} />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RecapRow({ label, value, styles }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

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
    backgroundColor: 'rgba(200,150,12,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: c.text,
    textAlign: 'center',
  },
  headerStepPill: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: 'rgba(200,150,12,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,12,0.3)',
    alignItems: 'center',
  },
  headerStepText: {
    fontFamily: fonts.bodyBold,
    color: c.gold,
    fontSize: fontSize.xs,
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
  stepCircleCompleted: { backgroundColor: c.success },
  stepCircleActive:    { backgroundColor: c.gold },
  stepCircleFuture: {
    backgroundColor: c.bgCard,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  stepNumActive: { color: '#000', fontWeight: '700', fontSize: 13 },
  stepNumFuture: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
  stepLabel: {
    fontSize: 10,
    color: c.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  stepLabelActive: { color: c.gold, fontWeight: '600' },
  connector: {
    width: 24, height: 2,
    backgroundColor: c.border,
    marginTop: 13,
  },
  connectorFilled: { backgroundColor: c.success },

  // ─── Progress bar ───
  progressTrack: {
    height: 3,
    backgroundColor: c.bgCard,
  },
  progressFillWrap: {
    height: 3,
  },
  progressFill: {
    flex: 1,
    height: 3,
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
    color: c.textSub,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFilled: {
    backgroundColor: 'rgba(200,150,12,0.06)',
    borderColor: 'rgba(200,150,12,0.35)',
  },
  inputFocused: { borderColor: c.gold },
  errorText: {
    color: c.error,
    fontSize: 13,
    marginTop: spacing.xs,
  },

  // ─── Step 2 : type cards (grille 3 colonnes) ───
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    backgroundColor: 'rgba(200,150,12,0.12)',
    borderColor: c.gold,
  },
  typeLabel: {
    ...typography.body,
    color: c.text,
    fontWeight: '600',
  },
  // ─── Toggle Vente/Location (pill) ───
  txToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    padding: 4,
    gap: 4,
  },
  txPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
  },
  txPillActive: {
    backgroundColor: c.gold,
  },
  txPillText: {
    ...typography.body,
    fontWeight: '600',
    color: c.textSub,
  },
  txPillTextActive: {
    color: '#0D0B08',
    fontWeight: '700',
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
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  photoPrimaryBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  photoPrimaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  photoRemove: {
    position: 'absolute',
    top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: c.error,
    alignItems: 'center', justifyContent: 'center',
  },
  photoEmpty: {
    width: 100, height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(200,150,12,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,150,12,0.4)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── Step 4 : prix ───
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  priceWrapFilled: {
    backgroundColor: 'rgba(200,150,12,0.06)',
    borderColor: 'rgba(200,150,12,0.35)',
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    color: c.text,
    fontSize: 15,
  },
  priceSuffix: {
    color: c.textMuted,
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
    backgroundColor: c.bgCard,
  },
  chipSelected: { backgroundColor: c.gold },
  chipText: {
    ...typography.body,
    color: c.textSub,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },

  // ─── Step 5 : localisation ───
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  coordsText: {
    ...typography.caption,
    color: c.textSub,
    textAlign: 'center',
  },
  gpsBlock: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gpsIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: c.goldMuted,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  gpsIconWrapOk: {
    backgroundColor: '#16A34A',
  },
  gpsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: c.text,
    marginBottom: 2,
  },
  gpsSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 16,
  },
  gpsWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(180,83,9,0.08)',
    borderRadius: 8,
    padding: 10,
  },
  gpsWarnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#B45309',
    flex: 1,
    lineHeight: 17,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.borderGold,
    backgroundColor: c.goldMuted,
    paddingVertical: 12,
  },
  gpsBtnOk: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  gpsBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: c.gold,
  },
  gpsBtnTextOk: {
    color: '#FFFFFF',
  },

  // ─── Step 6 : stepper +/- ───
  numberField: {
    marginBottom: spacing.md,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  numberInput: {
    flex: 1,
    textAlign: 'center',
    color: c.text,
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
    backgroundColor: c.bgCard,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  commoditeText: {
    ...typography.body,
    color: c.text,
    flex: 1,
  },

  // ─── Récap ───
  recapCard: {
    backgroundColor: c.bgCard,
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
    color: c.text,
    fontWeight: '700',
  },
  recapDesc: {
    ...typography.body,
    color: c.textSub,
    marginTop: spacing.xs,
  },
  recapPrice: {
    ...typography.h2,
    color: c.gold,
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
    color: c.textMuted,
    fontSize: 13,
  },
  recapValue: {
    color: c.text,
    fontSize: 13,
    textAlign: 'right',
    flex: 1,
  },
  recapDivider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: spacing.sm,
  },
  recapWarn: {
    color: c.warning,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ─── Barre de navigation entre étapes ───
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bgCard,
    gap: 12,
  },
  btnPrev: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.borderGold,
    backgroundColor: c.goldLight,
    flex: 1,
  },
  btnPrevText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: c.gold,
  },
  btnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: c.gold,
    flex: 2,
  },
  btnPublish: {
    backgroundColor: c.success,
    flex: 2,
  },
  btnNextText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
