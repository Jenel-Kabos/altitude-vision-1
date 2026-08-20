# PAY-4 — MTN MoMo Direct Congo : intégration sandbox

Date : 2026-08-19. Branche `main`, `HEAD bfdd67c8f8293c690640fab799b2aae062196d7a` (inchangé pendant tout le sprint).

## 1. Verdict

**PAY-4 MTN MOMO : IMPLÉMENTATION CERTIFIÉE / SANDBOX RÉEL NON CONFIRMÉ.**

Le provider `mtn_direct` est réellement implémenté (transport, adaptateur, orchestrateur Financial Core, contrôleurs, routes), avec une architecture qui empêche structurellement — et pas seulement par convention — les trois risques centraux du mandat (double débit, callback forgé, IDOR facture). **Aucun credential sandbox MTN n'était disponible dans cette session** : aucun appel réseau réel n'a été effectué, conformément au mandat (§10/§45 : jamais d'appel réel sans credentials fournis). Toute la validation vient de tests unitaires avec transport mocké, fidèles au contrat corroboré depuis des sources partiellement officielles (voir §3-4). Voir §46 pour les prérequis avant tout test sandbox réel puis toute mise en production.

## 2. Baseline Git

Voir `PAY4_MTN_MOMO_ETAT_INITIAL.md` §1. `HEAD` inchangé (`bfdd67c8f8293c690640fab799b2aae062196d7a`) pendant tout le sprint — aucun commit externe cette fois, contrairement à PAY-2/PAY-3.

## 3. Documentation MTN utilisée

- `momo.mtn.com/api/` (domaine officiel `mtn.com`, page statique) : **source primaire confirmée** — liste explicitement "Congo Brazzaville" parmi les marchés MTN MoMo API.
- `momodeveloper.mtn.com` (portail développeur officiel) : **inaccessible en contenu utile** dans cette session — la plateforme est une SPA JavaScript ; les outils de récupération disponibles n'obtiennent que la coquille de navigation (menus "Documentation"/"API Sandbox"/"Products"), jamais le contenu technique détaillé (endpoints, schémas). Confirmé aussi sur le portail miroir `momoapi.mtn.co.rw`, structurellement identique.
- Corroboration structurelle (source **secondaire, non officielle**, jamais copiée comme code) : une capture Postman documentant un test sandbox réel (`gist.github.com/chaiwa-berian`), utilisée uniquement pour vérifier la cohérence des noms de headers/endpoints/format déjà déduits, et un exemple de payload `FAILED` avec `reason` trouvé via recherche web.

**Limite honnête** : je n'ai pas pu consulter le Swagger/OpenAPI officiel complet, ni confirmer par une source primaire irréfutable certains détails secondaires (voir NON CONFIRMÉ, §45). Le contrat central (endpoints, headers, statuts, séquence d'authentification) est corroboré par recoupement de plusieurs sources indépendantes convergentes, ce qui constitue une base raisonnable pour une implémentation sandbox — mais pas le niveau de certitude d'une lecture directe du Swagger officiel.

## 4. API choisie

**MTN MoMo Collections (Open API)**, produit "Request to Pay", version `v1_0`. Base sandbox : `https://sandbox.momodeveloper.mtn.com`. Distincte de : Disbursements (paiement sortant, non pertinent — on collecte, on ne paie pas), Remittances (transferts entre comptes MoMo), et de toute variante "MADAPI"/OAuth dont l'existence n'a pu être ni confirmée ni infirmée pour Collections — non mélangée, jamais évoquée dans le code produit.

## 5. Pourquoi cette API

C'est la seule ayant pour objet exact "recevoir un paiement d'un client via son wallet MTN MoMo" (Request to Pay = collection), correspondant précisément au besoin métier (client paie une facture hôtel). Confirmée par multiples sources convergentes (portail officiel + SDK tiers actifs + capture sandbox réelle) comme le produit standard pour ce cas d'usage à travers tous les marchés MTN MoMo.

## 6. Congo support

