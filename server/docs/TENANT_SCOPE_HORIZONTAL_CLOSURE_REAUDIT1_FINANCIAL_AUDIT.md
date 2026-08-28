# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Re-audit financier

## Deux sous-systèmes financiers distincts, deux verdicts opposés

### 1. FinancialDocument / FinancialPayment / PaymentAllocation / FinancialLedgerEntry (hôtel + immobilier « Sprint Finance ») — **SAFE**

`controllers/financialController.js` + `services/finance/financialAuthorizationService.js` + `services/finance/paymentAllocationService.js`. Chaque handler charge la ressource puis appelle `authz.assertCan*`, qui exige une capacité (`hasFinancialCapability`, avec carve-out PlatformOperator explicite `platform.finance.*`) **et** `assertFinancialScope`/`assertFinancialDashboardScope` (charge le `Hotel` lié, appelle `assertResourceTenant`, fail-closed vers 404 sur toute ambiguïté). `paymentAllocationService.allocatePaymentToDocumentCore` recroise en plus `payment.establishmentId === document.establishmentId` et `payment.domain === document.domain` avant toute mutation de solde — empêche d'allouer le paiement du tenant A à la facture du tenant B même si le contrôle de capacité était contourné. Lecture personnelle (locataire/invité/propriétaire) vérifiée par identité réelle (`reservation.guest`/`reservation.owner`), pas par rôle seul. Aucun bypass trouvé malgré recherche adversariale ciblée (allocation croisée, confirmation/rejet sans document, domaines non concordants).

CinetPay (`cinetpayController.js`) : entièrement déprécié (410 sur les deux handlers), aucune mutation possible — ancien P0 historique définitivement fermé par dépréciation produit.

MTN MoMo (`mtnMomoPaymentController.js`) : réutilise le même `financialAuthorizationService` durci + fallback `isOwner` pour l'invité payeur — cohérent, SAFE.

### 2. Paiement / Contrat « Gestion Locative » (loyers, cautions) — **VULNÉRABLE, sévérité élevée**

Ce sous-système n'a **aucun champ `tenant`** sur `Paiement`/`Contrat` — l'attribution tenant est dérivée relationnellement (`Contrat.bien → Property.tenant`) via `tenantResourceAttributionService.resolveResourceTenant`, mais cette dérivation n'est invoquée **que** par les gardes `router.param('id', ...)` protégeant les routes `:id` de `contratRoutes.js`/`paiementRoutes.js` — jamais par les routes de liste/agrégation/mutation-multiple du même fichier.

Findings confirmés (détail complet dans `_FINDING_MATRIX.md`) :
- **RA-02** — `GET /api/paiements`, `/stats`, `/alertes` : fuite de lecture cross-tenant (montants, contrats, noms de locataires).
- **RA-03** — `POST /api/paiements/encaisser-multiple` : mutation cross-tenant (un Secretaire/Collaborateur/Admin du tenant A peut marquer payée une échéance du tenant B, créer un reçu à son nom, joindre une preuve de paiement au contrat du tenant B, déclencher une notification au vrai locataire du tenant B).
- **RA-04** — `GET /api/contrats` : même fuite de lecture (loyers, noms/téléphones propriétaire+locataire).
- **RA-05** — `rentalLeaseLifecycleController.*` : transition de bail, renouvellement, avenants, et surtout les 4 opérations de **caution** (`encaisserCaution`, `bloquerCaution`, `appliquerRetenueCaution`, `restituerCaution` — mouvements d'argent réels) sur le même modèle `Contrat`, sans aucun garde tenant, alors que `contratRoutes.js` documente explicitement avoir corrigé ce même modèle pour ses propres routes `:id` (TENANT-CERT-2).

### Reproduction runtime (test temporaire, supprimé avant STOP)

Un test Mongo+HTTP temporaire (`server/__tests__/_tmp_reaudit_paiement_tenant_leak.mongo.integration.test.js`) a été écrit et exécuté pour confirmer RA-02/RA-03 de façon non ambiguë : un `Secretaire` du tenant A obtient dans `GET /api/paiements` les échéances du tenant B ; `GET /api/paiements/stats` agrège les montants des deux tenants ; `POST /api/paiements/encaisser-multiple` permet à ce même Secretaire de marquer payée une échéance appartenant au tenant B. Résultat exact reporté dans `_RUNTIME_REPRODUCTIONS.md`. Le fichier de test est temporaire et sera supprimé avant la fin de ce mandat, conformément au mode read-only.

## Blast radius

Rôles atteignant ces routes par défaut : `Admin` (capacité joker `*`), `Secretaire` (capacités `payments.read`/`payments.manage` explicites), `Collaborateur` (capacité joker `legacy.full`, qui accorde également tout). Trois des rôles staff les plus courants du système peuvent donc lire l'intégralité du livre de loyers de tous les tenants de la plateforme et y effectuer des encaissements/mouvements de caution cross-tenant.

## Ce qui N'EST PAS affecté

Le sous-système Finance « Sprint Finance » (hôtel + documents financiers formels) reste intégralement SAFE et n'est touché par aucun des findings ci-dessus — les deux sous-systèmes ne partagent aucun code d'autorisation. Aucune modification n'a été apportée à `financialAuthorizationService.js`/`paymentAllocationService.js` par ce re-audit read-only.

## Conclusion

Le domaine financier au sens large ne peut PAS être déclaré clos. Le sous-système « Sprint Finance » est un modèle de robustesse ; le sous-système « Gestion Locative legacy » (Paiement/Contrat/RentalLeaseLifecycle) présente plusieurs P0 confirmés et reproduits, non couverts par aucun des hotfixs déjà certifiés de cette campagne.
