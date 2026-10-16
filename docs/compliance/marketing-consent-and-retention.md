# Consentement marketing, CRM et conservation des données — MARKETING-CONSENT-1

Commit audité : `5a54a135b61b30de9b8d298f2cdc2ae282eec330` (Altimmo 1.0.1, versionCode 4).
Statut : implémenté localement, **non commité, non déployé**. Les durées de
conservation ci-dessous restent **à valider juridiquement** ; ce document ne
constitue pas un avis juridique.

## 1. Flux de données marketing (état réel du code)

| Étape | Données | Code |
|---|---|---|
| Indexation CRM | Nom, e-mail, téléphone, rôle → relation `prospect`/`prestataire` ; profil métier dérivé → `exploitant_etablissement` ; fiches Proprietaire/Locataire (adresse, ville) ; formulaires de contact, devis, projets Altcom | `server/services/crmService.js` (`loadIdentitySources`, `synchronizeCustomers`) |
| Segmentation | Relations CRM, profils métier, score commercial (messages, visites, contrats, réservations, paiements, ancienneté), ville, unité organisationnelle | `server/services/marketingSegmentService.js`, `crmScoreService.js` |
| Envoi | E-mail (Zoho Mail), notification in-app + push Expo (`notify()`) | `server/services/marketingCampaignService.js` (`deliverToChannel`) |
| Workflows | Envoi individuel déclenché par événement (`marketing.message.send`) | `server/services/crmAutomationActions.js` |
| SMS / WhatsApp | **Aucun transport implémenté** (statut `CHANNEL_UNSUPPORTED`) | idem |
| Campagnes planifiées | `MarketingCampaign.scheduledAt` existe mais **aucune tâche planifiée** ne l'exploite ; l'envoi est toujours manuel (`POST /api/marketing/campaigns/:id/send`) | `server/services/scheduledJobs/jobRegistry.js` |

## 2. Modèle de consentement

- `User.marketingPreferences.{email,push,sms,whatsapp}` : `status` (`unknown` | `granted` | `withdrawn`), `updatedAt`, `source`, `textVersion`.
- `unknown` (défaut, **y compris pour tous les comptes existants**) = aucun consentement → exclu de toute campagne. Aucun consentement rétroactif.
- Historique append-only : `MarketingConsentEvent` (utilisateur, canal, statut précédent/nouveau, source, version du texte, date). Aucune IP, aucun e-mail.
- Version du texte : `CONSENT_TEXT_VERSION = 'marketing-consent-2026-10-10'` (`server/constants/marketingConsent.js`, recopiée côté mobile et web). **Tout changement de libellé impose d'incrémenter cette valeur.**
- Sources : `signup`, `profile_completion`, `mobile_settings`, `web_settings`, `email_unsubscribe_link`, `account_deletion`.
- Seul point d'écriture : `server/services/marketingConsentService.js`. `/users/updateMe`, `/users/complete-profile` (sans case cochée), la synchronisation CRM et les actions d'administration ne peuvent jamais (ré)abonner.
- Une case non cochée à l'inscription laisse `unknown` ; un refus explicite dans les paramètres enregistre `withdrawn`.

## 3. Éligibilité d'un destinataire (`resolveRecipient`)

Vérifiée **à la sélection** (`summarizeEligibility`, aperçu de segment) **et juste avant chaque envoi** (relecture du compte par destinataire) pour les campagnes ET les workflows. Codes journalisés (non nominatifs) dans `MarketingSend.error` :

| Code | Signification |
|---|---|
| `CUSTOMER_NOT_ACTIVE` | Fiche CRM archivée ou en revue de fusion |
| `OUT_OF_TENANT_SCOPE` | Fiche d'un autre tenant que la campagne |
| `NO_LINKED_ACCOUNT` | Fiche sans compte (contact, devis, fiche staff) : consentement invérifiable → exclue |
| `ACCOUNT_DELETED` / `ACCOUNT_INACTIVE` / `TECHNICAL_ACCOUNT` | Compte supprimé, suspendu/banni/désactivé, technique |
| `CONSENT_NOT_GRANTED` | Pas de consentement `granted` pour le canal |
| `EMAIL_SUPPRESSED` | E-mail présent dans `MarketingUnsubscribe` (global ou du tenant) |
| `DUPLICATE_RECIPIENT` | Même compte déjà servi par la campagne |
| `CHANNEL_UNSUPPORTED` | SMS/WhatsApp |

