/* global AbortController */
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel Altimmo (mobile, comptes internes autorisés).
// Dialogue en flux (XMLHttpRequest), critères actifs tenus par le serveur, cartes d'annonces publiques,
// comparaison IA-03, annulation, réinitialisation. Reprise : l'identifiant de conversation est conservé
// localement et la mémoire validée relue côté serveur au retour au premier plan (interruption de l'app).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { PageHeader } from '../../components';
import {
  cancelAdvisorTurn, classifyAdvisorError, getAdvisorConversation, resetAdvisorConversation, sendAdvisorTurn,
} from '../../services/altimmoAdvisorService';
import { advisorModeLabel, comparisonEnvelope, replacesCards, toAdvisorCards, turnOriginLabel } from '../../utils/advisorViewModel';
import { toComparisonView } from '../../utils/assistantViewModel';
import { resolveMobileDestination } from '../../navigation/navigationSdk';

const ALTITUDE_VISION_WHATSAPP = '242068002151';
const STORAGE_KEY = 'altimmo.advisor.conversation';
const MAX_TEXT = 1000;
const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function Lines({ title, items, marker, styles }) {
  if (!items.length) return null;
  return (
    <View>
      <Text style={styles.sectionLabel}>{title}</Text>
      {items.map((item) => <Text key={item} style={styles.con}>{marker} {item}</Text>)}
    </View>
  );
}

