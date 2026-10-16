# Altimmo — Renforcement de l'intermédiation commerciale : rapport final

Date : 2026-10-12 · Dépôt : `altitude-vision-1` · Branche : `main`
Référence : `docs/superpowers/specs/2026-10-10-altimmo-commercial-intermediation-hardening-design.md` et les plans des lots A à F.

> Travail **local uniquement**. Aucun commit, push, déploiement, migration de production, envoi réel, build EAS/AAB ou soumission Google Play n'a été effectué.

## Verdict

| Critère | Résultat | Fondement |
|---|---|---|
| Conforme à la vision métier | **PASS** | Lots A–E livrés et testés ; faille R1 de la boîte de support corrigée (§4 bis) ; décisions juridiques ouvertes au §12 |
| Sécurité de l'intermédiation | **PASS** | Boîte de support réservée aux agents `platform.support.*` : refus prouvé pour chaque rôle d'organisation, sur REST, routes héritées, pièces jointes, Socket.IO, notifications et CRM 360 (§4 bis, §9) |
| Isolation multi-tenant | **PASS** | `certify:tenant` GREEN (97/97) après le correctif ; suites d'isolation tenant A/B et cross-tenant vertes |
| CRM commercial exclusif | **PASS** | Marketing réservé à `platform.marketing.manage` en contexte PLATFORM, services et automatisations fermés (§4, Lot E) |
| Réservations directes | **PASS** | Réservation publique directe, y compris pendant une révision en attente ; `certify:financial` GREEN (188/188) |
| Gestion des habilitations | **PASS** | Onglet Utilisateurs (Vue plateforme) : octroi et retrait des capacités déléguables sans accès manuel à la base ; refus serveur testés (§4 ter) |
| Gouvernance de la délégation | **PASS** | Politique centrale appliquée à toutes les routes opérateur ; 5 contournements démontrés puis fermés ; provisionnement privilégié hors HTTP, gardé statiquement (§4 quater) |
| Fiabilité et visibilité des notifications (Lot N) | **PASS** | Notification persistante indépendante de Socket.IO ; anciennes notifications de la boîte de support masquées hors agents, sans purge (§4 quinquies) |
| Certification MongoDB complète | **PASS** | 240/240 suites, 3187/3187 tests, après tous les correctifs (§9) |
| Prêt pour livraison contrôlée | **NON** | En attente de validation explicite ; AAB versionCode ≥ 5 requis ; décisions juridiques ouvertes ; agents réels à habiliter |

## 1. Git initial et final

| | Initial | Final |
|---|---|---|
| HEAD | `5a54a135b61b30de9b8d298f2cdc2ae282eec330` | `5a54a135b61b30de9b8d298f2cdc2ae282eec330` (inchangé) |
| Branche | `main` | `main` |
| Worktree | 26 modifiés + 21 non suivis (MARKETING-CONSENT-1, avant la spec) ; 134 entrées à la reprise du 2026-10-11 | 189 modifiés + 67 non suivis (256 entrées) après le correctif P0, les habilitations, la politique de délégation, le Lot N et le correctif `Object.groupBy` (dont 72 fichiers de test où seul l'identifiant de fixture change) |
| `git diff --check` | — | propre |
| Recherche de secrets (diff + non suivis) | — | 0 occurrence |

Fichiers à fins de ligne CRLF préexistants : `server/controllers/conversationController.js`, `server/models/Conversation.js` (avertissement Git uniquement).

## 2. Travaux préexistants préservés

- **MARKETING-CONSENT-1** (consentement marketing par canal, désinscription signée, suppression de compte) : intégralement conservé et intégré au Lot E ; suite `marketingConsent` 22/22.
- **Correctif d'inscription Client mobile** (`RegisterScreen`, fermeture périmée) : conservé ; test dédié vert dans la suite mobile.
- Aucun `reset`, `checkout`, `stash` ni `clean`. Avant chaque réécriture de test, une copie a été conservée hors dépôt (scratchpad de session).

## 3. Matrice avant / après

| # | Écart audité | Avant | Après | Lot |
|---|---|---|---|---|
| A1 | Auto-approbation par l'Admin d'une organisation | Admin tenant valide ses annonces | Validation réservée à un `PlatformOperator` `platform.commercial.manage` en contexte PLATFORM (routes + service) | A |
| A2 | Modification sans revue | Staff tenant modifiait sans revue | Révision commerciale en attente ; version publique approuvée conservée | A |
| A3 | Annonces `tenant: null` non modérables | Bloquées | File plateforme unique, sans réattribution | A |
| A4 | Hôtels/hébergements auto-publiés | Admin/Collaborateur tenant | Même règle que A1, révisions dédiées | A/D |
| B1 | Coordonnées du candidat exposées au propriétaire | E-mail, téléphone, revenus, justificatifs | Projections masquées ; divulgation tracée sous autorisation explicite | B |
| B3 | Visite = mise en relation implicite | Téléphone dévoilé à la confirmation | Visite ≠ autorisation ; consentement non imposé | B |
| C1 | Message direct par `receiverId` | Possible vers n'importe qui | Refusé sans `ContactAuthorization` active exacte | C |
| C2 | `POST /api/conversations` (ancienne route) | Création libre | Même politique centrale | C |
| C3 | Autorisation de mise en relation | Inexistante | `ContactAuthorization` (octroi/révocation journalisés) | C |
| E1 | Campagnes par une organisation | Admin/CommunityManager tenant | `platform.marketing.manage` uniquement ; aucun objet marketing tenant | E |
| E1b | Automatisation marketing tenant | Exécutée si l'émetteur de l'événement était habilité | Toute action non opérationnelle refusée avant effet | E |
| C4 | Boîte de support Altitude Vision | Lisible et répondable par le staff de toute organisation (tenant du bien ou `tenant: null`) | Agents `PlatformOperator` `platform.support.read` / `platform.support.reply` uniquement ; aucun rôle d'organisation | P0 |
| D1 | Canal hôtelier | Hérite de C1 | Limité à une réservation confirmée / en cours, participants vérifiés | C/D |

## 4. Résultats par lot

**Lot C — Messagerie (registre `lot-c`).** `ContactAuthorization`, politique centrale d'écriture, conversations historiques en lecture seule, Socket.IO sans écriture, pièces jointes protégées. Résultat consigné : 12 suites serveur 96/96, web 1/1, mobile 10/10. Constat postérieur R1 corrigé par le correctif P0 (§4 bis).

**Lot B — Candidatures et visites (registre `lot-b`).** Projections privées, divulgations tracées (`ApplicationDisclosureEvent`), visite distincte de l'autorisation, décision propriétaire conservée. Résultat consigné : 8 suites 68/68, web 4/4, mobile 1/1.

**Lot A — Publication (registre `lot-a`).** `CommercialPublicationRevision`, décisions par CAS, files exclusivement plateforme. Complété dans cette session :
- tests unitaires de routes alignés sur l'acteur plateforme (`propertyRoutes` 41/41, `hotelRoutes` 45/45, `accommodationRoutes` 88/88, `routeOrdering` 9/9) ;
- **défaut corrigé** : `CommercialPublicationError`, `MarketingAuthorityError`, `MarketingConsentError` et `CrmActionPolicyError` ressortaient en **500** ; elles sont désormais mappées vers leur statut (409, 422, 403) et leur code dans `errorMiddleware` ;
- **défaut corrigé** : la page web de modération immobilière et le registre rejetaient sans motif, alors que le serveur l'exige (rejet impossible depuis l'interface). Un motif obligatoire est ajouté ; le registre n'affiche plus Valider/Rejeter à un Admin tenant ni sur la seule capacité `platform.properties.manage`.

