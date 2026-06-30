import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView,
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
  { value: 'vente',    label: 'Vente' },
  { value: 'location', label: 'Location' },
  { value: 'tous',     label: 'Tous' },
];

const TYPES_BIEN = PROPERTY_TYPES_WITH_ALL.map(t => t.value);

export const PRICE_MIN  = 0;
export const PRICE_MAX  = 500_000_000;
const PRICE_STEP = 5_000_000;

const DEFAULT_FILTERS = {
  transaction:    'tous',
  typeBien:       'tous',
  priceRange:     [PRICE_MIN, PRICE_MAX],
  ville:          'Toutes',
  arrondissement: 'Tous',
};

function formatPriceShort(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.0', '')}Md`;
  if (n >= 1_000_000)     return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}k`;
  return n === 0 ? '0' : String(n);
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
        <View style={styles.dropdownList}>
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
        </View>
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

  // Un seul dropdown ouvert à la fois
  const [openDropdown, setOpenDropdown] = useState(null);

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

  const priceLabel = `${formatPriceShort(minPrice)} — ${formatPriceShort(maxPrice)} FCFA`;
  const isPriceDefault = minPrice === PRICE_MIN && maxPrice === PRICE_MAX;

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
            <View style={styles.priceRow}>
              <Text style={[styles.priceText, isPriceDefault && styles.priceTextDefault]}>
                {isPriceDefault ? 'Tous les budgets' : priceLabel}
              </Text>
              {!isPriceDefault && (
                <TouchableOpacity
                  onPress={() => setPriceRange([PRICE_MIN, PRICE_MAX])}
                  hitSlop={8}
                  accessibilityLabel="Réinitialiser le budget"
                >
                  <Ionicons name="close-circle" size={16} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.sliderWrap}>
              <Slider
                value={priceRange}
                minimumValue={PRICE_MIN}
                maximumValue={PRICE_MAX}
                step={PRICE_STEP}
                onValueChange={setPriceRange}
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
    maxHeight: '88%',
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
    overflow: 'hidden',
    maxHeight: 200,
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

  // ─── Slider prix ───
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.text,
  },
  priceTextDefault: {
    color: c.textMuted,
    fontFamily: fonts.body,
  },
  sliderWrap: {
    paddingHorizontal: spacing.xs,
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
