// ALTIMMO-AI-01 → AI-INTEGRATION-02 — assistant de recherche Altimmo (mobile, connexion facultative).
// Mise en page, styles, cartes et comparaison repris d'AI-01, branchés sur le moteur IA-03
// (POST /api/altimmo/assistant/search et /compare) via utils/assistantViewModel.js, identique au web.
// Sans état serveur : aucune conversation n'est conservée. L'écran ne propose la recherche que si le
// serveur confirme l'activation ; un 503 en cours d'usage bascule sur l'état indisponible.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { PageHeader } from '../../components';
import { compareWithAssistant, getAssistantStatus, searchWithAssistant } from '../../services/altimmoAssistantService';
import { classifyAssistantError, toComparisonView, toSearchView } from '../../utils/assistantViewModel';
import { pickAssistantFilters } from '../../utils/assistantFilters';
import { resolveMobileDestination } from '../../navigation/navigationSdk';
import { PROPERTY_TYPES, OFFER_TYPES } from '../../constants/propertyTypes';
import { ACCOMMODATION_TYPES } from '../../constants/accommodation';
import { VILLES, getArrondissementsFor } from '../../constants/locations';

const ALTITUDE_VISION_WHATSAPP = '242068002151';
const MAX_COMPARE = 5;
const MAX_TEXT = 400;
const ENGINE_DISTRICT_CITIES = ['Brazzaville', 'Pointe-Noire'];
const EMPTY_FILTERS = Object.freeze({ offerType: '', propertyType: '', accommodationType: '', city: '', arrondissement: '', minPrice: '', maxPrice: '', minBedrooms: '' });
const CATEGORY_LABELS = { classic: null, furnished: 'Logement meublé', hotel: 'Hôtel', lodging: 'Hébergement' };
const digits = (value, max) => String(value || '').replace(/\D/g, '').slice(0, max);

function initialFormFilters(params) {
  const out = { ...EMPTY_FILTERS, ...pickAssistantFilters(params) };
  if (out.arrondissement && !ENGINE_DISTRICT_CITIES.some((city) => getArrondissementsFor(city).includes(out.arrondissement))) out.arrondissement = '';
  if (out.offerType === 'tous') out.offerType = '';
  return Object.fromEntries(Object.entries(out).filter(([key]) => key in EMPTY_FILTERS));
}

function Choice({ label, selected, onPress, styles, testID }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected) }} accessibilityLabel={label} testID={testID}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Lines({ title, items, marker, styles, tone }) {
  if (!items.length) return null;
  return (
    <View>
      <Text style={styles.sectionLabel}>{title}</Text>
      {items.map((item) => <Text key={item} style={tone}>{marker} {item}</Text>)}
    </View>
  );
}

