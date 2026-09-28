import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTIONS = [
  {
    id: 'responsable',
    icon: 'shield-checkmark-outline',
    title: 'Responsable du traitement',
    content: [
      { type: 'text', value: 'Altitude-Vision — Société d\'expertise multidisciplinaire' },
      { type: 'contact', icon: 'location-outline', value: 'Brazzaville, République du Congo' },
      { type: 'contact', icon: 'mail-outline', value: 'support@altitudevision.agency', email: 'mailto:support@altitudevision.agency' },
      { type: 'contact', icon: 'call-outline', value: '+242 06 800 21 51', tel: 'tel:+24206800215' },
    ],
  },
  {
    id: 'collecte',
    icon: 'server-outline',
    title: 'Données collectées',
    content: [
      { type: 'text', value: 'Nous collectons uniquement les données nécessaires à nos services :' },
      { type: 'bullets', items: [
        'Données d\'identification : nom, prénom, email, téléphone',
        'Données de compte : identifiant, mot de passe chiffré, photo de profil',
        'Données de navigation : adresse IP, cookies analytiques',
        'Données de service : annonces, demandes de visite, transactions, documents',
      ]},
    ],
  },
  {
    id: 'finalites',
    icon: 'eye-outline',
    title: 'Finalités du traitement',
    content: [
      { type: 'text', value: 'Vos données sont utilisées pour :' },
      { type: 'bullets', items: [
        'Créer et gérer votre compte utilisateur',
        'Traiter vos demandes de visite et transactions immobilières',
        'Vous envoyer des notifications relatives à vos dossiers',
        'Améliorer nos services via des statistiques anonymisées',
        'Respecter nos obligations légales et contractuelles',
      ]},
    ],
  },
  {
    id: 'partage',
    icon: 'share-social-outline',
    title: 'Partage des données',
    content: [
      { type: 'text', value: 'Nous ne vendons jamais vos données. Elles peuvent être partagées avec :' },
      { type: 'bullets', items: [
        'Cloudinary (stockage des photos et documents)',
        'Render (hébergement serveur)',
        'Netlify (hébergement du site web)',
        'MongoDB Atlas (base de données)',
        'Expo Push et Expo Updates (notifications et mises à jour de l\'application)',
        'Sentry (rapports de crash mobile)',
        'Google Sign-In et Google Maps SDK (connexion et carte)',
        'Zoho Mail (emails transactionnels)',
        'Autorités compétentes sur réquisition judiciaire',
      ]},
      { type: 'text', value: 'Chaque prestataire ne reçoit que les données strictement nécessaires à sa fonction. Aucun transfert à des tiers à des fins commerciales sans votre consentement.' },
    ],
  },
  {
    id: 'application-mobile',
    icon: 'phone-portrait-outline',
    title: 'Traitements spécifiques à l\'application',
    content: [
      { type: 'text', value: 'L\'application Altimmo utilise certaines fonctions de votre appareil, uniquement lorsque nécessaire :' },
      { type: 'bullets', items: [
        'Notifications push : un identifiant Expo Push est enregistré côté serveur pour vous adresser des notifications ; supprimé à la déconnexion ou à la suppression du compte.',
        'Localisation : approximative pour recentrer la carte ; précise uniquement lorsque vous capturez les coordonnées GPS d\'un bien que vous publiez. Aucun suivi en arrière-plan.',
        'Photos et fichiers : appareil photo et galerie utilisés pour votre photo de profil, vos annonces et vos documents. Stockage via Cloudinary.',
        'Messagerie : les messages échangés dans la messagerie interne sont stockés sur nos serveurs pour permettre leur consultation par les participants.',
        'Rapports de crash : envoyés à Sentry pour corriger les erreurs de l\'application, peuvent contenir des métadonnées techniques sur l\'appareil.',
        'Mises à jour : Expo Updates fournit les mises à jour de l\'application.',
      ]},
    ],
  },
  {
    id: 'conservation',
    icon: 'time-outline',
    title: 'Durée de conservation',
    content: [
      { type: 'table', rows: [
        { label: 'Données de compte', value: 'Durée du compte' },
        { label: 'Transactions', value: '5 ans (légal)' },
        { label: 'Notifications lues', value: '90 jours' },
        { label: 'Logs de connexion', value: '12 mois' },
        { label: 'Cookies analytiques', value: '24 mois' },
      ]},
      { type: 'text', value: 'Après suppression du compte, vos données sont effacées sous 30 jours.' },
    ],
  },
  {
    id: 'droits',
    icon: 'person-circle-outline',
    title: 'Vos droits',
    content: [
      { type: 'text', value: 'Conformément à la réglementation, vous disposez de :' },
      { type: 'bullets', items: [
        'Droit d\'accès : obtenir une copie de vos données',
        'Droit de rectification : corriger des données inexactes',
        'Droit à l\'effacement : demander la suppression de vos données',
        'Droit d\'opposition : vous opposer à certains traitements',
        'Droit à la portabilité : récupérer vos données',
      ]},
      { type: 'contact', icon: 'mail-outline', value: 'support@altitudevision.agency', email: 'mailto:support@altitudevision.agency' },
    ],
  },
  {
    id: 'securite',
    icon: 'lock-closed-outline',
    title: 'Sécurité',
    content: [
      { type: 'text', value: 'Mesures de protection mises en place :' },
      { type: 'checks', items: [
        'Chiffrement des mots de passe (bcrypt)',
        'Authentification par jeton JWT à durée limitée',
        'Communications chiffrées HTTPS/TLS',
        'Accès aux données restreint aux personnels habilités',
        'Sauvegardes régulières et surveillance des accès',
      ]},
    ],
  },
  {
    id: 'cookies',
    icon: 'flash-outline',
    title: 'Cookies (site web)',
    content: [
      { type: 'text', value: 'Les cookies concernent uniquement le site web Altitude-Vision (pas l\'application mobile) :' },
      { type: 'bullets', items: [
        'Cookies essentiels : fonctionnement du site, session',
        'Cookies analytiques (Google Analytics) : mesure d\'audience, chargés avec votre consentement uniquement',
      ]},
      { type: 'text', value: 'Vous pouvez gérer vos préférences via la bannière de cookies ou votre navigateur.' },
    ],
  },
  {
    id: 'suppression',
    icon: 'trash-outline',
    title: 'Suppression de votre compte',
    content: [
      { type: 'text', value: 'Vous pouvez à tout moment demander la suppression de votre compte :' },
      { type: 'bullets', items: [
        'Depuis cette application : onglet Profil → section Zone sensible → « Supprimer mon compte » (double confirmation).',
        'Depuis le site web : page publique altitudevision.agency/supprimer-mon-compte.',
        'Par email : support@altitudevision.agency (une vérification d\'identité peut être demandée).',
      ]},
      { type: 'text', value: 'Effets de la suppression : votre nom, email, téléphone, photo de profil, biographie, identifiants d\'authentification et jeton push sont effacés ou remplacés par des valeurs anonymes ; toutes vos sessions actives sont invalidées.' },
      { type: 'text', value: 'Données conservées ou anonymisées : certaines données métier peuvent devoir être conservées ou anonymisées lorsque cela est nécessaire à l\'intégrité des transactions, obligations applicables ou litiges — notamment les documents financiers (transactions, contrats, factures, paiements) et les messages échangés (l\'auteur est alors anonymisé, le contenu reste visible aux autres participants).' },
      { type: 'text', value: 'Cas particulier : si vous êtes seul administrateur actif d\'une organisation sur la plateforme, la suppression est refusée. Transférez d\'abord l\'administration à un autre membre.' },
      { type: 'contact', icon: 'mail-outline', value: 'support@altitudevision.agency', email: 'mailto:support@altitudevision.agency' },
    ],
  },
  {
    id: 'modifications',
    icon: 'refresh-outline',
    title: 'Modifications',
    content: [
      { type: 'text', value: 'Cette politique peut être mise à jour à tout moment. En cas de modification substantielle, vous serez informé par email ou notification dans l\'application.' },
      { type: 'text', value: 'Nous vous encourageons à la consulter régulièrement.' },
    ],
  },
  {
    id: 'contact',
    icon: 'chatbox-ellipses-outline',
    title: 'Contact & réclamations',
    content: [
      { type: 'text', value: 'Pour toute question ou réclamation relative à vos données :' },
      { type: 'contact', icon: 'mail-outline', value: 'support@altitudevision.agency', email: 'mailto:support@altitudevision.agency' },
      { type: 'contact', icon: 'call-outline', value: '+242 06 800 21 51', tel: 'tel:+24206800215' },
      { type: 'text', value: 'Délai de réponse : 30 jours maximum.' },
    ],
  },
];

