import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Slider } from '@miblanchard/react-native-slider';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../theme';
import { VILLES, getArrondissementsFor } from '../constants/locations';
import { PROPERTY_TYPES_WITH_ALL } from '../constants/propertyTypes';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TRANSACTIONS = [
  { value: 'vente',       label: 'Vente' },
  { value: 'location',    label: 'Location' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'tous',        label: 'Tous' },
];

const TYPES_BIEN = PROPERTY_TYPES_WITH_ALL.map(t => t.value);

export const PRICE_MIN  = 0;
export const PRICE_MAX  = 500_000_000;
const PRICE_STEP = 500_000; // 500K pour granularité locations ET ventes

// Presets budget pour sélection rapide
const BUDGET_PRESETS = [
  { label: '< 500K',    min: 0,             max: 500_000         },
  { label: '< 5M',      min: 0,             max: 5_000_000       },
  { label: '5M – 30M',  min: 5_000_000,     max: 30_000_000      },
  { label: '30M – 100M',min: 30_000_000,    max: 100_000_000     },
  { label: '> 100M',    min: 100_000_000,   max: PRICE_MAX       },
];

const DEFAULT_FILTERS = {
  transaction:    'tous',
  typeBien:       'tous',
  priceRange:     [PRICE_MIN, PRICE_MAX],
  ville:          'Toutes',
  arrondissement: 'Tous',
};

// ─── Helpers budget ───────────────────────────────────────────────────────────

/**
 * Formate un montant en FCFA en notation courte avec K et M majuscules.
 * Exemples : 500 000 → "500K" | 1 500 000 → "1.5M" | 50 000 000 → "50M"
 */
export function formatPriceShort(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}Md`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v : Math.round(v)}K`;
  }
  return n === 0 ? '0' : String(n);
}

/**
 * Parse une saisie budget humaine : "500K" → 500000, "2.5M" → 2500000,
 * "10000000" → 10000000. Retourne null si invalide.
 */
export function parseBudgetInput(text) {
  if (!text || !text.trim()) return null;
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.').toUpperCase();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  if (cleaned.endsWith('MRD') || cleaned.endsWith('MD')) return Math.round(num * 1_000_000_000);
  if (cleaned.endsWith('M'))  return Math.round(num * 1_000_000);
  if (cleaned.endsWith('K'))  return Math.round(num * 1_000);
  return Math.round(num);
}

// ─── Sous-composant dropdown ──────────────────────────────────────────────────

