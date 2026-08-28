# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Statut des dettes connues

## HZ-08 — `assertResourceTenantOrUnattributed` (ressources legacy `unresolved`)

Statut précédent : P2, DEFERRED. Revalidation de ce re-audit : le helper est toujours LIVE (toujours utilisé par les 14+ appelants déjà identifiés dans les mandats précédents et par les nouveaux `router.param` cités dans ce rapport — `contratRoutes.js`, `paiementRoutes.js`, `locataireRoutes.js`, `proprietaireRoutes.js`, `rentalManagementRoutes.js`, `gestionDocumentRoutes.js`). **Aucune nouvelle preuve d'exploitation P0/P1 de la tolérance `unresolved` elle-même n'a été trouvée** par ce re-audit — les findings RA-01 à RA-19 découlent tous d'une **absence totale** d'appel à ce helper (ou à un équivalent) sur les routes concernées, pas d'un contournement de sa logique de tolérance. **Statut maintenu : P2 / DEFERRED.** Non corrigé, conformément au mandat.

## HZ-09 — appels directs à `resolveTenantForUser`

Statut précédent : P3 architecture/fiabilité, RECLASSIFIED. Revalidation : toujours utilisé comme résolveur canonique (confirmé dans `paiementRoutes.js:64`, `rentalDocumentController.js`, etc.), toujours fail-closed en cas d'échec de résolution. **Aucun bypass tenant démontré** par ce re-audit. **Statut maintenu : P3.** Non corrigé.

## `errorMiddleware.js` — 500 au lieu de 404/403 pour certaines erreurs `assertResourceTenant*`

Statut précédent : défaut de sérialisation connu, non un défaut de sécurité tant que la ressource reste refusée. Revalidation : toujours vrai — dans tous les cas observés pendant ce re-audit (y compris les 2 findings reproduits en runtime, RA-02/RA-03, qui eux **ne** passent **pas** par ce chemin d'erreur puisqu'ils n'appellent jamais le garde tenant), l'autorisation reste correctement appliquée là où elle existe ; le défaut concerne uniquement le code HTTP retourné sur un refus déjà effectif, jamais un accès accordé à tort. **Statut maintenu : dette de sérialisation d'erreur, non bloquante pour la sécurité.** Non corrigé.

## `controller → controller` — dette architecturale connue = 1

Revalidation : `npm run architecture:check` confirme la dette inchangée à 1 occurrence (voir `_ETAT_INITIAL.md` — identique à la baseline finale du hotfix précédent). Aucune enquête de ce re-audit n'a modifié le code, donc cette dette ne peut mécaniquement pas avoir changé. Elle ne crée par ailleurs aucune frontière d'autorisation ambiguë (l'edge concerné n'est lié à aucun des findings RA-01 à RA-19). **Statut maintenu : dette architecturale suivie, non liée à la sécurité.**

## Nouvelles dettes/P2-P3 identifiées par ce re-audit (à documenter, non bloquantes)

- **RA-16 (Devis/Quote)** — absence totale de concept tenant sur ce modèle. Nécessite une décision produit (est-ce voulu ? Un Devis est-il une donnée globale de l'agence ou privée à un tenant ?) avant de pouvoir être classé P1 ou accepté comme P3. **Statut : À CLARIFIER, non bloquant pour la clôture si le produit confirme que les Devis sont intentionnellement globaux.**
- **RA-17 (Dashboard KPI globaux)** — agrégats sans PII, fuite d'information mineure. **Statut : P2, à corriger dans un sprint ultérieur, non bloquant à lui seul.**
- **RA-18 (`resolveHotel` mode existing)** — composant de RA-10, pas un finding indépendant de sévérité propre.
- **RA-19 (rentalMaintenanceController.list sans propertyId)** — fuite de liste mineure (tickets de maintenance, pas de mouvement financier). **Statut : P2.**
- **RA-20/RA-21 (Messaging attachments/socket)** — dettes de cohérence de code, pas des brèches. **Statut : P3, dette de refactoring.**
- **RA-22 (PlatformOperator « scopé »)** — écart entre l'hypothèse du mandat et le modèle de données réel, pas un bug. **Statut : à signaler au produit/à la sécurité, pas une dette technique.**

## Conclusion

Aucune dette P2/P3 déjà connue et acceptée (HZ-08, HZ-09, errorMiddleware, controller→controller) n'a été aggravée ou reclassée à la hausse par ce re-audit. En revanche, ce re-audit a produit un ensemble **distinct** de findings P0/P1 (RA-01 à RA-15, détaillés dans `_FINDING_MATRIX.md`) qui ne relèvent d'aucune des dettes ci-dessus — ce sont des surfaces jamais couvertes par un hotfix antérieur, pas une résurgence d'une dette déjà acceptée.
