import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import api from '../../services/api';

const STEPS = ['Type', 'Infos', 'Lieu', 'Équipements', 'Photos', 'Prix', 'Récap'];

const TYPES_BIEN = ['Appartement', 'Maison', 'Villa', 'Studio', 'Terrain', 'Bureau', 'Commerce'];

const TYPES_CONSTRUCTION = ['Béton', 'Brique', 'Bois', 'Mixte', 'Container'];

const AMENITIES = [
  { key: 'clim',       label: 'Climatisation',   icon: 'snow-outline' },
  { key: 'eau',        label: 'Eau courante',    icon: 'water-outline' },
  { key: 'elec',       label: 'Électricité',     icon: 'flash-outline' },
  { key: 'parking',    label: 'Parking',         icon: 'car-outline' },
  { key: 'securite',   label: 'Sécurité 24/7',   icon: 'shield-checkmark-outline' },
  { key: 'piscine',    label: 'Piscine',         icon: 'water-outline' },
  { key: 'jardin',     label: 'Jardin',          icon: 'leaf-outline' },
  { key: 'wifi',       label: 'Internet/Wifi',   icon: 'wifi-outline' },
  { key: 'meuble',     label: 'Meublé',          icon: 'bed-outline' },
  { key: 'cuisine_eq', label: 'Cuisine équipée', icon: 'restaurant-outline' },
  { key: 'balcon',     label: 'Balcon/Terrasse', icon: 'business-outline' },
  { key: 'domestique', label: 'Domestique',      icon: 'people-outline' },
];