**Lot E — CRM et marketing (registre `lot-e`).**
- Défaut corrigé : l'autorité marketing des automatisations était lue sur l'émetteur de l'événement (une règle tenant s'exécutait si un opérateur déclenchait l'événement).
- Politique d'actions CRM **fermée** : seules 4 actions opérationnelles et les notifications internes au staff sont exécutables ; les actions marketing et inconnues échouent avant tout effet, contrôlées aussi à l'enregistrement de la règle.
- Les services refusent tout périmètre tenant (`MARKETING_TENANT_SCOPE_FORBIDDEN`), y compris pour un opérateur habilité ; les campagnes tenant historiques restent annulables.
- Défaut web corrigé : la page marketing lisait des capacités dérivées du rôle (un vrai opérateur était toujours refusé). Elle lit désormais la capacité opérateur et le scope PLATFORM ; le lien de navigation et le module de profil sont conditionnés à `platform.marketing.manage`.
- Script `seedMarketingWorkflowRules --apply` neutralisé (refus avant tout accès base).

**Lot D — Hôtels et hébergements (registre `lot-d`).** Deux nouvelles suites, vertes dès le premier passage : le comportement était déjà correct et les tests le figent (`hotelCommercialOperationalBoundary` 4/4, `hotelOperationalMessaging` 5/5). Aucune modification de code financier.

**Lot F — Certification.** §9.

## 4 bis. Correctif P0 — isolation de la boîte de support Altitude Vision

**Décision métier appliquée :** la boîte de support commerciale appartient exclusivement à Altitude Vision. Aucune organisation cliente ne la consulte ni n'y répond.

**Cause (démontrée).** Six chemins ouvraient la boîte au staff des organisations :
1. le filtre `{ tenant ∈ [actif, null] }` ;
2. le rattachement de la conversation au tenant du bien ;
3. l'écriture autorisée par `ALL_STAFF.includes(role)` ;
4. les événements temps réel émis vers la room staff du tenant ;
5. `notifyStaff`, qui prévenait le staff du tenant ;
6. un accès Socket.IO fondé sur le rôle.

Un septième chemin a été découvert pendant ce correctif : la fiche CRM 360 d'une organisation projetait la conversation de support et ses messages, car les messages héritent du tenant du bien.

**Correctif (TDD, RED puis GREEN).** L'autorité est centralisée dans `messagingAuthorizationService` :
- `hasSupportCapability` relit à chaque accès un `PlatformOperator` actif détenant la capacité exacte ;
- `assertConversationAccess` : pour une conversation de la boîte, seul un participant (le prospect) ou un agent `platform.support.read` y accède ;
- `evaluateConversationWriteState` : la réponse exige `platform.support.reply`.

La même politique s'applique partout :

| Surface | Comportement |
|---|---|
| `GET /staff-inbox` | Capacité requise, sans filtre de tenant |
| Compteur de non-lus | Inclut la boîte pour les agents uniquement |
| Suppression | Réservée aux titulaires de `platform.support.reply` |
| Pièces jointes | Capacité vérifiée |
| `POST /api/messages` et `/start` (routes héritées) | Politique centrale |
| Socket.IO | `canAccessConversation` / `canWriteConversation` ; `emitSupportInboxEvent` réautorise chaque socket de `platform:support` et en retire les sockets non habilités |
| Notifications | `notifySupportAgents` (agents actifs uniquement) |
| CRM 360 | Conversations et messages de la boîte exclus |

L'autorisation ne passe jamais par `receiverId`, le propriétaire du bien, l'adhésion tenant, `User.role`, un nom d'organisation, un e-mail ou `tenant: null`. Aucun PlatformTenant implicite n'est créé.

**Capacités.**
- `platform.support.read` (existante) : lister, lire, télécharger les pièces jointes, rejoindre les rooms et recevoir les notifications.
- `platform.support.reply` (nouvelle) : répondre et supprimer.

Les agents ne reçoivent aucune capacité commerciale, marketing ou financière. `platform.support.reply` est exclue des capacités exigées pour la Vue plateforme : l'exiger retirerait la Vue plateforme aux administrateurs existants. Elle s'accorde explicitement, sans reprise de données.

**Interfaces.**
- Web : le lien « Messages clients », la redirection de `/messages`, le lien d'en-tête et le routage des notifications dépendent de `platform.support.read`, plus du rôle. Le staff d'organisation reste sur `/messages`.
- Mobile : `ConversationsScreen` ne charge la boîte que pour un opérateur actif `platform.support.read` (sinon messagerie directe), avec refus par défaut en cas d'erreur.