function AdvisorCard({ card, selected, onCompare, onOpen, styles }) {
  const advisor = () => Linking.openURL(`https://wa.me/${ALTITUDE_VISION_WHATSAPP}?text=${encodeURIComponent(`Bonjour Altitude Vision, je souhaite être accompagné(e) pour le bien « ${card.title} » trouvé avec le conseiller Altimmo.`)}`);
  return (
    <View style={styles.card} accessibilityLabel={card.title} testID={`advisor-card-${card.id}`}>
      <Text style={styles.cardType}>{[card.offerLabel, card.typeLabel].filter(Boolean).join(' · ')}</Text>
      {card.isLodging ? <Text style={styles.badge}>Hébergement annoncé</Text> : null}
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardPrice}>{card.price ? `${card.price.label} : ${card.price.value}` : 'Prix non renseigné sur l’annonce'}</Text>
      {card.location ? <Text style={styles.cardMeta}>{card.location}</Text> : null}
      {card.features.length ? <Text style={styles.cardMeta}>{card.features.join(' · ')}</Text> : null}
      <Lines title="Atouts" items={card.strengths} marker="✓" styles={styles} />
      <Lines title="Limites" items={card.limits} marker="✗" styles={styles} />
      <Lines title="À vérifier" items={card.toVerify} marker="?" styles={styles} />
      {card.isLodging ? <Text style={styles.disclaimer}>Disponibilités aux dates souhaitées non vérifiées par le conseiller : elles sont confirmées uniquement lors de la réservation.</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={() => onOpen(card)} style={styles.primary} accessibilityRole="button" accessibilityLabel={`Voir la fiche ${card.title}`}><Text style={styles.primaryText}>Voir la fiche</Text></Pressable>
        <Pressable onPress={advisor} accessibilityRole="button" accessibilityLabel="Parler à un conseiller"><Text style={styles.link}>Parler à un conseiller</Text></Pressable>
        <Pressable onPress={() => onCompare(card.id)} style={[styles.chip, selected && styles.chipActive]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Comparer ${card.title}`}>
          <Text style={[styles.chipText, selected && styles.chipTextActive]}>Comparer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdvisorScreen({ navigation, status, onUseClassic }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [criteria, setCriteria] = useState('');
  const [cards, setCards] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [selected, setSelected] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(null);
  const [error, setError] = useState(null);
  const turn = useRef(null);

  const restore = useCallback(async (id) => {
    try {
      const data = await getAdvisorConversation(id);
      if (!data) return;
      setMessages((data.messages || []).map((m, index) => ({ id: `r${index}`, role: m.role, text: m.content })));
      setCriteria(data.criteria || '');
      setCards(toAdvisorCards(data));
    } catch { /* conversation expirée ou nouvelle */ }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let id = null;
      try { id = await AsyncStorage.getItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
      if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) { id = randomId(); try { await AsyncStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ } }
      if (!alive) return;
      setConversationId(id);
      await restore(id);
    })();
    return () => { alive = false; turn.current?.controller.abort(); };
  }, [restore]);

  // Retour au premier plan après une interruption : la mémoire validée par le serveur fait foi.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && conversationId && !turn.current) restore(conversationId); });
    return () => subscription?.remove?.();
  }, [conversationId, restore]);

  const openListing = useCallback((card) => {
    if (card.hotelId) {
      const target = resolveMobileDestination('HOTEL_DETAIL', { hotelId: card.hotelId });
      if (target) { navigation.navigate(target.screen, target.params); return; }
    }
    navigation.navigate('DetailAnnonce', { resourceType: 'property', resourceId: card.id });
  }, [navigation]);

  const send = async () => {
    const message = text.trim();
    if (!message || busy || !conversationId) return;
    const turnId = randomId();
    const controller = new AbortController();
    turn.current = { turnId, controller };
    const replyId = `a-${turnId}`;
    setMessages((current) => [...current, { id: `u-${turnId}`, role: 'user', text: message }, { id: replyId, role: 'assistant', text: '', pending: true }]);
    setText(''); setBusy(true); setError(null); setStep('Le conseiller réfléchit à votre demande');
    const patch = (value) => setMessages((current) => current.map((m) => (m.id === replyId ? { ...m, ...value } : m)));
    try {
      const result = await sendAdvisorTurn({
        conversationId, turnId, message, signal: controller.signal,
        onEvent: ({ event, data }) => {
          if (event === 'status') setStep(data.label);
          if (event === 'delta') setMessages((current) => current.map((m) => (m.id === replyId ? { ...m, text: m.text + data.text } : m)));
          if (event === 'facts' && data.cards) setCards(toAdvisorCards(data));
        },
      });
      patch({ text: result.reply, pending: false, origin: turnOriginLabel(result.metrics) });
      setCriteria(result.criteria || '');
      if (replacesCards(result)) setCards(toAdvisorCards(result));
      setComparison(result.comparison ? toComparisonView(comparisonEnvelope(result.comparison)) : null);
      setSelected([]);
    } catch (caught) {
      setMessages((current) => current.filter((m) => m.id !== replyId || m.text));
      patch({ pending: false, interrupted: true });
      setError(classifyAdvisorError(caught));
    } finally {
      turn.current = null; setBusy(false); setStep(null);
    }
  };

  const cancel = async () => {
    const current = turn.current;
    if (!current) return;
    await cancelAdvisorTurn(conversationId, current.turnId);
    current.controller.abort();
  };

  const reset = async () => {
    if (busy) await cancel();
    try { await resetAdvisorConversation(conversationId); } catch { /* conversation déjà expirée */ }
    const id = randomId();
    try { await AsyncStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ }
    setConversationId(id); setMessages([]); setCriteria(''); setCards([]); setComparison(null); setSelected([]); setError(null);
  };

  const toggleCompare = (id) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, 5)));
  const prepareComparison = () => {
    const ordinals = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'];
    const positions = selected.map((id) => cards.findIndex((card) => card.id === id) + 1).filter((n) => n > 0).sort((a, b) => a - b);
    setText(`Compare le ${positions.map((n) => ordinals[n - 1]).join(' et le ')}.`);
  };

  return (
    <SafeAreaView style={styles.safe} testID="advisor-screen">
      <PageHeader title="Conseiller immobilier" subtitle={`Accès interne · ${advisorModeLabel(status?.mode)}`} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.criteria} testID="advisor-criteria">Critères retenus : {criteria || 'aucun pour le moment'}</Text>
          {onUseClassic ? <Pressable onPress={onUseClassic} accessibilityRole="button" accessibilityLabel="Utiliser la recherche guidée"><Text style={styles.link}>Utiliser la recherche guidée</Text></Pressable> : null}
          {messages.length === 0 ? <Text style={styles.disclaimer}>Par exemple : « Je cherche une maison à louer à Brazzaville entre 100 000 et 250 000 FCFA. »</Text> : null}
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]} testID={`advisor-message-${m.role}`}>
              <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.text || (m.pending ? '…' : '')}</Text>
              {m.origin ? <Text style={styles.origin}>Réponse : {m.origin}</Text> : null}
              {m.interrupted ? <Text style={styles.origin}>Réponse interrompue</Text> : null}
            </View>
          ))}
          {step ? <View style={styles.row}><ActivityIndicator color={c.gold} /><Text style={styles.cardMeta} testID="advisor-step">{step}…</Text></View> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert" testID={`advisor-error-${error.kind}`}>{error.message}</Text> : null}
          {cards.map((card) => <AdvisorCard key={card.id} card={card} selected={selected.includes(card.id)} onCompare={toggleCompare} onOpen={openListing} styles={styles} />)}
          {selected.length >= 2 ? <Pressable onPress={prepareComparison} style={styles.primary} accessibilityRole="button" accessibilityLabel="Préparer la comparaison"><Text style={styles.primaryText}>Préparer la comparaison</Text></Pressable> : null}
          {comparison && comparison.kind === 'compared' ? (
            <View style={styles.flexGap} testID="advisor-comparison">
              {comparison.columns.map((column) => (
                <View key={column.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{column.title}</Text>
                  {column.summary ? <Text style={styles.con}>{column.summary}</Text> : null}
                  <Lines title="Avantages" items={column.advantages} marker="✓" styles={styles} />
                  <Lines title="Limites" items={column.disadvantages} marker="✗" styles={styles} />
                  <Lines title="Non vérifié" items={column.unknowns} marker="?" styles={styles} />
                </View>
              ))}
              {comparison.rows.map((row) => <Text key={row.key} style={styles.cardMeta}>{row.label} : {row.values.join(' / ')}</Text>)}
              {comparison.conclusion ? <Text style={styles.notice}>{comparison.conclusion}</Text> : null}
            </View>
          ) : null}
          {comparison && comparison.kind !== 'compared' ? <Text style={styles.notice}>{comparison.message}</Text> : null}
          <Text style={styles.disclaimer}>Réponses fondées sur les annonces publiées. Proximité et disponibilités non vérifiées. Aucune réservation, aucun paiement, aucune coordonnée transmise. N’indiquez aucune donnée personnelle.</Text>
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput style={[styles.input, styles.flex]} value={text} onChangeText={setText} maxLength={MAX_TEXT} placeholder="Votre message au conseiller" accessibilityLabel="Votre message" multiline />
          {busy
            ? <Pressable onPress={cancel} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Annuler"><Text style={styles.secondaryText}>Annuler</Text></Pressable>
            : <Pressable onPress={send} disabled={!text.trim()} style={[styles.primary, !text.trim() && styles.disabled]} accessibilityRole="button" accessibilityLabel="Envoyer"><Text style={styles.primaryText}>Envoyer</Text></Pressable>}
          <Pressable onPress={reset} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Nouvelle conversation"><Text style={styles.secondaryText}>Nouveau</Text></Pressable>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  criteria: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text, backgroundColor: c.bgCard, borderRadius: radius.sm, padding: spacing.sm },
  bubble: { maxWidth: '88%', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: c.gold },
  botBubble: { alignSelf: 'flex-start', backgroundColor: c.bgCard },
  userText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: '#FFFFFF' },
  botText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  origin: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipActive: { backgroundColor: c.gold, borderColor: c.gold },
  chipText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  chipTextActive: { color: '#FFFFFF', fontFamily: fonts.bodyBold },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.bgCard, color: c.text, fontFamily: fonts.body, minHeight: 44, maxHeight: 120 },
  primary: { backgroundColor: c.gold, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  secondary: { borderWidth: 1, borderColor: c.gold, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  secondaryText: { color: c.text, fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  disabled: { opacity: 0.5 },
  link: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.text, textDecorationLine: 'underline', paddingVertical: 10 },
  card: { backgroundColor: c.bgCard, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  badge: { alignSelf: 'flex-start', fontFamily: fonts.bodyMedium, fontSize: fontSize.xs, color: c.text, backgroundColor: c.goldLight || c.bgCardAlt || c.bgCard, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2 },
  cardType: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, textTransform: 'uppercase' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  cardPrice: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.gold },
  cardMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted },
  con: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text },
  notice: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, backgroundColor: c.goldLight || c.bgCard, padding: spacing.sm, borderRadius: radius.xs },
  error: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.error },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.bg },
  disclaimer: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.sm },
});