function StepIndicator({ step, total }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
            {i < step
              ? <Ionicons name="checkmark" size={10} color="#000" />
              : <Text style={[styles.stepNum, i === step && { color: '#000' }]}>{i + 1}</Text>
            }
          </View>
          {i < total - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function PublierBienScreen({ navigation }) {
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const [form, setForm] = useState({
    status: 'location',
    type: 'Appartement',
    constructionType: 'Béton',

    title: '',
    description: '',

    surface: '',
    bedrooms: '',
    bathrooms: '',
    livingRooms: '',
    kitchens: '',

    street: '',
    district: '',
    city: 'Brazzaville',
    latitude: null,
    longitude: null,

    price: '',
    negotiable: false,
  });

  const [amenities, setAmenities] = useState([]);
  const [photos, setPhotos] = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAmenity = (k) =>
    setAmenities(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const detectLocation = async () => {
    setLocating(true);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation pour détecter votre position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set('latitude',  loc.coords.latitude);
      set('longitude', loc.coords.longitude);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setLocating(false);
    }
  };

  const pickImage = async (fromCamera = false) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Permission requise');

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...uris].slice(0, 10));
    }
  };

  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 1) return form.title.trim() && form.description.trim() && Number(form.surface) > 0;
    if (step === 2) return form.district.trim() && form.city.trim() && form.latitude != null && form.longitude != null;
    if (step === 4) return photos.length >= 3;
    if (step === 5) return Number(form.price) > 0;
    return true;
  };

  const handlePublish = async () => {
    if (photos.length < 3) return Alert.alert('Photos requises', 'Ajoutez au moins 3 photos.');
    if (form.latitude == null || form.longitude == null) {
      return Alert.alert('Localisation requise', 'Détectez votre position avant de publier.');
    }
    if (!form.description.trim()) {
      return Alert.alert('Description requise', 'Décrivez le bien avant de publier.');
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('pole', 'Altimmo');
      fd.append('title', form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('status', form.status);
      fd.append('type', form.type);
      fd.append('constructionType', form.constructionType);
      fd.append('price', String(Number(form.price)));
      fd.append('surface', String(Number(form.surface)));
      fd.append('bedrooms', String(Number(form.bedrooms) || 0));
      fd.append('bathrooms', String(Number(form.bathrooms) || 0));
      fd.append('livingRooms', String(Number(form.livingRooms) || 0));
      fd.append('kitchens', String(Number(form.kitchens) || 0));
      fd.append('latitude', String(form.latitude));
      fd.append('longitude', String(form.longitude));
      fd.append('address', JSON.stringify({
        street:   form.street.trim(),
        district: form.district.trim(),
        city:     form.city.trim(),
      }));
      amenities.forEach(a => fd.append('amenities', a));

      photos.forEach((uri, i) => {
        fd.append('images', {
          uri,
          name: `photo_${i}.jpg`,
          type: 'image/jpeg',
        });
      });

      await api.post('/properties', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(
        'Publié !',
        'Votre bien sera visible sur Altimmo après validation par un administrateur.',
        [{ text: 'OK', onPress: () => navigation.navigate('Annonces') }],
      );
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.error
        || 'Impossible de publier.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publier un bien</Text>
        <Text style={styles.stepLabel}>{step + 1}/{STEPS.length}</Text>
      </View>

      <StepIndicator step={step} total={STEPS.length} />
      <Text style={styles.currentStepName}>{STEPS[step]}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* 0 — Type */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Type de transaction</Text>
            <View style={styles.typeRow}>
              {['location', 'vente'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeCard, form.status === t && styles.typeCardActive]}
                  onPress={() => set('status', t)}
                >
                  <Ionicons
                    name={t === 'location' ? 'key-outline' : 'cash-outline'}
                    size={28}
                    color={form.status === t ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.typeLabel, form.status === t && { color: colors.primary }]}>
                    {t === 'location' ? 'Location' : 'Vente'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.stepTitle}>Type de bien</Text>
            <View style={styles.pillGrid}>
              {TYPES_BIEN.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pill, form.type === t && styles.pillActive]}
                  onPress={() => set('type', t)}
                >
                  <Text style={[styles.pillTxt, form.type === t && { color: '#000' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 1 — Infos */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Informations du bien</Text>

            <Field label="Titre *" value={form.title} onChange={v => set('title', v)} placeholder="Ex: Villa 4 ch. avec piscine" />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.fieldInput, { height: 110, textAlignVertical: 'top' }]}
                placeholder="Décrivez le bien, son environnement, ses points forts..."
                placeholderTextColor={colors.textMuted}
                value={form.description}
                onChangeText={v => set('description', v)}
                multiline
              />
            </View>

            <Field label="Superficie (m²) *" value={form.surface} onChange={v => set('surface', v)} placeholder="120" numeric />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Chambres" value={form.bedrooms} onChange={v => set('bedrooms', v)} placeholder="3" numeric />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Salles de bain" value={form.bathrooms} onChange={v => set('bathrooms', v)} placeholder="2" numeric />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Salons" value={form.livingRooms} onChange={v => set('livingRooms', v)} placeholder="1" numeric />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Cuisines" value={form.kitchens} onChange={v => set('kitchens', v)} placeholder="1" numeric />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Type de construction</Text>
            <View style={styles.pillGrid}>
              {TYPES_CONSTRUCTION.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pill, form.constructionType === t && styles.pillActive]}
                  onPress={() => set('constructionType', t)}
                >
                  <Text style={[styles.pillTxt, form.constructionType === t && { color: '#000' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 2 — Lieu */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Localisation</Text>

            <Field label="Quartier *" value={form.district} onChange={v => set('district', v)} placeholder="Ex: Gombe, Poto-Poto..." />
            <Field label="Ville *" value={form.city} onChange={v => set('city', v)} placeholder="Brazzaville" />
            <Field label="Rue / Adresse" value={form.street} onChange={v => set('street', v)} placeholder="Rue, n°..." />

            <View style={[styles.fieldWrap, { marginTop: 8 }]}>
              <Text style={styles.fieldLabel}>Position GPS *</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={detectLocation} disabled={locating}>
                {locating ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate-outline" size={20} color={colors.primary} />
                    <Text style={styles.gpsBtnTxt}>
                      {form.latitude != null ? 'Re-détecter ma position' : 'Détecter ma position'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {form.latitude != null && (
                <View style={styles.gpsBox}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.gpsTxt}>
                    {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
              <Text style={styles.hint}>Soyez sur place pour une localisation précise.</Text>
            </View>
          </View>
        )}

        {/* 3 — Équipements */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Équipements et commodités</Text>
            <Text style={styles.hint}>Sélectionnez tout ce que propose le bien.</Text>

            <View style={styles.amenitiesGrid}>
              {AMENITIES.map(a => {
                const active = amenities.includes(a.key);
                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.amenityCard, active && styles.amenityCardActive]}
                    onPress={() => toggleAmenity(a.key)}
                  >
                    <Ionicons
                      name={a.icon}
                      size={20}
                      color={active ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.amenityTxt, active && { color: colors.primary }]}>
                      {a.label}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 4 — Photos */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Photos ({photos.length}/10 — min 3)</Text>
            <View style={styles.photoBtns}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)}>
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
                <Text style={styles.photoBtnTxt}>Caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)}>
                <Ionicons name="images-outline" size={22} color={colors.primary} />
                <Text style={styles.photoBtnTxt}>Galerie</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                  {i === 0 && (
                    <View style={styles.mainBadge}><Text style={styles.mainBadgeTxt}>Principale</Text></View>
                  )}
                </View>
              ))}
            </View>
            {photos.length < 3 && (
              <Text style={{ color: colors.warning, textAlign: 'center', marginTop: 8, fontSize: 13 }}>
                Ajoutez encore {3 - photos.length} photo(s)
              </Text>
            )}
          </View>
        )}

        {/* 5 — Prix */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {form.status === 'location' ? 'Loyer mensuel' : 'Prix de vente'}
            </Text>

            <Field
              label={form.status === 'location' ? 'Loyer / mois (FCFA) *' : 'Prix (FCFA) *'}
              value={form.price}
              onChange={v => set('price', v)}
              placeholder="0"
              numeric
            />

            {form.price ? (
              <Text style={styles.previewPrice}>
                {Number(form.price).toLocaleString('fr-FR')} FCFA
                {form.status === 'location' ? ' / mois' : ''}
              </Text>
            ) : null}

            {form.status === 'vente' && (
              <TouchableOpacity style={styles.toggleRow} onPress={() => set('negotiable', !form.negotiable)}>
                <View style={[styles.toggle, form.negotiable && styles.toggleActive]}>
                  <View style={[styles.toggleDot, form.negotiable && styles.toggleDotActive]} />
                </View>
                <Text style={styles.fieldLabel}>Prix négociable</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 6 — Récap */}
        {step === 6 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Récapitulatif</Text>

            <Recap k="Transaction" v={form.status === 'location' ? 'Location' : 'Vente'} />
            <Recap k="Type"        v={form.type} />
            <Recap k="Titre"       v={form.title} />
            <Recap k="Surface"     v={form.surface ? `${form.surface} m²` : '—'} />
            <Recap k="Pièces"      v={`${form.bedrooms || 0} ch · ${form.bathrooms || 0} sdb`} />
            <Recap k="Localisation" v={`${form.district}, ${form.city}`} />
            <Recap k="GPS"         v={form.latitude != null ? `${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}` : '—'} />
            <Recap k="Équipements" v={amenities.length ? `${amenities.length} sélectionné(s)` : '—'} />
            <Recap k="Photos"      v={`${photos.length} photo(s)`} />
            <Recap
              k="Prix"
              v={form.price ? `${Number(form.price).toLocaleString('fr-FR')} FCFA${form.status === 'location' ? '/mois' : ''}` : '—'}
            />

            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.info} />
              <Text style={styles.noticeTxt}>
                Votre annonce sera publiée après validation par un administrateur.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity onPress={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} activeOpacity={0.85}>
            <LinearGradient
              colors={canNext() ? [colors.primaryDark, colors.primary] : ['#555', '#555']}
              style={styles.btnNext}
            >
              <Text style={styles.btnNextTxt}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handlePublish} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.btnNext}>
              {loading
                ? <ActivityIndicator color="#000" />
                : <><Text style={styles.btnNextTxt}>Publier le bien</Text><Ionicons name="checkmark" size={18} color="#000" /></>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, numeric }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={String(value ?? '')}
        onChangeText={onChange}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    </View>
  );
}

