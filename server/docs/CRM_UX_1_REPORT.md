# CRM-UX-1 — Rapport final d'industrialisation

## Audit du CRM existant

L'audit préalable est consigné dans `CRM_UX_1_AUDIT.md`. CRM-CORE-1 fournissait déjà l'unique Customer 360, le pipeline, les activités, la timeline DOC-EVO, les notifications et NAV-CORE. Il manquait le pilotage global, la recherche transverse, un agenda global et une procédure humaine de consolidation. Atlas contenait 0 Customer, 0 opportunité et 0 activité CRM au moment de l'audit; aucune consolidation réelle n'avait été lancée.

## Composants réutilisés

- `CrmCustomer`, `CrmOpportunity`, `CrmActivity` et `crmService`;
- `User`, `Proprietaire`, `Locataire` et les sources de CRM-CORE-1;
- `Property`, `Contrat`, réservations ACC/HM, `Paiement`, projets et conversations;
- `FinancialDocument` pour les montants financiers existants;
- DOC-EVO et son unique `buildTimeline`;
- `Notification`/`notificationService`;
- registre et SDK NAV-CORE;
- dashboard Web et composants responsive existants.

## Décisions d'architecture

Le CRM existant est étendu; aucun second CRM, pipeline, moteur de recherche, moteur documentaire ou moteur de notification n'est créé. Toutes les lectures transverses passent par `crmService`. Le navigateur ne contacte jamais directement les collections métier et ne calcule aucun KPI.

Le projet ne possédant aucune architecture drag-and-drop certifiée, le Kanban conserve les transitions explicites et sécurisées côté serveur. Cette décision évite une dépendance et une seconde logique de workflow.

## Tableau de bord CRM

Le cockpit `/dashboard/crm` affiche onze KPI calculés côté serveur :

- prospects : Customers actifs portant la relation `prospect`;
- opportunités : opportunités dont le résultat est `open`;
- clients actifs : Customers uniques en étape `client_actif` ou `fidelisation`;
- clients inactifs : Customers uniques en étape `ancien_client`;
- chiffre d'affaires : montants alloués moins remboursements des documents financiers non annulés;
- devis en attente : demandes `Nouveau`, `En cours` ou `Devis Envoyé`;
- contrats à signer : contrats `en_attente`;
- relances aujourd'hui, tâches en retard et rendez-vous du jour : échéances de `CrmActivity`;
- nouveaux contacts : `ContactMessage` reçus depuis le début de la journée serveur.

## Pipeline commercial et KPI

Le pipeline global reprend les huit étapes CRM-CORE-1. `CrmOpportunity` est enrichi avec un résultat réel `open`, `won` ou `lost`; une perte exige un motif. Les KPI ne déduisent rien arbitrairement :

- taux de conversion = gagnées / (gagnées + perdues), sinon `null`;
- durée moyenne = intervalle réel `createdAt` → `closedAt` des opportunités décidées;
- chiffre d'affaires par pôle = documents financiers regroupés par `domain`;
- meilleur commercial = valeur des opportunités réellement gagnées;
- activité par collaborateur = activités affectées et terminées.

## Recherche globale

Un seul endpoint serveur recherche Customer, Property, Contrat, réservations, factures, paiements, projets, conversations et documents. Les résultats renvoient une destination NAV-CORE et des paramètres, jamais un chemin Web local. Chaque catégorie est bornée afin d'éviter une réponse illimitée.

## Doublons potentiels

Le score est explicable : email identique +70, identité identique +25, entreprise identique +20, téléphone identique +15. Le score est plafonné à 100. Les différences de nom, entreprise, emails, téléphones, relations et nombre de sources sont affichées.

Le téléphone est normalisé uniquement pour produire un indice. Un téléphone seul marque explicitement `phoneOnly` et ne déclenche jamais de fusion.

## Assistant de consolidation et journal

L'assistant compare côte à côte les deux fiches ainsi que documents, contrats, réservations, propriétés, conversations et paiements. Seuls Admin et Gestionnaire immobilier peuvent décider : conserver A, conserver B ou reporter. Une justification d'au moins cinq caractères est obligatoire.

Une consolidation s'exécute dans une transaction Mongo :

1. les snapshots avant sont capturés;
2. le Customer conservé reçoit les identités, sources, relations, adresses et langues;
3. opportunités et activités sont réaffectées;
4. le Customer perdant est conservé, vidé de ses clés uniques, marqué `archived` et relié par `mergedInto`;
5. `CrmConsolidation` enregistre acteur, date, décision, justification, score et snapshots avant/après.

