import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Slider } from '@miblanchard/react-native-slider';
import { colors, fonts, fontSize, spacing, radius } from '../theme';
import { VILLES, getArrondissementsFor } from '../constants/locations';
import { PROPERTY_TYPES_WITH_ALL } from '../constants/propertyTypes';

const TRANSACTIONS = [
  { value: 'vente',    label: 'Vente' },
  { value: 'location', label: 'Location' },
  { value: 'tous',     label: 'Tous' },
];

const TYPES_BIEN = PROPERTY_TYPES_WITH_ALL.map(t => t.value);

const PRICE_MIN = 0;
const PRICE_MAX = 500_000_000;
const PRICE_STEP = 5_000_000;

export default function SearchPanel({
  visible,
  onClose,
  onSearch,
  initialFilters,
}) {
  const [transaction, setTransaction] = useState(
    initialFilters?.transaction || 'tous'
  );
  const [typeBien, setTypeBien] = useState(
    initialFilters?.typeBien || 'tous'
  );
  const [priceRange, setPriceRange] = useState(
    initialFilters?.priceRange || [PRICE_MIN, PRICE_MAX]
  );
  const [ville, setVille] = useState(initialFilters?.ville || 'Toutes');
  const [arrondissement, setArrondissement] = useState(
    initialFilters?.arrondissement || 'Tous'
  );
  const [typeOpen, setTypeOpen] = useState(false);
  const [villeOpen, setVilleOpen] = useState(false);
  const [arrondOpen, setArrondOpen] = useState(false);

  if (!visible) return null;

  const [minPrice, maxPrice] = priceRange;
  const arrondDisabled = ville === 'Toutes';
  const arrondsList = ['Tous', ...getArrondissementsFor(ville)];

  const handleVilleSelect = (v) => {
    setVille(v);
    setVilleOpen(false);
    // Reset arrondissement quand la ville change
    setArrondissement('Tous');
  };

  return (
    <View style={styles.panel}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rechercher un bien</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ─── Transaction ─── */}
      <Text style={styles.label}>TRANSACTION</Text>
      <View style={styles.rowChips}>
        {TRANSACTIONS.map((t) => {
          const active = transaction === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTransaction(t.value)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Type de bien (dropdown) ─── */}
      <Text style={styles.label}>TYPE DE BIEN</Text>
      <TouchableOpacity
        onPress={() => setTypeOpen((o) => !o)}
        style={styles.dropdown}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownText}>
          {typeBien === 'tous' ? 'Tous les types' : typeBien}
        </Text>
        <Ionicons
          name={typeOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.gold}
        />
      </TouchableOpacity>
      {typeOpen && (
        <View style={styles.dropdownList}>
          {TYPES_BIEN.map((t) => {
            const active = typeBien === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => {
                  setTypeBien(t);
                  setTypeOpen(false);
                }}
                style={[
                  styles.dropdownItem,
                  active && styles.dropdownItemActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    active && styles.dropdownItemTextActive,
                  ]}
                >
                  {t === 'tous' ? 'Tous les types' : t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── Ville (dropdown) ─── */}
      <Text style={styles.label}>VILLE</Text>
      <TouchableOpacity
        onPress={() => setVilleOpen((o) => !o)}
        style={styles.dropdown}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownText}>{ville}</Text>
        <Ionicons
          name={villeOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.gold}
        />
      </TouchableOpacity>
      {villeOpen && (
        <View style={styles.dropdownList}>
          {['Toutes', ...VILLES].map((v) => {
            const active = ville === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => handleVilleSelect(v)}
                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownItemText,
                  active && styles.dropdownItemTextActive,
                ]}>
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── Arrondissement (dropdown, dépend de ville) ─── */}
      <Text style={styles.label}>ARRONDISSEMENT</Text>
      <TouchableOpacity
        onPress={() => !arrondDisabled && setArrondOpen((o) => !o)}
        style={[styles.dropdown, arrondDisabled && styles.dropdownDisabled]}
        activeOpacity={arrondDisabled ? 1 : 0.8}
      >
        <Text style={[
          styles.dropdownText,
          arrondDisabled && styles.dropdownTextDisabled,
        ]}>
          {arrondissement}
        </Text>
        <Ionicons
          name={arrondOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={arrondDisabled ? colors.textMuted : colors.gold}
        />
      </TouchableOpacity>
      {arrondOpen && !arrondDisabled && (
        <View style={styles.dropdownList}>
          {arrondsList.map((a) => {
            const active = arrondissement === a;
            return (
              <TouchableOpacity
                key={a}
                onPress={() => {
                  setArrondissement(a);
                  setArrondOpen(false);
                }}
                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownItemText,
                  active && styles.dropdownItemTextActive,
                ]}>
                  {a}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── Budget (range slider) ─── */}
      <Text style={styles.label}>BUDGET</Text>
      <Text style={styles.priceText}>
        {minPrice.toLocaleString('fr-FR')} — {maxPrice.toLocaleString('fr-FR')} fcfa
      </Text>
      <View style={styles.sliderWrap}>
        <Slider
          value={priceRange}
          minimumValue={PRICE_MIN}
          maximumValue={PRICE_MAX}
          step={PRICE_STEP}
          onValueChange={setPriceRange}
          minimumTrackTintColor={colors.gold}
          maximumTrackTintColor="#444"
          thumbTintColor={colors.gold}
        />
      </View>

      {/* ─── CTA Rechercher ─── */}
      <TouchableOpacity
        onPress={() => onSearch?.({
          transaction, typeBien, priceRange, ville, arrondissement,
        })}
        style={styles.cta}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Rechercher</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.black,
    borderRadius: radius.md,
    padding: spacing.lg,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.white,
  },

  // ─── Section label ───
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  // ─── Chips transaction ───
  rowChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  chipTextActive: {
    color: colors.black,
    fontFamily: fonts.bodyBold,
  },

  // ─── Dropdown type ───
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownDisabled: {
    opacity: 0.4,
  },
  dropdownText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  dropdownTextDisabled: {
    color: colors.textMuted,
  },
  dropdownList: {
    marginTop: spacing.xs,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(200, 150, 12, 0.15)',
  },
  dropdownItemText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  dropdownItemTextActive: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
  },

  // ─── Slider ───
  priceText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  sliderWrap: {
    paddingHorizontal: spacing.xs,
  },

  // ─── CTA ───
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.black,
  },
});
