# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — CONTRAT MÉTIER

## Méthode

Comme pour `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1`, le contrat n'est pas déduit au jugé : il est extrait du backend déjà en production (`transactionRoutes.js`, non modifié). Chaque action est caractérisée séparément — aucune n'est traitée comme "toute la page".

## Contrat par action et par rôle

| Action | Admin | Collaborateur | Secretaire | GestionnaireImmobilier | CommunityManager | Communicant |
|---|---:|---:|---:|---:|---:|---:|
| Lecture liste complète + stats ("Gestion des transactions") | ALLOW | ALLOW | **ALLOW (corrigé — était DENY)** | DENY | DENY | DENY |
| Finaliser une transaction | ALLOW | ALLOW | **ALLOW (corrigé — était DENY)** | DENY | DENY | DENY |
| Annuler le dossier | ALLOW | ALLOW | **ALLOW (corrigé — était DENY)** | DENY | DENY | DENY |
| Valider/rejeter un virement | ALLOW | **DENY (corrigé — était ALLOW)** | DENY | DENY | DENY | DENY |
| Voir le détail d'une transaction / historique paiements / justificatif (lecture ciblée par ID) | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |

La dernière ligne (lecture ciblée par ID) suit `ALL_STAFF` (les 6 rôles), déjà appliqué correctement côté contrôleur (`isOwner || isStaff`) — **aucune correction nécessaire**, ce n'était pas gaté côté frontend et ne le sera pas après ce hotfix (mandat §44 : ne pas masquer toute la page si seule une action doit être restreinte).

## Justification par rôle

- **Admin** : joker `*`/rôle explicite dans les deux contrats backend concernés, aucune ambiguïté, non modifié.
- **Collaborateur** : `STAFF_DOC` l'inclut pour lecture/finalisation/annulation (comme pour Gestion Locative, via son statut de rôle staff généraliste historique — mandat §18, "ne pas réduire son accès sans preuve", confirmé non réduit ici). Il est en revanche **explicitement exclu** de `adminOnly` sur la validation de virement — un choix backend délibéré et distinct, jamais remis en cause (mandat §5 : ne jamais modifier le contrat `payments.reverse`-adjacent... **note** : `validerVirement` n'est PAS `payments.reverse`, c'est un contrat séparé du domaine transactions immobilières, mais le même principe de prudence s'applique — aucune preuve ne justifie d'élargir cette action à Collaborateur, donc son exclusion reste inchangée).
- **Secretaire** : possède déjà des capacités documentaires/paiements dans le domaine Gestion Locative (RBAC-1→5), mais ici la preuve vient directement du contrat backend `STAFF_DOC` qui l'inclut explicitement sur `GET /`, `GET /stats`, `POST /:id/finalize`, `PATCH /:id/cancel` — ce n'est pas une extrapolation depuis un autre domaine (mandat §20 : "ne pas extrapoler automatiquement"), c'est le contrat réel et déjà en vigueur de CE domaine précis, que le frontend n'appliquait pas.
- **GestionnaireImmobilier** : `STAFF_DOC` ne l'inclut sur aucune route de ce fichier — confirmé exclu de lecture, finalisation, annulation, ET validation de virement. Aucune capacité `properties.*`/`rental.*` ne s'étend à ce domaine transactionnel (mandat §19 : "cela ne signifie pas automatiquement..."). **Aucun changement** — le frontend l'excluait déjà correctement (c'est cette exclusion précise que RBAC-3 avait qualifiée de "cosmétique", confirmé exact : aucune correction nécessaire pour ce rôle).
- **CommunityManager/Communicant** : aucune route de ce fichier ne les mentionne — confirmé exclus de tout. Non concernés, non modifiés.
- **Proprietaire/Client** : hors `ALLOWED_ROLES` du dashboard staff — ne peuvent pas atteindre `/dashboard/transactions`. `GET /transactions/my` existe pour un usage Client **en dehors** de ce dashboard (probablement un futur espace propriétaire/acheteur, non audité ici — hors périmètre, mandat §22).

## Dette identifiée mais non corrigée (documentée, GO SOUS RÉSERVES sur ce point précis)

`GET /transactions/my` est conçu pour un Client consultant ses propres achats (`Transaction.find({ client: req.user._id })`), pas pour un membre staff sans droit `STAFF_DOC`. Après correction de `isAdmin`→`canManageTransactions`, les rôles restant en dehors de `STAFF_DOC` (`GestionnaireImmobilier`, `CommunityManager`, `Communicant`) continueront de tomber sur cette branche "Mes transactions" en visitant `/dashboard/transactions`, et verront une liste vide par construction (ils ne sont jamais `client` sur une `Transaction`). Ce n'est **pas une divergence de sécurité** (aucune fuite, comportement fail-closed par absence de données) mais une **UX dead-end** pour ces trois rôles — mandat §45 interdit de redesigner la page dans ce hotfix, et aucun contrat produit n'indique quel écran ces rôles devraient réellement voir sur cette page. **Non corrigé.** Documenté comme dette pour une décision produit future (par exemple : masquer entièrement la page à ces 3 rôles plutôt que de leur montrer un "Mes transactions" vide, ou leur afficher un message explicite) — recommandé mais hors périmètre strict de ce hotfix qui porte sur les DIVERGENCES DE SÉCURITÉ prouvées (Secretaire trop restreint, Collaborateur trop permissif sur le virement), pas sur l'UX d'un état déjà fail-closed.

## Verdict du contrat

Le contrat métier **est prouvé** pour les deux divergences de sécurité identifiées (Secretaire trop restreint sur lecture/finalisation/annulation, Collaborateur trop permissif sur la validation de virement) — preuve directe par lecture du backend déjà en production, jamais modifié, jamais ambigu. **Correction autorisée, côté frontend uniquement** (mandat §30 : backend correct, frontend incorrect → corriger le frontend seulement).