Le journal interdit update et delete par middleware Mongoose. Aucun Customer ni enregistrement source n'est supprimé.

## Activités et agenda

La vue unifiée propose Aujourd'hui, Cette semaine, En retard et À venir. Elle regroupe tâches, rappels, rendez-vous et relances, avec Customer, responsable, échéance et action de clôture. Les notifications d'assignation continuent d'utiliser le moteur Notification certifié.

## Navigation NAV-CORE et responsive

Les destinations `CRM_PIPELINE`, `CRM_SEARCH`, `CRM_DUPLICATES` et `CRM_ACTIVITIES` complètent les destinations Customer existantes. Les résultats transverses utilisent également les destinations administratives Documents, Paiements et Altcom. Tous les onglets et résultats du cockpit passent par le SDK NAV-CORE.

Le cockpit, les cartes KPI, le Kanban horizontal, les résultats, l'agenda et l'assistant sont adaptés desktop, tablette et petit écran Web. Aucun dashboard CRM natif Mobile n'a été créé.

## Impacts

- Backend : agrégats opérationnels, recherche, détection, consolidation transactionnelle, résultat d'opportunité et journal append-only.
- Web : cockpit multi-vues et composants CRM opérationnels responsive.
- Mobile : aucun changement; aucune incohérence réelle détectée.
- Données réelles : aucune synchronisation ou consolidation lancée sur Atlas.

## Tests réellement exécutés sur l'état final

- CRM-UX-1 + NAV-CORE ciblés : 2 suites, 14 tests réussis.
- Backend Unit complet : 105 suites, 1 215 tests réussis.
- Backend Mongo complet : 51 suites, 414 tests réussis.
- Web Vitest complet : 76 fichiers, 505 tests réussis.
- Playwright complet : 34 tests réussis en 9,5 minutes.
- Build Next.js 15.5.14 : réussi, 136 pages générées.
- ESLint serveur : 0 erreur, 109 avertissements historiques.
- ESLint client : 0 erreur, 267 avertissements historiques.
- `git diff --check` : réussi.

Les messages `TEST DATA COMMENTS ERROR`, erreurs simulées de rollback et API JSDOM non implémentées appartiennent aux scénarios négatifs existants; tous les runners certifiés terminent avec le code 0.

## Risques résiduels et dettes

- La détection compare actuellement les Customers actifs par paires (`O(n²)`); à grande échelle, un index de candidats/buckets devra précéder le scoring sans changer ses règles.
- La recherche fournit une pertinence simple et des limites par type; une indexation Mongo text/Atlas Search pourra améliorer le classement sans créer une seconde source de vérité.
- Une consolidation est volontairement non réversible depuis l'interface. Une procédure de défusion contrôlée et testée sera nécessaire avant d'autoriser un retour arrière.
- Les dépenses client restent non calculables faute d'attribution fiable dans le ledger et ne sont pas inventées dans les KPI.
- Le Kanban n'offre pas de drag-and-drop, conformément à l'absence de socle certifié.
- SMS/WhatsApp restent des canaux préparés sans fournisseur certifié.

## Fichiers créés

- `client/lib/components/crm/CrmActivitiesAgenda.jsx`
- `client/lib/components/crm/CrmDashboardPanel.jsx`
- `client/lib/components/crm/CrmDuplicatesCenter.jsx`
- `client/lib/components/crm/CrmGlobalSearch.jsx`
- `client/lib/components/crm/CrmPipelineBoard.jsx`
- `server/docs/CRM_UX_1_AUDIT.md`
- `server/docs/CRM_UX_1_REPORT.md`
- `server/models/CrmConsolidation.js`

## Fichiers modifiés

- `client/app/dashboard/crm/page.jsx`
- `client/lib/__tests__/CrmCustomersPage.test.jsx`
- `client/lib/pages/dashboard/CrmCustomersPage.jsx`
- `client/lib/services/crmService.js`
- `server/__tests__/crm.mongo.integration.test.js`
- `server/controllers/crmController.js`
- `server/models/CrmCustomer.js`
- `server/models/CrmOpportunity.js`
- `server/routes/crmRoutes.js`
- `server/services/crmService.js`
- `shared/navigation/registry.json`

## Confirmations

- Aucun commit.
- Aucun push.
- Aucune migration destructive.
- Aucune suppression de données.
- Aucun Customer réel consolidé ou modifié.
