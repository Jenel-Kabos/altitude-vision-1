# PAY-4 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short → 8 fichiers non suivis, tous produits par PAY-3 (registre, constantes, tests, docs) — aucun commit externe depuis PAY-3 cette fois
git branch --show-current → main
git rev-parse HEAD → bfdd67c8f8293c690640fab799b2aae062196d7a (identique à la fin de PAY-3, inchangé)
git diff --check → exit 0
```

Contrairement à PAY-2/PAY-3, `HEAD` n'a **pas** avancé depuis la fin de PAY-3 — les fichiers PAY-3 restent non commités dans le worktree, exactement comme laissés.

## 2. Rapports lus

`PAY1_ARCHITECTURE_REPORT.md`, `PAY3_UNIFIED_PAYMENT_ARCHITECTURE_REPORT.md`, `PAY3_PAYMENT_PROVIDER_MATRIX.md`, `PAY3_MANUAL_PAYMENT_MATRIX.md`, `PAY2_CINETPAY_DEPRECATION_REPORT.md` — tous relus (rédigés lors des sprints précédents de cette même conversation).

## 3. Registre existant audité

`server/services/finance/paymentProviderRegistry.js` : l'entrée `mtn_direct` déclare déjà `scope: 'national'`, `methods: ['mobile_money']`, `capabilities: { initiate: true, statusQuery: true, webhook: true, refund: false, reconcile: true }`, et une table de normalisation `STATUS_MAPS.mtn_direct` **provisoire** (`{ pending, successful, failed, cancelled }`, en minuscules, jamais vérifiée contre la documentation réelle). `initiatePayment`/`getStatus`/`verifyCallback` lèvent `FINANCIAL_PROVIDER_NOT_IMPLEMENTED`. Contrat à préserver : `getProvider('mtn_direct')` doit continuer à exposer les mêmes noms de méthode, seule leur implémentation change.

## 4. Documentation MTN consultée

`momodeveloper.mtn.com` est une SPA (rendu JavaScript) — non exploitable directement par les outils de récupération disponibles dans cette session (contenu retourné = coquille de navigation uniquement). Contournement : `momo.mtn.com/api/` (page produit officielle, domaine `mtn.com`, statique) confirme explicitement **Congo Brazzaville** comme marché MTN MoMo API supporté. Le contrat technique exact (endpoints, headers, formats) a été corroboré via une capture Postman tierce documentant un test sandbox réel (`gist.github.com/chaiwa-berian`), traitée comme source **secondaire non officielle** — jamais copiée comme code, seulement utilisée pour valider la cohérence du contrat déjà connu (headers, séquence Create API User → API Key → Token → RequestToPay → GetStatus, statuts `PENDING/SUCCESSFUL/FAILED`, champ `reason` sur échec). Détail complet et limites de cette recherche : `PAY4_MTN_MOMO_REPORT.md` §3-4.

## 5. Plan

1. Corriger `STATUS_MAPS.mtn_direct` du registre PAY-3 pour refléter la casse réelle MTN (`PENDING`/`SUCCESSFUL`/`FAILED`) — additif, ne casse pas le contrat.
2. Construire une couche transport MTN dédiée (`services/payments/providers/mtn/`), séparée de toute décision financière.
3. Étendre `financialPaymentService.createHotelPayment` pour accepter un `provider`/`providerPaymentId` optionnels (défaut `'manual'` inchangé — rétrocompatible).
4. Ajouter la transition `pending→failed` manquante (jamais nécessaire avant PAY-4 car aucun paiement manuel n'échoue de façon asynchrone).
5. Construire l'orchestrateur MTN (initiation, corroboration de statut, jamais de confirmation directe depuis un callback non vérifiable).
6. Router : initiation (client propriétaire de sa réservation ou staff), callback (corrobore toujours via GET avant de confirmer), vérification de statut.
7. Tests ciblés (transport, contrat provider, sécurité, Financial Core, ownership).
8. Aucun appel réseau réel — aucun credential sandbox disponible dans cet environnement (§10/§45 du mandat).

Aucune route webhook Airtel/Yabetoo créée. Aucune UI web/mobile construite au-delà de la documentation de la cible.
