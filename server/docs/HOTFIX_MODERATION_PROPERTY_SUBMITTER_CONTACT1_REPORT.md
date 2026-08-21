# HOTFIX-MODERATION-PROPERTY-SUBMITTER-CONTACT-1 — Rapport final

Date : 2026-08-21. Branche `main`. Aucun commit créé.

## Résumé exécutif

L'audit a révélé que le backend exposait **déjà** tout le nécessaire (`owner` peuplé avec `name email photo role phone` sur l'endpoint de modération, strictement scopé Admin) — le vrai gap était uniquement frontend : `role`/`phone` arrivaient déjà dans la réponse API mais n'étaient jamais affichés, et aucun bouton WhatsApp n'existait. **Aucune modification backend n'a donc été nécessaire** ; seuls des tests de preuve/régression ont été ajoutés côté serveur. Le bloc "Propriétaire" minimal a été remplacé par un bloc "Soumis par" complet (nom, rôle traduit, email, téléphone, date de soumission, bouton WhatsApp), avec un nouveau helper `normalizePhoneForWhatsApp` gérant les formats réels du projet.

## Réponses aux 30 questions du mandat

1. **Quel champ Property identifie le vrai soumissionnaire ?** `Property.owner` (`ObjectId ref: 'User'`) — prouvé par `owner: req.user.id` à la création, dans `propertyController.js` (web) et `propertyMobileController.js` (mobile). Aucun champ `createdBy`/`submittedBy` distinct n'existe.
2. **Quelle collection contient ses coordonnées ?** `User` (`server/models/User.js`).
3. **L'API de modération les retournait-elle déjà ?** Oui — `getPendingProperties` peuple déjà `owner` avec `'name email photo role phone'` (`propertyController.js:563`), avant même ce hotfix.
4. **Backend modifié ?** Non, aucun fichier `server/controllers`, `server/models` ou `server/routes` modifié. Seul `server/__tests__/propertyRoutes.test.js` a été étendu (tests de preuve).
5. **Quels champs sont exposés (endpoint modération) ?** `owner._id, name, email, photo, role, phone` — rien de plus (sélection Mongoose explicite).
6. **Des champs sensibles sont-ils exposés ?** Non — `password`/`tokenVersion`/tokens ne peuvent pas transiter par une sélection Mongoose `populate(path, 'name email photo role phone')`, structurellement impossible. Vérifié par un test dédié (`returned.password`/`returned.tokenVersion` → `undefined`).
7. **L'API publique Property a-t-elle changé ?** Non — ni `getProperty` (`/api/properties/:id`) ni `getAllProperties`/`runPropertySearch` (`/api/properties`) n'ont été touchés. Le test préexistant prouvant que `owner.email`/`owner.phone` sont absents de la réponse publique reste vert sans modification.
8. **Le nom apparaît-il dans les détails ?** Oui, dans le bloc "Soumis par".
9. **Email ?** Oui, affiché ; message "Email non renseigné" si absent (jamais `undefined` affiché).
10. **Téléphone ?** Oui, affiché ; message "Numéro non renseigné" si absent.
11. **Rôle ?** Oui, traduit en label humain (`Propriétaire`, `Client`, `Administrateur`, etc. — mapping local `ROLE_LABELS` couvrant l'intégralité de l'enum `User.role`), jamais le code brut.
12. **Date si pertinente ?** Oui — `Property.createdAt` (schéma `timestamps: true`, confirmé), affichée "Soumis le {date}" ; utilisé seulement parce que sa correspondance avec la date de dépôt est prouvée (création = premier `statusAdmin: 'En attente'`), pas supposée.
13. **Comment le numéro WhatsApp est-il normalisé ?** `client/lib/utils/whatsapp.js` — `normalizePhoneForWhatsApp()` : supprime tout caractère non-numérique, puis applique 3 règles dans l'ordre (déjà préfixé 242 → inchangé ; local congolais 9 chiffres commençant par 0 → préfixé 242 sans retirer le 0 ; sinon, si longueur plausible (8-15 chiffres) → traité comme international déjà correct, préservé tel quel ; sinon → `null`).
14. **+242 est-il géré ?** Oui — jamais dupliqué (testé explicitement : `+242068002151` → `242068002151`, pas `242242068002151`).
15. **Numéro international géré ?** Oui — un numéro plausible d'un autre pays (ex. `+33612345678`) est préservé avec son propre code pays, jamais préfixé 242 arbitrairement.
16. **Numéro absent géré ?** Oui — `normalizePhoneForWhatsApp(null/undefined/'')` → `null`, bouton WhatsApp rendu comme `<button disabled>`, jamais un lien.
17. **Numéro invalide géré ?** Oui — chaîne non exploitable (ex. `'12'`, `'abc'`) → `null`, même comportement désactivé.
18. **URL wa.me correcte ?** Oui — `https://wa.me/{numéro normalisé}?text={message encodé}`, jamais `wa.me/undefined` (impossible structurellement : le lien n'est rendu que si `buildWhatsAppLink` renvoie une valeur non nulle).
19. **Message prérempli ?** Oui — `"Bonjour, je vous contacte depuis Altitude Vision concernant votre annonce « {titre} » actuellement en cours de validation."`, construit uniquement à partir de données réellement présentes (`selectedProperty.title`), aucune donnée sensible.
20. **Encodage correct ?** Oui — `encodeURIComponent` via `buildWhatsAppLink`, testé avec accents, guillemets français, `&`, `?`.
21. **Envoi automatique ? (doit être NON)** Confirmé NON — le lien `wa.me` ouvre WhatsApp avec le message prérempli dans le champ de saisie ; c'est WhatsApp (application tierce) qui exige un clic humain sur "Envoyer", aucun code de ce hotfix ne peut déclencher un envoi automatique.
22. **Cross-tenant sécurisé ?** `getPendingProperties` n'applique **aucun filtre tenant** — comportement préexistant, non modifié par ce hotfix (le mandat interdit explicitement de toucher aux hotfixes tenant existants sans bug prouvé, et aucun bug n'a été identifié ni introduit ici). Documenté tel quel, pas de changement de périmètre tenant.
23. **Tests backend ?** 3 nouveaux tests dans `propertyRoutes.test.js` (401 sans token, 403 non-Admin, 200 Admin avec owner complet + preuve d'absence de password/tokenVersion, 200 avec owner null sans crash) — 39/39 tests du fichier verts.
24. **Tests frontend ?** 10 tests (`PropertyModerationPage.test.jsx`) + 13 tests du helper (`whatsapp.test.js`) — nom/email/téléphone/rôle/date affichés, lien wa.me correct avec message encodé, bouton désactivé si numéro absent/invalide, email absent géré proprement.
25. **Lint ?** Backend : 0 erreur (106 warnings baseline inchangée). Frontend : 0 erreur (266 warnings baseline inchangée), 0 erreur/warning sur les fichiers créés/modifiés.
26. **Build ?** `npm run build:next` réussi.
27. **`git diff --check` ?** exit 0.
28. **Fichiers modifiés ?** `client/lib/pages/dashboard/PropertyModerationPage.jsx` (bloc "Soumis par"), `server/__tests__/propertyRoutes.test.js` (3 tests ajoutés). Fichiers créés : `client/lib/utils/whatsapp.js`, `client/lib/__tests__/whatsapp.test.js`, `client/lib/__tests__/PropertyModerationPage.test.jsx`, `server/docs/HOTFIX_MODERATION_PROPERTY_SUBMITTER_CONTACT1_ETAT_INITIAL.md`, ce rapport.
29. **Git ?** Aucun `git add`/`commit`/`push`/`deploy`/reset destructif exécuté.
30. **Verdict ?** Voir ci-dessous.

## Gates

| Gate | Résultat |
|---|---|
| Tests backend ciblés (`propertyRoutes.test.js`, incluant modération) | 39/39 ✅ |
| Suite backend unit complète | 127/127 suites, 1459/1459 tests ✅ |
| Lint backend | 0 erreur ✅ |
| Tests frontend ciblés (`PropertyModerationPage.test.jsx`, `whatsapp.test.js`) | 10/10 + 13/13 ✅ |
| Suite client complète | 93/93 fichiers, 634/634 tests ✅ |
| Lint client | 0 erreur ✅ |
| Build production (`build:next`) | ✅ |
| `git diff --check` | exit 0 ✅ |

## Verdict

**CERTIFIÉ VERT.**

Chaîne complète vérifiée : `Property.owner` (soumissionnaire canonique, prouvé par le code de création) → `User.phone` (déjà peuplé par l'endpoint de modération, jamais construit depuis `req.body`) → `normalizePhoneForWhatsApp()` (règles testées sur les formats réels du projet, jamais de double-préfixage 242, jamais de numéro étranger altéré) → `wa.me` (URL toujours valide ou lien absent, jamais `wa.me/undefined`) → message prérempli encodé → ouverture WhatsApp, sans aucun envoi automatique. Les coordonnées restent strictement backoffice (endpoint `Admin`-only, fiche publique inchangée et déjà testée comme ne les exposant jamais). Aucun numéro n'est fourni arbitrairement par le frontend — tout provient de `owner.phone` renvoyé par le serveur. Tous les gates (tests, lint, build, `git diff --check`) sont verts sur backend et frontend.

## STOP

Conformément au mandat : aucune modification de la messagerie, aucun travail paiement, aucun redesign global du dashboard. En attente de validation utilisateur.
