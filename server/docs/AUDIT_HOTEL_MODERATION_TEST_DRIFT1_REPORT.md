# AUDIT-HOTEL-MODERATION-TEST-DRIFT-1 — Rapport final

Date : 2026-08-22. Branche `main`. Aucun commit créé.

## Résumé exécutif

`HotelModerationPage.jsx` avait déjà été aligné (avant ce sprint, modification externe non commitée) sur le même pattern "grille de cartes + modale de détail" que `PropertyModerationPage.jsx` et `AccommodationModerationPage.jsx` — changement structurel et visuel explicitement documenté dans le code lui-même (`HOTFIX-MODERATION-HOTEL-UI-1`). Aucun endpoint, permission, payload ou transition métier n'a changé — seule la position DOM des actions de modération (déplacées de la carte vers une modale accessible via "Voir les détails") a changé. **TEST DRIFT CONFIRMÉ.** Le composant a été conservé intact ; seul le test a été adapté pour ouvrir la modale avant d'asserter, sans affaiblir aucune assertion métier existante, et un test manquant (rejet avec motif obligatoire et payload exact) a été ajouté.

## Réponses aux 31 questions du mandat

1. **Quel test échouait exactement ?** Les 2 tests de `HotelModerationPage.test.jsx` (`describe('HotelModerationPage — versions sensibles proposées')`).
2. **Quelle assertion ?** Test 1 : `expect(await screen.findByText('Modification sensible proposée')).toBeInTheDocument()`. Test 2 : `fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))`.
3. **Valeur attendue ?** Présence immédiate du texte de comparaison de version et du bouton "Valider" dans le DOM au premier rendu.
4. **Valeur reçue ?** Timeout — ni le texte ni le bouton n'existent dans le DOM initial (uniquement une carte avec un bouton "Voir les détails").
5. **`HotelModerationPage.jsx` avait-il été modifié avant ce sprint ?** Oui — modification externe non commitée, déjà présente au baseline du sprint HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 précédent, jamais créée ni modifiée par lui.
6. **Quelles modifications ?** Voir `AUDIT_HOTEL_MODERATION_TEST_DRIFT1_DIFF_MATRIX.md` — passage d'un layout `<div>` simple avec formulaire de rejet inline à une grille `DashboardCard` + modale de détail (`DashboardPage`/`DashboardPageHeader`/`DashboardState`/`DashboardToolbar`, stats en cartes, filtre en pilules, état d'erreur dédié).
7. **Sont-elles visuelles/UX ?** Oui, exclusivement — confirmé ligne par ligne dans la matrice (STRUCTURE DOM/VISUEL/LIBELLÉ/ACTION-déplacement), aucune ligne classée PERMISSION/API/SÉCURITÉ/STATUT MÉTIER.
8. **Une API a-t-elle changé ?** Non — `getPendingHotels()`/`reviewHotel(id, action, payload)` appelés à l'identique ; `hotelService.js` non modifié (`git status`/`git diff --stat` vides).
9. **Une permission a-t-elle changé ?** Non — le wrapper de route (`client/app/dashboard/moderation/hotellerie/page.jsx`) n'a pas été touché ; aucun garde de rôle retiré ou ajouté dans le composant.
10. **Une transition métier a-t-elle changé ?** Non — `handleValidate`/`handleReject` appellent les mêmes actions (`'validate'`/`'reject'`) avec le même payload (`{reason}`), même règle "motif obligatoire" avant tout appel.
11. **Une donnée sensible supplémentaire est-elle exposée ?** Non — mêmes champs (`hotel.property`, `categories`, `hotelServices`, `proposedVersion`), aucune nouvelle donnée affichée qui ne l'était pas déjà (uniquement réorganisée entre carte et modale).
12. **Une fonctionnalité a-t-elle réellement disparu ?** Non — Valider, Rejeter (avec motif obligatoire), comparaison de version proposée : toutes présentes, seulement déplacées dans la modale de détail. Un bug mineur préexistant a même été corrigé au passage : `rejectingId` n'était jamais réinitialisé en cas d'échec du rejet dans l'ancienne version (`setRejectingId(null)` absent du `catch`/`finally`) — désormais correctement remis à `null` dans un `finally`.
13. **Le test était-il couplé à l'ancien DOM ?** Oui — il cherchait le texte et le bouton directement au premier rendu, sans jamais simuler le clic d'ouverture de la modale devenue le vrai point d'entrée.
14. **La fixture était-elle obsolète ?** Non — la fixture (`getPendingHotels.mockResolvedValue([...])`) reste un format de données valide et inchangé ; seul le parcours d'interaction pour l'atteindre a changé.
15. **S'agit-il d'un TEST DRIFT ?** Oui, confirmé.
16. **S'agit-il d'une vraie régression ?** Non — aucune (métier, sécurité ou fonctionnelle).
17. **`HotelModerationPage.jsx` a-t-il dû être modifié ?** Non.
18. **Si oui, pourquoi précisément ?** Sans objet.
19. **Si non, a-t-il été conservé exactement tel quel ?** Oui — `git status`/`git diff` confirment qu'aucune ligne de ce fichier n'a été modifiée par cet audit.
20. **Quel changement test a été effectué ?** `HotelModerationPage.test.jsx` : les 2 tests existants ouvrent désormais la modale (clic sur "Voir les détails") avant d'asserter ; `findByText` remplacé par `findAllByText` pour le texte dupliqué légitimement (badge + en-tête de section) ; 1 nouveau test ajouté pour le rejet (motif obligatoire, payload exact `{reason: 'Photos insuffisantes'}`), comblant un gap de couverture qui existait déjà avant ce diff (le rejet n'était jamais testé).
21. **Les assertions métier restent-elles fortes ?** Oui — toujours `toHaveBeenCalledWith('HOTEL-1', 'validate')` / `toHaveBeenCalledWith('HOTEL-1', 'reject', {reason: ...})` (endpoint + ID + payload exacts, jamais un `toBeTruthy()` générique), toujours la vérification du texte complet de comparaison de version (nom proposé + ville proposée).
22. **Tests HotelModerationPage ?** 3/3 verts (2 corrigés + 1 nouveau).
23. **Tests Hotel/modération (backend) ?** `hotelRoutes.test.js` rejoué sans modification : 39/39 verts — confirme le contrat backend (`/status/pending`, `/:id/:action`, permissions `ROLES_MODERATION`) intact.
24. **Suite client complète ?** 93/93 fichiers, 641/641 tests verts (aucun échec restant, y compris les fichiers touchés par le hotfix Property précédent).
25. **Lint ?** 0 erreur (267 warnings, baseline inchangée — dont 1 warning pré-existant non lié dans `HotelModerationPage.jsx`, `Tag` importé sans être utilisé, laissé tel quel car hors périmètre : ne pas toucher le composant).
26. **Build ?** `npm run build:next` réussi.
27. **`git diff --check` ?** exit 0.
28. **Backend touché ?** Non — aucun fichier `server/` modifié par cet audit.
29. **Fichiers modifiés ?** `client/lib/__tests__/HotelModerationPage.test.jsx` uniquement. Documentation créée : `server/docs/AUDIT_HOTEL_MODERATION_TEST_DRIFT1_ETAT_INITIAL.md`, `..._DIFF_MATRIX.md`, ce rapport.
30. **Commit/push/deploy ?** Aucun.
31. **Verdict ?** Voir ci-dessous.

