# HZ-04 — Cause racine

Cause démontrée et commune aux deux routes LIVE : frontière tenant absente et query globale.

- Middleware manquant sur `/admin/list` et `/status/pending`.
- `listAccommodationsForAdmin` initialisait explicitement un fallback `{}`.
- `pending` construisait un filtre de statut/modération sans `tenant`.
- Aucun tenant ne circulait du contexte authentifié vers ces queries.
- Le modèle porte directement `Accommodation.tenant` (ObjectId indexé) : aucune relation indirecte ni migration nécessaire.

La primitive existante `requireTenantScopeForStaffAllowPlatformWide`, certifiée HZ-03 et déjà importée dans ce routeur pour HZ-02, est appropriée. Middleware seul insuffisant : les handlers ignoraient encore `req.platformTenant`; le prédicat a donc été ajouté à la frontière de lecture la plus étroite.

