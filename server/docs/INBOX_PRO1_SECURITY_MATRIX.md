# INBOX-PRO-1 — Matrice de sécurité

## Rendu HTML (`SafeHtmlEmailViewer`)

| Vecteur | Défense | Statut |
|---|---|---|
| `<script>` | DOMPurify (défaut + `FORBID_TAGS`) | ✅ Testé |
| `on*` (onerror, onclick, onload, onmouseover…) | DOMPurify (défaut + `FORBID_ATTR` explicite) | ✅ Testé |
| `javascript:` URL | DOMPurify (défaut) | ✅ Testé |
| `<iframe>`/`<object>`/`<embed>`/`<form>` imbriqués | DOMPurify `FORBID_TAGS` | ✅ Testé |
| CSS cassant la page hôte | Isolation structurelle (iframe `srcDoc`, document distinct) — pas une sanitization, une architecture | ✅ Par construction |
| JS s'exécutant malgré une sanitization manquée | `sandbox` iframe SANS `allow-scripts` — deuxième couche indépendante de DOMPurify | ✅ Par construction (défense en profondeur) |
| Accès de l'iframe au DOM parent | `sandbox` SANS `allow-same-origin` | ✅ Par construction |
| Navigation piégée dans l'iframe au clic d'un lien | `target="_blank"` forcé sur tous les `<a>` + `sandbox="allow-popups allow-popups-to-escape-sandbox"` | ✅ Testé |
| Fuite de contenu via une image de tracking | Non traité (voir matrice de rendu) | NON CONFIRMÉ / hors périmètre |

## Pièces jointes (mandat §48)

**Attachments téléchargement/authentification — NON RE-AUDITÉ CE SPRINT.** Le mécanisme (`previewEndpoint`/`downloadEndpoint`, `uploadPrivateAsset`/`readPrivateAsset`) est **antérieur à ce sprint et inchangé**. Aucune modification n'a été apportée à `internalMailController.js` au-delà de la persistance du champ `html` (2 lignes). La question "une URL de pièce jointe ne doit pas permettre un accès cross-tenant" n'a pas été re-vérifiée par un nouveau test dans ce sprint — **NON CONFIRMÉ (par ce sprint spécifiquement)**, mais aucune régression introduite (aucun fichier de routing/autorisation des pièces jointes touché).

## Tenant isolation (mandat §49-50)

**Non concerné par ce sprint.** `InternalMail` n'a jamais eu de champ tenant/scope dans ce système (messagerie interne + emails Zoho d'un unique compte `contact@altitudevision.agency`, pas un système multi-tenant par conversation comme `Conversation`/`Message`). Les corrections tenant-scope des sprints précédents (HOTFIX-USERS-COUNT-1 → TENANT-SCOPE-HOTFIX-3) concernent exclusivement `Conversation`/`Message` (StaffInboxPage), Hotel, Financial, BusinessProfiles — **aucun fichier de ces sprints n'a été touché ni n'avait besoin de l'être ici**. Les invariants "Platform Operator sans tenant sélectionné → pas d'accès tenant-scoped", "propriétaire ne devient pas participant automatiquement", "conversation unattributed conserve son contrat" concernent le modèle `Conversation`, non `InternalMail` — non applicables à ce mandat, non modifiés.

## Owner / Client isolation (mandat §50)

Non applicable à `InternalMail` (pas un modèle scopé par ownership/tenant) — non modifié, non régressé (aucun changement d'autorisation).

## Résumé

Le changement de sécurité de ce sprint est **strictement additif et local** : un nouveau composant frontend (`SafeHtmlEmailViewer`) plus sûr que l'ancien rendu direct, et deux lignes backend (persistance d'un champ HTML optionnel). Aucune route, aucun middleware d'autorisation, aucun contrôle tenant/ownership n'a été modifié.