**Flux légitimes préservés (tests verts) :**
- prospect ↔ agent ;
- conversations directes `ContactAuthorization` ;
- canal hôtelier opérationnel ;
- communications opérationnelles des organisations ;
- CRM opérationnel ;
- réservations ;
- gestion locative.

## 4 ter. Gestion des habilitations depuis l'onglet Utilisateurs

**Audit de l'existant :**
- `PlatformOperator` : un document par utilisateur, statuts `active` / `suspended` / `revoked`.
- Service `platformOperatorService` : transaction, verrou sentinelle `PlatformAuthorityLock`, protection du dernier opérateur viable, refus de l'auto-action, audit `ActionLog`.
- Routes `/api/platform-operators` gardées par `platform.operators.manage` (opérateur actif et éligible à la Vue plateforme), avec les mutations limitées au scope PLATFORM (`requirePlatformGovernanceScope`).
- Wrappers web présents mais **aucune interface** : l'octroi exigeait un script ou une écriture en base.
- Constat : `POST /api/platform-operators` remplace l'ensemble des capacités et peut accorder n'importe laquelle, y compris `platform.operators.manage` et l'impersonation (§11).

**Mise en œuvre, réutilisant l'existant sans système parallèle :**
- Liste fermée `PLATFORM_DELEGABLE_CAPABILITIES` : `platform.support.read`, `platform.support.reply`, `platform.commercial.manage`, `platform.marketing.manage`. Toute autre capacité est refusée par ce canal (`PLATFORM_CAPABILITY_NOT_DELEGABLE`).
- Endpoints `GET` et `POST /api/platform-operators/:userId/capabilities`, derrière la même garde `platform.operators.manage` et le scope PLATFORM. Aucune nouvelle capacité n'est créée : la délégation reste une autorité de gouvernance des opérateurs.
- Service `getDelegatedCapabilityProfile` / `changeDelegatedCapability` (une capacité par appel, motif obligatoire). Il refuse :
  - l'auto-accréditation ;
  - un bénéficiaire technique, inactif, suspendu, banni ou supprimé ;
  - un opérateur suspendu ou révoqué, jamais réhabilité par ce canal ;
  - le retrait, à un administrateur critique (`platform.operators.manage`), d'une capacité requise par la Vue plateforme (`PLATFORM_CRITICAL_ADMIN_PROTECTED`).
- Garanties d'écriture :
  - même verrou et même transaction que les autres transitions ;
  - opérations idempotentes ;
  - audit `platform_operator.capability_granted` / `capability_revoked` (acteur, capacité, avant/après, motif), uniquement quand une modification a lieu.
- Aucun droit n'est déduit d'un rôle tenant, d'un e-mail ou d'un nom d'organisation.
- Web : action « Gérer les habilitations », visible seulement avec `platform.operators.manage`, jamais avec `platform.users.manage` seul. La fiche affiche l'identité, les statuts du compte et de l'opérateur, les capacités actuelles et la liste déléguable **renvoyée par le serveur**. Chaque modification passe par une confirmation avec motif, puis un message de succès ou le refus du serveur. Aucune action n'est proposée sur son propre compte ni sur un opérateur suspendu.

**Tests (TDD, RED puis GREEN) :**
- `platformOperatorDelegatedCapabilities.mongo` : **15/15**, 12 en échec avant implémentation. Couverture : octroi de `support.read` et `support.reply` avec accès effectif à la boîte, révocation et perte immédiate de l'accès, refus de l'admin d'organisation (avec ou sans tenant), de l'opérateur sans délégation, du scope tenant, de l'auto-accréditation, des capacités non déléguables ou inconnues, des entrées invalides, du bénéficiaire inéligible, de l'opérateur suspendu ; protection de l'administrateur critique ; idempotence ; audit.
- Web `UsersAccreditations` : **7/7**, en échec avant implémentation (composant absent).

## 4 quater. Sécurisation globale de la délégation des capacités

**Audit des chemins d'écriture des capacités `PlatformOperator` :**

| Chemin | Avant | Après |
|---|---|---|
| `POST /api/platform-operators` | Toute capacité ; remplacement complet de l'ensemble | Politique centrale : capacités déléguables uniquement ; cible privilégiée intouchable ; bénéficiaire actif ; jamais soi-même |
| `PATCH /:userId/reactivate` | Restaurait toutes les capacités, y compris non déléguables | Refus (409) si l'opérateur détient une capacité non déléguable ; inchangé pour un agent aux seules capacités déléguables |
| `GET` / `POST /:userId/capabilities` | Liste fermée locale | Même politique centrale |
| `PATCH /suspend`, `/revoke`, cycle de vie des comptes | Ne font que retirer | Inchangés (protection du dernier opérateur viable conservée) |
| Scripts CLI `bootstrapPlatformOperator`, `applyDataReset` | `grantOperator` sans borne | `provisionPrivilegedOperator` : comportement inchangé, hors HTTP |
| Script CLI `grantPlatformCommercialCapability` | `$addToSet` de `platform.commercial.manage` | Inchangé (capacité déléguable, CLI gardée) |

**Contournements démontrés avant correction**, par un test temporaire sur Mongo réel, supprimé après exécution :
1. Création avec `platform.operators.manage` : 201.
2. Création avec `platform.support.impersonation` : 201.
3. Création avec `platform.finance.manage` : 201.
4. Remplacement de l'ensemble d'un administrateur critique, réduit à `platform.support.read` : 201.
5. Réactivation, par un administrateur sans impersonation, d'un opérateur suspendu qui la détenait : 200, impersonation restaurée.

