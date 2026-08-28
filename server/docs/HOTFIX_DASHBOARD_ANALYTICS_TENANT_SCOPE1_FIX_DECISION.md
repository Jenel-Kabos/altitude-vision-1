# Décision de correction

## Cause racine

Le routeur passait directement de `auth.protect` au contrôleur. Les helpers supportaient déjà des scopes tenant, mais ne recevaient jamais le contexte canonique : sales/rentals étaient appelés sans `scopeUserIds`, accommodations sans `tenantId`, hotels avec un acteur sans `platformTenant`.

## Correctif minimal

1. Réutiliser la factory canonique `createRequireTenantScope` dans `tenantContext.js` avec une politique dédiée : tenant obligatoire pour tout staff, mode global permis seulement au vrai PlatformOperator, passage self-service maintenu pour les non-staff.
2. Monter ce garde après `protect` au niveau du routeur.
3. Transmettre les `tenantScopeUserIds` déjà calculés aux deux services reporting sales/rentals. Accommodation et Hotel consomment l'acteur enrichi existant.

La petite exportation `requireTenantScopeForAnalytics` est nécessaire parce qu'aucune variante existante ne combinait ces trois contrats. Elle ne crée ni nouveau resolver, ni règle métier, ni confiance dans un header client. Une seule ligne de dispatch de query est ajustée ; aucun pipeline ni calcul n'est modifié. Le fallback `[]` est volontairement fail-closed si un tenant existe mais que le scope utilisateur est absent.

Les autres routes et les deux dépendances service→controller ARCH-2M restent intactes. Un audit horizontal séparé n'est pas requis pour certifier ce périmètre ; l'équivalence d'autres routes seulement protégées par auth demeure NON CONFIRMÉE et devra être auditée séparément avant toute modification.