L'e-mail utilisé est toujours `User.email` (jamais une adresse historique copiée dans le CRM). `MarketingSend.recipientEmail` n'est plus renseigné (identifiant de compte uniquement). Une campagne relancée ne resollicite pas un destinataire déjà servi.

## 4. Désinscription

- Chaque e-mail marketing contient un lien `FRONTEND_URL/desinscription-marketing?token=…` (jeton HMAC-SHA256, clé dérivée de `MARKETING_UNSUBSCRIBE_SECRET` ou, à défaut, de `JWT_SECRET`, sans expiration, sans donnée personnelle en clair).
- La page web demande une **confirmation** puis appelle `POST /api/marketing-preferences/unsubscribe` (un GET ne désinscrit jamais). Réponse identique que le compte existe ou non ; idempotent ; limité par `publicApiLimiter`.
- Effet : canal `withdrawn` (source `email_unsubscribe_link`) + inscription dans `MarketingUnsubscribe`.
- Mobile : Profil › « Communications et offres ». Web : Mon compte › « Communications et offres ».
- SMS/WhatsApp : non applicables tant qu'aucun fournisseur n'est branché (`STOP` fournisseur à prévoir le cas échéant).

## 5. Suppression de compte (`DELETE /api/users/me`) — matrice

| Donnée | Traitement | Justification / durée | Emplacement |
|---|---|---|---|
| Nom, e-mail, téléphone, photo, bio, jeton push, Google ID, avatar | Anonymisés / effacés (existant) | — | `User` |
| Consentements marketing | Tous `withdrawn` (source `account_deletion`) | Exclusion immédiate, y compris campagnes approuvées | `User.marketingPreferences` |
| Historique de consentement | **Conservé** (sans coordonnées) | Preuve du consentement/retrait — **durée à valider** | `MarketingConsentEvent` |
| Fiche CRM issue du seul compte | Anonymisée (« Contact supprimé »), coordonnées vidées, archivée ; clé `user:<id>` gardée | Empêche la réimportation, garde l'historique commercial non nominatif | `CrmCustomer` |
| Fiche CRM multi-source (ex. Proprietaire de gestion locative) | E-mail/téléphone du compte retirés ; données de la source métier conservées | Régies par le domaine gestion locative | `CrmCustomer` |
| Journal d'envoi marketing | `recipientEmail` effacé | Statistiques conservées sans coordonnées | `MarketingSend` |
| Liste de suppression e-mail | Entrée de l'e-mail d'origine supprimée | Le compte est de toute façon inéligible | `MarketingUnsubscribe` |
| Réimportation CRM | Comptes `Supprimé` exclus de la synchronisation | — | `crmService.loadIdentitySources` |
| Contrat d'hébergement propriétaire (PDF), engagements, IP de signature | **Conservés** si contrat accepté ; la référence au PDF est désormais gardée (auparavant effacée → fichier orphelin dans Cloudinary) | Preuve contractuelle — **durée à valider juridiquement** | `User.contratPdfAsset` (Cloudinary privé), `User.certifications`, `User.ipInscription` |
| IP d'inscription / engagements sans contrat | Effacés | Plus de finalité | `User` |
| Copies du contrat envoyées par e-mail (utilisateur, administrateur) | Hors de portée technique | À traiter par procédure interne | Boîtes Zoho |
| Candidatures (`RealEstateApplication`), dossiers d'activation pro (`TenantApplication`), réservations, transactions, factures, messages | Conservés (inchangé) | Intégrité des dossiers tiers / obligations comptables — **durées à valider** | Collections métier |

## 6. Migration

- **Aucune migration ni backfill requis** : un champ `marketingPreferences` absent est lu comme `unknown` (exclu). Ne pas exécuter de script attribuant un consentement aux comptes existants.
- Nouvelle collection `marketingconsentevents` (index `{ user: 1, at: -1 }`), créée à la première écriture.
- Variables d'environnement : `MARKETING_UNSUBSCRIBE_SECRET` (recommandée, sinon dérivée de `JWT_SECRET`) ; `FRONTEND_URL` (lien de désinscription).
- Effet en production après déploiement : **toute campagne existante n'atteindra que les comptes ayant donné un consentement après déploiement**. C'est voulu.

## 7. Google Play — Sécurité des données (application Android)