function Recap({ k, v }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapKey}>{k}</Text>
      <Text style={styles.recapVal} numberOfLines={2}>{v || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: colors.text },
  stepLabel:    { fontSize: 13, color: colors.textMuted },

  stepRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 },
  stepDot:      { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum:      { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepLine:     { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },
  stepLineActive:{ backgroundColor: colors.primary },
  currentStepName: { textAlign: 'center', color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 1 },

  scroll:       { padding: 16, paddingBottom: 32 },
  stepContent:  { gap: 14 },
  stepTitle:    { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint:         { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  typeRow:      { flexDirection: 'row', gap: 12 },
  typeCard:     { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border },
  typeCardActive:{ borderColor: colors.primary },
  typeLabel:    { fontSize: 15, fontWeight: '700', color: colors.textSecondary },

  pillGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  pillActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt:      { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  fieldWrap:    { gap: 6 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  fieldInput:   { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  row2:         { flexDirection: 'row', gap: 12 },

  gpsBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.backgroundCard, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.primary },
  gpsBtnTxt:    { fontSize: 14, fontWeight: '700', color: colors.primary },
  gpsBox:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.backgroundLight, borderRadius: 10, padding: 12, marginTop: 8 },
  gpsTxt:       { fontSize: 13, color: colors.text, fontWeight: '600' },

  amenitiesGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityCard:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, minWidth: '48%' },
  amenityCardActive: { borderColor: colors.primary, backgroundColor: colors.backgroundLight },
  amenityTxt:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flexShrink: 1 },

  photoBtns:    { flexDirection: 'row', gap: 12 },
  photoBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.backgroundCard, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: colors.primary },
  photoBtnTxt:  { fontSize: 14, fontWeight: '600', color: colors.primary },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb:   { width: 90, height: 90, position: 'relative' },
  thumbImg:     { width: 90, height: 90, borderRadius: 10 },
  thumbRemove:  { position: 'absolute', top: -6, right: -6, backgroundColor: '#000', borderRadius: 11 },
  mainBadge:    { position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  mainBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#000' },

  previewPrice: { fontSize: 20, fontWeight: '800', color: colors.primary, textAlign: 'center', paddingVertical: 12 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  toggle:       { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: colors.primary },
  toggleDot:    { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textMuted },
  toggleDotActive: { backgroundColor: '#000', alignSelf: 'flex-end' },

  recapRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  recapKey:     { fontSize: 14, color: colors.textMuted },
  recapVal:     { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },

  noticeBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.backgroundLight, borderRadius: 10, padding: 12, marginTop: 12 },
  noticeTxt:    { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  footer:       { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  btnNext:      { borderRadius: 14, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnNextTxt:   { fontSize: 16, fontWeight: '700', color: '#000' },
});