**Correctif :**
- **Politique centrale** `services/platformOperator/capabilityDelegationPolicy.js`, avec la liste fermée `PLATFORM_DELEGABLE_CAPABILITIES` (support lecture et réponse, commercial, marketing). Elle expose `assertDelegableCapabilities`, `assertOrdinaryTargetNotPrivileged` et `assertOrdinaryReactivationAllowed`. Toute autre capacité (gouvernance, impersonation, finance, administration) est refusée par la gestion ordinaire.
- **`grantOperator`**, appelé par la route HTTP, est désormais soumis à la politique.
- **`provisionPrivilegedOperator`** reprend l'ancien `grantOperator` sans modification. Il est réservé aux scripts CLI gardés (dry-run, `--confirm-database`, garde de production) et aux fixtures de test.
- **Garde statique** `platformOperatorPrivilegedProvisioningBoundary.test.js` : seuls le service et les deux scripts CLI peuvent référencer `provisionPrivilegedOperator`. La route appelle l'octroi ordinaire, et aucun paramètre HTTP (`allowSelfGrant`, `privileged`…) ne l'active.
- **Décision D13 révisée.** La réactivation HTTP restaure à l'identique les capacités d'un opérateur aux seules capacités déléguables. Elle est refusée pour un administrateur critique, dont la récupération passe par le CLI existant `bootstrapPlatformOperator --reactivate`. Une procédure HTTP de récupération (contrat proposé au §12) n'a **pas** été implémentée, faute de validation.

**Tests (TDD) :**
- `platformOperatorDelegationPolicy.mongo` : **22/22**, en échec avant correction (module absent ; contournements démontrés ci-dessus). Couverture :
  - création autorisée ; quatre capacités autorisées ;
  - création refusée avec `operators.manage`, impersonation, `finance.manage`, `finance.read`, `tenants.manage`, et avec la Vue plateforme complète ;
  - auto-accréditation refusée ; bénéficiaire inactif refusé ;
  - remplacement d'un administrateur critique ou d'un détenteur d'impersonation refusé ;
  - réactivation privilégiée refusée ; réactivation d'un agent autorisée à capacités identiques ;
  - ré-octroi après révocation sans héritage ;
  - délégation unitaire non déléguable refusée ;
  - opération sans rapport sans effet sur les autres opérateurs ;
  - dernier administrateur critique préservé ;
  - audit présent ; tentative refusée non journalisée ;
  - aucun drapeau HTTP de provisionnement.
- Garde statique : **3/3**.
- `platformOperatorLifecycle04C2` (D13) aligné : **26/26**, original conservé hors dépôt.

## 4 quinquies. Lot N — fiabilité et visibilité historique des notifications ; compatibilité Node 20

**Périmètre.** Le dépôt ne contient aucun plan nommé « Lot N ». Je l'ai défini à partir des deux risques résiduels du correctif P0 consignés dans ce rapport.

**1. Fiabilité.**
- *Cause* : dans `messageController`, `getIO().emit(...)` et `notify(...)` partageaient le même bloc `try`. Si Socket.IO était indisponible, l'exception survenait avant `notify` : la notification persistante (cloche et push) du destinataire était perdue en silence.
- *Preuve RED* : une réponse d'agent donnait 201, mais **0** notification pour le prospect.
- *Correctif* : l'émission temps réel est isolée et best-effort ; `notify` s'exécute toujours. Aucun autre couple `getIO` → `notify` non protégé dans les contrôleurs ou services (recherche automatisée).

**2. Visibilité historique.**
- *Constat* : les notifications `new_staff_message` (nom de l'expéditeur et aperçu de 100 caractères du message d'un prospect) adressées au staff d'organisation avant le correctif P0 restaient listables, comptées, lisibles par identifiant et visibles dans le portail locataire.
- *Correctif* : `notificationVisibilityFilter` et `SUPPORT_INBOX_NOTIFICATION_TYPES` dans `notificationService`. Ces notifications ne sont exposées qu'à un agent `platform.support.read` actif, relu à chaque requête.
- *Points d'application* : liste, filtre non lus, compteurs, `PATCH /:id/read` (404), `DELETE /:id` (404), `read-all`, `clear`, portail locataire (`tenantPortalService`).
- **Aucune purge, migration ni écriture** : les documents masqués ne sont ni modifiés ni supprimés, y compris par `read-all` et `clear` (testé). La révocation de l'agent les masque immédiatement.
- Les notifications de réponse au prospect (`message_staff`) et tous les autres types sont inchangés.

