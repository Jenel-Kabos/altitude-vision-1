# ARCH-2C1 — Contrat comportemental du streaming documentaire

## Entrée et sortie

- Entrée partagée inchangée : `{ url, name, res, context = {} }`.
- URL absente ou protocole autre que HTTP(S) : HTTP 422, `{ status: 'fail', message: 'Document indisponible.' }`, aucun appel réseau.
- Upstream HTTP 404 ou 500 : corps upstream drainé, log contextuel, HTTP 502 et message safe identique.
- Succès : pipe exact du flux vers `res`.
- Type : valeur upstream ou `application/octet-stream`.
- Disposition : `inline` et filename nettoyé/tronqué à 120 caractères.
- Cache : `private, no-store`; `X-Content-Type-Options: nosniff`.
- Erreur transport avant headers : HTTP 502. Après headers : log uniquement, aucune seconde réponse.
- Aucun timeout n'était géré avant; aucun n'a été introduit afin de ne pas changer le contrat.

## Sécurité et ordre

Les routes, middleware, recherches DB, not-found, tenant, participation, ownership et permissions restent dans les contrôleurs, avant l'appel au streamer. L'extraction ne rend aucune nouvelle URL accessible et conserve exactement la validation existante `^https?://`; elle ne prétend pas corriger séparément la dette SSRF historique.

## Caractérisation avant extraction

Le nouveau test a d'abord ciblé l'export historique du contrôleur et a passé **7/7** avant déplacement. Il couvre URL absente/protocoles refusés, upstream 404/500, content-type, content-disposition, nettoyage filename, pipe, défaut MIME et erreurs réseau avant/après headers. L'intégration Mongo existante couvre flux réel, document absent/sans URL, upstream 404, authentication, tenant, propriétaire et locataire.
