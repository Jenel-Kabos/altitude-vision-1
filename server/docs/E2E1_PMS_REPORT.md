# E2E-1 — Rapport final de certification navigateur du workflow PMS hôtelier

Date : 2026-08-15. Branche `main`, HEAD `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba` (identique au début du sprint — aucun commit effectué, voir §29). Document produit après implémentation, débogage et validation complètes ; fait suite à `E2E1_PMS_ETAT_INITIAL.md`.

## 1. Résumé exécutif

Le cycle PMS complet — réservation → confirmation → check-in → chambre occupée → check-out → chambre en cleaning → housekeeping → inspection → chambre de nouveau disponible — a été certifié de bout en bout par automatisation navigateur réelle (Playwright, Chromium), avec un second acteur réel (Admin) pour le volet financier obligatoire au check-out. **Verdict : E2E-1 CERTIFIÉ VERT** (voir §30 pour le détail des preuves).

Trois bugs applicatifs réels et un bug de test ont été découverts et corrigés pendant la certification (jamais un test affaibli pour « faire passer » un bug) :
1. Un gap d'autorisation backend rendait `/room-assignment` et `/checkout-financial-readiness` inaccessibles à tout Admin plateforme (403 permanent).
2. L'état « prêt pour check-out » affiché au propriétaire/admin restait périmé après toute action financière (facturation, encaissement, allocation).
3. Un bug de génération de référence de réservation (`HotelReservation.reference` jamais généré, découvert au tout début du sprint).
4. Un bug de test (regex traversant une nouvelle ligne) faisait échouer à tort le scénario financier.

## 2. Contexte et objectif

Certifier que le cycle PMS complet fonctionne réellement dans un navigateur, pas seulement via des tests API/unitaires, en réutilisant strictement l'infrastructure et les modèles existants (aucune reconstruction du PMS). Sprint de certification/correction de bugs, pas un sprint de fonctionnalité.

## 3. Périmètre

Inclus : login réel, portail propriétaire, cockpit hôtel, réservations, check-in/check-out, housekeeping, inspection, contexte financier minimal nécessaire au check-out, notifications contextualisées, isolation multi-hôtel/multi-propriétaire, maison meublée non-PMS (contrôle négatif).
Exclu : reconstruction de fonctionnalités PMS, `altimmo-app/` (mobile), tout appel réseau externe réel, toute donnée de production.

## 4. Méthodologie

- Audit préalable complet de l'infrastructure Playwright existante avant tout code (voir `E2E1_PMS_ETAT_INITIAL.md`).
- Réutilisation exclusive du `webServer` partagé unique (`server/scripts/start-accommodation-e2e.js`) — aucun second serveur/DB créé.
- Chaque scénario crée, utilise et vérifie son propre état (discipline QA-1) ; recherche par référence exacte, jamais par sélecteur ambigu.
- Assertions sur URL, statut réseau, payload, texte visible — jamais de simple absence d'erreur.
- Tout bug trouvé a été diagnostiqué par preuve directe (inspection de trace réseau JSON, lecture du code source réel, requêtes curl isolées) avant toute correction — jamais de correction devinée.
- Aucune correction interdite appliquée : aucun contrôle backend supprimé, aucun contournement d'ownership, aucun statut forcé en base depuis le frontend, aucune attente arbitraire ajoutée, aucun test désactivé, aucune assertion affaiblie pour accepter un bug.

## 5. Infrastructure Playwright auditée (rappel)

`client/playwright.config.js` : `testDir: ./e2e`, `fullyParallel: false`, `workers: 1`, `retries: 0`, `trace: on`, `screenshot: only-on-failure`, `video: on`, projets `desktop-chromium`/`mobile-chromium`, `webServer` unique (`reuseExistingServer: false`) lançant un `MongoMemoryReplSet` réel + Express réel (port 5000) + `next dev` réel (port 3000) + faux fournisseur de paiement local, avec blocage réseau externe réel (`externalNetworkGuard.js`).

## 6. Fixtures ajoutées (additives uniquement)

Dans `server/scripts/start-accommodation-e2e.js` : `RoomCategory` A (`unitsAvailable: 8`) et B (`unitsAvailable: 2`), `RatePlan` A/B (`amount: 40000 XAF`), `Room` A1–A8 et B1 (`status: available, active: true`) pour `dash4HotelA`/`dash4HotelB`. Aucune fixture DASH-4 existante modifiée.

