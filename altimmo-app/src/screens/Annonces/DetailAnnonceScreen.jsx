import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, Dimensions, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const fmt = (n) => n ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—';

export default function DetailAnnonceScreen({ route, navigation }) {
  const { property: p } = route.params;
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = p.images || p.photos || [];
  const isLocation = p.transactionType === 'location' || p.type === 'location';
  const prix = fmt(p.price || p.loyer || p.prix);

  const callProprio = () => {
    const tel = p.proprietaire?.phone || p.contact?.telephone;
    if (tel) Linking.openURL(`tel:${tel}`);
    else Alert.alert('Téléphone non disponible');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header flottant */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="heart-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Galerie */}
        <View style={styles.gallery}>
          <ScrollView
            horizontal pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setPhotoIndex(idx);
            }}
          >
            {photos.length > 0
              ? photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.galleryPhoto} />
                ))
              : <View style={[styles.galleryPhoto, styles.galleryPlaceholder]}>
                  <Ionicons name="home-outline" size={60} color={colors.textMuted} />
                </View>
            }
          </ScrollView>
          {photos.length > 1 && (
            <View style={styles.pagination}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: isLocation ? colors.location : colors.vente }]}>
            <Text style={styles.badgeText}>{isLocation ? 'LOCATION' : 'VENTE'}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Titre & Prix */}
          <Text style={styles.title}>{p.title || p.titre || 'Bien immobilier'}</Text>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.loc}>{[p.quartier, p.ville].filter(Boolean).join(', ') || '—'}</Text>
          </View>
          <Text style={styles.price}>
            {prix}{isLocation ? <Text style={styles.priceSuffix}>/mois</Text> : ''}
          </Text>

          {/* Caractéristiques */}
          <View style={styles.featRow}>
            {[
              { icon: 'bed-outline',    label: p.bedrooms,  unit: 'ch.' },
              { icon: 'water-outline',  label: p.bathrooms, unit: 'sdb' },
              { icon: 'expand-outline', label: p.surface,   unit: 'm²' },
              { icon: 'layers-outline', label: p.pieces,    unit: 'pièces' },
            ].filter(f => f.label != null).map((f, i) => (
              <View key={i} style={styles.featCard}>
                <Ionicons name={f.icon} size={20} color={colors.primary} />
                <Text style={styles.featVal}>{f.label}</Text>
                <Text style={styles.featUnit}>{f.unit}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          {(p.description || p.description_fr) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{p.description || p.description_fr}</Text>
            </View>
          )}

          {/* Propriétaire */}
          {p.proprietaire && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Propriétaire</Text>
              <View style={styles.ownRow}>
                {p.proprietaire.photo
                  ? <Image source={{ uri: p.proprietaire.photo }} style={styles.ownPhoto} />
                  : <View style={styles.ownPhotoPlaceholder}>
                      <Ionicons name="person" size={20} color={colors.textMuted} />
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownName}>{p.proprietaire.name || p.proprietaire.nom}</Text>
                  <Text style={styles.ownRole}>Propriétaire vérifié</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barre d'actions */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={callProprio}>
          <Ionicons name="call-outline" size={20} color={colors.primary} />
          <Text style={styles.actionTxt}>Appeler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
          <Text style={styles.actionTxt}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.actionTxt}>Visite</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} activeOpacity={0.85}>
          <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.reserveBtn}>
            <Text style={styles.reserveTxt}>Réserver</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  floatingHeader: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn:      { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 8 },
  gallery:      { height: 300, position: 'relative' },
  galleryPhoto: { width, height: 300 },
  galleryPlaceholder: { backgroundColor: colors.backgroundLight, justifyContent: 'center', alignItems: 'center' },
  pagination:   { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive:    { backgroundColor: '#fff', width: 18 },
  badge:        { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:    { fontSize: 10, fontWeight: '800', color: '#fff' },
  body:         { padding: 20 },
  title:        { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  loc:          { fontSize: 14, color: colors.textMuted },
  price:        { fontSize: 24, fontWeight: '900', color: colors.primary, marginBottom: 16 },
  priceSuffix:  { fontSize: 14, fontWeight: '400', color: colors.textMuted },
  featRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  featCard:     { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border },
  featVal:      { fontSize: 16, fontWeight: '800', color: colors.text },
  featUnit:     { fontSize: 11, color: colors.textMuted },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  description:  { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  ownRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  ownPhoto:     { width: 46, height: 46, borderRadius: 23 },
  ownPhotoPlaceholder: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.backgroundLight, justifyContent: 'center', alignItems: 'center' },
  ownName:      { fontSize: 15, fontWeight: '700', color: colors.text },
  ownRole:      { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actionBar:    { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.backgroundLight, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  actionBtn:    { flex: 1, alignItems: 'center', gap: 4 },
  actionTxt:    { fontSize: 11, color: colors.textSecondary },
  reserveBtn:   { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  reserveTxt:   { fontSize: 14, fontWeight: '700', color: '#000' },
});
