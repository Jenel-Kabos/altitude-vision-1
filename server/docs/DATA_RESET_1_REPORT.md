# DATA-RESET-1 — Rapport d'exécution

Date : 2026-08-13  
Résultat : **RESET_AND_BOOTSTRAP_COMPLETE**

## Autorisation et preflight

ResetId `data-reset-1-20260813`, base `altitudevision`, hash `e675ec0df7301effde02ddf71a4fc5768976c5cdb0344247bd5283439d0012b1`. Le preflight immédiatement antérieur au drop a confirmé 104 collections et 718 documents, sans drift.

## Reset

Les 718 documents d'essai et les 104 collections du manifeste ont été supprimés par `dropDatabase`. Aucun fichier, code, secret externe ou asset Cloudinary n'a été supprimé. Les 103 collections correspondant aux modèles Mongoose uniques ont été recréées avec leurs indexes actuels ; l'écart 104→103 correspond à l'ancienne collection runtime `facebookposts`, sans modèle Mongoose actuel et non recréée.

## Bootstrap minimal

- User : 1, nom Altitude Vision, email masqué `al***@gmail.com`, rôle Admin, actif.
- PlatformTenant : 1, Altitude Vision, statut `trial`.
- OrgUnit racine : 1.
- OrgMembership : 1, rôle `owner`, actif.
- PlatformOperator : 1, actif, capacités plateforme certifiées.
- Settings, Theme, Subscription : 1 chacun.
- ActionLog : 4 nouveaux événements de bootstrap.
- Données métier : 0.

Total post-reset : 12 documents, dont 8 structures/configurations minimales et 4 logs propres.

## CRM et indexes

`CrmCustomer=0`. L'index `one_crm_customer_per_tenant_source` est unique sur `{ tenant, sourceRefs.entityType, sourceRefs.entityId }` et porte le filtre partiel `$type:string` + `$type:objectId`. L'ancien index non partiel n'existe plus ; CRM-INDEX-MIGRATION-1 n'est plus nécessaire.

## Incident de confidentialité terminal

La commande a demandé une saisie interactive après tentative de désactivation de l'écho. L'intégration terminal a néanmoins renvoyé la saisie dans le flux de session. Le secret n'a pas été écrit dans un fichier, argument CLI, rapport applicatif ou historique shell, mais il doit être considéré comme exposé dans la session et changé immédiatement par le mécanisme de changement/réinitialisation de mot de passe.

## Confirmations

Cloudinary : **NO CHANGE**. Des assets orphelins peuvent rester. Aucun commit, push, deploy, rotation de credentials ou nettoyage externe n'a été exécuté.
