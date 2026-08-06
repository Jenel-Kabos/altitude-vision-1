# CRM-CORE-1 — Rapport final

## Audit complet et cartographie

L'audit préalable est consigné dans `CRM_CORE_1_AUDIT.md`. Aucun CRM 360 ni pipeline générique n'existait. Le projet possédait cependant des identités et contacts dispersés (`User`, `Proprietaire`, `Locataire`, formulaires, devis, projets), une messagerie (`Conversation`/`Message`), un moteur documentaire et de dossiers DOC-EVO, un moteur Notification, ainsi que les moteurs métiers immobilier, GL, ACC, HM, Altcom, Mila Events et Finance.

L'audit Atlas, strictement en lecture seule, a recensé 11 comptes, 2 propriétaires, 34 locataires, 16 demandes commerciales/contact, 23 conversations, 106 messages, 8 biens, 17 contrats, 9 visites et 161 notifications. Six clés d'identité se recoupent entre collections. Aucun document, contrat ou contact réel n'a été modifié.

## Décisions d'architecture

- `CrmCustomer` est un index relationnel, pas une nouvelle autorité métier. Il référence chaque enregistrement source et ne copie jamais ses contrats, documents, réservations, paiements ou conversations.
- Une fusion automatique exige un email normalisé commun ou une liaison `User` explicite. Le téléphone est affiché/recherchable mais n'est pas une preuve, car il peut être partagé.
- L'index unique multikey interdit qu'une même clé canonique ou source appartienne à deux Customers.
- Un conflit entre Customers existants les place en `merge_review`; aucune fusion silencieuse.
- Le dossier 360, les agrégats financiers et la timeline sont calculés côté serveur. `buildTimeline` de DOC-EVO est réutilisé; aucune seconde timeline persistante n'est créée.
- `CrmOpportunity` apporte le pipeline générique absent. `CrmActivity` unifie les seules activités CRM; les visites/tickets opérationnels restent dans leurs moteurs.

## Customer 360 et dossier client

