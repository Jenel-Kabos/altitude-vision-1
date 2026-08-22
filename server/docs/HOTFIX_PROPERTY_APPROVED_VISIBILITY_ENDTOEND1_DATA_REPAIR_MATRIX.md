# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — Matrice de réparation de données

## 1. Documents concernés (lecture seule, base réelle)

Requête exécutée (lecture seule, aucune mutation) :

```js
Property.find({
  status: { $in: ['vente', 'location'] },
  statusAdmin: 'Validée',
  isPublished: { $ne: true },
})
```

**Résultat : 1 document concerné.**

| `_id` | `title` | `status` | `statusAdmin` | `isPublished` | `availability` | `pole` | `reviewedAt` |
|---|---|---|---|---|---|---|---|
| `6a887b6d3aebee9658c9e4ec` | PARCELLE A VENDRE | vente | Validée | false | Disponible | Altimmo | 2026-08-21T21:46:33.464Z |

Contexte de la base : cette base contient exactement **1 seul** `Property` classique (vente/location) au total — ce n'est donc pas une base de production à grande échelle mais l'environnement de travail partagé déjà utilisé par les hotfixes précédents (même `_id`, confirmé identique).

## 2. Critères précis d'identification

```js
{ status: { $in: ['vente', 'location'] }, statusAdmin: 'Validée', isPublished: { $ne: true } }
```

Ce filtre identifie exactement et uniquement les biens classiques (vente/location) déjà approuvés par un Admin mais jamais publiés atomiquement — le symptôme exact du bug historique. Il n'inclut ni les hébergements (`status='hebergement'`, cycle `Accommodation`/`Hotel` séparé, jamais concerné par `isPublished`), ni les biens en attente ou rejetés (qui n'ont légitimement jamais `isPublished=true`).

## 3. Stratégie de réparation idempotente

**La réparation légitime n'est jamais une mutation directe (`updateOne({isPublished: true})`) — elle consiste à rejouer le vrai workflow de validation** (`PATCH /api/properties/admin/:id/validate`), pour chaque document identifié par le critère ci-dessus. Ce choix est justifié et prouvé par test (`propertyApprovedVisibilityEndToEnd.mongo.integration.test.js`, describe "Réparation idempotente") :

- `updatePropertyStatus` fixe `isPublished: newStatusAdmin === 'Validée'` de façon **inconditionnelle** pour tout `classicListing` (vente/location) — rejouer `validate` sur un document déjà `Validée` ne fait que réaffirmer `statusAdmin='Validée'` et corriger `isPublished` à `true`, sans effet de bord observable (mêmes notifications déjà envoyées une fois, `reviewedAt` simplement rafraîchi).
- Rejouer l'action une deuxième fois (double-clic accidentel) produit exactement le même état final — **prouvé idempotent par test** (`res2.status === 200`, `portfolio.items` reste à 1 élément, jamais de doublon).
- Aucune donnée n'est perdue ni écrasée : seuls `statusAdmin`, `reviewedAt` et `isPublished` sont réaffirmés ; tous les autres champs (`title`, `type`, `price`, `owner`, `address`…) restent strictement inchangés.

## 4. Dry-run (lecture seule, exécuté, résultat ci-dessus)

Le dry-run EST la requête de comptage/identification de la section 1, déjà exécutée en lecture seule contre la base réelle. Elle peut être rejouée à tout moment sans aucun risque (aucune écriture).

## 5. Ce qui N'A PAS été exécuté sur la base réelle

Conformément au mandat (§Phase 7, §Interdictions) : **aucune réparation n'a été appliquée au document réel `6a887b6d3aebee9658c9e4ec`.** Ni mutation directe, ni ré-invocation de l'endpoint `/admin/:id/validate` contre cette base. La stratégie de réparation ci-dessus est documentée et **prouvée par test sur une base éphémère** (`MongoMemoryReplSet`, isolée), jamais exécutée en conditions réelles sans autorisation explicite de l'utilisateur.

## 6. Recommandation d'exécution (nécessite validation utilisateur avant action)

Si l'utilisateur autorise la réparation, l'action recommandée est : **se connecter au dashboard Admin (`/dashboard/moderation/properties`) et cliquer "Valider" sur `PARCELLE A VENDRE`** (déjà `Validée`, donc sans risque de double-validation métier — l'action ne fait que corriger `isPublished`). Alternative techniquement équivalente mais non recommandée en premier choix : appeler `PATCH /api/properties/admin/6a887b6d3aebee9658c9e4ec/validate` avec un token Admin valide. Dans les deux cas, c'est une action humaine explicite, jamais un script automatique exécuté par cet audit.