**Confirmé par source primaire officielle** (`momo.mtn.com/api/`, domaine `mtn.com`) : "Congo Brazzaville" listé explicitement parmi les marchés MTN MoMo API supportés, aux côtés du Bénin, Cameroun, Côte d'Ivoire, Eswatini, Guinée Conakry, Guinée-Bissau, Ghana, Libéria, Rwanda, Afrique du Sud, Ouganda, Zambie, Nigéria, Soudan, Soudan du Sud, Afghanistan. Le mandat §4 affirmait déjà ce fait ; il est ici revérifié indépendamment plutôt que simplement recopié.

## 7. Sandbox

Contrat technique sandbox utilisé (corroboré §3) :
- Base URL : `https://sandbox.momodeveloper.mtn.com`
- Auth : Basic (API User + API Key, provisionnés hors-ligne au préalable — non implémenté dans ce sprint, voir §46) → `POST /collection/token/` → `{access_token, token_type, expires_in}`
- `POST /collection/v1_0/requesttopay` — headers `Authorization: Bearer`, `X-Reference-Id` (UUID v4, généré serveur), `X-Target-Environment: sandbox`, `Ocp-Apim-Subscription-Key`, `X-Callback-Url` (optionnel) — corps `{amount, currency, externalId, payer:{partyIdType:'MSISDN',partyId}, payerMessage, payeeNote}` → **202 Accepted, corps vide**
- `GET /collection/v1_0/requesttopay/{referenceId}` — même headers (sans corps) → `200 {financialTransactionId?, status, reason?}`
- Statuts observés : `PENDING`, `SUCCESSFUL`, `FAILED` (majuscules) — **aucun `CANCELLED` trouvé** dans les sources consultées ; corrigé dans le registre PAY-3 qui l'avait provisoirement inclus par erreur (§3 de `PAY4_MTN_MOMO_ETAT_INITIAL.md`).
- Devise sandbox : les exemples corroborés utilisent systématiquement `EUR`, indépendamment du marché ciblé (comportement largement rapporté par la communauté développeur, **non confirmé depuis une source primaire officielle dans cette session**) — traité comme un paramètre de configuration distinct (`MTN_MOMO_CURRENCY`, défaut `'EUR'`), jamais confondu avec la devise réelle stockée dans `FinancialPayment` (toujours `XAF`).

Aucun appel sandbox réel effectué (§1).

## 8. Production model

**NON CONFIRMÉ** — aucune information primaire obtenue dans cette session sur l'URL de production, le processus de souscription commerciale, ni les conditions de go-live pour le marché Congo-Brazzaville. Nécessite un contact direct MTN Congo / MoMo Developer Program. Voir §46.

## 9. Configuration

`server/services/payments/providers/mtn/mtnMoMoConfig.js` — validation paresseuse (à l'usage, jamais au démarrage du serveur). Variables requises : `MTN_MOMO_ENVIRONMENT`, `MTN_MOMO_BASE_URL`, `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`. Optionnelles : `MTN_MOMO_CALLBACK_URL`, `MTN_MOMO_CURRENCY`. Aucune n'existe dans `client/`/`altimmo-app/`, aucune sous `EXPO_PUBLIC_*`/`NEXT_PUBLIC_*` — vérifié par grep, confirmé absent.

## 10. Credentials

**Aucun credential sandbox fourni à cette session.** Noms de variables documentés (§9), aucune valeur, aucun secret en dur nulle part dans le code (vérifié par relecture intégrale des fichiers produits). `mtnMoMoConfig.js` échoue explicitement (`MTN_MOMO_CONFIG_MISSING`, HTTP 503) si l'une manque, plutôt que de tenter un appel avec des valeurs partielles.

## 11. Token lifecycle

`POST /collection/token/`, Basic auth (`apiUser:apiKey` en base64), retourne `{access_token, expires_in}`. Implémenté dans `mtnMoMoClient.fetchAccessToken`. Testé (`mtnMoMoClient.test.js`) : construction correcte de l'en-tête Basic, réponse invalide rejetée explicitement (`MTN_MOMO_PROVIDER_ERROR`).

## 12. Token cache

Cache en mémoire processus (`{accessToken, expiresAt}`), marge de sécurité 60s avant l'expiration réelle déclarée par MTN. Jamais persisté en Mongo (mandat §12). Testé : réutilisation avant expiration (1 seul appel token pour 2 paiements), refetch après expiration (2 appels token avec avance d'horloge simulée).

