import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { fonts, spacing } from '../../theme';

const { width } = Dimensions.get('window');
const GALLERY_HEIGHT = 280;

// PHASE-H1 — même patron de galerie hors-ScrollView + header flottant que
// DetailAnnonceScreen.jsx (jamais une seconde implémentation de galerie) :
// FlatList paginée, compteur, barre de progression, header superposé.
export default function HotelHeroGallery({ images = [], onBack, onShare }) {
  const { themeColors: c } = useTheme();
  const styles = makeStyles(c);
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const onScrollEnd = useCallback((event) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(next);
  }, []);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.item}>
      <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    </View>
  ), [styles]);

  return (
    <View style={styles.wrap}>
      {images.length > 0 ? (
        <>
          <FlatList
            ref={listRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, i) => item.url || String(i)}
            renderItem={renderItem}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.gradient} pointerEvents="none" />
          {images.length > 1 && (
            <View style={styles.counter} pointerEvents="none">
              <Ionicons name="images-outline" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="business-outline" size={48} color={c.border} />
          <Text style={styles.placeholderText}>Aucune photo disponible</Text>
        </View>
      )}

      <SafeAreaView style={styles.headerSafe} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          {onShare && (
            <TouchableOpacity style={styles.headerBtn} onPress={onShare} accessibilityRole="button" accessibilityLabel="Partager cet hôtel">
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { width, height: GALLERY_HEIGHT, backgroundColor: c.bgCard },
  item: { width, height: GALLERY_HEIGHT },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: GALLERY_HEIGHT * 0.5 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { fontFamily: fonts.body, color: c.textMuted },
  counter: {
    position: 'absolute', bottom: 14, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  counterText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.3 },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
});
