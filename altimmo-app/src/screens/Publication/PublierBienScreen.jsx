import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import api from '../../services/api';

const STEPS = ['Type','Infos','Photos','Prix','Publier'];
const TYPES_BIEN = ['Appartement','Maison','Terrain','Bureau','Villa','Commerce','Studio'];

function StepIndicator({ step, total }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
            {i < step
              ? <Ionicons name="checkmark" size={12} color="#000" />
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
  const [step,      setStep]      = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [form, setForm] = useState({
    transactionType: 'location',
    propertyType: 'Appartement',
    title: '', address: '', quartier: '', ville: 'Brazzaville',
    surface: '', pieces: '', bedrooms: '', bathrooms: '',
    description: '',
    price: '', charges: '', caution: '', negotiable: false,
  });
  const [photos, setPhotos] = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

  const handlePublish = async () => {
    if (photos.length < 3) return Alert.alert('Photos requises', 'Ajoutez au moins 3 photos.');
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, String(v)));
      photos.forEach((uri, i) => {
        formData.append('images', {
          uri,
          name: `photo_${i}.jpg`,
          type: 'image/jpeg',
        });
      });
      await api.post('/properties', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Publié !', 'Votre bien est maintenant visible sur Altimmo.', [
        { text: 'OK', onPress: () => navigation.navigate('Annonces') },
      ]);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de publier.');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1) return form.title && form.quartier && form.ville;
    if (step === 2) return photos.length >= 3;
    if (step === 3) return form.price;
    return true;
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ÉTAPE 0 — Type */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Type de transaction</Text>
            <View style={styles.typeRow}>
              {['location','vente'].map(t => (
                <TouchableOpacity
                  key={t} style={[styles.typeCard, form.transactionType === t && styles.typeCardActive]}
                  onPress={() => set('transactionType', t)}
                >
                  <Ionicons name={t === 'location' ? 'key-outline' : 'cash-outline'} size={28} color={form.transactionType === t ? colors.primary : colors.textMuted} />
                  <Text style={[styles.typeLabel, form.transactionType === t && { color: colors.primary }]}>
                    {t === 'location' ? '🏠 Location' : '💰 Vente'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.stepTitle}>Type de bien</Text>
            <View style={styles.typeBienGrid}>
              {TYPES_BIEN.map(t => (
                <TouchableOpacity
                  key={t} style={[styles.typeBienPill, form.propertyType === t && styles.typeBienPillActive]}
                  onPress={() => set('propertyType', t)}
                >
                  <Text style={[styles.typeBienTxt, form.propertyType === t && { color: '#000' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ÉTAPE 1 — Infos */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Informations du bien</Text>
            {[
              { key: 'title',       label: 'Titre *', placeholder: 'Ex: Villa 4 ch. Gombe' },
              { key: 'address',     label: 'Adresse', placeholder: 'Rue, N°...' },
              { key: 'quartier',    label: 'Quartier *', placeholder: 'Ex: Gombe, Poto-Poto...' },
              { key: 'ville',       label: 'Ville *', placeholder: 'Ex: Brazzaville' },
              { key: 'surface',     label: 'Superficie (m²)', placeholder: '120', numeric: true },
              { key: 'pieces',      label: 'Pièces', placeholder: '5', numeric: true },
              { key: 'bedrooms',    label: 'Chambres', placeholder: '3', numeric: true },
              { key: 'bathrooms',   label: 'Salles de bain', placeholder: '2', numeric: true },
            ].map(f => (
              <View key={f.key} style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={String(form[f.key])}
                  onChangeText={v => set(f.key, v)}
                  keyboardType={f.numeric ? 'numeric' : 'default'}
                />
              </View>
            ))}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Décrivez le bien..."
                placeholderTextColor={colors.textMuted}
                value={form.description}
                onChangeText={v => set('description', v)}
                multiline
              />
            </View>
          </View>
        )}

        {/* ÉTAPE 2 — Photos */}
        {step === 2 && (
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
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {photos.length < 3 && (
              <Text style={{ color: colors.warning, textAlign: 'center', marginTop: 8, fontSize: 13 }}>
                ⚠️ Ajoutez au moins {3 - photos.length} photo(s) supplémentaire(s)
              </Text>
            )}
          </View>
        )}

        {/* ÉTAPE 3 — Prix */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {form.transactionType === 'location' ? 'Loyer mensuel' : 'Prix de vente'}
            </Text>
            {form.transactionType === 'location' ? (
              <>
                {[
                  { key: 'price',    label: 'Loyer/mois (FCFA) *' },
                  { key: 'charges',  label: 'Charges (FCFA)' },
                  { key: 'caution',  label: 'Caution (FCFA)' },
                ].map(f => (
                  <View key={f.key} style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={String(form[f.key])}
                      onChangeText={v => set(f.key, v)}
                      keyboardType="numeric"
                    />
                  </View>
                ))}
              </>
            ) : (
              <>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Prix (FCFA) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={String(form.price)}
                    onChangeText={v => set('price', v)}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => set('negotiable', !form.negotiable)}
                >
                  <View style={[styles.toggle, form.negotiable && styles.toggleActive]}>
                    <View style={[styles.toggleDot, form.negotiable && styles.toggleDotActive]} />
                  </View>
                  <Text style={styles.fieldLabel}>Prix négociable</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ÉTAPE 4 — Confirmation */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Récapitulatif</Text>
            {[
              ['Type', `${form.transactionType} — ${form.propertyType}`],
              ['Titre', form.title],
              ['Quartier', `${form.quartier}, ${form.ville}`],
              ['Surface', form.surface ? `${form.surface} m²` : '—'],
              ['Photos', `${photos.length} photo(s)`],
              ['Prix', form.price ? `${Number(form.price).toLocaleString('fr-FR')} FCFA` : '—'],
            ].map(([k, v]) => (
              <View key={k} style={styles.recapRow}>
                <Text style={styles.recapKey}>{k}</Text>
                <Text style={styles.recapVal}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bouton suivant / publier */}
      <View style={styles.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            onPress={() => setStep(s => s + 1)}
            disabled={!canNext()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canNext() ? [colors.primaryDark, colors.primary] : ['#555','#555']}
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

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: colors.text },
  stepLabel:    { fontSize: 13, color: colors.textMuted },
  stepRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  stepDot:      { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum:      { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepLine:     { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineActive:{ backgroundColor: colors.primary },
  scroll:       { padding: 16, paddingBottom: 32 },
  stepContent:  { gap: 14 },
  stepTitle:    { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  typeRow:      { flexDirection: 'row', gap: 12 },
  typeCard:     { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border },
  typeCardActive:{ borderColor: colors.primary },
  typeLabel:    { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  typeBienGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBienPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  typeBienPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBienTxt:  { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  fieldWrap:    { gap: 6 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  fieldInput:   { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  photoBtns:    { flexDirection: 'row', gap: 12 },
  photoBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.backgroundCard, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: colors.primary },
  photoBtnTxt:  { fontSize: 14, fontWeight: '600', color: colors.primary },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb:   { width: 90, height: 90, position: 'relative' },
  thumbImg:     { width: 90, height: 90, borderRadius: 10 },
  thumbRemove:  { position: 'absolute', top: -6, right: -6 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggle:       { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: colors.primary },
  toggleDot:    { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textMuted },
  toggleDotActive: { backgroundColor: '#000', alignSelf: 'flex-end' },
  recapRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  recapKey:     { fontSize: 14, color: colors.textMuted },
  recapVal:     { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  footer:       { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  btnNext:      { borderRadius: 14, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnNextTxt:   { fontSize: 16, fontWeight: '700', color: '#000' },
});