## 13. Concurrence token

Mécanisme single-flight (`inFlightTokenRequest`, promesse partagée) : 20 appels `requestToPay` concurrents ne déclenchent qu'**un seul** appel `POST /collection/token/`, vérifié par test dédié avec une promesse de token délibérément retardée pour forcer le chevauchement.

## 14. Provider registry

`server/services/finance/paymentProviderRegistry.js` (posé en PAY-3) : l'entrée `mtn_direct` est désormais réellement branchée sur `mtnMoMoProvider` (`initiatePayment`/`getStatus`/`verifyCallback`/`normalizeStatus`), `integratedWithFinancialCore` passé à `true` (seul provider automatique dans ce cas). Contrat du registre **non modifié** — mêmes noms de méthode qu'en PAY-3, seule l'implémentation change (mandat §6 : « ne change pas l'interface provider sans nécessité démontrée » — aucune nécessité, aucun changement d'interface).

## 15. RequestToPay

`mtnMoMoProvider.initiatePayment` : génère (ou réutilise, voir §26) la référence via `mtnMoMoClient.generateReferenceId()` (`crypto.randomUUID()`, jamais fournie par le client — mandat §14). Appelle `mtnMoMoClient.requestToPay`, qui poste vers MTN et retourne `{providerStatus: 'PENDING'}` sur 202 uniquement.

## 16. X-Reference-Id / providerPaymentId

`X-Reference-Id` = référence générée serveur = `FinancialPayment.providerPaymentId`. Protégé par l'index unique existant `{provider, providerPaymentId}` (Financial Core, F1, non modifié). Le client ne peut jamais le choisir — le contrôleur `initiate` n'accepte que `{reservationId, documentId, amountMinor, msisdn}`.

## 17. MSISDN

Validé et normalisé côté serveur (`mtnMoMoProvider.normalizeMsisdn`), jamais une confiance en une regex frontend. Format canonique : `242` + 9 derniers chiffres significatifs, tolérant `+242`, `00242`, ou saisie locale. Aucune détection d'opérateur par préfixe (mandat §15 respecté à la lettre) — le client choisit explicitement "MTN Mobile Money" en amont. Numéro rejeté explicitement (`MTN_MOMO_INVALID_MSISDN`) si moins de 9 chiffres significatifs. Testé exhaustivement (formats valides/invalides).

## 18. XAF

`FinancialPayment.currency` reste toujours `'XAF'` (F2.2, inchangé). La devise réellement envoyée à MTN (`MTN_MOMO_CURRENCY`, défaut `'EUR'` en sandbox, §7) est un paramètre de transport distinct, jamais confondue avec la devise stockée — documenté explicitement dans le code et ce rapport comme un point à re-confirmer en production (NON CONFIRMÉ, §45).

## 19. Amount

Le montant envoyé à MTN vient exclusivement du solde réel de la `FinancialDocument` serveur (`assertRequestedAmountWithinBalance`), jamais d'une valeur arbitraire du client au-delà de ce plafond. Testé : montant supérieur au solde → `FINANCIAL_DOCUMENT_OVERPAYMENT`, montant nul/négatif → `FINANCIAL_INVALID_AMOUNT`, montant partiel valide → accepté.

## 20. 202 semantics

Règle absolue implémentée et testée à trois niveaux (transport, provider, orchestrateur) : `202 → { status: 'PENDING' }` uniquement, jamais `succeeded`/`confirmed`. Aucun statut HTTP différent de 202 n'est interprété comme un succès implicite (testé).

## 21. Status mapping

`MTN_STATUS_MAP` (source unique dans `mtnMoMoProvider.js`, consommée par le registre — pas de duplication) : `PENDING→pending`, `SUCCESSFUL→succeeded`, `FAILED→failed`. Aucun nouvel enum `FinancialPayment` créé — les trois valeurs existaient déjà (F1). Statut non reconnu → erreur explicite, jamais une supposition silencieuse (testé).

