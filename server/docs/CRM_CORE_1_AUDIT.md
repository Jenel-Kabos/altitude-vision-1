# CRM-CORE-1 — Audit initial (avant modification)

## Verdict

Il n'existe pas de CRM 360 transversal ni de pipeline commercial générique. En revanche, le projet contient déjà tous les moteurs sources qu'un CRM doit fédérer. Le CRM doit donc être une couche relationnelle et d'agrégation : il ne remplace ni `User`, ni les fiches `Proprietaire`/`Locataire`, ni la messagerie, ni les dossiers, ni les documents, ni les notifications.

## Identités et contacts existants

- `User` est l'identité authentifiée unique par email.
- `Proprietaire` et `Locataire` sont des fiches métier distinctes, reliables explicitement à `User`; cette séparation est certifiée par GL et ne doit pas être supprimée.
- `ContactMessage`, `QuoteRequest`, `AltcomProject`, les estimations et plusieurs réservations portent des instantanés de contact sans relation commune.
- Aucun modèle `Customer`, `CRM`, `Lead`, `Opportunity`, `Deal` ou `Pipeline` n'existe.

## Communication existante

- `Conversation` + `Message` constituent la messagerie client/staff canonique, également utilisée sur Mobile.
- `Notification` + `notificationService` constituent le moteur unique de notifications.
- Les emails entrants/sortants et adresses d'entreprise existent déjà; aucun second moteur de communication ne doit être créé.

## Dossiers, documents et timelines

- DOC-EVO expose un registre unique d'adaptateurs de dossiers et une fonction `buildTimeline` commune.
- Les documents sont portés par les modèles documentaires et financiers existants. Le CRM doit seulement produire des références/liens et des agrégats.
- Plusieurs domaines possèdent un historique local (`workflowHistory`, cycle de bail, réservations, patrimoine). Le CRM ne doit pas les recopier; sa timeline est une projection triée de ces événements et de ses propres activités.

## Données métier réutilisables

- Immobilier : `Property`, `Visite`, `RealEstateApplication`, `RealEstateReservation`, `Transaction`.
- Gestion locative : `Proprietaire`, `Locataire`, `Contrat`, `Paiement`, maintenance et dossiers GL.
- Hébergement/hôtel : `AccommodationReservation`, `HotelReservation` et facturation certifiée.
- Altcom/Mila Events : `AltcomProject`, `QuoteRequest`, `Quote`, `Event`.
- Finance : `FinancialDocument`, paiements, remboursements et ledger; aucun calcul financier ne doit être fait côté Web.

## Web et Mobile

- Web possède des écrans séparés pour utilisateurs, propriétaires, locataires, contacts, devis, conversations et dossiers, mais aucune fiche transversale.
- Mobile possède profils, conversations, messages et notifications. Le roadmap existant impose de ne pas porter les dashboards CRM administratifs sur Mobile. Aucun changement Mobile n'est requis pour CRM-CORE-1.

## NAV-CORE

Le registre partagé ne contient aucune destination CRM. Deux destinations Web-only sont nécessaires : liste Customer 360 et détail d'une fiche. Elles doivent être consommées par le dashboard via le SDK partagé.

## Mesure en production — lecture seule

Au moment de l'audit : 11 `User`, 2 `Proprietaire`, 34 `Locataire`, 6 `ContactMessage`, 8 `QuoteRequest`, 2 `AltcomProject`, 23 conversations, 106 messages, 8 biens, 17 contrats, 9 visites et 161 notifications. Six clés email/téléphone apparaissent dans plusieurs collections (16 occurrences de collections cumulées). Aucun doublon d'email n'existe dans `User`.

## Architecture retenue

1. Un index relationnel `CrmCustomer` matérialise une identité 360 et référence les enregistrements sources; les moteurs sources restent autorités.
2. L'email normalisé et les liaisons `User` explicites empêchent la création de deux fiches pour une identité prouvée. Le téléphone reste recherchable mais n'est jamais une preuve automatique, car il peut être partagé. Les rapprochements ambigus ne sont jamais fusionnés silencieusement.
3. Un pipeline générique est créé car aucun pipeline n'existe, via `CrmOpportunity` et un historique append-only des étapes.
4. Les rendez-vous, tâches, rappels, relances et notes sont unifiés dans `CrmActivity`; ils ne remplacent pas les visites, tickets ou calendriers opérationnels.
5. Le dossier Customer 360 est une projection serveur des sources et de DOC-EVO. Il ne stocke aucun document, paiement, réservation ou conversation.
