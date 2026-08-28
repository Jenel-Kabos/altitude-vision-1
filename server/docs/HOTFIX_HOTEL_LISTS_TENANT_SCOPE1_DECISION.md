# HZ-06 — Décision

Décision technique : réutiliser `requireTenantScopeForStaffAllowPlatformWide`, puis injecter le tenant canonique dans les queries Hotel de la seule branche Admin vulnérable. Les non-Admin continuent d’utiliser manager/assignments ; le PlatformOperator global garde la query globale et le scoped reçoit le tenant sélectionné.

Cette solution est minimale, applique le scope dans Mongo et ne change ni RBAC ni métier. Verdict final : **CERTIFIÉ VERT**, avec tous les gates demandés réussis. Prochain sujet recommandé après fermeture : HZ-08 attribution legacy, sans l’exécuter ici.