function ResultCard({ card, selected, onCompare, onOpen, styles }) {
  const advisor = () => Linking.openURL(`https://wa.me/${ALTITUDE_VISION_WHATSAPP}?text=${encodeURIComponent(`Bonjour Altitude Vision, je souhaite être accompagné(e) pour le bien « ${card.title} » trouvé avec l'assistant Altimmo.`)}`);
  const category = CATEGORY_LABELS[card.category];
  return (
    <View style={styles.card} accessibilityLabel={card.title} testID={`assistant-result-${card.id}`}>
      <Text style={styles.cardType}>{[card.offerLabel, card.typeLabel].filter(Boolean).join(' · ')}</Text>
      {category ? <Text style={styles.badge}>{category}</Text> : null}
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardPrice}>{card.price ? `${card.price.label} : ${card.price.value}` : 'Prix non renseigné sur l’annonce'}</Text>
      {card.honoraires ? <Text style={styles.cardMeta}>{card.honoraires.label} : {card.honoraires.value}</Text> : null}
      {card.location ? <Text style={styles.cardMeta}>{card.location}</Text> : null}
      {card.features.length ? <Text style={styles.cardMeta}>{card.features.join(' · ')}</Text> : null}
      {card.summary ? <Text style={styles.con}>{card.summary}</Text> : null}
      <Lines title="Critères satisfaits" items={card.satisfied} marker="✓" styles={styles} tone={styles.pro} />
      <Lines title="Critères non satisfaits" items={card.unmet} marker="✗" styles={styles} tone={styles.con} />
      <Lines title="À vérifier" items={card.toVerify} marker="?" styles={styles} tone={styles.con} />
      <Lines title="Points de comparaison" items={card.tradeoffs} marker="•" styles={styles} tone={styles.con} />
      {card.isLodging ? <Text style={styles.disclaimer}>Disponibilités aux dates souhaitées confirmées uniquement lors de la réservation.</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={() => onOpen(card)} style={styles.primary} accessibilityRole="button" accessibilityLabel={`Voir la fiche ${card.title}`}><Text style={styles.primaryText}>Voir la fiche</Text></Pressable>
        <Pressable onPress={() => onOpen(card)} style={styles.secondary} accessibilityRole="button" accessibilityLabel={card.isLodging ? 'Vérifier les dates et réserver' : 'Demander une visite'}>
          <Text style={styles.secondaryText}>{card.isLodging ? 'Vérifier les dates' : 'Demander une visite'}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable onPress={advisor} accessibilityRole="button" accessibilityLabel="Parler à un conseiller"><Text style={styles.link}>Parler à un conseiller</Text></Pressable>
        {onCompare ? <Choice label="Comparer" selected={selected} onPress={() => onCompare(card.id)} styles={styles} testID={`compare-${card.id}`} /> : null}
      </View>
    </View>
  );
}

function Notice({ title, lines = [], styles, testID }) {
  return (
    <View style={styles.noticeBox} accessibilityRole="summary" testID={testID}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {lines.map((line) => <Text key={line} style={styles.con}>{line}</Text>)}
    </View>
  );
}

export default function AssistantScreen({ navigation, route }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [enabled, setEnabled] = useState(null);
  const [filters, setFilters] = useState(() => initialFormFilters(route?.params?.filters));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const lastRequest = useRef(null);
  const sequence = useRef(0);
  const busyRef = useRef(false);
  const autoStarted = useRef(false);

  const lodging = filters.offerType === 'hebergement';
  const districts = ENGINE_DISTRICT_CITIES.includes(filters.city) ? getArrondissementsFor(filters.city) : [];
  const setFilter = (key, value) => setFilters((current) => {
    const next = { ...current, [key]: current[key] === value && ['offerType', 'propertyType', 'accommodationType', 'city', 'arrondissement'].includes(key) ? '' : value };
    if (key === 'city') next.arrondissement = '';
    if (key === 'offerType') { next.propertyType = ''; next.accommodationType = ''; }
    return next;
  });

  const handleError = useCallback((caught) => {
    const classified = classifyAssistantError(caught);
    if (classified.kind === 'disabled') setEnabled(false);
    setError(classified);
  }, []);

  const runSearch = useCallback(async (request) => {
    // Une seule requête à la fois ; une réponse tardive d'une recherche antérieure est ignorée.
    if (busyRef.current) return;
    busyRef.current = true;
    const id = sequence.current + 1;
    sequence.current = id;
    setBusy(true); setError(null); setComparison(null); setCompareIds([]);
    try {
      const envelope = await searchWithAssistant(request);
      if (sequence.current !== id) return;
      lastRequest.current = request;
      setView(toSearchView(envelope));
    } catch (caught) {
      if (sequence.current === id) handleError(caught);
    } finally {
      busyRef.current = false;
      if (sequence.current === id) setBusy(false);
    }
  }, [handleError]);

  useEffect(() => {
    let active = true;
    getAssistantStatus().then((value) => { if (active) setEnabled(value); }).catch(() => {}); // getAssistantStatus ne rejette pas : garde de forme
    return () => { active = false; };
  }, []);

  // « Affiner avec l'assistant » : recherche lancée une fois avec les filtres repris de la liste.
  useEffect(() => {
    if (enabled !== true || autoStarted.current) return;
    autoStarted.current = true;
    const preset = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    if (Object.keys(preset).length) runSearch({ filters: preset });
  }, [enabled, filters, runSearch]);

  const submit = () => {
    const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const query = text.trim();
    if (!query && !Object.keys(active).length) {
      setError({ kind: 'incomplete', message: 'Décrivez votre recherche ou choisissez au moins un critère.' });
      return;
    }
    runSearch({ query: query || undefined, filters: active });
  };

  const onCompare = async () => {
    if (busyRef.current || compareIds.length < 2) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      setComparison(toComparisonView(await compareWithAssistant({ propertyIds: compareIds, query: lastRequest.current?.query })));
    } catch (caught) {
      handleError(caught);
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  const openListing = useCallback((card) => {
    if (card.hotelId) {
      const target = resolveMobileDestination('HOTEL_DETAIL', { hotelId: card.hotelId });
      if (target) { navigation.navigate(target.screen, target.params); return; }
    }
    navigation.navigate('DetailAnnonce', { resourceType: 'property', resourceId: card.id });
  }, [navigation]);

  const toggleCompare = (id) => setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX_COMPARE)));
  const reset = () => { setFilters({ ...EMPTY_FILTERS }); setText(''); setView(null); setComparison(null); setCompareIds([]); setError(null); };

  const header = <PageHeader title="Trouver mon bien" subtitle="Assistant Altimmo" onBack={() => navigation.goBack()} />;

  if (enabled !== true) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.content}>
          {enabled === null
            ? <ActivityIndicator color={c.gold} accessibilityLabel="Chargement de l’assistant" />
            : (
              <Notice styles={styles} testID="assistant-disabled" title="L’assistant de recherche n’est pas encore disponible."
                lines={['Vous pouvez consulter toutes les annonces publiées et utiliser les filtres de recherche.']} />
            )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.questionBox} accessibilityLabel="Critères de recherche">
            <Text style={styles.sectionLabel}>Projet</Text>
            <View style={styles.wrap}>
              {OFFER_TYPES.filter((option) => option.value !== 'tous').map((option) => (
                <Choice key={option.value} label={option.label} selected={filters.offerType === option.value} onPress={() => setFilter('offerType', option.value)} styles={styles} testID={`offer-${option.value}`} />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Type de bien</Text>
            <View style={styles.wrap}>
              {(lodging ? ACCOMMODATION_TYPES : PROPERTY_TYPES).map((option) => {
                const key = lodging ? 'accommodationType' : 'propertyType';
                return <Choice key={option.value} label={option.label} selected={filters[key] === option.value} onPress={() => setFilter(key, option.value)} styles={styles} />;
              })}
            </View>
            <Text style={styles.sectionLabel}>Ville</Text>
            <View style={styles.wrap}>
              {VILLES.map((city) => <Choice key={city} label={city} selected={filters.city === city} onPress={() => setFilter('city', city)} styles={styles} />)}
            </View>
            {districts.length ? (
              <>
                <Text style={styles.sectionLabel}>Arrondissement</Text>
                <View style={styles.wrap}>
                  {districts.map((district) => <Choice key={district} label={district} selected={filters.arrondissement === district} onPress={() => setFilter('arrondissement', district)} styles={styles} />)}
                </View>
              </>
            ) : null}
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Budget min. (FCFA)</Text>
                <TextInput style={styles.input} value={filters.minPrice} onChangeText={(v) => setFilter('minPrice', digits(v, 12))} keyboardType="number-pad" accessibilityLabel="Budget minimum en FCFA" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Budget max. (FCFA)</Text>
                <TextInput style={styles.input} value={filters.maxPrice} onChangeText={(v) => setFilter('maxPrice', digits(v, 12))} keyboardType="number-pad" accessibilityLabel="Budget maximum en FCFA" />
              </View>
              {!lodging ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Chambres min.</Text>
                  <TextInput style={styles.input} value={filters.minBedrooms} onChangeText={(v) => setFilter('minBedrooms', digits(v, 2))} keyboardType="number-pad" accessibilityLabel="Nombre minimum de chambres" />
                </View>
              ) : null}
            </View>
            <View style={styles.row}>
              <Pressable onPress={submit} disabled={busy} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Rechercher" testID="assistant-search"><Text style={styles.primaryText}>Rechercher</Text></Pressable>
              <Pressable onPress={reset} disabled={busy} accessibilityRole="button" accessibilityLabel="Effacer les critères"><Text style={styles.link}>Effacer les critères</Text></Pressable>
            </View>
          </View>

          {busy ? <ActivityIndicator color={c.gold} accessibilityLabel="L’assistant recherche" /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error} testID={`assistant-error-${error.kind}`}>{error.message}</Text> : null}

          {view ? (
            <View style={styles.flexGap} testID={`assistant-view-${view.kind}`}>
              {view.criteria.length ? (
                <View style={styles.wrap} accessibilityLabel="Critères compris">
                  {view.criteria.map((chip) => (
                    <Text key={chip.key} style={[styles.criteriaChip, !chip.verifiable && styles.criteriaUnverified]}>{chip.label}{chip.verifiable ? '' : ' (non vérifiable)'}</Text>
                  ))}
                </View>
              ) : null}
              {view.kind === 'incomplete' ? <Notice styles={styles} title="Critères incomplets" lines={view.questions} /> : null}
              {view.kind === 'invalid' ? <Notice styles={styles} title="Votre demande n’a pas pu être traitée." lines={['Vérifiez les critères saisis.']} /> : null}
              {view.unverifiable.length ? <Notice styles={styles} title="Données non vérifiables" lines={view.unverifiable} /> : null}
              {view.kind === 'empty' || view.noExactMatch ? (
                <Notice styles={styles} title="Aucune annonce ne correspond exactement à tous vos critères."
                  lines={[view.toVerify.length ? 'Les biens ci-dessous peuvent convenir, mais certaines informations restent à vérifier.' : 'Modifiez ou retirez un critère pour élargir la recherche.']} />
              ) : null}
              {view.warnings.map((message) => <Text key={message} style={styles.disclaimer}>{message}</Text>)}
              {view.results.length ? <Text style={styles.disclaimer}>{view.orderLabel}</Text> : null}
              {view.results.map((card) => <ResultCard key={card.id} card={card} styles={styles} onOpen={openListing} selected={compareIds.includes(card.id)} onCompare={toggleCompare} />)}
              {view.toVerify.length ? <Text style={styles.cardTitle}>Biens dont certaines informations sont à vérifier</Text> : null}
              {view.toVerify.map((card) => <ResultCard key={card.id} card={card} styles={styles} onOpen={openListing} selected={compareIds.includes(card.id)} onCompare={toggleCompare} />)}
              {compareIds.length >= 2 ? (
                <Pressable onPress={onCompare} disabled={busy} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel={`Comparer les ${compareIds.length} biens sélectionnés`}>
                  <Text style={styles.primaryText}>Comparer les {compareIds.length} biens</Text>
                </Pressable>
              ) : null}
              {view.nextPageToken ? (
                <Pressable onPress={() => runSearch({ ...lastRequest.current, pageToken: view.nextPageToken })} disabled={busy} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Page suivante"><Text style={styles.secondaryText}>Page suivante</Text></Pressable>
              ) : null}
              {view.notices.map((message) => <Text key={message} style={styles.notice}>{message}</Text>)}
            </View>
          ) : null}

          {comparison && comparison.kind !== 'compared' ? <Notice styles={styles} testID="assistant-comparison" lines={[comparison.message]} /> : null}
          {comparison && comparison.kind === 'compared' ? (
            <View style={styles.flexGap} testID="assistant-comparison">
              <ScrollView horizontal contentContainerStyle={styles.table}>
                <View>
                  <View style={styles.tableRow}><Text style={[styles.cellHead, styles.cellLabel]}>Critère</Text>{comparison.columns.map((column) => <Text key={column.id} style={styles.cellHead}>{column.title}</Text>)}</View>
                  {comparison.rows.map((row) => (
                    <View key={row.key} style={styles.tableRow}><Text style={[styles.cell, styles.cellLabel]}>{row.label}</Text>{row.values.map((value, index) => <Text key={comparison.columns[index]?.id || index} style={styles.cell}>{value}</Text>)}</View>
                  ))}
                </View>
              </ScrollView>
              {comparison.columns.map((column) => (
                <View key={column.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{column.title}</Text>
                  {column.summary ? <Text style={styles.con}>{column.summary}</Text> : null}
                  <Lines title="Avantages" items={column.advantages} marker="✓" styles={styles} tone={styles.pro} />
                  <Lines title="Limites" items={column.disadvantages} marker="✗" styles={styles} tone={styles.con} />
                  <Lines title="Non vérifié" items={column.unknowns} marker="?" styles={styles} tone={styles.con} />
                  <Pressable onPress={() => openListing({ id: column.id })} accessibilityRole="button" accessibilityLabel={`Voir la fiche ${column.title}`}><Text style={styles.link}>Voir la fiche</Text></Pressable>
                </View>
              ))}
              {comparison.tradeoffSummary ? <Text style={styles.con}>{comparison.tradeoffSummary}</Text> : null}
              {comparison.conclusion ? <Text style={styles.notice}>{comparison.conclusion}</Text> : null}
              {comparison.unavailableCount ? <Text style={styles.disclaimer}>{comparison.unavailableCount} bien(s) sélectionné(s) ne sont plus publiés et ont été écartés.</Text> : null}
            </View>
          ) : null}
          <Text style={styles.disclaimer}>Les informations proviennent des annonces publiées. La proximité des services n’est pas encore vérifiée par l’assistant.</Text>
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput style={[styles.input, styles.flex]} value={text} onChangeText={setText} maxLength={MAX_TEXT} placeholder="Ex. : maison 3 chambres à Bacongo avec parking"
            accessibilityLabel="Décrivez votre recherche" onSubmitEditing={submit} returnKeyType="search" />
          <Pressable onPress={submit} disabled={busy} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Envoyer"><Text style={styles.primaryText}>Envoyer</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  flexGap: { gap: spacing.sm },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipActive: { backgroundColor: c.gold, borderColor: c.gold },
  chipText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  chipTextActive: { color: '#FFFFFF', fontFamily: fonts.bodyBold },
  criteriaChip: { borderWidth: 1, borderColor: c.gold, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12, fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.text },
  criteriaUnverified: { borderStyle: 'dashed', color: c.textMuted },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs },
  questionBox: { backgroundColor: c.bgCardAlt || c.bgCard, borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs },
  noticeBox: { backgroundColor: c.goldLight || c.bgCard, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  field: { flexGrow: 1, minWidth: 100 },
  fieldLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginBottom: 2 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.bgCard, color: c.text, fontFamily: fonts.body, minHeight: 44 },
  primary: { backgroundColor: c.gold, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  secondary: { borderWidth: 1, borderColor: c.gold, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  secondaryText: { color: c.text, fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  disabled: { opacity: 0.5 },
  link: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text, textDecorationLine: 'underline', paddingVertical: 10 },
  card: { backgroundColor: c.bgCard, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  badge: { alignSelf: 'flex-start', fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.text, backgroundColor: c.goldLight || c.bgCardAlt || c.bgCard, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2 },
  cardType: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, textTransform: 'uppercase' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  cardPrice: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.gold },
  cardMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  pro: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.success || c.text },
  con: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  notice: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, backgroundColor: c.goldLight || c.bgCard, padding: spacing.sm, borderRadius: radius.xs },
  error: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.error },
  table: { paddingVertical: spacing.xs },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border },
  cellHead: { width: 150, padding: 8, fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text },
  cell: { width: 150, padding: 8, fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  cellLabel: { width: 130, color: c.textMuted },
  inputBar: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.bg },
  disclaimer: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.sm },
});
