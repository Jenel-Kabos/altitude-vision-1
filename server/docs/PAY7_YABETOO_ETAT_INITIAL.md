# PAY-7 — Yabetoo International — État initial

## Baseline Git

- Branche : `main`.
- HEAD : `15506a7b113742ad266cc5977ff06164b6c04994` (`Update Altimmo 3`).
- L'arbre était déjà très modifié avant PAY-7 : travaux PAY-5/PAY-6/PAY-6.1, Financial Core, conversations, litiges, Inbox Pro/Zoho et trois assets mobiles. PAY-7 ne les supprime ni ne les réécrit.
- `git diff --check` initial : vert, avec deux avertissements CRLF préexistants sur `internalMailController.js` et `InternalMail.js`.
- Aucun commit, push, déploiement, reset ou nettoyage n'est autorisé ni effectué.
- Pendant PAY-7, d'autres changements externes Inbox Pro sont apparus (notamment composants/tests responsive). Ils ont été laissés intacts et ne font pas partie du diff PAY-7.

## Inventaire réel

Yabetoo est appelé par un seul transport, `server/services/yabetooService.js`, depuis deux contrôleurs historiques :

1. Vente/location immobilière : `PaiementTransaction` est le paiement, `Transaction` porte l'agrégat métier. Initiation et polling sont authentifiés ; un webhook public signé traite les événements.
2. Visites : `Visite.paiementStatus` et `Visite.paiementRef` portent directement le paiement. Initiation et polling sont authentifiés ; aucun webhook/reconciler n'existe.

Aucun usage Yabetoo n'a été trouvé pour l'hébergement/hôtel, les réservations hôtelières, les loyers de gestion locative ou le Financial Core. Le web appelle les deux domaines. Le mobile appelle uniquement le paiement de transaction immobilière.

## Contrat réseau codé

- Base par défaut : sandbox Yabetoo `/v1` ; surcharge par `YABETOO_API_URL`.
- Auth : `Authorization: Bearer <YABETOO_SECRET_KEY>` côté serveur.
- Création : `POST /payment-intents`, montant en XAF, données MoMo et client incluses dès la création.
- Confirmation : `POST /payment-intents/:id/confirm`, sans corps.
- Consultation : `GET /payment-intents/:id`.
- Aucun timeout Axios explicite, aucune clé d'idempotence sortante, aucune normalisation d'erreur et aucun logging structuré.

## Écart documentaire bloquant

La documentation officielle consultée le 2026-08-21 décrit actuellement :

- création via `POST /v1/payment-intents`, qui retourne `id` et `clientSecret` ;
- confirmation avec `client_secret` et `payment_method_data` côté serveur ; l'exemple officiel utilise `POST /v1/payment-intents`, et non la route `/:id/confirm` codée ;
- Bearer secret key, XAF uniquement, Congo-Brazzaville, MTN et Airtel ;
- idempotency key recommandée ;
- webhook HMAC-SHA256 sur `timestamp.raw_body` ;
- remboursements via support, sans API de refund publiquement confirmée.

Le contrat de confirmation du dépôt est donc incompatible avec la documentation officielle actuelle. Aucun test sandbox réel fourni dans ce sprint ne permet de justifier une compatibilité legacy différente. Verdict réseau : **NON CERTIFIÉ / SECURITY HARDENING REQUIRED**.

## Configuration observée (valeurs non exposées)

- `YABETOO_API_URL` : présent localement, environnement sandbox.
- `YABETOO_SECRET_KEY` : présent localement ; valeur volontairement non reproduite.
- `YABETOO_WEBHOOK_SECRET` : absent du `server/.env` observé ; présent seulement comme nom dans l'exemple. Le webhook échoue donc fermé en local (`503`) tant qu'il n'est pas fourni par l'environnement du processus.
- L'environnement de production effectif et la configuration du dashboard Yabetoo : **NON CONFIRMÉS**.

## Décision d'arrêt

Les conditions PAY-7 §62 sont réunies : contrat de confirmation divergent, idempotence faible et timeout non sûr. Aucun adaptateur Financial Core ni nouveau domaine n'est branché avant clarification contractuelle et validation sandbox.