const SectionCard = ({ section, c }) => {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  const renderItem = (item, idx) => {
    switch (item.type) {
      case 'text':
        return (
          <Text key={idx} style={[styles.bodyText, { color: c.text + 'CC' }]}>
            {item.value}
          </Text>
        );
      case 'contact':
        return (
          <TouchableOpacity
            key={idx}
            style={styles.contactRow}
            onPress={() => {
              if (item.email) Linking.openURL(item.email);
              else if (item.tel) Linking.openURL(item.tel);
            }}
            activeOpacity={item.email || item.tel ? 0.7 : 1}
          >
            <Ionicons name={item.icon} size={16} color={colors.gold} />
            <Text style={[styles.contactText, { color: c.textSub }, (item.email || item.tel) && styles.contactLink]}>
              {item.value}
            </Text>
          </TouchableOpacity>
        );
      case 'bullets':
        return (
          <View key={idx} style={styles.listContainer}>
            {item.items.map((bullet, i) => (
              <View key={i} style={styles.listRow}>
                <Text style={[styles.bullet, { color: colors.gold }]}>•</Text>
                <Text style={[styles.listText, { color: c.text + 'CC' }]}>{bullet}</Text>
              </View>
            ))}
          </View>
        );
      case 'checks':
        return (
          <View key={idx} style={styles.listContainer}>
            {item.items.map((check, i) => (
              <View key={i} style={styles.listRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
                <Text style={[styles.listText, { color: c.text + 'CC' }]}>{check}</Text>
              </View>
            ))}
          </View>
        );
      case 'table':
        return (
          <View key={idx} style={[styles.table, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {item.rows.map((row, i) => (
              <View key={i} style={[styles.tableRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}>
                <Text style={[styles.tableLabel, { color: c.text }]}>{row.label}</Text>
                <View style={styles.tableBadge}>
                  <Text style={styles.tableBadgeText}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.iconWrap}>
          <Ionicons name={section.icon} size={22} color={colors.gold} />
        </View>
        <Text style={[styles.cardTitle, { color: c.text }]}>{section.title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={c.text + '66'}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.cardBody}>
          {section.content.map((item, idx) => renderItem(item, idx))}
        </View>
      )}
    </View>
  );
};

export default function PolitiqueConfidentialiteScreen() {
  const navigation = useNavigation();
  const { themeColors: c } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.bgCard, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Politique de confidentialité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Vos données, notre responsabilité</Text>
          <Text style={styles.heroSub}>
            Découvrez comment nous collectons, utilisons et protégeons vos informations personnelles.
          </Text>
          <Text style={styles.heroDate}>
            Mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Sections */}
        <View style={styles.sections}>
          {SECTIONS.map((section) => (
            <SectionCard key={section.id} section={section} c={c} />
          ))}
        </View>

        {/* Contact CTA */}
        <View style={[styles.ctaCard, { backgroundColor: colors.gold + '15', borderColor: colors.gold + '40' }]}>
          <Ionicons name="mail-outline" size={28} color={colors.gold} />
          <Text style={[styles.ctaTitle, { color: c.text }]}>Une question sur vos données ?</Text>
          <Text style={[styles.ctaText, { color: c.text + 'AA' }]}>
            Notre équipe vous répond dans les 30 jours.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.gold }]}
            onPress={() => Linking.openURL('mailto:support@altitudevision.agency')}
          >
            <Ionicons name="mail" size={18} color="#fff" />
            <Text style={styles.ctaBtnText}>support@altitudevision.agency</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.semiBold,
    fontSize: fontSize.md,
  },
  container: { paddingBottom: 40 },
  hero: {
    backgroundColor: colors.gold,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
  sections: { padding: spacing.md, gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.md,
  },
  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 10 },
  bodyText: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 22 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  contactText: { fontFamily: fonts.regular, fontSize: fontSize.sm },
  contactLink: { color: colors.gold, textDecorationLine: 'underline' },
  listContainer: { gap: 8 },
  listRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 16, lineHeight: 22 },
  listText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 22 },
  table: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm },
  tableLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm },
  tableBadge: { backgroundColor: colors.gold + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  tableBadgeText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.gold },
  ctaCard: {
    margin: spacing.md,
    marginTop: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, textAlign: 'center' },
  ctaText: { fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: 'center' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  ctaBtnText: { fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: '#fff' },
});
