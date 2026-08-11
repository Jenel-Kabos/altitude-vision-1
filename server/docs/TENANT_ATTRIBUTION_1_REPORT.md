# TENANT-ATTRIBUTION-1 — Rapport

Date : 2026-08-10.

## 1–4. Cartographie, modèles legacy, dérivations et service canonique

La matrice complète est dans `TENANT_ATTRIBUTION_1_AUDIT.md`. Le service central couvre User, Property, Hotel, HotelReservation, HotelStaffAssignment, Room, Accommodation, AccommodationReservation, RentalManagement, Contrat, Paiement, Conversation, Message, Document et objets financiers. Les preuves explicites et relationnelles sont fusionnées; tout conflit devient `ambiguous`. `assertResourceTenant` retourne une absence 404 pour ne pas révéler l'existence cross-tenant.

## 5. Documents

Les routes Document exigent un tenant actif. LIST combine les filtres fonctionnels whitelistés avec le scope tenant. GET, UPDATE et DELETE attribuent la ressource avant l'opération. CREATE ignore tout tenant client, persiste celui du contexte serveur et refuse une relation incohérente. Les architectures `Document`, `Contrat.documents[]` et `FinancialDocument` restent distinctes.

## 6. Conversations et messages

Les routes Conversations et Messages exigent un tenant actif. Le détail, les messages, mark-read, suppression et envoi vérifient l'attribution; les permissions participant/staff restent un second `AND`. Les listes et la staff inbox éliminent après attribution les candidats legacy ambigus. Les nouvelles Conversations et Messages persistents utilisent le tenant du contexte validé.

## 7–8. Finance et Hôtel

Le bypass Admin global a été supprimé. Un Admin doit présenter un contexte tenant et l'hôtel demandé doit lui être attribué avant toute capacité financière ou opérationnelle. Les listes et dashboards Admin sont bornés aux hôtels attribuables du tenant et ne retournent plus `globalAccess: true`. Les documents, paiements et allocations nouvellement créés recopient le tenant serveur/établissement validé.

## 9–10. GL et Accommodation

Le résolveur sait remonter RentalManagement, Contrat et Paiement via Property, ainsi que Accommodation et ses réservations. Aucun des 17 contrats historiques sans lien fiable n'a été modifié. Accommodation, HotelReservation et AccommodationReservation disposent désormais d'un champ nullable indexé; les workflows avec contexte tenant rejettent les divergences.

## 11. Modifications de schéma additives

Champ `tenant`, nullable, indexé et sans défaut global ajouté à Document, Conversation, Message, Hotel, HotelReservation, Accommodation, AccommodationReservation, FinancialDocument, FinancialPayment et PaymentAllocation. Aucune donnée existante n'est réécrite.

## 12. Nouvelles écritures

Le contexte produit par `requireTenantScope` est attaché à l'acteur serveur. Documents, conversations, messages, hôtels/hébergements, réservations tenant-contextuelles et objets financiers utilisent ce contexte ou une relation métier résolue. Un tenant fourni dans le body Document est ignoré.

## 13–14. Dry-run et ambiguïtés

`server/scripts/auditTenantAttribution.js` classe A à F, imprime collection, document, tenant courant/proposé, preuve, statut, confiance et totaux par collection. Il exige `--uri` et `--confirm-read-only`, refuse `--apply`, désactive les index automatiques et n'écrit rien. Il n'a pas été exécuté sur une base réelle. `ambiguous` et `unresolved` échouent fermés.

## 15–16. Tests adversariaux et régressions

Les trois reproductions TENANT-CERT ont été inversées en assertions de refus. Une suite dédiée couvre explicite, dérivé, ambigu, non résolu et données futures. Les résultats définitifs des gates sont consignés ci-dessous après exécution. Une incompatibilité initiale avec des fixtures Hôtel orphelines a été corrigée sans relâcher les routes tenant-scopées.

## 17. Performances

Les champs directs indexés rendent les données futures O(1) pour l'attribution. Le legacy peut nécessiter plusieurs lectures relationnelles et un post-filtrage; le dry-run permet de quantifier ce coût avant tout backfill contrôlé. Aucun cache risquant de mélanger deux tenants n'a été ajouté.

## 18–19. Risques et dettes restantes

