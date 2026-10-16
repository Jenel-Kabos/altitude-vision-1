import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';
import { PageHeader, FormSwitch, Button } from '../../components';
import { getMarketingPreferences, updateMarketingPreferences } from '../../services/marketingPreferencesService';
import { MARKETING_CHANNELS, OPERATIONAL_NOTICE } from '../../constants/marketingConsent';

// MARKETING-CONSENT-1 — Préférences de communications promotionnelles.
// Chaque bascule est enregistrée immédiatement côté serveur (historisée) ;
// en cas d'échec, l'interrupteur revient à l'état confirmé par le serveur.
export default function MarketingPreferencesScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setPreferences(await getMarketingPreferences()); }
    catch { setError('Impossible de charger vos préférences. Vérifiez votre connexion puis réessayez.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (channel, granted) => {
    setSaving(channel);
    setError('');
    try { setPreferences(await updateMarketingPreferences({ [channel]: granted })); }
    catch { setError('Votre choix n’a pas pu être enregistré. Réessayez.'); }
    finally { setSaving(null); }
  }, []);

  const withdrawAll = useCallback(async () => {
    setSaving('all');
    setError('');
    try { setPreferences(await updateMarketingPreferences(Object.fromEntries(MARKETING_CHANNELS.map(({ key }) => [key, false])))); }
    catch { setError('Le retrait n’a pas pu être enregistré. Réessayez.'); }
    finally { setSaving(null); }
  }, []);

  const anyGranted = MARKETING_CHANNELS.some(({ key }) => preferences?.channels?.[key]?.granted);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageHeader title="Communications" subtitle="Offres et actualités" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choisissez si Altitude Vision peut vous adresser des offres et actualités. Ces choix sont facultatifs et modifiables à tout moment.
        </Text>
        {!preferences && !error ? <ActivityIndicator color={c.gold} accessibilityLabel="Chargement des préférences" /> : null}
        {preferences ? MARKETING_CHANNELS.map((channel) => (
          <View key={channel.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{channel.title}</Text>
              <Text style={styles.rowDesc}>{channel.description}</Text>
            </View>
            <FormSwitch
              value={preferences.channels?.[channel.key]?.granted === true}
              onValueChange={(next) => toggle(channel.key, next)}
              disabled={Boolean(saving)}
              accessibilityLabel={channel.title}
            />
          </View>
        )) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {error && !preferences ? <Button label="Réessayer" variant="outline" onPress={load} /> : null}
        {preferences && anyGranted ? (
          <Button label="Retirer tous mes consentements" variant="outline" onPress={withdrawAll} loading={saving === 'all'} disabled={Boolean(saving)} />
        ) : null}
        <Text style={styles.notice}>{OPERATIONAL_NOTICE}</Text>
        <Text style={styles.notice}>Chaque e-mail promotionnel contient aussi un lien de désinscription.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.md, gap: spacing.md },
  intro: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgCard, borderRadius: radius.sm, padding: spacing.sm },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.text },
  rowDesc: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  error: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.error },
  notice: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, lineHeight: 16 },
});
