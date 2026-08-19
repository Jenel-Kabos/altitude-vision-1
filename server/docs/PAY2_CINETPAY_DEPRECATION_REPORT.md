# PAY-2 — Dépréciation contrôlée de CinetPay & fermeture du P0

Date : 2026-08-19. Branche `main`, `HEAD f1bb85cda6d63a86ef6afc288b8893d61b0a96cb` (inchangé pendant tout le sprint).

## 1. Résumé

Le P0 identifié par PAY-1 (webhook CinetPay actif sans signature ni idempotence, `POST /api/paiements/webhook-cinetpay`) est fermé — non pas en le sécurisant pour poursuivre l'intégration, mais en dépréciant CinetPay dans son ensemble, conformément à la décision produit (Congo-Brazzaville : MTN/Airtel directs à terme, manuel déjà fonctionnel, Yabetoo selon corridors, futur PSP carte). Aucune nouvelle initiation CinetPay n'est plus possible ; le webhook ne peut plus muter aucune donnée. L'historique CinetPay (`PaiementTransaction.methode`, `Transaction.paymentMethod`, champs `cinetpayTransactionId`/`cinetpayRaw`) est intégralement conservé, lisible et non touché. Aucune UI web ou mobile ne proposait CinetPay comme choix actif — confirmé par recherche exhaustive, donc aucune modification frontend/mobile n'était nécessaire ni n'a été faite.

## 2. P0 initial

Rappel (voir `PAY2_CINETPAY_DEPRECATION_ETAT_INITIAL.md` §3 et `PAY1_ARCHITECTURE_REPORT.md` §9) : `cinetpayController.js:webhookCinetpay`, référencé comme `notify_url` par `initierPaiement` dans le même fichier, acceptait tout POST non authentifié et écrivait directement `Paiement.statut = 'payé'` à partir d'un `transaction_id` et d'un `status` fournis par l'appelant, sans aucune vérification.

## 3. Flux CinetPay actifs (avant ce sprint)

| Flux | Route | Fichier | Statut avant PAY-2 |
|---|---|---|---|
| Initiation | `POST /api/paiements/initier` | `cinetpayController.js:initierPaiement` | Actif — appelait réellement l'API CinetPay (`axios.post`) |
| Webhook | `POST /api/paiements/webhook-cinetpay` | `cinetpayController.js:webhookCinetpay` | Actif — mutait `Paiement` sans vérification (le P0) |

Aucun autre flux CinetPay n'était actif : ni le frontend web, ni l'application mobile n'appellent `POST /api/paiements/initier` (recherche exhaustive de `paiements/initier` dans `client/` et `altimmo-app/` — zéro résultat ; seul `transactions/:id/paiements/initier`, le flux **Yabetoo**, est appelé par `transactionService.js` web et mobile).

## 4. Flux legacy (non touchés, hors périmètre)

`paiementTransactionController.js:webhookCinetpay`, route `POST /api/transactions/webhook/cinetpay`, commentaire de route explicite `// legacy — conservé, non utilisé par les nouveaux paiements`. Correctement sécurisé (HMAC-SHA256 sur 15 champs IPN + `x-token`, idempotence via `FinancialProviderEvent`). **Non modifié** — il reste ce qu'il était : du code mort documenté, préservé pour compatibilité de lecture éventuelle, sans risque puisqu'il n'a jamais été le flux recevant du trafic réel.

## 5. Initiation — correction

`cinetpayController.js:initierPaiement` ne construit plus aucune requête vers `https://api-checkout.cinetpay.com`. Réponse immédiate et stable :

```json
{ "status": "fail", "code": "PAYMENT_PROVIDER_DEPRECATED", "provider": "cinetpay", "message": "..." }
```

HTTP `410 Gone`, conforme au contrat conceptuel du mandat §12. Aucun fallback automatique vers Yabetoo ou un autre provider (mandat §7 : « pas de fallback CinetPay→Yabetoo automatique ») — le client reçoit une erreur explicite, à charge de son interface de choisir un autre moyen (déjà le cas, puisqu'aucune UI n'appelait ce flux).

