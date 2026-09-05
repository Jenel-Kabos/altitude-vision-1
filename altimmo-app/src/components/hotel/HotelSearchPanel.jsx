import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

const toISODate = (date) => date.toISOString().slice(0, 10);
const fromISODate = (value) => (value ? new Date(`${value}T00:00:00Z`) : null);
const formatFR = (value) => (value ? fromISODate(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : null);

function Stepper({ label, value, min = 0, onChange }) {
  const { themeColors: c } = useTheme();
  const styles = makeStepperStyles(c);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, value <= min && styles.btnDisabled]}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Ionicons name="remove" size={16} color={value <= min ? c.textMuted : c.text} />
        </TouchableOpacity>
        <Text style={styles.value}>{value}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => onChange(value + 1)} accessibilityRole="button" accessibilityLabel={`Augmenter ${label}`}>
          <Ionicons name="add" size={16} color={c.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// PHASE-H2 — panneau de recherche (dates + voyageurs + chambres) de
// HotelDetailScreen. Réutilise le sélecteur de date déjà présent dans
// DetailAnnonceScreen (jamais une deuxième dépendance de date-picker).
export default function HotelSearchPanel({ value, onChange, onSubmit, loading = false }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [pickerField, setPickerField] = useState(null); // 'checkIn' | 'checkOut' | null

  const onChangeDate = useCallback((event, selected) => {
    setPickerField(Platform.OS === 'ios' ? pickerField : null);
    if (event.type === 'dismissed' || !selected) return;
    const iso = toISODate(selected);
    if (pickerField === 'checkIn') {
      const next = { ...value, checkIn: iso };
      if (value.checkOut && value.checkOut <= iso) next.checkOut = null;
      onChange(next);
    } else if (pickerField === 'checkOut') {
      onChange({ ...value, checkOut: iso });
    }
  }, [pickerField, value, onChange]);

  const canSubmit = Boolean(value.checkIn && value.checkOut && value.adults >= 1 && value.rooms >= 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateField} onPress={() => setPickerField('checkIn')} accessibilityRole="button" accessibilityLabel="Choisir la date d’arrivée">
          <Text style={styles.dateLabel}>Arrivée</Text>
          <Text style={styles.dateValue}>{formatFR(value.checkIn) || 'Sélectionner'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateField} onPress={() => value.checkIn && setPickerField('checkOut')} accessibilityRole="button" accessibilityLabel="Choisir la date de départ">
          <Text style={styles.dateLabel}>Départ</Text>
          <Text style={styles.dateValue}>{formatFR(value.checkOut) || 'Sélectionner'}</Text>
        </TouchableOpacity>
      </View>

      {pickerField && (
        <DateTimePicker
          value={(pickerField === 'checkIn' ? fromISODate(value.checkIn) : fromISODate(value.checkOut)) || new Date()}
          mode="date"
          minimumDate={pickerField === 'checkOut' && value.checkIn ? new Date(fromISODate(value.checkIn).getTime() + 86400000) : new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onChangeDate}
        />
      )}

      <Stepper label="Adultes" value={value.adults} min={1} onChange={(adults) => onChange({ ...value, adults })} />
      <Stepper label="Enfants" value={value.children} min={0} onChange={(children) => onChange({ ...value, children })} />
      <Stepper label="Chambres" value={value.rooms} min={1} onChange={(rooms) => onChange({ ...value, rooms })} />

      <Button label="Rechercher" onPress={onSubmit} disabled={!canSubmit} loading={loading} style={styles.submitBtn} />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { backgroundColor: c.bgCardAlt, borderRadius: radius.sm, padding: spacing.md, gap: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateField: { flex: 1, backgroundColor: c.bgCard, borderRadius: radius.xs, borderWidth: 1, borderColor: c.border, padding: spacing.sm },
  dateLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted },
  dateValue: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text, marginTop: 2 },
  submitBtn: { marginTop: spacing.xs },
});
const makeStepperStyles = (c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard },
  btnDisabled: { opacity: 0.4 },
  value: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text, minWidth: 18, textAlign: 'center' },
});