## Preuve du non-impact métier (mandat §28)

- **Mêmes endpoints** : `getPendingHotels()` → `GET /hotels/status/pending` ; `reviewHotel(id, action, payload)` → `PATCH /hotels/:id/:action`. Ni `hotelService.js` ni les routes/contrôleurs backend n'ont changé.
- **Mêmes méthodes HTTP** : GET et PATCH, inchangées.
- **Mêmes permissions** : `ROLES_MODERATION` côté backend (non modifié) ; aucun garde retiré côté frontend (le wrapper de route n'a pas changé).
- **Mêmes actions** : `'validate'` / `'reject'`.
- **Mêmes transitions métier** : hôtel retiré de la liste locale au succès, toast de confirmation, aucun changement de statut admin différent.
- **Aucune donnée sensible supplémentaire** : mêmes champs affichés, seulement réorganisés visuellement.
- **Aucune suppression de garde** : le motif de rejet reste obligatoire avant tout appel API (`if (!rejectReason.trim()) { toast.error(...); return; }`, inchangé).

## Verdict

**AUDIT-HOTEL-MODERATION-TEST-DRIFT-1 : TEST DRIFT CONFIRMÉ — AMÉLIORATION FRONTEND CONSERVÉE.**

Aucune règle métier, permission ou sécurité modifiée. L'amélioration frontend (alignement sur le pattern carte + modale déjà en place dans `PropertyModerationPage.jsx`/`AccommodationModerationPage.jsx`) est légitime et a été conservée intégralement, sans aucune modification de `HotelModerationPage.jsx`. Le test obsolète a été réaligné sur le vrai parcours d'interaction, en conservant (et en renforçant, via l'ajout du test de rejet) la force de ses assertions métier. Tous les gates sont verts.

## STOP

Conformément au mandat : aucun autre sprint entamé. En attente de validation utilisateur.