## 6. Webhook — correction

`cinetpayController.js:webhookCinetpay` ne touche plus jamais `Paiement` ni `notificationService`. Il journalise la réception (`console.log`, observabilité uniquement, aucune donnée sensible) puis répond `410 Gone` avec le même contrat `PAYMENT_PROVIDER_DEPRECATED`. **Choix explicite (Option B du mandat §8, motivé)** : la route reste montée plutôt que supprimée, pour absorber proprement d'éventuelles notifications résiduelles de CinetPay sur des transactions initiées avant cette dépréciation (jusqu'à expiration naturelle de leurs tentatives de notification côté CinetPay), sans jamais leur permettre de muter quoi que ce soit. Tout paiement resté en `en_attente` de ce fait doit être complété manuellement par le staff via la route déjà existante `POST /api/paiements/:id/marquer-paye` — aucune perte de capacité fonctionnelle, seulement la suppression de la confirmation automatique non vérifiable.

## 7. Historique

Vérifié sans modification :
- `PaiementTransaction.methode` conserve `cinetpay_mobile`/`cinetpay_carte` dans son enum ; `cinetpayTransactionId` et `cinetpayRaw` restent définis sur le schéma.
- `Transaction.paymentMethod` conserve les mêmes valeurs d'enum.
- Aucune donnée, aucun document existant n'a été touché, converti ou migré vers Yabetoo/MTN.
- Test ajouté (`cinetpayIsolation.test.js`) verrouillant explicitement la présence de ces champs/enums — protège contre un futur retrait accidentel qui casserait la lecture de l'historique.

## 8. Frontend

`client/lib/pages/dashboard/TransactionsPage.jsx` affiche encore les icônes `cinetpay_mobile`/`cinetpay_carte` pour l'historique des transactions — **conservé intact**, car c'est exactement l'affichage historique que le mandat §10 demande de ne pas supprimer. Aucun sélecteur actif "CinetPay" trouvé nulle part dans `client/` pour une nouvelle opération — rien à retirer.

## 9. Mobile

Recherche exhaustive dans `altimmo-app/` : **zéro occurrence** de "cinetpay" (code, écran, service). Rien à modifier, conforme au mandat §11.

## 10. Correction (synthèse technique)

Un seul fichier de logique métier modifié : `server/controllers/cinetpayController.js` (102 lignes retirées — appel `axios`, dépendance `notificationService`, dépendance `Paiement` — remplacées par 2 handlers stables de 410 Gone, ~20 lignes). Un commentaire de route mis à jour dans `server/routes/paiementRoutes.js` (aucun changement de comportement de routage, les deux routes restent montées aux mêmes chemins).

## 11. Tests d'attaque

`server/__tests__/cinetpayWebhookCharacterization.test.js` réécrit (3 tests) — rejoue exactement les payloads forgés qui exploitaient le P0 avant correction :
1. `transaction_id` deviné + `status: ACCEPTED`, aucun en-tête → **`Paiement.findOneAndUpdate` n'est plus jamais appelé**, réponse `410 PAYMENT_PROVIDER_DEPRECATED`.
2. `userId` arbitraire dans le `metadata` du corps → **`notify()` n'est plus jamais appelé**.
3. Rejeu identique du même payload → toujours sans effet (rien à muter, donc rien à protéger par idempotence supplémentaire).

`server/__tests__/cinetpayIsolation.test.js` (3 tests, dont 2 nouveaux) : initiation refusée sans jamais appeler `axios.post` (isolation externe la plus forte possible — l'appel n'existe plus) ; préservation des enums/champs historiques (§7).

## 12. Non-régression