La fiche expose identité, entreprise, emails, téléphones, adresses, langues, rôles relationnels et sources. Elle agrège biens, contrats, visites, transactions, séjours, projets Altcom, devis, contacts, conversations, messages et notifications. Les indicateurs financiers (chiffre d'affaires encaissé, remboursements, encours) sont calculés depuis `FinancialDocument` en unités mineures côté serveur. Les dépenses restent explicitement indisponibles tant qu'aucune attribution client fiable n'existe dans le ledger.

Les documents financiers et dossiers DOC-EVO sont uniquement référencés. Le CRM ne stocke aucun fichier ni URL documentaire parallèle.

## Pipeline commercial

Étapes uniques : Prospect, Qualification, Proposition, Négociation, Contrat, Client actif, Fidélisation, Ancien client. Chaque opportunité porte pôle, valeur, devise, probabilité, responsable, échéance et historique append-only des changements d'étape.

## Activités et communications

Rendez-vous, tâches, rappels, relances, notes, appels, emails, SMS et préparation WhatsApp sont reliés au Customer et éventuellement à une opportunité. L'assignation utilise `notificationService` et le type `crm_activity_assigned`; aucune seconde collection de notifications n'est créée. WhatsApp est marqué « préparé » : aucun fournisseur ni envoi fictif n'a été ajouté.

## Navigation et RBAC

NAV-CORE contient deux destinations Web-only : `CRM_CUSTOMERS` et `CRM_CUSTOMER_DETAILS`. Le dashboard et les liens de fiches les résolvent via le SDK partagé. Aucun écran administratif CRM n'est ajouté au Mobile.

Accès API : Admin, Collaborateur, Gestionnaire immobilier, Secrétaire, Community Manager et Communicant. Le navigateur ne calcule aucun agrégat financier et ne choisit aucune identité à fusionner.

## Éléments réutilisés

- `User`, `Proprietaire`, `Locataire` et toutes les sources commerciales existantes;
- `Conversation`, `Message`, `Notification` et `notificationService`;
- DOC-EVO, son registre de dossiers et `buildTimeline`;
- moteurs Property, Contrat, Visite, Transaction, ACC, HM et Finance;
- NAV-CORE et son SDK Web;
- layout et contrôle d'accès du dashboard existant.

## Éléments créés ou améliorés

- index Customer 360 et synchronisation contrôlée des sources;
- API de liste, recherche, détail, pipeline et activités;
- pipeline transversal et historique d'étapes;
- écran Web de liste/consolidation et fiche 360 responsive;
- type Notification CRM et destinations NAV-CORE;
- tests Mongo, Web et navigation.

## Impacts

- Backend : trois modèles CRM, un service d'agrégation, contrôleur et routes.
- Web : deux routes CRM, liste, fiche, pipeline, activités et entrée de navigation.
- Mobile : aucun changement, conformément au roadmap qui réserve les dashboards CRM au Web.
- Données réelles : audit en lecture seule uniquement. La consolidation réelle reste une action staff explicite depuis l'interface.

## Tests réellement exécutés sur l'état final

- CRM + NAV-CORE ciblés : 2 suites, 11 tests réussis.
- Backend Unit complet : 105 suites, 1 215 tests réussis.
- Backend Mongo complet : 51 suites, 411 tests réussis.
- Web Vitest complet : 76 fichiers, 505 tests réussis.
- Playwright complet : 34 tests réussis en 10,5 minutes.
- Build Next.js 15.5.14 : réussi, 136 pages générées.
- ESLint serveur : 0 erreur, 109 avertissements historiques.
- ESLint client : 0 erreur, 267 avertissements historiques.
- `git diff --check` : réussi.

Les premiers lancements sandbox de Backend Unit et Playwright ont été refusés sur l'ouverture de ports locaux (`EPERM`). Ils ont été relancés hors sandbox et les résultats ci-dessus sont ceux des campagnes valides. Les messages d'erreur simulés dans Mongo/Vitest font partie des scénarios négatifs; tous les runners finissent avec le code 0.

## Risques résiduels et dettes

- Les sources sans email ni liaison User obtiennent une identité isolée fondée sur leur source; leur rapprochement humain reste à concevoir avant toute fusion.
- Les dépenses client ne sont pas calculables de façon fiable avec le ledger actuel et restent `null`.
- SMS et WhatsApp n'ont aucun fournisseur certifié; seuls les canaux et activités sont préparés.
- La synchronisation est volontairement explicite et non exécutée automatiquement sur la production.
- Une procédure administrative de fusion/défusion contrôlée sera nécessaire pour traiter les cas `merge_review`.
- Les avertissements ESLint historiques et les données Browserslist obsolètes restent hors périmètre.

## Fichiers créés

- `client/app/dashboard/crm/page.jsx`
- `client/app/dashboard/crm/[id]/page.jsx`
- `client/lib/__tests__/CrmCustomersPage.test.jsx`
- `client/lib/pages/dashboard/CrmCustomersPage.jsx`
- `client/lib/pages/dashboard/CrmCustomer360Page.jsx`
- `client/lib/services/crmService.js`
- `server/__tests__/crm.mongo.integration.test.js`
- `server/controllers/crmController.js`
- `server/docs/CRM_CORE_1_AUDIT.md`
- `server/docs/CRM_CORE_1_REPORT.md`
- `server/models/CrmActivity.js`
- `server/models/CrmCustomer.js`
- `server/models/CrmOpportunity.js`
- `server/routes/crmRoutes.js`
- `server/services/crmService.js`

## Fichiers modifiés par CRM-CORE-1

- `client/lib/pages/dashboard/AdminDashboard.jsx`
- `server/models/Notification.js`
- `server/server.js`
- `server/services/navigationService.js`
- `shared/navigation/registry.json`

Les autres fichiers sales appartiennent aux sprints GL-RECON précédents et ont été préservés.

## Confirmations

- Aucun commit.
- Aucun push.
- Aucune migration destructive.
- Aucune suppression de données.
- Aucun Customer réel créé pendant l'audit ou les tests.
