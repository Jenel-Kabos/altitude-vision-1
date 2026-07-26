import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { soumettreVirement } from '../../services/transactionService';

const COORDONNEES_BANCAIRES = {
  Banque:    'Société Générale Congo',
  IBAN:      'CG25 3001 4000 1234 5678 901',
  SWIFT:     'SOGEOGCGXXX',
  Titulaire: 'ALTITUDE VISION SARL',
  Référence: 'À préciser obligatoirement',
};

export default function VirementScreen({ route, navigation }) {
  const { transactionId, montant = 0, bien = '' } = route.params || {};
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [reference, setReference] = useState('');
  const [notes,     setNotes]     = useState('');
  const [fichier,   setFichier]   = useState(null);
  const [loading,   setLoading]   = useState(false);

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFichier(result.assets[0]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!reference.trim()) {
      Alert.alert('Référence requise', 'Veuillez saisir la référence de votre virement.');
      return;
    }
    setLoading(true);
    try {
      await soumettreVirement(transactionId, {
        referenceBancaire: reference.trim(),
        notes:             notes.trim() || undefined,
        fichier:           fichier
          ? { uri: fichier.uri, name: fichier.name, mimeType: fichier.mimeType }
          : null,
      });
      Alert.alert(
        'Virement soumis ✅',
        'Votre preuve de virement a été envoyée. Notre équipe la vérifiera sous 24h.',
        [{ text: 'OK', onPress: () => navigation.navigate('Profil', { screen: 'Transactions' }) }]
      );
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'envoyer la preuve. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [reference, notes, fichier, transactionId, navigation]);

  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Virement bancaire</Text>
        </View>

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant à virer</Text>
          <Text style={styles.amountValue}>{fmt(montant)} FCFA</Text>
          {bien ? <Text style={styles.amountBien}>{bien}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coordonnées bancaires</Text>
          <View style={styles.bankCard}>
            {Object.entries(COORDONNEES_BANCAIRES).map(([k, v]) => (
              <View key={k} style={styles.bankRow}>
                <Text style={styles.bankKey}>{k}</Text>
                <Text style={styles.bankVal} selectable>{v}</Text>
              </View>
            ))}
          </View>
          <View style={styles.warning}>
            <Ionicons name="information-circle-outline" size={15} color="#92400E" />
            <Text style={styles.warningText}>
              Indiquez impérativement votre référence de dossier dans le libellé du virement.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre preuve</Text>

          <Text style={styles.label}>Référence du virement *</Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            style={styles.input}
            placeholder="Ex: VIR-20240701-DUPONT"
            placeholderTextColor={c.placeholder}
            cursorColor={c.gold}
            selectionColor={c.borderGold}
          />

          <Text style={styles.label}>Notes (optionnel)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            placeholder="Informations complémentaires…"
            placeholderTextColor={c.placeholder}
            cursorColor={c.gold}
            selectionColor={c.borderGold}
            textAlignVertical="top"
          />

          <TouchableOpacity onPress={pickFile} style={styles.fileBtn}>
            <Ionicons name={fichier ? 'document-outline' : 'attach-outline'} size={18} color={c.gold} />
            <Text style={styles.fileBtnText}>
              {fichier ? fichier.name : 'Joindre un justificatif (image / PDF)'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.cta}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !reference.trim()}
          style={[styles.ctaBtn, (loading || !reference.trim()) && styles.ctaBtnDisabled]}
        >
          {loading ? <ActivityIndicator size="small" color={c.onAccent} /> : (
            <>
              <Ionicons name="send-outline" size={17} color={c.onAccent} />
              <Text style={styles.ctaBtnText}>Envoyer la preuve</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: c.bg },
  scroll:  { padding: spacing.lg, paddingBottom: 120 },

  header:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },

  amountCard:  { backgroundColor: c.bgCard, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: c.borderGold || c.border, marginBottom: spacing.lg },
  amountLabel: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  amountValue: { fontFamily: fonts.display, fontSize: 36, color: c.gold, marginTop: 4 },
  amountBien:  { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub, marginTop: 4 },

  section:      { marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },

  bankCard: { backgroundColor: c.bgCard, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  bankRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  bankKey:  { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  bankVal:  { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text, textAlign: 'right', flex: 1, marginLeft: spacing.md },

  warning:     { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: '#FFFBEB', borderRadius: 8, padding: spacing.sm },
  warningText: { fontFamily: fonts.body, fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 },

  label:    { fontFamily: fonts.bodyMedium || fonts.bodyBold, fontSize: fontSize.sm, color: c.text, marginBottom: 6, marginTop: spacing.md },
  input:    { backgroundColor: c.bgCard, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: c.border, fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  textarea: { minHeight: 80 },

  fileBtn:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: c.goldMuted || `${c.gold}18`, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: c.borderGold || c.border },
  fileBtnText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.gold, flex: 1 },

  cta:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, padding: spacing.lg },
  ctaBtn:      { backgroundColor: c.gold, borderRadius: radius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  ctaBtnDisabled: { opacity: 0.45 },
  ctaBtnText:  { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.onAccent },
});
