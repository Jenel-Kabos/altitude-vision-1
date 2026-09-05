import React, { useCallback } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

const MAP_HEIGHT = 160;

// PHASE-H1.5 — ferme le gap H1 "carte absente" en réutilisant l'infra déjà
// présente dans CarteScreen.jsx (react-native-maps) : jamais une deuxième
// bibliothèque de cartographie. Aperçu non-cluster (un seul marqueur), pas
// de Supercluster nécessaire pour un point unique.
export default function HotelLocationMap({ latitude, longitude, title }) {
  const { themeColors: c } = useTheme();
  const styles = makeStyles(c);

  const openDirections = useCallback(async () => {
    if (!latitude || !longitude) {
      Alert.alert('Coordonnées manquantes', 'Cet établissement n’a pas encore de position GPS.');
      return;
    }
    const label = encodeURIComponent(title || 'Hôtel');
    if (Platform.OS === 'ios') {
      const googleInstalled = await Linking.canOpenURL('comgooglemaps://');
      Linking.openURL(googleInstalled
        ? `comgooglemaps://?daddr=${latitude},${longitude}&q=${label}&directionsmode=driving`
        : `maps://?daddr=${latitude},${longitude}&q=${label}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}&travelmode=driving`);
    }
  }, [latitude, longitude, title]);

  return (
    <View style={styles.wrap}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={styles.map}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        initialRegion={{ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      >
        <Marker coordinate={{ latitude, longitude }} title={title} />
      </MapView>
      <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} accessibilityRole="button" accessibilityLabel="Obtenir l’itinéraire">
        <Ionicons name="navigate-outline" size={14} color={c.gold} />
        <Text style={styles.directionsText}>Itinéraire</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginTop: spacing.xs, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  map: { width: '100%', height: MAP_HEIGHT },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: c.bgCardAlt, paddingHorizontal: 10, paddingVertical: 6, margin: spacing.xs, borderRadius: radius.xs,
  },
  directionsText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.gold },
});