## 22. Callback

`POST /api/payments/providers/mtn/callback` (public, sans JWT — routeur dédié `paymentProviderRoutes.js`, monté hors de `/api/financial`). `mtnMoMoProvider.extractCallbackReference` n'extrait **qu'une référence**, jamais un statut de confiance (`trusted: false` systématique, testé).

## 23. Callback security — cœur anti-P0

**Aucune signature callback exploitable n'a pu être confirmée pour Collections depuis une source primaire dans cette session** (le portail officiel étant inaccessible en contenu, §3) — conformément au mandat §22, la conséquence assumée est que **toute confirmation passe obligatoirement par une GET status inquiry réelle** (`mtnHotelPaymentBridge.reconcileMtnHotelPayment`), jamais par le corps du callback. Prouvé par le test le plus important de ce sprint (`mtnHotelPaymentBridge.test.js`, "ANTI-P0") : un callback dont le corps prétend `SUCCESSFUL` ne confirme **rien** si la vraie réponse MTN (mockée) est `PENDING`. C'est structurellement impossible de reproduire le P0 CinetPay ici — le code ne lit même pas `body.status`.

## 24. Callback idempotence

Un callback dupliqué sur un paiement déjà `succeeded`/`failed` ne rappelle même pas MTN (`payment.status !== 'pending'` → `transition: 'none'` immédiat, testé). Aucune double confirmation, aucune double allocation possible par ce mécanisme (aucune allocation n'est d'ailleurs créée automatiquement — voir §29).

## 25. Status inquiry

`GET`-équivalent implémenté (`mtnMoMoClient.getTransactionStatus` → `mtnMoMoProvider.getStatus`), exposé côté API via `POST /api/financial/hotel/payments/:paymentId/mtn/check-status` (action utilisateur "Vérifier le paiement", mandat §25), accessible au titulaire du paiement ou à un staff avec capacité de lecture financière (testé, IDOR vérifié).

## 26. Reconciliation

