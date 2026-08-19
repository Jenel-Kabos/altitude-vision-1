# PAY-2 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short → (vide, worktree propre)
git branch --show-current → main
git rev-parse HEAD → f1bb85cda6d63a86ef6afc288b8893d61b0a96cb
git diff --check → exit 0
```

**HEAD a avancé extérieurement depuis la fin de PAY-1** (`29044699d25df30d1fffbbadf11fefc9cd6f9cac` → `f1bb85cda6d63a86ef6afc288b8893d61b0a96cb`). Ce commit (`f1bb85c "Update Altimmo 30"`, auteur `Altitudevision <altitudevis3n@gmail.com>`) n'a pas été créé par cette session — aucune session de travail précédente n'a exécuté `git commit`. Il correspond exactement au contenu produit lors des sprints UI-MOB-5 à UI-MOB-7 et PAY-1 (27 fichiers : composants/tests mobiles, rapports `UI_MOB*`, rapports `PAY1_*`, test de caractérisation CinetPay), confirmé par `git show --stat HEAD`. Le worktree est désormais propre — aucune régularisation nécessaire, aucun travail perdu. Documenté conformément à la consigne de ne jamais prétendre avoir créé ce commit.

## 2. Rapports lus

`PAY1_ETAT_INITIAL.md`, `PAY1_PAYMENT_METHOD_MATRIX.md`, `PAY1_DOMAIN_MATRIX.md`, `PAY1_ARCHITECTURE_REPORT.md` — tous relus intégralement (déjà rédigés par la session précédente de cette même conversation).

## 3. Rappel du P0 identifié par PAY-1

`server/controllers/cinetpayController.js:webhookCinetpay`, route `POST /api/paiements/webhook-cinetpay` (référencée comme `notify_url` par `initierPaiement` dans le même fichier) : aucune vérification de signature, aucune protection anti-rejeu, écriture directe `Paiement.statut = 'payé'` à partir d'un `transaction_id` et d'un `status` fournis dans le corps de la requête, sans authentification. Un second flux (`paiementTransactionController.js:webhookCinetpay`, route `POST /api/transactions/webhook/cinetpay`), correctement sécurisé (HMAC-SHA256 + `FinancialProviderEvent`), existe mais est explicitement commenté `// legacy — conservé, non utilisé par les nouveaux paiements`.

## 4. Décision produit actée pour ce sprint

CinetPay n'est **pas** retenu comme provider stratégique pour le Congo-Brazzaville. Cible future : MTN MoMo / Airtel Money directs (national), manuel (espèces/virement/chèque, déjà fonctionnel), Yabetoo selon corridors internationaux réellement supportés, futur PSP carte. PAY-2 ferme le P0 par **dépréciation contrôlée** de CinetPay, pas par un durcissement en vue d'une poursuite de l'intégration (contrairement à la recommandation initiale de `PAY1_ARCHITECTURE_REPORT.md` §49 PAY-2, révisée par cette décision produit plus récente).

## 5. Plan

1. Inventaire exhaustif de toutes les occurrences CinetPay dans le code (classification ACTIVE/LEGACY/READ-ONLY/DEAD/TEST-ONLY).
2. Tracer les flux réellement actifs (initiation, webhook, frontend web, mobile) par domaine.
3. Reproduire le test de caractérisation PAY-1 pour prouver l'état AVANT correction.
4. Désactiver l'initiation (`POST /api/paiements/initier`) — réponse explicite `410 Gone` / `PAYMENT_PROVIDER_DEPRECATED`, aucun appel à l'API CinetPay.
5. Neutraliser le webhook (`POST /api/paiements/webhook-cinetpay`) — aucune mutation possible, réponse explicite.
6. Vérifier/laisser intact tout ce qui permet de lire l'historique CinetPay (`PaiementTransaction.methode` enum, affichage web/mobile).
7. Retirer CinetPay des choix actifs côté UI si exposé comme option pour une nouvelle opération (sans toucher à l'affichage historique).
8. Tests de non-régression + tests d'attaque prouvant la fermeture.
9. Gates complets, rapport final.

Aucune migration, aucune suppression d'enum, aucun changement destructif prévu.
