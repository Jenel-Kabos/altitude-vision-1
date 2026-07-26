import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

const TOPICS = [
  { id: 'achat',    icon: 'home-outline',              label: 'Acheter un bien',             msg: "Bonjour, je souhaite acheter un bien immobilier. Pouvez-vous m'aider ?" },
  { id: 'location', icon: 'key-outline',               label: 'Louer un bien',               msg: "Bonjour, je recherche un bien à louer. Quelles sont vos disponibilités ?" },
  { id: 'vente',    icon: 'pricetag-outline',           label: 'Vendre / mettre en location', msg: "Bonjour, je souhaite mettre un bien en vente ou en location avec votre agence." },
  { id: 'visite',   icon: 'calendar-outline',           label: 'Planifier une visite',        msg: "Bonjour, j'aimerais planifier une visite pour un bien qui m'intéresse." },
  { id: 'info',     icon: 'information-circle-outline', label: 'Renseignements généraux',     msg: "Bonjour, j'ai une question générale concernant vos services immobiliers." },
  { id: 'autre',    icon: 'chatbubble-outline',         label: 'Autre demande',               msg: "Bonjour, j'aimerais entrer en contact avec votre équipe." },
];

export default function ChatbotScreen({ navigation }) {
  const { user }           = useAuth();
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customMsg,     setCustomMsg]     = useState('');
  const [loading,       setLoading]       = useState(false);

  const demarrerConversation = useCallback(async () => {
    if (!user) { navigation.navigate('Login'); return; }
    if (!selectedTopic) {
      Alert.alert('Sujet requis', 'Veuillez sélectionner un sujet pour démarrer la conversation.');
      return;
    }

    setLoading(true);
    try {
      const message = customMsg.trim()
        ? `${selectedTopic.msg}\n\n${customMsg.trim()}`
        : selectedTopic.msg;

      const res = await api.post('/conversations/start', { message });
      const conversation = res.data?.data?.conversation;

      if (!conversation) throw new Error('Conversation non créée');

      navigation.replace('Chat', {
        conversation,
        contact: { _id: null, name: 'Équipe Altitude Vision', photo: null },
      });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de démarrer la conversation.');
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, customMsg, user, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacter l'agence</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Hero ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatarWrap}>
            <View style={styles.heroAvatarOuter}>
              <View style={styles.heroAvatarInner}>
                <Ionicons name="business" size={28} color={c.gold} />
              </View>
            </View>
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.heroName}>Altitude Vision</Text>
          <Text style={styles.heroRole}>Équipe commerciale</Text>

          <View style={styles.heroBadge}>
            <Ionicons name="time-outline" size={12} color="#059669" />
            <Text style={styles.heroBadgeText}>Répond généralement en moins d'1h</Text>
          </View>

          <View style={styles.heroHours}>
            <Ionicons name="calendar-outline" size={13} color={c.textMuted} />
            <Text style={styles.heroHoursText}>Lun – Sam · 8h00 – 18h00</Text>
          </View>
        </View>

        {/* ─── Sujets ─── */}
        <Text style={styles.sectionLabel}>Quel est le sujet de votre demande ?</Text>

        <View style={styles.topicsGrid}>
          {TOPICS.map((t) => {
            const selected = selectedTopic?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.topicCard, selected && styles.topicCardSelected]}
                onPress={() => setSelectedTopic(t)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.topicIcon, selected && styles.topicIconSelected]}>
                  <Ionicons name={t.icon} size={20} color={selected ? c.onAccent : c.gold} />
                </View>
                <Text style={[styles.topicLabel, selected && styles.topicLabelSelected]}>
                  {t.label}
                </Text>
                {selected && (
                  <View style={styles.topicCheck}>
                    <Ionicons name="checkmark" size={12} color={c.onAccent} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Message personnalisé ─── */}
        {selectedTopic && (
          <View style={styles.customSection}>
            <Text style={styles.sectionLabel}>Précisez votre demande (optionnel)</Text>
            <TextInput
              style={styles.customInput}
              placeholder="Décrivez votre projet, vos critères, vos questions…"
              placeholderTextColor={c.placeholder}
              cursorColor={c.gold}
              selectionColor={c.borderGold}
              value={customMsg}
              onChangeText={setCustomMsg}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{customMsg.length}/500</Text>
          </View>
        )}

        {/* ─── CTA ─── */}
        <TouchableOpacity
          style={[styles.ctaBtn, (!selectedTopic || loading) && styles.ctaBtnDisabled]}
          onPress={demarrerConversation}
          disabled={!selectedTopic || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color={c.onAccent} />
            : <Ionicons name="chatbubbles-outline" size={18} color={c.onAccent} />
          }
          <Text style={styles.ctaBtnText}>
            {loading ? 'Connexion…' : 'Démarrer la conversation'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Votre message sera transmis à notre équipe. Un collaborateur vous répondra dans les meilleurs délais.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
  },

  scroll: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  heroCard: {
    backgroundColor: c.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.lg,
    marginBottom: 28,
  },
  heroAvatarWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  heroAvatarOuter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: c.goldMuted,
    borderWidth: 2, borderColor: c.borderGold,
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#16A34A',
    borderWidth: 2.5, borderColor: c.bgCard,
  },
  heroName: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: c.text,
    marginBottom: 2,
  },
  heroRole: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5,150,105,0.10)',
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#059669',
  },
  heroHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroHoursText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: c.textMuted,
  },

  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },

  topicsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  topicCardSelected: {
    backgroundColor: c.gold,
    borderColor: c.gold,
  },
  topicIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: c.goldMuted,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  topicIconSelected: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  topicLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: c.text,
    flex: 1,
  },
  topicLabelSelected: {
    fontFamily: fonts.bodyBold,
    color: c.onAccent,
  },
  topicCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  customSection: {
    marginBottom: spacing.lg,
  },
  customInput: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: c.text,
    height: 110,
  },
  charCount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: c.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.gold,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: spacing.md,
  },
  ctaBtnDisabled: { opacity: 0.45 },
  ctaBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: c.onAccent,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