« Partagé » : les transferts vers Render/MongoDB Atlas, Zoho Mail, Expo, Cloudinary et Sentry ne relèvent de l'exception « prestataire de services » **que si** des contrats les limitent au traitement pour le compte d'Altitude Vision. **À confirmer contractuellement** ; à défaut, cocher « Partagé » pour les types concernés.

| Type | Collecté | Partagé | Obligatoire | Éphémère | Finalités | Preuves |
|---|---|---|---|---|---|---|
| Nom | Oui | Non (sous réserve contrats) | Obligatoire | Non | Fonctionnement, Gestion du compte, Communications du développeur, Publicité/marketing (personnalisation des messages, avec consentement), Prévention des fraudes/conformité (contrat) | `User.name`, `renderTemplate` (prenom/nom), `pdfService.generateContratHebergement` |
| Adresse e-mail | Oui | Non (sous réserve contrats) | Obligatoire | Non | Fonctionnement, Gestion du compte, Communications du développeur, Publicité/marketing (avec consentement), Prévention des fraudes/conformité | `authController.signup`, `marketingCampaignService.deliverToChannel` |
| Numéro de téléphone | Oui | Non (sous réserve contrats) | Facultatif (exigé seulement au parcours Google) | Non | Fonctionnement, Gestion du compte, Prévention des fraudes/conformité (contrat). **Pas** de marketing (aucun canal SMS/WhatsApp actif) | `User.phone`, `completeProfile` |
| Adresse | Oui (adresse professionnelle du dossier d'activation ; adresses de biens) | Non (sous réserve contrats) | Facultatif | Non | Fonctionnement, Gestion du compte. **Pas** de marketing : le segment « géographique » n'utilise que les villes des fiches Proprietaire/Locataire saisies sur le web | `FirstOrganizationOnboardingScreen`, `marketingSegmentService.geographique` |
| ID utilisateur | Oui | Non | Obligatoire | Non | Fonctionnement, Gestion du compte, Communications du développeur, Publicité/marketing (ciblage push avec consentement) | `identityKeys user:<id>`, `notify()` |
| Autres infos (rôle, profil métier, engagements, dossier pro) | Oui | Non (sous réserve contrats) | Obligatoire | Non | Fonctionnement, Gestion du compte, Communications du développeur, Prévention des fraudes/conformité, **Publicité/marketing** (segments par profil, avec consentement). Personnalisation : **Non**. Analyse : facultative (indicateurs internes `userKpiService`) | `marketingSegmentService` (`proprietaires_immobiliers`, `exploitants`) |
| Activité dans l'app — autres actions / interactions | Oui | Non | Obligatoire (inhérent à l'usage) | Non | Fonctionnement, **Publicité/marketing** (score CRM : messages, visites, contrats, réservations — segments VIP/prospects chauds), Analyse (indicateurs internes) | `crmScoreService.computeFromDossier` |
| Identifiants de l'appareil (jeton Expo Push) | Oui | Non (Expo : sous réserve contrat) | Facultatif (permission notifications) | Non | Fonctionnement, Communications du développeur, Publicité/marketing (push promotionnel avec consentement) | `User.pushToken`, `utils/expoPush` |

Communications du développeur : notifications opérationnelles (réservations, visites, contrats, sécurité) — non affectées par le refus marketing.
Publicité ou marketing : **à cocher** pour Nom, E-mail, ID utilisateur, Autres infos, Activité dans l'app, Identifiants d'appareil — le CRM envoie effectivement des campagnes, désormais uniquement avec consentement.
Impact croisé : le score CRM utilise aussi les paiements soldés (historique d'achats) → revoir la réponse « Infos financières › Historique des achats » (finalité marketing).

## 8. Décisions métier / juridiques ouvertes

1. Le consentement recueilli vise « Altitude Vision ». Un tenant tiers (organisation cliente de la plateforme) peut-il l'utiliser pour ses propres campagnes ? Aujourd'hui le code le permet si la fiche CRM appartient au tenant. **Décision requise** (restreindre au tenant d'Altitude Vision ou recueillir un consentement par organisation).
2. Durées de conservation : contrat d'hébergement, IP de signature, historique de consentement, candidatures, dossiers pro, journaux d'envoi.
3. Contacts CRM sans compte (formulaires, devis, fiches staff) : exclus par défaut. Leur réintégration exige un mécanisme de consentement propre (hors périmètre).
4. Validation du libellé de consentement et de la politique de confidentialité par un juriste.
5. Copies e-mail du contrat dans les boîtes Zoho : procédure de purge interne.
