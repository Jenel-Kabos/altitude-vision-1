# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — MATRICE DES ACTIONS FRONTEND

`client/lib/pages/dashboard/TransactionsPage.jsx` (430 lignes). Toutes les expressions de contrôle de rôle trouvées (recherche exhaustive, aucune supposée) :

- `TransactionsPage.jsx:331` — `const isAdmin = ['Admin', 'Collaborateur'].includes(user?.role);` (composant principal)
- `TransactionsPage.jsx:134` — `const canFinalize = isAdmin && tx.status === 'Paiement en attente';` (dérivé, dans `TransactionModal`)
- `TransactionsPage.jsx:135` — `const canCancel = isAdmin && !['Réussie', 'Annulée'].includes(tx.status);` (dérivé, idem)
- `TransactionsPage.jsx:216` — `isAdmin && p.methode === 'virement' && p.statut === 'en_attente'` (gate inline, valider/rejeter virement)
- `TransactionsPage.jsx:231` — `isAdmin && (...)` (gate du bloc entier finaliser/annuler)

Aucun `can(`, `canEdit`, `canDelete`, `canPay`, `canReverse`, `canPayout`, `allowedRoles` — 100% logique de rôle en dur, un seul flag `isAdmin` propagé partout (y compris comme prop `isAdmin` de `TransactionModal`, ligne 94).

## Inventaire des actions réelles

| Action UI | Check frontend actuel | Endpoint | Effet métier |
|---|---|---|---|
| Basculer "Gestion des transactions" (liste complète + stats) vs "Mes transactions" | `isAdmin` (ligne 344-345, 369, 380) | `GET /transactions` + `GET /transactions/stats` (si `isAdmin`) sinon `GET /transactions/my` | Lecture — détermine la population de données retournée, pas seulement un affichage |
| Afficher les KPI (volume, commissions, statuts) | `isAdmin` (ligne ~369) | `GET /transactions/stats` | Lecture |
| Voir le détail d'une transaction (modal) | Aucun gate — ouverture libre pour tout rôle ayant chargé la liste | `GET /transactions/:id` (ownership/staff vérifié en contrôleur) | Lecture |
| Voir l'historique des paiements d'une transaction | Aucun gate | `GET /transactions/:id/paiements` (ownership/staff vérifié) | Lecture |
| Voir le justificatif de paiement sécurisé | Aucun gate — dépend de `p.paymentProof?.canPreview` calculé backend | `GET /transactions/:id/paiements/:pId/proof` (ownership/staff vérifié) | Lecture |
| Finaliser une transaction | `canFinalize` = `isAdmin && tx.status === 'Paiement en attente'` | `POST /transactions/:id/finalize` | Écriture — changement d'état définitif |
| Annuler le dossier | `canCancel` = `isAdmin && !['Réussie','Annulée'].includes(tx.status)` | `PATCH /transactions/:id/cancel` | Écriture — changement d'état définitif |
| Valider/rejeter un virement en attente | `isAdmin` (ligne 216) | `PATCH /transactions/:txId/paiements/:pId/valider` | Écriture — décision financière sur un paiement |

Actions exposées par `client/lib/services/transactionService.js` mais **jamais appelées** par cette page (donc hors périmètre de la divergence, non concernées par ce hotfix) : `createTransaction`, `soumettreVirement`, `enregistrerEspeces`, `initierPaiement`, `verifierPaiement`, `updateNotes`. Aucune action de suppression n'existe dans cette page.

## Constat central

Un seul flag `isAdmin` (`{Admin, Collaborateur}`) gate simultanément **deux contrats backend différents** (voir `HOTFIX_RBAC_TRANSACTIONS_ACCESS1_ENDPOINT_MATRIX.md`) :
1. Lecture complète (liste/stats) + Finaliser + Annuler → backend `staffOnly` = `{Admin, Secretaire, Collaborateur}` (`STAFF_DOC`).
2. Valider/rejeter virement → backend `adminOnly` = `{Admin}` seul.

Même schéma que `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1` : un flag unique masque deux populations différentes, dans les deux sens (une exclusion à tort, une inclusion à tort).