- Suite unitaire serveur complète : **118/118 suites, 1353/1353 tests verts** (baseline PAY-1 : 118/1352 ; +1 test net).
- Test Mongo pertinent (`legacyPaymentWebhook.mongo.integration.test.js`, Yabetoo + CinetPay Flux B legacy) : **2/2 verts, non affecté**.
- `transactionPaymentAuthorization.test.js` + `externalIsolation.test.js` : **16/16 verts, non affectés**.
- Lint serveur : **0 erreur**, 106 avertissements (identique à la baseline PAY-1, aucun nouveau).
- Aucun test client (`client/`) ni mobile (`altimmo-app/`) exécuté — non requis, aucune UI modifiée (§8-9).

## 13. Fichiers modifiés

- `server/controllers/cinetpayController.js` — dépréciation des deux handlers.
- `server/routes/paiementRoutes.js` — commentaire de route mis à jour (aucun changement de routage).
- `server/__tests__/cinetpayWebhookCharacterization.test.js` — réécrit pour prouver la fermeture du P0 (au lieu de la vulnérabilité).
- `server/__tests__/cinetpayIsolation.test.js` — mis à jour + test de préservation historique ajouté.

Aucun modèle modifié. Aucun fichier frontend/mobile modifié. Aucun changement métier hors paiement (Auth/JWT/Tenant/IAM/logique transactions/loyer non touchées).

## 14. Gates

- `npm run lint` (server) → 0 erreur, 106 avertissements (baseline).
- `npm run test:unit` → 118/118 suites, 1353/1353 tests.
- Tests Mongo pertinents (webhook legacy) → 2/2 verts.
- `git diff --check` → exit 0.

## 15. Git

```
git status --short (avant modifications) → vide
git diff --check → exit 0
git rev-parse HEAD → f1bb85cda6d63a86ef6afc288b8893d61b0a96cb (inchangé pendant tout le sprint)
```

**Note de discipline git** : `HEAD` avait avancé extérieurement entre PAY-1 et PAY-2 (`29044699d` → `f1bb85cda`, commit `"Update Altimmo 30"`, auteur `Altitudevision`) — documenté dans `PAY2_CINETPAY_DEPRECATION_ETAT_INITIAL.md` §1. Ce commit n'a pas été créé par cette session. Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session PAY-2.

## 16. Dette restante

1. Le Flux B CinetPay legacy (`paiementTransactionController.js:webhookCinetpay`, HMAC sécurisé) reste du code mort documenté — non retiré (mandat §14 : pas de migration destructive). Sa suppression pourrait être envisagée dans un sprint de nettoyage ultérieur, une fois confirmé qu'aucun paiement historique ne dépend plus de sa complétion.
2. Les paiements CinetPay initiés avant cette dépréciation et encore `en_attente` (s'il en existe) ne recevront plus jamais de confirmation automatique — nécessitent une revue manuelle ponctuelle par le staff (`marquerPaye`), non quantifiée dans ce sprint (aucune requête de comptage exécutée sur une base de production).
3. Les variables d'environnement `CINETPAY_API_KEY`/`CINETPAY_SECRET`/`CINETPAY_SITE_ID` restent déclarées (`.env.example`) — non retirées, car `CINETPAY_SECRET` reste utilisé par le Flux B legacy conservé (§4).

## 17. Verdict

**PAY-2 : CERTIFIÉ VERT.**

- Aucun nouveau paiement CinetPay ne peut être initié : ✅ (410 systématique, aucun appel externe, prouvé par test).
- Le webhook vulnérable ne peut plus muter un paiement : ✅ (410 systématique, aucune écriture, prouvé par test rejouant les payloads d'attaque exacts de PAY-1).
- Historique conservé : ✅ (enums, champs legacy, affichage web tous intacts, verrouillés par test).
- Aucun autre provider cassé : ✅ (Yabetoo, virement, espèces, chèque, Financial Core hôtel — aucun fichier les concernant modifié, tests dédiés vérifiés verts).
- Tests/gates verts : ✅ (118/118 suites serveur, 1353/1353 tests, lint propre, Mongo pertinent vert).

Le P0 de PAY-1 est fermé par dépréciation, pas par correctif de sécurité sur un provider destiné à disparaître — cohérent avec la décision produit. STOP conforme au mandat §18, aucun sprint PAY-3 entamé.