**3. `Object.groupBy` (Node 20).**
- *Cause* : `legacyRentalTestDataCleanupService` (fichier versionné, non modifié par ces lots jusqu'ici) appelait `Object.groupBy`, absent de Node 20. Or le runtime déclaré est Node 20 (`engines: >=20.0.0`, CI en Node 20).
- *Correctif minimal* : une fonction locale `groupBy` aux garanties identiques (objet sans prototype, ordre d'insertion), substituée aux deux appels. **Version de Node inchangée**, car aucune nécessité démontrée.
- *Preuve* : `legacyRentalTestDataCleanupC211D` passe de 1 échec à **3/3** ; le shard 2 passe de 399/400 à **400/400**.

**Tests :**
- `notificationSupportInboxVisibility.mongo` (nouveau) : **5/5**, dont 4 en échec avant correction.
- `notificationController.test.js` aligné : bouchon du filtre, et assertion renforcée sur la propriété du destinataire et le masquage : **4/4**.

## 5. Fichiers créés / modifiés

| Zone | Entrées Git | Principaux ajouts |
|---|---|---|
| `server/` | 101 | Modèles `ContactAuthorization`, `ApplicationDisclosureEvent`, `CommercialPublicationRevision`, `MarketingConsentEvent` ; services `contactAuthorizationService`, `realEstateApplicationPrivacyService`, `commercialPublicationService`, `marketingAuthorityService`, `crmActionPolicy`, `marketingConsentService`, `conversationSerializer` ; contrôleurs/routes `contactAuthorization*`, `marketingPreferences*` |
| `client/` | 37 | Modération (propriétés, hôtels, hébergements, registre), marketing, préférences et désinscription, messagerie en lecture seule, candidatures et visites |
| `altimmo-app/` | 15 | Consentement et préférences, messagerie en lecture seule, visites, inscription |
| `docs/` | 9 | Spec, 6 plans, conformité marketing, Data Safety |

Lot N et compatibilité Node 20 (2026-10-12) :
- **Serveur** : `notificationService` (filtre de visibilité), `notificationController`, `tenantPortalService`, `messageController` (fiabilité), `legacyRentalTestDataCleanupService` (`groupBy` local).
- **Tests** : `notificationSupportInboxVisibility.mongo` (nouveau) ; `notificationController.test.js` aligné.

Politique de délégation (2026-10-12) :
- **Serveur** : `capabilityDelegationPolicy` (nouveau), `platformOperatorService` (`grantOperator` borné, `provisionPrivilegedOperator`, réactivation) ; scripts `bootstrapPlatformOperator` et `applyDataReset` (appel renommé).
- **Tests** :
  - nouveaux : `platformOperatorDelegationPolicy.mongo`, `platformOperatorPrivilegedProvisioningBoundary` ;
  - `platformOperatorLifecycle04C2` aligné ;
  - 72 fichiers de test : seul l'identifiant de fixture `grantOperator` devient `provisionPrivilegedOperator`, sans autre changement.

Habilitations (2026-10-12) :
- **Serveur** : `platformOperatorConstants`, `platformOperatorService`, `platformOperatorController`, `platformOperatorRoutes`, nouvelle suite `platformOperatorDelegatedCapabilities.mongo`.
- **Web** : `AccreditationsDialog` (nouveau), `UsersPanel`, `platformOperatorService`, nouveau test `UsersAccreditations`.

Correctif P0 (2026-10-12) :
- **Code serveur** : `messagingAuthorizationService`, `socket`, `notificationService`, `messageController`, `conversationController`, `conversationRoutes`, `crmService`, `errorMiddleware` (codes `TENANT_RESOURCE_NOT_FOUND` / `TENANT_ATTRIBUTION_AMBIGUOUS` : 404 au lieu de 500), `platformOperatorConstants`.
- **Web** : `AdminDashboard`, `MessagesPage`, `Header`, `NotificationBell`.
- **Mobile** : `ConversationsScreen`.
- **Nouveaux tests** :
  - `supportInboxIsolation.mongo` (15 tests) et `CRM360-21` ;
  - web : `MessagesSupportInboxRedirect` (4 tests) et un test de navigation ;
  - mobile : `ConversationsSupportInbox` (5 tests).
- **Tests historiques réécrits sur la nouvelle règle**, sans affaiblir les refus (originaux copiés hors dépôt) :
  - `conversationStaffInboxTenant` ;
  - `conversationRoutes` (bouchon de capacité seulement) ;
  - `socketAuthorization` ;
  - `platformNativeSpecializedWorkflows` ;
  - `platformViewEligibility` ;
  - `messagingTenantAmbiguousStaff` ;
  - `messagingPlatformInboxAggregation` ;
  - `socketDistributedAdapter` ;
  - côté web, le bouchon `can()` d'`AdminDashboardDomains` (comme en production, un `platform.*` n'est plus hérité du joker Admin).

Ajouts de cette session (2026-10-11/12) :
- **Code** : `crmActionPolicy`, `crmAutomationEngine`, `crmAutomationController`, `marketingAuthorityService`, `marketingCampaignService`, `marketingTemplateService`, `errorMiddleware`, `seedMarketingWorkflowRules` ; côté web `MarketingDashboardPage`, `AdminDashboard`, `dashboardProfiles`, `PropertyModerationPage`, `PropertyRegistry`, `propertyService`.
- **Tests serveur** : 5 nouveaux fichiers, 18 adaptés à la règle validée et 1 date codée en dur corrigée.
- **Tests web** : 6 fichiers adaptés ou étendus.
- **Mobile** : 1 directive de lint ajoutée.

## 6. Modèles et endpoints

- Habilitations — `GET/POST /api/platform-operators/:userId/capabilities` (`platform.operators.manage` + PLATFORM ; liste déléguable fermée).
- `ContactAuthorization` — `GET/POST /api/contact-authorizations`, `GET /api/contact-authorizations/:id`, `PATCH /api/contact-authorizations/:id/revoke` (mutations : `platform.commercial.manage`).
- `ApplicationDisclosureEvent` — `GET /api/real-estate-applications/:id/contact-disclosure` (autorisation de contact exacte, divulgation tracée).
- `CommercialPublicationRevision` — décisions via `PATCH /api/properties/admin/:id/:action`, `PATCH /api/admin/properties/:id/{approve|reject}`, `PATCH /api/hotels/:id/:action`, `PATCH /api/accommodations/:id/:action` ; files `GET …/status/pending` (+ `pending-count`) : `platform.commercial.manage` + PLATFORM.
- `MarketingConsentEvent` — `GET/PATCH /api/users/me/marketing-preferences`, `POST /api/marketing-preferences/unsubscribe`.
- Marketing — `/api/marketing/*` : `platform.marketing.manage` + PLATFORM.
- Automatisation CRM — `POST/PATCH /api/crm-automation/rules` : refus 403 `CRM_MARKETING_ACTION_FORBIDDEN` / `CRM_OUTBOUND_ACTION_NOT_ALLOWED`.

## 7. Autorisations

- **Identité Altitude Vision** : `PlatformOperator` actif détenant la capacité exacte, relue juste avant chaque mutation. Jamais `User.role`, une adhésion tenant, un nom ou un `tenant: null`.
- **Contextes** :
  - PLATFORM = opérateur éligible, sans tenant sélectionné ;
  - TENANT = tenant sélectionné résolu ;
  - UNRESOLVED = refus.
- **Capacités** :
  - `platform.commercial.manage` : modération et mise en relation ;
  - `platform.marketing.manage` : campagnes et modèles.
  Toutes deux exigent l'éligibilité à la Vue plateforme pour les routes HTTP.
  - `platform.support.read` / `platform.support.reply` : boîte de support (lecture / réponse), relues à chaque accès, envoi ou événement socket. Une suspension ou révocation prend effet immédiatement (testé).
- **Organisations** : elles conservent le CRM opérationnel (activités, tâches, rappels, opportunités, notifications internes), la gestion de leurs biens, la suppression, les opérations hôtelières et la décision finale sur les candidatures.

## 8. Compatibilité des données existantes

- Les conversations directes historiques passent en lecture seule ; aucune autorisation rétroactive.
- Les annonces déjà approuvées restent publiques ; une nouvelle validation sans modification renvoie 409 `PUBLICATION_REVISION_EMPTY`, sans effet de bord.
- Les annonces en attente rejoignent la file plateforme sans changement de tenant.
- Les modèles et campagnes marketing rattachés à un tenant restent lisibles et annulables, mais ne peuvent plus être activés, approuvés ni envoyés.
- Les règles d'automatisation tenant contenant une action marketing restent stockées mais échouent fermées à l'exécution.
- Aucun consentement rétroactif, aucune migration ni reprise de données (backfill) exécutée.
- Boîte de support : aucune donnée modifiée. Les conversations existantes restent attribuées au tenant du bien (provenance seulement), mais ce rattachement n'ouvre plus aucun accès. Les opérateurs existants détenant `platform.support.read` lisent sans pouvoir répondre tant que `platform.support.reply` ne leur est pas accordée. Les notifications déjà reçues par du staff d'organisation avant le correctif restent dans leur historique (aucune purge).

## 9. Tests exécutés (nombres exacts)

| Campagne | Résultat |
|---|---|
| **Campagne finale après le Lot N et le correctif `Object.groupBy` (2026-10-12, référence)** | |
| Unitaires serveur, 1re passe | 171/173 suites, 1900/1901 : `hotelRoutes` (délai de 5 s dépassé) et `estimationBadge` (worker Jest tué par SIGSEGV, suite non exécutée). Les deux sont **verts isolément** (2 suites, 50/50), sur des fichiers non modifiés. Classement : *environnement*. |
| Unitaires serveur, relance complète | **173/173 suites, 1906/1906** |
| Suites ciblées (Lot N, boîte de support, messagerie, notifications d'instruction, `legacyRentalTestDataCleanupC211D`) | 8 suites, **84/84** |
| `certify:architecture` | GREEN, **7/7** |
| `certify:tenant` | GREEN, **97/97** |
| `certify:frontend` | GREEN, 179 fichiers, **1335/1335** |
| **Mongo complet, 8 shards** (réplique exacte du runner officiel, un processus par shard, deux tâches successives pour respecter la limite de 2 h) | **240/240 suites, 3187/3187 tests** |
| — shards 1 à 8 | 539/539 · 400/400 · 367/367 · 416/416 · 386/386 · 346/346 · 388/388 · 345/345 (30 suites chacun) |
| Mobile | non relancé (aucun fichier mobile modifié depuis la dernière exécution, 657/657) |
| **Campagne après la politique de délégation (2026-10-12)** | |
| Unitaires serveur `npm run test:unit` | 173 suites, **1906/1906** |
| `certify:architecture` | GREEN, **7/7** |
| `certify:tenant` | GREEN, 7 suites, **97/97** |
| `certify:frontend` | GREEN, 179 fichiers, **1335/1335** |
| Régressions opérateurs ciblées (`platformAdmin1.adversarial`, `platformAdminAuthorityHardening`, `platformOperatorLifecycle04C2`, `platformAdminBootstrap1` ×2, `dataReset1`) | 6 suites, 108/109 avant l'alignement de D13, puis `platformOperatorLifecycle04C2` **26/26** |
| **Mongo complet, 8 shards** (réplique exacte du runner officiel : un replica set par shard, `safeTestEnv`, mêmes drapeaux Jest ; un processus par shard) | **238/239 suites, 3181/3182 tests** |
| — shard 1/8 | 30/30 suites, 539/539 |
| — shard 2/8 | 29/30 suites, 399/400 (échec : `legacyRentalTestDataCleanupC211D`, `Object.groupBy`) |
| — shard 3/8 | 30/30 suites, 367/367 |
| — shard 4/8 | 30/30 suites, 416/416 |
| — shard 5/8 | 30/30 suites, 386/386 |
| — shard 6/8 | 30/30 suites, 346/346 |
| — shard 7/8 | 30/30 suites, 388/388 (relancé seul : la 1re exécution a été interrompue par la limite de 2 h de la tâche de fond, sans résultat) |
| — shard 8/8 | 29/29 suites, 340/340 (exécuté avec la relance du shard 7) |
| **Après les habilitations** | |
| Unitaires serveur | 172 suites, **1903/1903** |
| Mongo opérateurs, plateforme et support (12 suites : `platformOperatorDelegatedCapabilities`, `platformAdmin1.adversarial`, `platformAdminAuthorityHardening`, `platformAdminBootstrap1` ×2, `platformAdminCert1` ×2, `platformAdminGlobalUsers`, `platformOperatorLifecycle04C2`, `platformViewEligibility`, `platformNativeSpecializedWorkflows`, `supportInboxIsolation`) | **12 suites, 256/256** |
| Web ciblé (`UsersAccreditations`, `GlobalUsersPanel`, `UsersContextPanel`) | 3 fichiers, **24/24** |
| `certify:architecture` | GREEN |
| `certify:tenant` | GREEN, **97/97** |
| `certify:frontend` | GREEN, 179 fichiers, **1335/1335** |
| **Après le correctif P0 (2026-10-12)** | |
| Unitaires serveur `npm run test:unit` (après la dernière modification de code) | 172 suites, **1903/1903** |
| `supportInboxIsolation.mongo` (nouvelle) | **15/15** |
| Régressions Mongo messagerie, socket, plateforme et hôtel (20 suites, voir ci-dessous) | 1re passe : 17 suites vertes, 3 rouges (240 tests réussis, 15 échecs) ; les 3 suites figeaient l'ancienne règle et ont été réécrites, puis relancées : **3 suites, 47/47** |
| CRM (`crm360TenantBoundary` avec CRM360-21, `crm`, `platformCrmAdministration`) | 3 suites, **51/51** (CRM360-21 rouge avant le correctif) |
| `certify:tenant` | GREEN, 7 suites, **97/97** |
| `certify:architecture` | GREEN |
| `certify:frontend` (web complet) | GREEN, 178 fichiers, **1328/1328** |
| Mobile `npm test` | 78 suites, **657/657** |
| Lint des fichiers modifiés (serveur, web, mobile) | 0 erreur ; avertissements préexistants uniquement |
| **Avant le correctif P0** | |
| Unitaires serveur `npm run test:unit` | 172 suites, **1897/1897** |
| `certify:tenant` | GREEN, 7 suites, **97/97** |
| `certify:architecture` | GREEN |
| `certify:frontend` (web complet) | GREEN, 177 fichiers, **1323/1323** |
| `certify:financial` | GREEN, 18 suites, **188/188** |
| Mobile `npm test` | 77 suites, **652/652** (inscription Client par e-mail incluse) |
| Mobile TypeScript / lint | 0 erreur / 0 erreur (128 avertissements préexistants) |
| Mongo complet, shards 1–3, 5, 6 (script officiel) | 148 suites ; 4 en échec, toutes reclassées et corrigées ou expliquées (ci-dessous) |
| Mongo, shards 7–8 (Jest `--shard`, même découpage) | 58 suites, 708/713 ; 5 échecs alignés sur la règle validée |
| Shard 4 (plantage SIGSEGV de Node) + suites corrigées, relance finale | **37 suites, 553/553** |
| Lot E sortie | 12 suites **197/197** ; UI marketing 20/20 |
| Lot D | frontière 4/4, messagerie hôtelière 5/5, 35 suites hôtel/hébergement (2 échecs reclassés et corrigés) |

**Les 20 suites de régression P0 :**
- *Boîte de support et messagerie* : `supportInboxIsolation`, `commercialMessagingPolicy`, `conversationCommercialStart`, `securityClosureP0WaveMessagingSendAuthority`, `messageReadAuthority`, `messagingPlatformInboxAggregation`, `messagingTenantAmbiguousStaff`.
- *Socket.IO* : `socketTenantIsolation`, `socketDistributedAdapter` (Redis, deux instances), `socketPlatformSupportLive.e2e`.
- *Plateforme et isolation* : `platformNativeSpecializedWorkflows`, `contactAuthorization`, `contactAuthorizationRoutes`, `dashboardHomeTenantTransition`, `platformAuthorityTenantIsolation`, `tenantHardening2.adversarial`, `platformViewEligibility`, `platformOperatorLifecycle04C2`.
- *Hôtellerie* : `hotelOperationalMessaging`, `hotelCommercialOperationalBoundary`.

**Matrice P0 exigée (toutes couvertes par des tests verts) :**
- Collaborateur sur un prospect de son propre bien : REFUS. Les rôles Admin et CommunityManager sont aussi testés.
- Autre organisation : REFUS.
- Prospect `tenant: null` : REFUS.
- Agent habilité : OK (lister, lire, pièce jointe, répondre, socket).
- Agent sans capacité, ou avec la seule capacité commerciale : REFUS.
- Agent en lecture seule qui répond : REFUS.
- Agent suspendu ou révoqué : REFUS immédiat, y compris sur Socket.IO.
- Routes héritées (`/start`, `POST /api/messages`, `GET /api/messages/:id`), pièces jointes, Socket.IO, notifications et CRM 360 pour une organisation : REFUS.

**Couverture Mongo :** les 236 suites ont toutes été exécutées au moins une fois. La dernière exécution de chacune est verte, sauf `legacyRentalTestDataCleanupC211D` (§10).

**Classement des échecs rencontrés :**
- *Comportement obsolète du test* (ancienne modération ou ancien marketing tenant) : adapté à la règle validée, sans affaiblir l'intention.
- *Date codée en dur* : `hotelOverbookingConcurrency` (arrivée au 2026-10-10, désormais passée), corrigé en dates relatives.
- *Environnement* : mise en veille ou charge parallèle (`accommodationReservation`, `rentalManagementBiensInscritsStat`, `financialMongoHarnessLifecycle`), puis vert isolément ; SIGSEGV du shard 4.
- *Défaut produit* : mapping d'erreurs (500 au lieu de 4xx), rejet sans motif en interface, marketing piloté par l'émetteur de l'événement, page marketing liée au rôle. Tous corrigés selon le cycle RED/GREEN.

## 10. Tests non exécutés ou en échec connu

- ~~`legacyRentalTestDataCleanupC211D` (`Object.groupBy`)~~ : corrigé (§4 quinquies).
- `npm run certify:release` (porte de release complète) : non exécutée.
- Tests E2E Playwright (`client`) : non exécutés.
- Build Next.js de production et build Expo/EAS : non exécutés (interdits ou hors certification de domaine).
- Les suites des shards 1–3 et 5–6 n'ont pas été relancées après le dernier changement de `errorMiddleware`. Il ne modifie que des réponses auparavant en 500 ; les unitaires et la relance finale sont verts.
- Mobile : non relancé après les habilitations et la politique de délégation (aucun fichier mobile modifié ; dernière exécution 657/657).
- Suite Mongo complète : **exécutée** après tous les correctifs, **240/240 suites et 3187/3187 tests** (§9). L'ancien échec `legacyRentalTestDataCleanupC211D` (`Object.groupBy`) est corrigé (§4 quinquies). Seules les 20 suites de régression ciblées, les 3 suites CRM et `certify:tenant` l'ont été. D'autres suites peuvent encore figer l'ancien accès du staff d'organisation à la boîte de support. À exécuter avant toute livraison.

## 11. Risques résiduels

1. **R1 — Boîte de support exposée aux organisations : CORRIGÉ** (§4 bis). Risques résiduels liés :
   - **Agents à habiliter.** Tout employé d'Altitude Vision qui doit répondre doit être un `PlatformOperator` actif avec `platform.support.read` et `platform.support.reply`. Sans octroi, la boîte n'a pas de répondant en production.
   - **Fragilité préexistante.** Dans `messageController`, l'appel `getIO()` précède `notify()` lors d'une réponse d'agent. Si Socket.IO n'est pas initialisé (cas des tests), la notification du prospect n'est pas créée. En production, Socket.IO est initialisé.
   - **Mobile.** Il n'y a pas de console de support mobile pour les agents au rôle `Client` au-delà de la liste ; la console de référence est le web.
   - **Historique.** ~~Notifications reçues par du staff d'organisation avant le correctif~~ : masquées à la lecture (Lot N), sans purge. Elles restent en base, et les **push Expo déjà délivrés** sur les appareils avant le correctif ne peuvent pas être rappelés.
   - ~~Fragilité `getIO()` avant `notify()`~~ : corrigée (Lot N).
2. ~~Octroi complet non borné~~ : **CORRIGÉ** (§4 quater). Les capacités critiques ne s'attribuent plus que par provisionnement privilégié CLI. Risque résiduel : quiconque dispose d'un accès shell et base peut exécuter ces scripts. C'est le périmètre de confiance de l'infrastructure, déjà gardé par dry-run, `--confirm-database` et la garde de production.
3. Un administrateur critique suspendu ne peut plus être réactivé par HTTP ; sa récupération exige le CLI. Une délégation unitaire ne réhabilite jamais un opérateur suspendu ou révoqué.
4. Pas de canal opérationnel invité ↔ hôte pour les hébergements non hôteliers (fermé par défaut).
5. `crm.notification.create` sans `body` explicite échoue (champ requis) : défaut préexistant.
6. Pas d'automatisation marketing plateforme (fermée par conception tant qu'aucun modèle de règle plateforme n'existe).
7. Un code client ancien qui rejetterait sans motif reçoit désormais 422 (attendu).

## 12. Décisions encore nécessaires

1. ~~R1~~ : tranché par l'utilisateur, uniquement des agents `PlatformOperator` (`platform.support.*`). Reste à désigner et habiliter les agents réels, désormais depuis l'onglet Utilisateurs (action d'administration, hors code).
1 bis. ~~Borner l'octroi complet~~ : tranché (liste fermée appliquée partout).
1 ter. **Procédure exceptionnelle d'attribution ou de récupération des capacités critiques par HTTP.** D13 validée par l'utilisateur : la réactivation des opérateurs critiques reste réservée à la procédure administrative (CLI) existante. Le principe de double approbation est validé, mais son **implémentation par API n'est pas autorisée à ce stade**. Contrat consigné pour plus tard :
   - **Portée** : `platform.operators.manage`, `platform.support.impersonation`, capacités financières et d'administration ; réactivation d'un administrateur critique.
   - **Double contrôle** : une demande créée par l'administrateur A (motif, capacités exactes, cible) ; une approbation par un administrateur B distinct, actif, détenteur de `platform.operators.manage` et de chaque capacité demandée (pas d'amplification) ; jamais A = B ; jamais la cible parmi A ou B.
   - **Limites** : expiration (24 h par exemple) ; une demande par cible à la fois ; transaction et verrou sentinelle ; audit de la demande, de l'approbation et du refus ; notification des autres administrateurs critiques.
   - **Pendant ce temps** : le CLI `bootstrapPlatformOperator` reste la seule voie.
2. Faut-il un canal opérationnel pour les hébergements non hôteliers ?
3. Faut-il une automatisation marketing au niveau plateforme (modèle de règle sans tenant) ?
4. Validation juridique : durées de conservation, libellés de consentement, politique de confidentialité, contrats prestataires (Data Safety « Partagé »).
5. ~~Node ≥ 21 ou remplacement d'`Object.groupBy`~~ : remplacement local effectué ; Node 20 conservé.
6. Purge éventuelle des anciennes notifications de support en base (aujourd'hui seulement masquées) : décision de conservation des données, non exécutée.

## 13. Impacts web / mobile

- **Web** :
  - files de modération et décisions exclusivement en Vue plateforme ; motif de rejet obligatoire ;
  - registre et modération sans action pour un Admin tenant ;
  - marketing visible uniquement pour un opérateur `platform.marketing.manage` en Vue plateforme ;
  - messagerie en lecture seule selon l'état serveur ;
  - boîte « Messages clients » visible et accessible aux seuls agents `platform.support.read` ; le staff d'organisation garde `/messages` ;
  - coordonnées de candidat et de visite affichées uniquement sur projection autorisée.
- **Mobile** : consentement et préférences marketing, messagerie en lecture seule, visites sans téléphone imposé, correctif d'inscription Client. Correctif P0 : `ConversationsScreen` ne charge la boîte de support que pour un agent actif `platform.support.read` ; les membres d'organisation chargent leur messagerie directe.

## 14. Google Play — Sécurité des données

La documentation (`docs/compliance/marketing-consent-and-retention.md` §7, `google-play-data-safety.md`) couvre le consentement marketing, la suppression et l'usage CRM. Points nouveaux à refléter :
- coordonnées des prospects divulguées uniquement après autorisation explicite d'Altitude Vision, et tracées ;
- justificatifs protégés indépendamment de la messagerie ;
- messagerie directe limitée aux échanges autorisés ou opérationnels.

Aucune case déclarée ne change de nature : les finalités restent celles listées au §7 du document de conformité. La réponse « Partagé » reste conditionnée aux contrats prestataires.

## 15. AAB

L'AAB **1.0.1 (versionCode 4) ne contient aucun de ces changements**, ni MARKETING-CONSENT-1, ni le correctif d'inscription Client. Une future version Android devra utiliser **versionCode ≥ 5**. Aucun AAB n'a été construit.

## 16. Confirmation

Aucun commit, push, déploiement (Netlify/Render), migration ou écriture en base de production, envoi réel (e-mail, SMS, WhatsApp, push), campagne réelle, build EAS/AAB ni soumission Google Play n'a été effectué. HEAD est resté sur `5a54a135b61b30de9b8d298f2cdc2ae282eec330`.