function DropdownField({ label, value, displayValue, items, open, onToggle, onSelect, disabled, styles, c }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && onToggle()}
        style={[styles.dropdown, disabled && styles.dropdownDisabled, open && styles.dropdownOpen]}
        activeOpacity={disabled ? 1 : 0.8}
        accessibilityRole="button"
        accessibilityLabel={`Sélectionner ${label.toLowerCase()}`}
        accessibilityState={{ disabled, expanded: open }}
      >
        <Text style={[styles.dropdownText, disabled && styles.dropdownTextDisabled]}>
          {displayValue}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={disabled ? c.textMuted : c.gold}
        />
      </TouchableOpacity>
      {open && !disabled && (
        <ScrollView
          style={styles.dropdownList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {items.map((item) => {
            const isActive = value === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => onSelect(item.value)}
                style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isActive }}
              >
                {isActive && (
                  <Ionicons name="checkmark" size={14} color={c.gold} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SearchPanel({ visible, onClose, onSearch, initialFilters }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [transaction, setTransaction] = useState(initialFilters?.transaction ?? DEFAULT_FILTERS.transaction);
  const [typeBien,    setTypeBien]    = useState(initialFilters?.typeBien    ?? DEFAULT_FILTERS.typeBien);
  const [priceRange,  setPriceRange]  = useState(initialFilters?.priceRange  ?? DEFAULT_FILTERS.priceRange);
  const [ville,       setVille]       = useState(initialFilters?.ville       ?? DEFAULT_FILTERS.ville);
  const [arrondissement, setArrondissement] = useState(initialFilters?.arrondissement ?? DEFAULT_FILTERS.arrondissement);

  // Champs texte budget (affichage + saisie)
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');

  // Un seul dropdown ouvert à la fois
  const [openDropdown, setOpenDropdown] = useState(null);

  // Synchronise le panel avec les filtres actifs à chaque ouverture (ex: quick-chips)
  useEffect(() => {
    if (visible && initialFilters) {
      setTransaction(initialFilters.transaction ?? DEFAULT_FILTERS.transaction);
      setTypeBien(initialFilters.typeBien    ?? DEFAULT_FILTERS.typeBien);
      setPriceRange(initialFilters.priceRange ?? DEFAULT_FILTERS.priceRange);
      setVille(initialFilters.ville           ?? DEFAULT_FILTERS.ville);
      setArrondissement(initialFilters.arrondissement ?? DEFAULT_FILTERS.arrondissement);
      setMinInput('');
      setMaxInput('');
      setOpenDropdown(null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDropdown = useCallback((name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  }, []);

  const arrondDisabled = ville === 'Toutes';
  const arrondsList = useMemo(() => ['Tous', ...getArrondissementsFor(ville)], [ville]);

  const typeItems = useMemo(() =>
    TYPES_BIEN.map(t => ({ value: t, label: t === 'tous' ? 'Tous les types' : t })),
  []);

  const villeItems = useMemo(() =>
    ['Toutes', ...VILLES].map(v => ({ value: v, label: v })),
  []);

  const arrondItems = useMemo(() =>
    arrondsList.map(a => ({ value: a, label: a })),
  [arrondsList]);

  const [minPrice, maxPrice] = priceRange;
  const isPriceDefault = minPrice === PRICE_MIN && maxPrice === PRICE_MAX;

  // Applique un preset budget
  const applyPreset = useCallback((preset) => {
    setPriceRange([preset.min, preset.max]);
    setMinInput(preset.min === 0 ? '' : formatPriceShort(preset.min));
    setMaxInput(preset.max >= PRICE_MAX ? '' : formatPriceShort(preset.max));
  }, []);

  // Valide et applique la saisie min
  const commitMin = useCallback(() => {
    const val = parseBudgetInput(minInput);
    if (val === null && !minInput.trim()) {
      setPriceRange([0, priceRange[1]]);
    } else if (val !== null) {
      const clamped = Math.min(val, priceRange[1]);
      setPriceRange([clamped, priceRange[1]]);
      setMinInput(clamped === 0 ? '' : formatPriceShort(clamped));
    }
  }, [minInput, priceRange]);

  // Valide et applique la saisie max
  const commitMax = useCallback(() => {
    const val = parseBudgetInput(maxInput);
    if (val === null && !maxInput.trim()) {
      setPriceRange([priceRange[0], PRICE_MAX]);
    } else if (val !== null) {
      const clamped = Math.max(val, priceRange[0]);
      const final   = Math.min(clamped, PRICE_MAX);
      setPriceRange([priceRange[0], final]);
      setMaxInput(final >= PRICE_MAX ? '' : formatPriceShort(final));
    }
  }, [maxInput, priceRange]);

  const handleVilleSelect = useCallback((v) => {
    setVille(v);
    setArrondissement('Tous');
    setOpenDropdown(null);
  }, []);

  const handleReset = useCallback(() => {
    setTransaction(DEFAULT_FILTERS.transaction);
    setTypeBien(DEFAULT_FILTERS.typeBien);
    setPriceRange(DEFAULT_FILTERS.priceRange);
    setVille(DEFAULT_FILTERS.ville);
    setArrondissement(DEFAULT_FILTERS.arrondissement);
    setMinInput('');
    setMaxInput('');
    setOpenDropdown(null);
  }, []);

  const handleSearch = useCallback(() => {
    onSearch?.({ transaction, typeBien, priceRange, ville, arrondissement });
  }, [transaction, typeBien, priceRange, ville, arrondissement, onSearch]);

  // Compter les filtres actifs pour le bouton CTA
  const activeCount = useMemo(() => {
    let n = 0;
    if (transaction !== 'tous') n++;
    if (typeBien !== 'tous') n++;
    if (ville !== 'Toutes') n++;
    if (!isPriceDefault) n++;
    return n;
  }, [transaction, typeBien, ville, isPriceDefault]);

  // Label affiché au-dessus du slider
  const budgetLabel = isPriceDefault
    ? 'Tous les budgets'
    : `${minPrice === 0 ? '0' : formatPriceShort(minPrice)} — ${maxPrice >= PRICE_MAX ? '500M+' : formatPriceShort(maxPrice)} FCFA`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Fond semi-opaque — tap pour fermer */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Fermer les filtres"
        />

        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleReset}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Réinitialiser les filtres"
            >
              <Text style={styles.resetBtn}>Réinitialiser</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Filtres</Text>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Corps scrollable */}
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrer : ${t.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ─── Type de bien ─── */}
            <DropdownField
              label="TYPE DE BIEN"
              value={typeBien}
              displayValue={typeBien === 'tous' ? 'Tous les types' : typeBien}
              items={typeItems}
              open={openDropdown === 'type'}
              onToggle={() => toggleDropdown('type')}
              onSelect={(v) => { setTypeBien(v); setOpenDropdown(null); }}
              styles={styles}
              c={c}
            />

            {/* ─── Ville ─── */}
            <DropdownField
              label="VILLE"
              value={ville}
              displayValue={ville}
              items={villeItems}
              open={openDropdown === 'ville'}
              onToggle={() => toggleDropdown('ville')}
              onSelect={handleVilleSelect}
              styles={styles}
              c={c}
            />

            {/* ─── Arrondissement (conditionnel) ─── */}
            {!arrondDisabled && (
              <DropdownField
                label="ARRONDISSEMENT"
                value={arrondissement}
                displayValue={arrondissement}
                items={arrondItems}
                open={openDropdown === 'arrond'}
                onToggle={() => toggleDropdown('arrond')}
                onSelect={(v) => { setArrondissement(v); setOpenDropdown(null); }}
                styles={styles}
                c={c}
              />
            )}

            {/* ─── Budget ─── */}
            <Text style={styles.label}>BUDGET</Text>

            {/* Presets rapides */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {BUDGET_PRESETS.map((p) => {
                const isActive = priceRange[0] === p.min && priceRange[1] === p.max;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetChip, isActive && styles.presetChipActive]}
                    onPress={() => applyPreset(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Saisie min / max avec parsing K et M */}
            <View style={styles.budgetInputRow}>
              <View style={styles.budgetInputGroup}>
                <Text style={styles.budgetInputLabel}>Min</Text>
                <View style={[styles.budgetInputBox, minInput && styles.budgetInputBoxActive]}>
                  <TextInput
                    style={[styles.budgetInputField, { color: c.text }]}
                    placeholder="0"
                    placeholderTextColor={c.textMuted}
                    value={minInput}
                    onChangeText={setMinInput}
                    onBlur={commitMin}
                    onSubmitEditing={commitMin}
                    keyboardType="default"
                    returnKeyType="done"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Budget minimum"
                  />
                  <Text style={styles.budgetInputSuffix}>FCFA</Text>
                </View>
              </View>

              <View style={styles.budgetSepWrap}>
                <View style={styles.budgetSepLine} />
              </View>

              <View style={styles.budgetInputGroup}>
                <Text style={styles.budgetInputLabel}>Max</Text>
                <View style={[styles.budgetInputBox, maxInput && styles.budgetInputBoxActive]}>
                  <TextInput
                    style={[styles.budgetInputField, { color: c.text }]}
                    placeholder="500M"
                    placeholderTextColor={c.textMuted}
                    value={maxInput}
                    onChangeText={setMaxInput}
                    onBlur={commitMax}
                    onSubmitEditing={commitMax}
                    keyboardType="default"
                    returnKeyType="done"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Budget maximum"
                  />
                  <Text style={styles.budgetInputSuffix}>FCFA</Text>
                </View>
              </View>
            </View>

            {/* Hint K / M */}
            <Text style={styles.budgetHint}>
              Saisissez ex: 500K · 2.5M · 100000000
            </Text>

            {/* Slider visuel */}
            <View style={styles.sliderWrap}>
              <Text style={[styles.priceLabel, isPriceDefault && styles.priceLabelDefault]}>
                {budgetLabel}
              </Text>
              <Slider
                value={priceRange}
                minimumValue={PRICE_MIN}
                maximumValue={PRICE_MAX}
                step={PRICE_STEP}
                onValueChange={(vals) => {
                  setPriceRange(vals);
                  setMinInput(vals[0] === 0 ? '' : formatPriceShort(vals[0]));
                  setMaxInput(vals[1] >= PRICE_MAX ? '' : formatPriceShort(vals[1]));
                }}
                minimumTrackTintColor={c.gold}
                maximumTrackTintColor={c.border}
                thumbTintColor={c.gold}
                accessibilityLabel="Budget"
              />
              <View style={styles.sliderBounds}>
                <Text style={styles.boundText}>0</Text>
                <Text style={styles.boundText}>500M</Text>
              </View>
            </View>

            {/* Espace bas pour ne pas coller au CTA */}
            <View style={{ height: spacing.xl }} />
          </ScrollView>

          {/* CTA fixe en bas */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cta}
              onPress={handleSearch}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={activeCount > 0 ? `Appliquer ${activeCount} filtre${activeCount > 1 ? 's' : ''}` : 'Voir tous les biens'}
            >
              <Text style={styles.ctaText}>
                {activeCount > 0
                  ? `Appliquer ${activeCount} filtre${activeCount > 1 ? 's' : ''}`
                  : 'Voir tous les biens'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  // ─── Modal ───
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  resetBtn: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.gold,
  },

  // ─── Corps ───
  body: {
    paddingHorizontal: spacing.lg,
  },

  // ─── Label section ───
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 1.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // ─── Chips transaction ───
  rowChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.text,
  },
  chipTextActive: {
    color: '#0A0A0A',
    fontFamily: fonts.bodyBold,
  },

  // ─── Dropdown ───
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
  },
  dropdownOpen: {
    borderColor: c.gold,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownDisabled: {
    opacity: 0.35,
  },
  dropdownText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
  },
  dropdownTextDisabled: {
    color: c.textMuted,
  },
  dropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.gold,
    borderBottomLeftRadius: radius.xs,
    borderBottomRightRadius: radius.xs,
    backgroundColor: c.bgCard,
    maxHeight: 260,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  dropdownItemActive: {
    backgroundColor: `${c.gold}15`,
  },
  dropdownItemText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
    flex: 1,
  },
  dropdownItemTextActive: {
    color: c.gold,
    fontFamily: fonts.bodyBold,
  },

  // ─── Budget — presets ───
  presetRow: {
    gap: 8,
    paddingVertical: 2,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
  },
  presetChipActive: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  presetChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: c.text,
  },
  presetChipTextActive: {
    color: '#0A0A0A',
    fontFamily: fonts.bodyBold,
  },

  // ─── Budget — inputs min/max ───
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: spacing.md,
  },
  budgetInputGroup: {
    flex: 1,
  },
  budgetInputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  budgetInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.xs,
    backgroundColor: c.bgCard,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  budgetInputBoxActive: {
    borderColor: c.gold,
  },
  budgetInputField: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    padding: 0,
  },
  budgetInputSuffix: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: c.textMuted,
    marginLeft: 4,
  },
  budgetSepWrap: {
    paddingBottom: 14,
    alignItems: 'center',
    width: 16,
  },
  budgetSepLine: {
    width: 10,
    height: 1.5,
    backgroundColor: c.border,
  },
  budgetHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: c.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // ─── Slider prix ───
  sliderWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  priceLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  priceLabelDefault: {
    color: c.textMuted,
    fontFamily: fonts.body,
  },
  sliderBounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
  },
  boundText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },

  // ─── Footer CTA ───
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  cta: {
    backgroundColor: c.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
  },
});