## 7. Cartographie UI (rappel, détail complet dans l'état initial)

Login (`/login`) → Portail propriétaire (`/mon-espace-proprietaire`) → Portfolio (`/mes-hotels`) → Cockpit hôtel (`/mes-hotels/:hotelId`) → Réservations (`/mes-hotels/reservations?hotelId=`) → Housekeeping+Inspection (`/mes-hotels/:hotelId/housekeeping`, page unique) → Panneau financier intégré à la carte réservation (`HotelFinancialDocumentPanel.jsx`, lecture seule côté propriétaire) → Override Admin (`/dashboard/hotel-reservations`, `AdminHotelReservationsPage.jsx`) → Maison meublée non-PMS (`/mes-hebergements/:id`).

## 8. Bug réel #1 — Gap d'autorisation backend (Admin bloqué sur les routes hôtelières scopées)

**Symptôme observé** : `GET /api/hotel-reservations/:id/room-assignment` et `GET /api/hotel-reservations/:id/checkout-financial-readiness` retournaient systématiquement 403 pour l'acteur Admin, alors que les routes financières équivalentes (`/api/financial/...`) fonctionnaient pour ce même acteur.

**Preuve** : inspection directe des traces réseau JSON (`0-trace.network`/`1-trace.network`, contextes navigateur séparés Owner/Admin) confirmant les 403 systématiques ; ajout temporaire de logs serveur confirmant que `req.user.platformTenant` n'était jamais peuplé sur ce routeur, contrairement à `financialRoutes.js` qui monte `requireTenantScope`.

**Cause racine** : `server/routes/hotelReservationRoutes.js` n'attachait aucun middleware de contexte tenant, alors que `resolveHotelAccessScope` (branche Admin) exige `actor.platformTenant`.