- TENANT-CERT-1 complet doit être relancé après ce sprint; la plateforme n'est pas déclarée certifiée ici.
- Les contrats historiques sans `bien`, les sockets non couverts et les autres routes GL/Accommodation restent à examiner adversarialement.
- Les ressources globales ne sont pas introduites; un éventuel Admin plateforme nécessitera un modèle explicite et une politique dédiée.
- Les workflows internes legacy sans contexte peuvent conserver un tenant nullable pour compatibilité; ils ne sont pas autorisés via les nouvelles frontières HTTP tenant-scopées.

## 20. Fichiers créés

- `server/services/platformTenant/tenantResourceAttributionService.js`
- `server/scripts/auditTenantAttribution.js`
- `server/__tests__/tenantAttribution.mongo.integration.test.js`
- `server/__tests__/tenantCert.audit.mongo.integration.test.js` (créé pendant TENANT-CERT, converti ici en régression)
- `server/docs/TENANT_ATTRIBUTION_1_AUDIT.md`
- `server/docs/TENANT_ATTRIBUTION_1_REPORT.md`
- `server/docs/TENANT_CERT_1_AUDIT.md` et `server/docs/TENANT_CERT_1_REPORT.md` préexistaient non suivis au début du sprint et sont conservés.

## 21. Fichiers modifiés

- `server/controllers/{accommodationController,conversationController,documentController,messageController}.js`
- `server/middleware/tenantContext.js`
- `server/models/{Accommodation,AccommodationReservation,Conversation,Document,FinancialDocument,FinancialPayment,Hotel,HotelReservation,Message,PaymentAllocation}.js`
- `server/routes/{conversationRoutes,documentRoutes,financialRoutes,hotelRoutes,messageRoutes}.js`
- `server/services/accommodation/{mobileAccommodationPublicationService}.js`
- `server/services/{accommodationReservationService,accommodationService,hotelReservationService,hotelService}.js`
- `server/services/finance/{accommodationBillingService,financialAuthorizationService,financialPaymentService,hotelBillingAdapter,paymentAllocationService}.js`
- `server/services/hotel/hotelAccessScopeService.js`

## 22. Gates et verdict

Campagne fraîche du 2026-08-10 :

- Tests adversariaux TENANT-ATTRIBUTION/TENANT-CERT : **PASS**, 2 suites, 8 tests. Les trois fuites démontrées sont refusées.
- MongoDB complet : **FAIL**, 11 suites en échec / 53 réussies, 49 tests en échec / 538 réussis. Les échecs concernent principalement des fixtures legacy sans contexte tenant et des assertions attendant encore un accès Admin global; ils empêchent la certification globale.
- Backend Unit : **NON QUALIFIÉ**. Une première exécution a rencontré `EPERM` dans le sandbox; les relances autorisées ont été interrompues après des attentes répétées sur des scénarios de routes Hôtel sans contexte tenant. Aucun résultat vert n'est revendiqué.
- Web Vitest : **PASS**, 76 fichiers, 510 tests.
- Playwright desktop + mobile : **PASS**, 34 tests en 10,6 minutes.
- Mobile Jest : **PASS**, 24 suites, 227 tests.
- TypeScript mobile : **PASS**.
- Expo Doctor : **PASS**, 20/20 contrôles.
- Export Android : **PASS**.
- Build Next.js : **PASS**, 142 pages statiques générées.
- ESLint serveur : **PASS** avec 124 avertissements et 0 erreur.
- ESLint client : **PASS** avec 268 avertissements et 0 erreur.
- ESLint mobile : **PASS** avec 82 avertissements et 0 erreur.
- `git diff --check` : **PASS** après correction de deux espaces finaux; avertissements CRLF uniquement.

Verdict : les trois frontières de sécurité exigées par TENANT-ATTRIBUTION-1 sont corrigées et couvertes (**objectif de sécurité ciblé PASS**), mais la campagne globale reste **NON CERTIFIÉE** à cause du gate MongoDB rouge et du gate Backend Unit non qualifié. La plateforme multi-tenant n'est donc pas déclarée certifiée.

Confirmations : aucun commit, aucun push, aucun déploiement, aucune migration destructive, aucun backfill réel, aucune suppression de données réelles, aucune écriture de production.
