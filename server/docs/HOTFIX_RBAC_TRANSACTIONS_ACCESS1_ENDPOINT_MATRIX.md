# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — MATRICE DES ENDPOINTS

Lecture directe de `server/routes/transactionRoutes.js` (fichier non modifié) :

```js
const staffOnly = [auth.protect, auth.restrictTo(...STAFF_DOC)]; // STAFF_DOC = ['Admin','Secretaire','Collaborateur']
const adminOnly = [auth.protect, auth.restrictTo('Admin')];
```

| Endpoint | UI consumer | Auth middleware | Capability/rôles | Tenant | Ownership | Modèle | Verdict |
|---|---|---|---|---|---|---|---|
| `GET /transactions/stats` | KPI (ligne ~369) | `staffOnly` | `{Admin, Secretaire, Collaborateur}` | Aucun (`requireTenantScope` absent) | N/A | `Transaction` | **DIVERGENCE — frontend `isAdmin` exclut `Secretaire` à tort** |
| `GET /transactions/my` | "Mes transactions" (branche `!isAdmin`) | `protect` seul | Tout utilisateur authentifié | N/A | `Transaction.find({ client: req.user._id })` — filtré sur le CLIENT acheteur, pas sur un "agent assigné" | `Transaction` | **Contrat mal aligné avec l'usage réel** — cette route est conçue pour un Client consultant ses propres achats (commentaire code : "Client : ses transactions"), pas pour un membre staff sans droit admin. Un Secretaire/GestionnaireImmobilier/CommunityManager/Communicant qui atteint cette branche reçoit une liste vide par construction (il n'est jamais `client` sur une transaction), pas un message d'erreur clair — voir section dédiée ci-dessous |
| `GET /transactions` | Liste complète (branche `isAdmin`) | `staffOnly` | `{Admin, Secretaire, Collaborateur}` | Aucun | N/A | `Transaction` | **DIVERGENCE — frontend `isAdmin` exclut `Secretaire` à tort** |
| `GET /transactions/:id` | Détail transaction (modal) | `protect` seul | Tout utilisateur authentifié | N/A | Contrôleur : `isOwner \|\| isStaff` (`ALL_STAFF` = les 6 rôles staff) | `Transaction` | Cohérent — aucun gate frontend à ce niveau, contrôleur déjà correct |
| `POST /transactions/:id/finalize` | "Finaliser" | `staffOnly` | `{Admin, Secretaire, Collaborateur}` | Aucun | Aucun explicite (état de la transaction vérifié par le contrôleur — machine à états, non RBAC) | `Transaction` | **DIVERGENCE — frontend `canFinalize` (via `isAdmin`) exclut `Secretaire` à tort** |
| `PATCH /transactions/:id/cancel` | "Annuler le dossier" | `staffOnly` | `{Admin, Secretaire, Collaborateur}` | Aucun | Idem | `Transaction` | **DIVERGENCE — frontend `canCancel` (via `isAdmin`) exclut `Secretaire` à tort** |
| `GET /transactions/:id/paiements` | Historique paiements (modal) | `protect` seul | Tout utilisateur authentifié | N/A | Contrôleur : `canAccessTransaction`/`denyTransactionAccess` (ownership + staff) | `PaiementTransaction` | Cohérent — aucun gate frontend, contrôleur déjà correct |
| `GET /transactions/:id/paiements/:pId/proof` | "Voir justificatif sécurisé" | `protect` seul | Tout utilisateur authentifié | N/A | Idem `canAccessTransaction` | `PaiementTransaction` | Cohérent — aucun gate frontend nécessaire, `p.paymentProof?.canPreview` déjà calculé backend |
| `PATCH /transactions/:txId/paiements/:pId/valider` | "Valider"/"Rejeter" virement | `adminOnly` | `{Admin}` seul | Aucun | Vérification transaction/paiement liés (409 si incohérent) | `PaiementTransaction` | **DIVERGENCE OPPOSÉE — frontend `isAdmin` inclut `Collaborateur` à tort, bouton visible menant à un 403 garanti** |
| `POST /transactions/:id/paiements/especes` | Non appelé par cette page | `staffOnly` | `{Admin, Secretaire, Collaborateur}` | Aucun | N/A | `PaiementTransaction` | Hors périmètre — action non exposée dans `TransactionsPage.jsx` |
| `POST /transactions`, `PATCH /:id/notes`, `POST /:id/paiements/initier`, `GET /verifier/:intentId`, `POST /:id/paiements/virement` | Non appelés par cette page | `staffOnly`/`protect` selon la route | — | — | — | — | Hors périmètre |

## Modèle de données confirmé

`transactionController.js:1-2` : `const Transaction = require('../models/Transaction');` — domaine **immobilier** (vente/location), distinct de `Paiement`/`RentalPaymentReceipt` (Gestion Locative) et de `FinancialPayment` (Financial Core hôtelier). `paiementTransactionController.js:2-3` : `PaiementTransaction`, lié à `Transaction` par référence. Aucun import de `financialAuthorizationService` dans `transactionController.js` ni `paiementTransactionController.js` (vérifié, zéro occurrence) — ce domaine n'est **pas** le Financial Core hôtelier, confirmé par `server/docs/PAY1_ARCHITECTURE_REPORT.md` qui note explicitement l'absence de capacité `payments.reverse`-équivalente pour les transactions immobilières.

## `payments.reverse` — confirmé hors sujet

`server/routes/paiementRoutes.js:22` : `requireCapability('payments.reverse')` gate `POST /paiements/:id/receipts/:receiptId/cancel` — un domaine **entièrement différent** (Gestion Locative, modèle `Paiement`/`RentalPaymentReceipt`). `transactionRoutes.js` n'importe ni n'utilise `requireCapability` ni `payments.reverse` nulle part. Aucun risque de confusion ou de régression sur ce contrat déjà certifié RBAC-2 — non touché par ce hotfix.

## Menu — absence constatée

Aucune entrée "Transactions" n'existe dans `AdminDashboard.jsx` `NAV_SECTIONS` ni dans `client/lib/navigation/dashboardProfiles.js` (recherche exhaustive, zéro résultat) — cette page n'est actuellement accessible que par lien direct (notifications `transaction_created`/`transaction_finalized`/`payment_success`/`payment_failed` dans `NotificationBell.jsx`) ou saisie manuelle de l'URL. Il n'existe donc pas de "contrat de visibilité de menu" à corriger pour cette page — le seul gate en amont est le layout dashboard générique (`ALLOWED_ROLES`), déjà audité et non modifié par les hotfix précédents.
