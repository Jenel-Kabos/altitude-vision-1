import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

const MAX_PHOTOS = 10;

// Sélection/aperçu/suppression/couverture de photos, partagé par les 3 parcours de
// publication. L'upload Cloudinary réel n'est déclenché qu'à la publication finale
// (voir handlePublish de chaque écran) — ici on ne gère que la sélection locale.
export default function PhotoManager({ photos, onChange, error, max = MAX_PHOTOS }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const ajouterPhotos = useCallback(async () => {
    if (photos.length >= max) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie requis pour ajouter des photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: max - photos.length,
      mediaTypes: ['images'],
    });
    if (!res.canceled && res.assets?.length) {
      const additions = res.assets.map((a) => ({ uri: a.uri, uploading: false, url: null }));
      onChange([...photos, ...additions]);
    }
  }, [photos, onChange, max]);

  const supprimerPhoto = useCallback((index) => {
    onChange(photos.filter((_, i) => i !== index));
  }, [photos, onChange]);

  const definirCouverture = useCallback((index) => {
    if (index === 0) return;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  }, [photos, onChange]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos ({photos.length}/{max})</Text>
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
            {index === 0 ? (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Couverture</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => definirCouverture(index)}
                style={styles.coverBtn}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Définir comme couverture"
              >
                <Ionicons name="star-outline" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {photo.uploading ? (
              <View style={styles.uploadingOverlay}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => supprimerPhoto(index)}
              style={styles.removeBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Supprimer la photo"
            >
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < max ? (
          <TouchableOpacity
            onPress={ajouterPhotos}
            style={styles.addTile}
            accessibilityRole="button"
            accessibilityLabel="Ajouter des photos"
          >
            <Ionicons name="add" size={24} color={c.gold} />
          </TouchableOpacity>
        ) : null}
      </View>
      {photos.length === 0 && (
        <Button label="Ajouter des photos" onPress={ajouterPhotos} variant="outline" style={styles.emptyBtn} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const THUMB = 88;

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  thumbWrap: {
    width: THUMB, height: THUMB, borderRadius: radius.xs, overflow: 'hidden', position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  addTile: {
    width: THUMB, height: THUMB, borderRadius: radius.xs, borderWidth: 1.5, borderColor: c.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCardAlt,
  },
  emptyBtn: { marginTop: spacing.xs },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  coverBtn: {
    position: 'absolute', bottom: 4, left: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute', bottom: 4, left: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.xs, backgroundColor: 'rgba(200,150,12,0.9)',
  },
  coverBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#0A0A0A' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  error: {
    fontFamily: fonts.body, fontSize: fontSize.xs, color: c.error, marginTop: spacing.xs,
  },
});
