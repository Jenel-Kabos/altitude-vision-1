# ZOHO-INBOX-HEALTHCHECK-1 — MATRICE FRONTEND

## Non applicable au message de test (mandat §44-47)

Le message n'existe pas en base (voir `_STORAGE_MATRIX.md`) et n'est donc jamais renvoyé par l'API (voir `_API_MATRIX.md`) — **le frontend ne peut structurellement pas l'afficher**, quel que soit l'état de son cache, de ses filtres, ou du moment du dernier rafraîchissement. Aucun test de rafraîchissement/Network réel n'a été jugé nécessaire pour ce message précis : la cause est établie avec certitude à une couche largement antérieure (IMAP search criteria).

## Cache / rafraîchissement de l'Inbox (documenté pour référence, non la cause ici)

`InternalMessagingPage.jsx` : `getReceivedMessages()` appelé au montage et toutes les 30 secondes (`setInterval`, confirmé par lecture directe du composant, `HOTFIX-INBOX-SECURITY-2`/`INBOX-2` non modifiés sur ce point) — pas de cache client persistant bloquant un rafraîchissement (contrairement au cache mobile `getRecommendedProperties`, documenté séparément et sans rapport avec ce healthcheck).

## Conclusion

Cette couche est **hors de cause** pour le message de test. Aucune modification frontend n'est recommandée.