`reconcileMtnHotelPayment` sert à la fois de mécanisme de callback (corroboration) et de status inquiry manuelle — même fonction, même garantie. **Pas de cron/polling automatique implémenté** dans ce sprint (mandat §26 : « ne crée pas un cron agressif sans audit de l'infrastructure existante ») — l'infrastructure de tâches planifiées existante (`node-cron`, utilisée pour Facebook sync/IMAP) n'a pas été auditée dans ce sprint faute de temps ; brancher un cron de réconciliation périodique sur les paiements `mtn_direct` `pending` depuis plus de N minutes est documenté comme prochaine étape (§50), pas codé.

## 27. Timeout ambiguity

Résolu par ordre d'opérations strict : référence générée et persistée (`FinancialPayment.providerPaymentId`, statut `pending`) **avant** l'appel réseau `RequestToPay`. Un timeout après cet appel laisse le paiement `pending` avec sa référence exploitable — jamais une seconde `RequestToPay`. Testé à trois niveaux (transport : 1 seule tentative ; orchestrateur : `initiatePayment` appelé une seule fois même après timeout, résultat `CHECK_STATUS`).

## 28. Fallback prevention

`assertFallbackAllowed` (posé en PAY-3) reste la garde disponible — non appelée activement par PAY-4 (aucun fallback MTN→Yabetoo codé, conforme mandat §29 : « respecter absolument »). Testée et héritée sans modification.

## 29. FinancialPayment

`financialPaymentService.createHotelPayment` étendu (additif, rétrocompatible) pour accepter `provider`/`providerPaymentId` optionnels — défaut `'manual'` si absents, comportement F2.2 strictement inchangé pour tout appelant existant (vérifié : tests F2.2/F2.3 mongo toujours verts sans modification). `mtnHotelPaymentBridge` n'écrit **jamais** directement dans `FinancialPayment` — toujours via cette fonction canonique.

## 30. Allocation

**Non automatisée dans ce sprint.** Un paiement MTN confirmé (`succeeded`) reste, comme un paiement manuel confirmé, en attente d'allocation explicite via l'API F2.2 existante (`POST /api/financial/payments/:paymentId/allocations`, staff autorisé) — **aucune ligne de code n'a été ajoutée pour distinguer un paiement `mtn_direct` d'un paiement `manual` à ce niveau**, exactement la garantie demandée par le mandat §31 (« vérifier qu'un paiement MTN confirmé peut être affecté... exactement comme manual payment confirmed »). Non re-testé spécifiquement (l'allocation ne lit jamais `provider`, confirmé par lecture de `paymentAllocationService.js`, non modifié).

## 31. Ledger

`payment.created` (à l'initiation), `payment.confirmed` (fonction canonique `confirmHotelPaymentCore`, réutilisée sans modification) ou `payment.failed` (nouvelle fonction `failHotelPaymentCore`, même schéma d'écriture que confirmed) — tous dans `FinancialLedgerEntry`, append-only, inchangé. Limite documentée : `actorType` reste `'user'` même pour une confirmation déclenchée par callback système (§16 gaps).

## 32. Hotel readiness

**Aucune condition `if (provider === 'mtn_direct')` nulle part dans le métier de check-out** (vérifié par grep sur `hotelCheckoutFinancialReadinessService.js` et `hotelReservationController.js` — zéro résultat, fichiers non modifiés par ce sprint). Un `FinancialPayment` `mtn_direct` confirmé et alloué influence la readiness exactement comme un paiement manuel confirmé, par construction (le lecteur de readiness ne lit que `status`/allocations actives, jamais `provider`) — hérité, non re-testé spécifiquement au niveau Mongo par manque de temps (voir gaps §45).

## 33. Partial payments

Testé dans l'orchestrateur (`mtnHotelPaymentBridge.test.js`, "montant partiel valide (paiement partiel) est accepté") — aucune règle Financial Core changée, le mécanisme de solde/allocation partielle existant (F2.2) reste seul responsable.

## 34. Overpayments

Protection héritée et testée à l'entrée : `assertRequestedAmountWithinBalance` refuse toute initiation dépassant le solde, avant même d'atteindre MTN — MTN ne peut donc jamais recevoir de demande de paiement dépassant la dette réelle par ce chemin.

## 35. Ownership

`assertActorCanPayReservation` : le client authentifié ne peut initier que pour SA propre réservation (`reservation.guestUser`) ; un staff avec `financial.payment.create` (déjà vérifié par le contrôleur avant d'appeler le bridge) peut initier au nom d'un client. Testé exhaustivement (tiers refusé, titulaire autorisé, staff autorisé).

## 36. Tenant

Non retesté spécifiquement ce sprint — le scope tenant du domaine hôtel est déjà géré par `requireTenantScope` (middleware global de `financialRoutes.js`, non modifié) et par `establishmentId` dérivé serveur (`reservation.hotel`, jamais du client). Aucun changement de comportement tenant introduit.

## 37. IAM

**Aucune capacité IAM existante modifiée** (mandat §37 : « ne modifie pas IAM sauf bug démontré » — aucun bug trouvé). Le chemin d'auto-paiement client est un **nouveau chemin additif** (`assertActorCanPayReservation`, propre au bridge MTN), pas une extension des capacités `financial.*` existantes ni un changement de `FINANCIAL_CAPABILITIES`.

## 38. Error mapping

`mapTransportError` (mtnMoMoClient.js) traduit toute erreur transport en codes internes stables (`MTN_MOMO_TIMEOUT`, `MTN_MOMO_AUTH_FAILED`, `MTN_MOMO_REFERENCE_NOT_FOUND`, `MTN_MOMO_PROVIDER_ERROR`) — **jamais le corps brut MTN renvoyé au client**. Vérifié par lecture et tests dédiés (timeout, réponse invalide).

## 39. Logging

Autorisé et effectivement présent : `provider=mtn_direct` (implicite via les noms d'événement `mtn_momo.*`), référence masquée (`maskReference`, 8 premiers caractères + `…`), statut HTTP, durée. **Jamais** : clé API, clé d'abonnement, jeton bearer, en-tête `Authorization`, MSISDN complet (`maskMsisdn` disponible, non encore appelé partout — voir gaps §45). Vérifié explicitement par test (« le token n'apparaît jamais dans un log »).

## 40. PII

MSISDN stocké dans `FinancialPayment.payer.phone` en clair (comme pour tous les autres providers du dépôt — Yabetoo/CinetPay legacy font de même, aucune régression introduite). `providerMetadata` (champ `select:false` du schéma `FinancialPayment`, hérité F1) n'est jamais rempli par ce sprint — aucun dump brut de réponse MTN persisté.

## 41. Tests unitaires

**4 nouveaux fichiers, 54 tests, tous verts** :
- `mtnMoMoClient.test.js` (12) — config, token (fetch/cache/expiry/single-flight/non-logué), RequestToPay (202/erreur/timeout), GetTransactionStatus.
- `mtnMoMoProvider.test.js` (21) — MSISDN (5 valides + 6 invalides), normalisation de statut (3 + 1 rejet), initiation (référence fournie/générée, jamais confirmée sur 202), callback (jamais `trusted`, référence invalide rejetée, extraction header).
- `mtnHotelPaymentBridge.test.js` (16) — ownership (3), montant (3), idempotence/timeout (2), réconciliation incluant le test **anti-P0** (6), préconditions facture (2).
- `mtnMomoPaymentController.test.js` (5) — callback jamais confiant, référence inconnue neutre, callback invalide toujours 200, ownership check-status (2).

Plus 2 tests ajoutés à `paymentProviderRegistry.test.js` (préservation de l'index unique existant, déjà comptés en PAY-3) et 1 test retiré (mtn_direct n'est plus "non implémenté", net −1 sur ce fichier).

## 42. Tests Mongo

**Aucun nouveau test Mongo créé** pour MTN (aucune donnée MTN-spécifique ne transite par un chemin Mongo non déjà couvert — `createHotelPayment`/`confirmHotelPayment` restent les mêmes fonctions déjà testées en intégration réelle par F2.2/F2.3). Non-régression vérifiée en relançant les suites existantes après les modifications de `financialPaymentService.js` : `hotelFinancialPaymentsF22.mongo.integration.test.js` (4/4), `hotelFinancialCheckoutF23.mongo.integration.test.js` (3/3), `financialCore.mongo.integration.test.js` (13/13) — tous verts, aucune régression.

## 43. Sandbox E2E

**Non exécuté — aucun credential disponible dans cette session** (§1/§10). Verdict honnête : `SANDBOX RÉEL NON CONFIRMÉ`, pas simulé comme "PASS".

## 44. Bugs trouvés

Deux bugs découverts et corrigés **pendant l'écriture des tests de ce sprint**, avant tout commit :
1. `mapTransportError` risquait de ne jamais s'appliquer aux erreurs transport réelles (`error?.code` matchait aussi un code d'erreur axios brut comme `ECONNABORTED`, empêchant la traduction en `MTN_MOMO_TIMEOUT`) — corrigé en testant `instanceof FinancialError` au lieu de la seule présence d'un `.code`.
2. `STATUS_MAPS.mtn_direct` posé en PAY-3 utilisait une casse et un vocabulaire (`pending/successful/failed/cancelled`, minuscules, `cancelled` inexistant) jamais vérifiés contre la documentation réelle — corrigé (`PENDING/SUCCESSFUL/FAILED`, majuscules, sans `cancelled`) après recherche documentaire de ce sprint.

## 45. NON CONFIRMÉ (liste explicite)

- URL/processus de production MTN Congo (§8).
- Existence d'une signature callback exploitable pour Collections (§23 — traité par corroboration systématique plutôt que supposé absent ou présent sans preuve).
- Devise réellement acceptée en production pour le Congo (XAF supposé cohérent avec le marché, jamais confirmé depuis une source primaire).
- Comportement exact du callback en sandbox (les sources indiquent qu'il ne se déclenche pas sans simulation manuelle du PIN) — non testé faute de credentials.
- Politique de retry MTN sur callback perdu ("le callback n'est envoyé qu'une seule fois", affirmé par le mandat §4/§21 — non re-vérifié indépendamment depuis une source primaire accessible dans cette session, mais l'architecture ne dépend de toute façon jamais de cette affirmation pour sa sécurité, §23).
- `maskMsisdn` existe mais n'est pas encore appelé systématiquement partout où un MSISDN pourrait apparaître en log futur — vérifié qu'aucun log actuel n'expose de MSISDN complet, mais pas garanti par une règle automatisée.

## 46. Production prerequisites

1. Compte marchand MTN MoMo Congo-Brazzaville (démarche commerciale, hors code).
2. Credentials production (`MTN_MOMO_API_USER`/`MTN_MOMO_API_KEY`/`MTN_MOMO_SUBSCRIPTION_KEY` de production, jamais les mêmes que sandbox).
3. `MTN_MOMO_CALLBACK_URL` de production joignable publiquement en HTTPS.
4. Confirmation de la devise réelle acceptée (§45).
5. Test sandbox réel complet (§43) avant toute demande de go-live.
6. Revue de sécurité dédiée avant activation production (mandat §52) — ce sprint ne l'active à aucun moment (aucune bascule automatique sandbox→production dans le code, `MTN_MOMO_ENVIRONMENT` reste un paramètre de déploiement, jamais codé en dur).
7. Décision explicite (utilisateur/produit) d'activer — jamais automatique.

## 47. Files changed

Nouveaux : `server/services/payments/providers/mtn/{mtnMoMoConfig,mtnMoMoClient,mtnMoMoProvider}.js`, `server/services/finance/mtnHotelPaymentBridge.js`, `server/controllers/mtnMomoPaymentController.js`, `server/routes/paymentProviderRoutes.js`, `server/constants/paymentProviderConstants.js` (PAY-3), `server/services/finance/paymentProviderRegistry.js` (PAY-3), 4 fichiers de tests MTN + `financialPaymentMassAssignment.test.js`/`paymentProviderRegistry.test.js` (PAY-3), 4 documents PAY-4.

Modifiés : `server/services/finance/financialPaymentService.js` (provider/providerPaymentId additifs + `failHotelPayment` nouveau), `server/routes/financialRoutes.js` (2 routes ajoutées), `server/server.js` (montage du nouveau routeur public).

Aucun fichier frontend/mobile modifié.

## 48. Gates

- `npm run lint` (server, fichiers PAY-4) → 0 erreur, 0 nouvel avertissement.
- `npm run test:unit` → **124/124 suites, 1425/1425 tests** (baseline avant PAY-4 : 120/1371 ; +4 suites, +54 tests nets).
- Tests Mongo pertinents (F2.2/F2.3/Financial Core) → 20/20 verts, aucune régression.
- `git diff --check` → exit 0.
- Client/mobile : non exécutés, aucune modification (conforme mandat §58).

## 49. Git final

```
git status --short → 3 fichiers modifiés (financialRoutes.js, server.js, financialPaymentService.js), le reste nouveau
git diff --check → exit 0
git rev-parse HEAD → bfdd67c8f8293c690640fab799b2aae062196d7a (inchangé pendant tout le sprint)
```
Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session.

## 50. Next step

En attente de validation explicite avant toute suite (mandat §60 : STOP après PAY-4). Étapes candidates pour une décision produit ultérieure, non commencées :
- Obtenir des credentials sandbox MTN réels et exécuter le test E2E manquant (§43).
- Brancher une réconciliation périodique (cron) sur les paiements `mtn_direct` `pending` anciens (§26).
- Ajouter un test Mongo dédié readiness hôtel avec un `FinancialPayment` `provider: 'mtn_direct'` confirmé (§32, actuellement garanti par construction mais non testé en intégration réelle).
- Airtel Direct, migration Yabetoo, UI Web/Mobile de paiement, activation production : **explicitement non commencés**, conforme mandat §60.