**Correction** :
- `server/routes/hotelReservationRoutes.js` : ajout du middleware non bloquant `attachTenantContext` (jamais `requireTenantScope`, qui bloquerait à tort Owner/Guest — ceux-ci n'atteignent jamais la branche Admin de `resolveHotelAccessScope`).
- `server/controllers/hotelReservationController.js` (`assertReservationAccess`) : repli sur `req.platformTenant` si `req.user.platformTenant` est absent, par mutation directe de `req.user` (jamais un spread `{...req.user}` — un document Mongoose spread perd `.role`/`.id`, bug intermédiaire constaté et corrigé pendant le diagnostic).

**Portée** : ce correctif bénéficie aux 8 endpoints qui passent par `assertReservationAccess` (getOne, cancel, confirm, reject, checkIn, checkoutFinancialReadiness, checkOut, getRoomAssignment) — aucune régression pour Owner/Guest (chemins d'accès distincts, jamais atteints).

## 9. Bug réel #2 — État financier de check-out périmé dans l'UI

**Symptôme observé** : après facturation/encaissement/allocation réussis côté Admin, le panneau `checkout-financial-readiness` continuait d'afficher « État financier indisponible » ou un état obsolète, empêchant le check-out même une fois la facture soldée.

**Preuve** : trace réseau confirmant que `GET .../checkout-financial-readiness` n'était appelé qu'une seule fois (au montage, doublé par StrictMode), jamais après les mutations financières ultérieures (finalize-lines, issue, payments, allocations).

**Cause racine** : `RoomAssignmentPanel.jsx` (`loadReadiness`) ne se redéclenchait que sur changement de `reservation._id`/`reservation.status` — jamais modifiés par les actions financières, qui se produisent dans des panneaux frères (`HotelFinancialDocumentPanel.jsx`/`HotelPaymentPanel.jsx`) sans aucun canal de communication vers `RoomAssignmentPanel`.

**Correction** :
- `RoomAssignmentPanel.jsx` : dépendance de `loadReadiness` élargie à la référence complète de `reservation` (se réévalue à chaque nouvelle référence fournie par le parent).
- `HotelFinancialDocumentPanel.jsx` : nouvelle prop `onChanged`, appelée après chaque mutation réussie (`run()`), et propagée à `HotelPaymentPanel` en plus de son propre rafraîchissement local.
- `AdminHotelReservationsPage.jsx` : `onChanged={load}` passé à `HotelFinancialDocumentPanel` (déjà présent pour `RoomAssignmentPanel`), fermant la boucle de rafraîchissement.

## 10. Bug réel #3 — Référence de réservation jamais générée (trouvé en tout début de sprint)

**Symptôme** : `HotelReservation.reference` restait `undefined` après création, cassant toute recherche par référence.

**Cause racine** : `mongoose-sequence` utilise le mode « parallèle » historique de Mongoose (`pre('save', true, fn)`), qui ne bloque pas les hooks `pre('save')` suivants contrairement à l'hypothèse du commentaire existant dans le code.

**Correction** : `server/models/HotelReservation.js` — génération de la référence déplacée dans un hook `post('save')` (garanti après tous les hooks parallèles), avec jointure explicite à `doc.$session()` pour rester dans la transaction englobante. Validé par deux scripts de reproduction isolés (save simple, puis sous transaction) avant/après, sans régression sur les 9 suites de tests liées (122/122).

## 11. Bug de test (non applicatif) — Regex traversant une nouvelle ligne

**Symptôme** : le scénario financier échouait avec `FINANCIAL_DOCUMENT_OVERPAYMENT` (409) alors que le paiement correspondait exactement au total de la facture.

**Preuve** : logs serveur temporaires montrant `amountMinor: 140000` envoyé par le test contre un `document.totalMinor` réel de `40000` (confirmé identique côté `checkout-financial-readiness`, source indépendante) — l'application était donc correcte, le test envoyait un montant faux.

**Cause racine** : `documentTotalText.match(/([\d\s]+)\s*XAF/)` — le numéro de facture (`FAC-000051-2026-000001`) se termine par des chiffres séparés du montant par un simple retour à la ligne ; `\s` dans la classe de caractères traverse ce `\n`, fusionnant `000001` et `40 000` en `140000`.

**Correction** : `client/e2e/e2e1-pms-workflow.spec.js` — extraction du montant depuis la seule ligne contenant `XAF` (`split('\n').find(...)`) avant d'en retirer les caractères non numériques.

## 12. Scénarios E2E-1 implémentés (10 tests, 8 describe blocks)

1. **PMS nominal complet** — réservation → confirmation → check-in → contexte financier créé (chambre A1). ✅
2. **PMS nominal, répétition indépendante** — même chaîne, chambre A2, pour écarter un coup de chance. ✅
3. **Cycle financier complet et check-out nominal** (deux acteurs réels Owner + Admin) — réservation → check-in (A3) → facturation Admin (finaliser/émettre) → encaissement → allocation → check-out → housekeeping → inspection approuvée → chambre de nouveau disponible (vérifié par une nouvelle affectation réelle). ✅
4. **Checkout bloqué (financier)** — check-out refusé tant que la facture n'est ni émise ni encaissée, code d'erreur métier visible, aucune 500. ✅
5. **Inspection échouée** — check-out par dérogation Admin (deux dialogues natifs séquentiels), ménage terminé, inspection rejetée, chambre jamais réaffectable (vérifié négativement). ✅
6. **Switch établissement propre** — Hôtel A → Hôtel B, aucune fuite de données A dans le cockpit B, requête réseau vérifiée avec le bon `hotelId`. ✅
7. **Cross-owner réel** — Owner A force l'URL d'un hôtel géré par un autre propriétaire → 403 réseau réel (pas juste une redirection frontend), aucune donnée visible. ✅
8. **Deep-link direct** — navigation directe vers `/mes-hotels/reservations?hotelId=` sans passer par le portfolio, contexte restauré, requête réseau vérifiée. ✅
9. **Notification contextualisée** — clic sur notification housekeeping ouvre directement le bon hôtel, requête réseau scopée vérifiée. ✅
10. **Maison meublée non-PMS** — Maison C reste indépendante du modèle `Room`, aucune notion de chambre visible (contrôle négatif). ✅

## 13. Assertions au-delà de « pas d'erreur »

URL (`toHaveURL`), statuts réseau explicites (200/201/403), payloads de mutations critiques (`hotelId`/`reservationId`/roomId capturés depuis la réponse réseau), textes de statut visibles (`.last()` pour lever l'ambiguïté onglet/badge), au moins une mise à jour reflétée sans rechargement manuel (recherche debouncée, panneaux financiers qui se rafraîchissent après action distante).

## 14. Hygiène Playwright respectée

Aucun `waitForTimeout` utilisé. Sélecteurs stables (rôle, label, texte, `data-testid`) — jamais de classe Tailwind. `waitForResponse`/`waitForRequest` toujours armés avant l'action déclenchante (un bug de test contraire — deep-link — a été trouvé et corrigé). Aucune dépendance d'ordre entre tests. Scénario nominal répété (voir §15/§16) pour écarter tout coup de chance — jamais de retry utilisé comme correctif de flakiness sans compréhension de la cause racine.

## 15. Validation répétée — suite complète

3 exécutions complètes de `e2e1-pms-workflow.spec.js` (10 tests chacune) après les correctifs finaux :

| Run | Résultat |
|---|---|
| 1 | 10/10 passés |
| 2 | 10/10 passés |
| 3 | 10/10 passés |

## 16. Validation répétée — scénario nominal isolé

5 exécutions isolées du describe block « PMS nominal » (2 tests chacune, chambres A1/A2) :

| Run | Résultat |
|---|---|
| 1–5 | 2/2 passés à chaque run |

## 17. Exécution groupée DASH-4 + E2E-1

`e2e1-pms-workflow.spec.js` + `dash4-hospitality-realtime.spec.js` exécutés ensemble (13 tests, même `webServer` partagé) : **13/13 passés**. Aucune interférence d'état entre les deux fichiers.

## 18. Gates — Serveur

- Lint (`npm run lint`) : ✅ 0 erreur (110 avertissements préexistants, non liés à ce sprint).
- Tests unitaires (`npm run test:unit`) : ✅ 116 suites / 1326 tests passés.
- Tests MongoDB/replica (`npm run test:mongo`) : ✅ 82 suites / 863 tests passés.

## 19. Gates — Client

- Lint (`npm run lint`) : ✅ 0 erreur (269 avertissements préexistants).
- Tests (`npm test`, Vitest) : ✅ 85 fichiers / 559 tests passés.
- Build production (`npm run build:next`) : ✅ succès.

## 20. Gates — Racine

- `npm run health` : ✅ 28/28 OK, 0 avertissement, 0 erreur bloquante.
- `npm run release-check` : SERVER (Lint✅ Tests✅ Mongo✅), CLIENT (Lint✅ Tests✅ Build✅), MOBILE (Syntax✅ Lint✅ Types✅ Tests✅ **Doctor ❌** Export✅).

## 21. Statut Mobile/Expo (hors périmètre, rapporté honnêtement)

Le seul échec de `release-check` est **MOBILE — Doctor**, explicitly hors périmètre de ce sprint (mission §67/§non-continuation). Aucun fichier de `altimmo-app/` n'a été modifié. Conformément à la règle du mandat : **WEB/PMS VERT, MOBILE DOCTOR JAUNE PRÉEXISTANT** — ce statut ne dégrade pas le verdict E2E-1 ci-dessous, qui porte exclusivement sur le périmètre web/PMS certifié.

## 22. Ownership et sécurité vérifiés en conditions réelles

Cross-owner (§12.7) : 403 réseau réel renvoyé par le backend, jamais une simple redirection frontend décorative. Isolation tenant/hôtel vérifiée par inspection directe de requête réseau (switch établissement, §12.6). Aucun contrôle d'autorisation supprimé ou affaibli — le seul changement d'autorisation (§8) *ajoute* une résolution de contexte manquante, il ne retire aucune vérification existante.

## 23. Corrections appliquées — récapitulatif conformité mandat

| Type de correction | Appliqué | Catégorie mandat |
|---|---|---|
| Gap d'autorisation backend (403 à tort) | ✅ | Contexte perdu / contrôle manquant — corrigé, jamais retiré |
| État UI périmé après action distante | ✅ | Transition UI non synchronisée |
| Hook Mongoose mal ordonné (référence jamais générée) | ✅ | Bug applicatif réel, trouvé avant toute écriture de scénario |
| Regex de test traversant une ligne | ✅ | Bug de test, jamais un bug applicatif maquillé |
| Contournement d'ownership | ❌ jamais appliqué | Interdit |
| Statut forcé en base depuis le frontend | ❌ jamais appliqué | Interdit |
| Attente arbitraire ajoutée | ❌ jamais appliquée | Interdit |
| Test désactivé ou assertion affaiblie pour accepter un bug | ❌ jamais appliqué | Interdit |

## 24. Limitations et UI manquante rencontrées

Aucun blocage architectural nécessitant une nouvelle fonctionnalité majeure : tous les écrans requis par les 10 scénarios existaient déjà (aucune mention `UI MANQUANTE` nécessaire). Le panneau financier n'est accessible en écriture qu'à l'Admin (jamais au propriétaire, `canManage=false` par conception DASH-3) — comportement volontaire, pas une lacune, reflété fidèlement dans le scénario financier (deux acteurs réels).

## 25. Fichiers modifiés par ce sprint (hors sprints précédents de la session)

- `server/routes/hotelReservationRoutes.js` — middleware `attachTenantContext` ajouté.
- `server/controllers/hotelReservationController.js` — `assertReservationAccess`, repli tenant.
- `server/models/HotelReservation.js` — hook `post('save')` pour la référence (trouvé en tout début de sprint, avant l'écriture de scénarios).
- `server/scripts/start-accommodation-e2e.js` — fixtures RoomCategory/RatePlan/Room additives.
- `server/services/finance/paymentAllocationService.js` — aucun changement définitif (log de diagnostic temporaire ajouté puis retiré).
- `client/lib/components/RoomAssignmentPanel.jsx` — rafraîchissement readiness + attributs `data-*` de stabilisation E2E.
- `client/lib/components/HotelFinancialDocumentPanel.jsx` — prop `onChanged` propagée.
- `client/lib/pages/dashboard/AdminHotelReservationsPage.jsx` — `onChanged={load}` câblé.
- `client/e2e/e2e1-pms-workflow.spec.js` — nouveau fichier, 10 scénarios.
- `server/docs/E2E1_PMS_ETAT_INITIAL.md`, `server/docs/E2E1_PMS_REPORT.md` — livrables documentaires.

## 26. Ce qui n'a PAS été fait (conformité mandat)

Aucune reconstruction du PMS. Aucun ajout de Cypress/Puppeteer. Aucune donnée de production utilisée. Aucun appel Cloudinary/email/paiement réel (fournisseur de paiement local factice déjà en place, réseau externe bloqué par `externalNetworkGuard.js`). Aucune modification de `altimmo-app/`. Aucune progression automatique vers un sprint EXEC suivant.

## 27. Reproductibilité

Toute correction a été validée par une preuve directe et reproductible (trace réseau JSON, script de reproduction isolé, log serveur temporaire retiré après diagnostic) avant d'être considérée comme résolue — jamais une correction « au jugé » livrée sans nouvelle exécution de test à l'appui.

## 28. Risques résiduels connus

`next dev` (compilation à la demande + StrictMode) reste intrinsèquement plus sujet à des effets d'affichage transitoires qu'un build de production — mitigé ici par un pattern de sondage sur attributs `data-*` plutôt que des attentes temporelles arbitraires, jamais éliminé en théorie mais démontré stable sur 3×10 + 5×2 + 1×13 exécutions consécutives sans échec restant.

## 29. État Git final (lecture seule, aucun commit/push)

- `git branch --show-current` : `main`
- `git rev-parse HEAD` : `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba` (inchangé depuis le début du sprint — travail non commité, comme pour tous les sprints précédents de cette session)
- `git diff --check` : aucune erreur d'espace blanc
- `git status --short` : fichiers modifiés/nouveaux listés, cohérents avec §25 plus les livrables des sprints DASH-1 à DASH-4 déjà présents avant ce sprint (non retouchés ici)
- Aucun `git add`/`commit`/`push` exécuté, conformément au mandat.

## 30. Verdict final

**E2E-1 CERTIFIÉ VERT.**

Justification : la chaîne nominale complète (Réservation → Confirmation → Check-in → Chambre occupée → Check-out → Housekeeping → Inspection → Chambre de nouveau disponible) a été exécutée réellement dans un navigateur Chromium, avec un second acteur réel (Admin) pour le volet financier obligatoire, et validée stable sur :
- 3 exécutions complètes de la suite (10/10 à chaque fois),
- 5 exécutions isolées du scénario nominal (2/2 à chaque fois),
- 1 exécution groupée avec la suite DASH-4 existante (13/13),
- l'intégralité des gates serveur/client/racine mandatés (à l'exception du Mobile Doctor, explicitement hors périmètre et préexistant).

Trois bugs applicatifs réels ont été trouvés et corrigés en cours de route (jamais contournés), avec preuve directe à l'appui de chaque diagnostic. Aucune correction interdite n'a été appliquée. Le sprint s'arrête ici, conformément à la règle de non-continuation du mandat.
