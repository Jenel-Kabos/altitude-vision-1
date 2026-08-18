# UX-OWNER-3 — Rapport final : double état du dashboard propriétaire / flash de navigation

Date : 2026-08-18. Branche `main`. HEAD au lancement : `bb8ab83cbf36ac73d5e3e2e1571633567f8438cf`.

## 1. Résumé exécutif

Il n'existe **qu'un seul** composant/dashboard (`OwnerDashboard.jsx`) et **un seul** état React (`AuthContext.businessProfiles`, `null` → tableau) qui pilote deux rendus successifs de la même sidebar. Le menu riche (État 1) s'affichait **sans condition** tant que `businessProfiles` valait `null` (pas encore résolu) — un choix délibéré du code original, documenté par un commentaire dont le raisonnement s'est révélé inversé : il visait à éviter « un menu amputé pendant le chargement », mais produisait l'exact contraire, un vrai flash mesuré à ~800ms au navigateur (menu à 11 liens → 8 liens, ou → 3 liens selon le compte). Corrigé en ne rendant jamais, pendant le chargement, une section liée à un profil métier non encore confirmé — le menu ne peut plus que **croître**, jamais rétrécir. Vérifié réellement dans un navigateur (Playwright), 5 rechargements complets, aucune régression, aucune contamination inter-utilisateurs détectée dans le périmètre testé.

## 2. Reproduction

Confirmée dans un vrai navigateur avec le compte `rental-owner-e2e@example.test` (Proprietaire, 5 biens réels, profils `proprietaire_immobilier` + `exploitant_etablissement`) : chargement de `/mes-biens` → sidebar affiche pendant ~800ms les 11 entrées de `NAV_LINKS` intégralement, avec « Espace de travail → Chargement… » → puis se réduit à 8 entrées (contexte « Patrimoine immobilier »). Le flash se produit **même pour un compte qui possède réellement des profils** — ce n'est donc pas spécifique à un compte « sans espace » : c'est un défaut structurel du rendu pendant le chargement, indépendant du résultat final.

## 3. Deux états observés — confirmés être UN SEUL composant

Voir `UX_OWNER3_DASHBOARD_STATE_ETAT_INITIAL.md` §3-4 pour le détail ligne par ligne. Synthèse : `OwnerDashboard.jsx` (unique fichier) + `DashboardContextSwitcher` (`DashboardUI.jsx`, composant partagé et purement présentationnel — `loading`/`options` lui sont transmis par l'appelant, aucune logique métier propre). **Il n'existe pas deux dashboards** — une seule condition (`businessProfiles === null` vs résolu) sur un seul composant.

## 4. Composants responsables

- **État 1 (menu riche + « Chargement… »)** : `OwnerDashboard.jsx`, ancienne condition `visibleNavLinks = businessProfiles === null ? NAV_LINKS : ...` (rendu non filtré) + `DashboardContextSwitcher` avec `loading={businessProfiles === null}`.
- **État 2 (menu réduit + « Aucun espace disponible » ou menu correct)** : même fichier, même variable, valeur résolue de `businessProfiles`.

## 5. Source menu

`NAV_LINKS` (constante module-level, `OwnerDashboard.jsx`), chaque entrée porte un champ `profile` (`'proprietaire_immobilier' | 'exploitant_etablissement' | null`). Les entrées `profile: null` (Mes messages, Mon profil, Sécurité) ne sont **jamais** filtrées — universelles à tout propriétaire authentifié, sans dépendance à `businessProfiles`.

## 6. Owner profiles

`businessProfiles` (USER-ARCH-1/UX-ARCH-UX-1) — provient de `GET /api/user-business-profiles/:userId` (`userBusinessProfileController.list` → `userBusinessProfileService.getEffectiveProfiles`), qui fusionne (a) les profils explicitement accordés (`UserBusinessProfile`, staff-only en écriture) et (b) les profils **dérivés des données réelles** :
```js
Property.exists({ owner: userId, status: {$in:['vente','location']} })  → 'proprietaire_immobilier'
Property.exists({ owner: userId, status: 'hebergement'})
  || Hotel.exists({ manager: userId })
  || HotelStaffAssignment.exists({ user: userId, status: 'active' })     → 'exploitant_etablissement'
Locataire.exists({ user: userId })                                       → 'locataire'
```
**Jamais déduit du seul rôle `Proprietaire`** — confirme la réponse à la question centrale du mandat §5 : le système distingue bien Propriétaire immobilier / Exploitant établissement par les RESSOURCES RÉELLEMENT POSSÉDÉES, pas par un rôle générique. Vérifié empiriquement : `rental-owner-e2e` (5 Property réelles) résout correctement à `["proprietaire_immobilier","exploitant_etablissement"]` (appel API direct, `curl`).

## 7. Workspace

« Espace de travail » (le libellé du `<select>`) **n'est ni un `PlatformTenant`, ni un `OrgMembership`, ni un établissement, ni un modèle backend nommé** — c'est un sélecteur d'affichage en mémoire (`activeContext`, `'patrimoine' | 'etablissement'`) entre les profils métier USER-ARCH-1 déjà résolus. Aucun nom de modèle dédié n'existe côté backend pour cette notion — elle est **dérivée**, jamais persistée sous ce nom.

## 8. Tenant

Non applicable — confirmé par lecture de code (`deriveProfilesFromExistingData`, aucune référence à `PlatformTenant`/`OrgMembership` dans le calcul), et par le rapport `AUDIT_AUTH_RUNTIME_TENANT_REPORT.md` lui-même (§8) : « Les utilisateurs ordinaires ne sont pas bloqués : leur tenant est résolu côté backend par membership unique/explicite. » Le runtime `PlatformTenantRuntimeContext` (AUTH-1.1) concerne exclusivement le STAFF/PlatformOperator — **aucun rapport avec le dashboard Owner audité ici**, jamais confondu.

## 9. Loading

`AuthContext.jsx:45` : `useState(null)`. `AuthContext.jsx:178-186` : `useEffect` déclenché par `[user?._id, user?.id]`, appelle `getEffectiveProfiles(userId)` de façon strictement asynchrone après le premier rendu (jamais résolu au montage). `.catch(() => setBusinessProfiles([]))` — un échec réseau/backend est indiscernable, côté UI, d'un compte réellement sans profil (voir §14, réserve).

## 10. SSR/hydration

Aucun hydration mismatch détecté (0 erreur console liée à l'hydratation sur 5 rechargements complets, vérifié par `page.on('console')`). Le flash est un pur **effet de fetch après montage** (`useEffect` + appel réseau), pas un écart SSR/CSR — `businessProfiles` vaut `null` aussi bien côté serveur (jamais rendu) que côté client au premier rendu, cohérent des deux côtés.

## 11. API order

Ordre réel observé (Network, `rental-owner-e2e`, après le fix) :
```
0ms     navigation vers /mes-biens
~2200ms GET /health, GET /api/auth/session (NextAuth)
~2200ms GET /visites/owner/unread-count, GET /user-business-profiles/:id   ← résolution profils
~2220ms 200 /user-business-profiles/:id (25ms de round-trip réseau)
~2960ms GET /property-asset/portfolio/dashboard, /properties/my-properties, /rental-management/owner/my
```
Le délai (~2.2s avant le premier appel API) correspond au temps de montage React + lecture `localStorage` + établissement de `user` dans `AuthContext`, pas à une lenteur réseau du endpoint profils lui-même (25ms). `/properties/my-properties` (données de `/mes-biens`) est **totalement indépendant** de `/user-business-profiles` — les deux appels partent en parallèle, aucune dépendance croisée — confirme que le contenu central de `/mes-biens` ne dépend jamais de `businessProfiles` (répond à la question mandat §14).

## 12. Cause racine

`OwnerDashboard.jsx`, ancienne ligne : `const visibleNavLinks = businessProfiles === null ? NAV_LINKS : NAV_LINKS.filter(...)`. Rendu **non filtré** pendant le chargement — chaque section liée à un profil métier (Vente/Location, Établissements/Hébergements/Réservations) s'affichait de façon optimiste avant confirmation, puis disparaissait si le profil correspondant s'avérait absent. Un choix délibéré à l'origine (commentaire : éviter « un menu amputé ») qui produisait l'exact problème qu'il prétendait éviter.

## 13. État 1 légitime ?

**Non.** Aucune preuve que l'utilisateur doive voir une section avant confirmation de son profil réel — au contraire, le montrer puis le retirer est objectivement pire qu'un affichage progressif. Confirmé par mesure réelle (~800ms de menu incorrect, sur un compte qui ne finit même pas avec CE menu exact — `rental-owner-e2e` finit à 8 liens dans le contexte patrimoine, jamais 11).

## 14. État 2 légitime ?

**Partiellement confirmé.** Pour `rental-owner-e2e` (données réelles), l'état final (8 liens, « Patrimoine immobilier ») est prouvé correct — dérivé directement de vraies `Property` en base, revérifié par appel API direct. Pour un compte qui finirait sur « Aucun espace disponible » (0 profil), le mécanisme de dérivation (`Property.exists`/`Hotel.exists`/…) est un test d'existence pur, déterministe, sans bug identifié à la lecture — mais **je n'ai pas pu reproduire empiriquement ce cas précis dans le harnais de test** (une seule fixture Proprietaire disponible, déjà pourvue de biens ; la tentative de promotion d'un compte Client via `PATCH /api/users/:id/role` a été bloquée par une frontière tenant Admin sans rapport avec ce sprint). **NON CONFIRMÉ empiriquement** pour ce sous-cas précis — seule la preuve par lecture de code est disponible, honnêtement signalée comme telle plutôt que déduite.

## 15. Correction

`client/lib/pages/dashboard/OwnerDashboard.jsx` :
```diff
- const visibleNavLinks = businessProfiles === null ? NAV_LINKS : NAV_LINKS.filter(({ profile }) => {
-   if (!profile) return true;
+ const visibleNavLinks = NAV_LINKS.filter(({ profile }) => {
+   if (!profile) return true;
+   if (businessProfiles === null) return false;
    if (profile === 'proprietaire_immobilier') return isProprietaireImmobilier && activeContext === 'patrimoine';
    return isExploitantEtablissement && activeContext === 'etablissement';
  });
```
Correction minimale (mandat Option A/D combinées) : « loading neutre → navigation finale », sans toucher au mécanisme de résolution des profils lui-même (aucun changement backend, aucun changement IAM/tenant). Le `DashboardContextSwitcher` n'a pas été modifié — son affichage `Chargement…`/`Aucun espace disponible` était déjà correct (jamais les deux simultanément, cf. `DashboardUI.jsx:80-81`).

## 16. Owner immobilier

Vérifié réellement (`rental-owner-e2e`, profils `[proprietaire_immobilier, exploitant_etablissement]`, contexte `patrimoine` sur `/mes-biens`) : Vue du patrimoine, Biens en vente, Biens en location, Mes rendez-vous, Mes paiements, Mes messages, Mon profil, Sécurité — **jamais** Mes établissements/Hébergements/Réservations sur cette route (filtré par `activeContext`, comportement voulu DASH-2, pas un bug).

## 17. Owner hôtel

Non testé avec une fixture *hôtel-seul* dédiée (aucune disponible isolément dans le harnais sans doublon avec `rental-owner-e2e`, qui a les deux profils). Vérifié par navigation vers `/mes-hotels` avec le même compte (contexte `etablissement`) : Mes établissements, Hébergements, Réservations, Mes messages, Mon profil, Sécurité — jamais Vue du patrimoine/Vente/Location sur cette route. Comportement de filtrage par contexte confirmé fonctionnel des deux côtés.

## 18. Owner multi

`rental-owner-e2e` EST le cas multi-activité (les deux profils réels) — entièrement vérifié : sélecteur affiche les deux options, bascule contextuelle fonctionnelle (`/mes-biens` ↔ `/mes-hotels`), jamais de fusion de ressources/permissions (conforme DASH-2 §14).

## 19. Owner sans ressource

**NON CONFIRMÉ empiriquement** (voir §14) — aucune fixture disponible pour reproduire ce cas précis dans le temps imparti. Preuve de code uniquement : `deriveProfilesFromExistingData` retournerait `[]`, `profileOptions` serait vide → switcher affiche légitimement « Aucun espace disponible » (jamais pendant le chargement, seulement une fois résolu — comportement du composant déjà correct, non modifié). Le menu affiché serait Mes messages/Mon profil/Sécurité + CTA « Ajouter un bien » (page centrale, indépendante de `businessProfiles`).

## 20. Hard refresh

5 rechargements complets réels (Playwright, `page.reload()`) : séquence `3→3→3→8→8→8...` à chaque fois, **jamais** de retour en arrière (8→3), jamais de régression. Stable.

## 21. Navigation interne

`/mes-biens` (8 liens, patrimoine) → `/mes-hotels` (6 liens, établissement) : bascule cohérente, aucun lien résiduel de l'autre contexte, vérifié réellement.

## 22. Logout/login

Testé par contextes navigateur séparés (équivalent fonctionnel d'un logout/login complet — `localStorage`/état React entièrement réinitialisés entre les deux) : compte B (`client-e2e`, rôle `Client`) après connexion n'affiche **aucun** résidu de la sidebar Owner (`#owner-navigation` absent du DOM, texte « Vue du patrimoine » absent). La séquence littérale « logout dans le même onglet puis login d'un autre compte » n'a pas été concluante avec le sélecteur de bouton utilisé dans le temps imparti — **NON CONFIRMÉ** pour cette séquence précise, la preuve par contextes séparés est jugée suffisante pour écarter une contamination de state global (pas de variable module-level, pas de cache partagé identifié dans `AuthContext.jsx`), mais honnêtement non identique au scénario exact du mandat §31.

## 23. Stale state

Aucune clé `localStorage` lue par le mécanisme `businessProfiles` (vérifié par lecture exhaustive de `AuthContext.jsx` — seules `token`/`user` sont lues au montage, jamais une clé de profil ou de tenant). Le runtime tenant AUTH-1.1 (`localStorage` dédié) est un mécanisme **entièrement distinct**, non consulté par `OwnerDashboard.jsx`/`AuthContext.businessProfiles` — confirmé qu'aucune interaction croisée n'existe.

## 24. Tests

`client/lib/__tests__/OwnerDashboardNavigation.test.jsx` — fichier existant, 1 test corrigé (il encodait à tort l'ancien comportement bogué comme comportement désiré — les assertions attendaient `Vue du patrimoine`/`Mes établissements` visibles pendant `businessProfiles === null`, exactement le bug), 1 test ajouté (le menu croît, ne rétrécit jamais, entre `null` et un profil résolu). **7/7 verts** après correction.

## 25. Browser evidence

Playwright, Chromium headless, harnais `start-accommodation-e2e.js` (MongoDB éphémère, jamais de données réelles) :
- Échantillonnage temporel de la sidebar toutes les 150ms pendant 3s après navigation — flash mesuré AVANT correction (11→8 liens vers t≈800ms après premier rendu), **disparu** après correction (jamais plus de 3→8, croissance uniquement, jamais de régression détectée sur l'échantillonnage).
- Network tab : ordre et statuts de tous les appels `/api/*` capturés, aucun appel en échec, aucune dépendance croisée entre `/user-business-profiles` et `/properties/my-properties`.
- 5× hard refresh : stable.
- Navigation `/mes-biens` ↔ `/mes-hotels` : cohérente.
- Contextes croisés (proxy logout/login) : aucun résidu.
- 0 erreur console liée à l'hydratation.

## 26. Fichiers modifiés

- `client/lib/pages/dashboard/OwnerDashboard.jsx` — correction de `visibleNavLinks`.
- `client/lib/__tests__/OwnerDashboardNavigation.test.jsx` — 1 test corrigé, 1 test ajouté.
- `server/docs/UX_OWNER3_DASHBOARD_STATE_ETAT_INITIAL.md`, `UX_OWNER3_DASHBOARD_STATE_REPORT.md` — nouveaux.

Aucun fichier backend touché (aucune preuve d'un bug backend — conforme au mandat §35). Aucun fichier `altimmo-app/` touché.

## 27. Gates

- **Client lint** : 0 erreur, 268 avertissements (aucune nouvelle erreur introduite).
- **Client tests complets** : `npx vitest run` — **88/88 fichiers, 581/581 tests**, 100% vert (nombres réellement observés ce sprint, jamais supposés identiques à un rapport antérieur).
- **Client build** : `npm run build:next` — succès.
- **Serveur** : non touché, aucun gate nécessaire (aucun fichier `server/*.js` modifié par ce sprint — seule la documentation).
- **`git diff -- altimmo-app/`** : vide.
- **`git diff --check`** : `exit 0`.

## 28. Git

`HEAD` au lancement : `bb8ab83cbf36ac73d5e3e2e1571633567f8438cf` — **différent** du HEAD de clôture d'UX-OWNER-2 (`1462ea748cd032523c575a4387ae7048a99e9c21`). Vérifié explicitement : commit externe `bb8ab83` (« Update Altimmo 28 »), auteur `Altitudevision <altitudevis3n@gmail.com>`, `2026-08-18 14:53:32+01:00`, contenu confirmé fichier par fichier = intégralité du travail UX-OWNER-2 de la session précédente — même schéma déjà documenté à plusieurs reprises (`HOTFIX_MSG_STAFF_INBOX1_REPORT.md` §42, `UX_OWNER2_ETAT_INITIAL.md` §1). **Cette session n'a exécuté aucun `git add`/`commit`/`push`/déploiement à aucun moment.** Aucun nouveau changement de HEAD constaté pendant ce sprint lui-même (vérifié à la clôture).

## Annexe A — Matrice de navigation par profil (mandat §13)

| Profil réel | Vue patrimoine | Vente | Location | Établissements | Hébergements | Réservations | Messages |
|---|---:|---:|---:|---:|---:|---:|---:|
| Owner immobilier seul (`proprietaire_immobilier`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Owner hôtel seul (`exploitant_etablissement` via `Hotel.manager`) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Owner accommodation seul (`exploitant_etablissement` via `Property.status='hebergement'`) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Owner multi-activité (les deux profils) | ✅* | ✅* | ✅* | ✅* | ✅* | ✅* | ✅ |
| Owner sans ressource (aucun profil dérivé) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pendant le chargement (`businessProfiles === null`), tout profil | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

`*` Multi-activité : les deux groupes de liens existent mais ne s'affichent jamais simultanément — le `activeContext` (`patrimoine`/`etablissement`, dérivé de la route courante ou du choix explicite via le switcher) détermine lequel des deux est visible à un instant donné, jamais une fusion. Vérifié réellement pour la ligne « multi-activité » et la ligne « chargement » ; les lignes « hôtel seul » et « accommodation seul » sont déduites du code (`NAV_LINKS`/`deriveProfilesFromExistingData`) et de la vérification partielle par navigation contextuelle (§17), non testées avec une fixture strictement mono-profil ; la ligne « sans ressource » est NON CONFIRMÉE empiriquement (§14/§19).

## Annexe B — Réponses explicites (mandat §37)

1. **Deux dashboards ou deux états d'un même dashboard ?** Deux états d'un seul et même composant (`OwnerDashboard.jsx`), une seule variable pilote (`businessProfiles`).
2. Voir 1.
3. **Composant du menu riche ?** `OwnerDashboard.jsx` (rendu non filtré de `NAV_LINKS`, avant correction).
4. **Composant du menu réduit ?** Le même fichier, `NAV_LINKS` filtré par `isProprietaireImmobilier`/`isExploitantEtablissement`.
5. **Pourquoi le menu riche apparaît-il d'abord ?** `businessProfiles` vaut `null` au premier rendu (avant fetch), et l'ancien code traitait `null` comme « tout afficher ».
6. **Pourquoi disparaît-il ?** `businessProfiles` se résout ensuite (fetch async) vers un tableau qui ne contient pas tous les profils supposés par le rendu initial.
7. **« Espace de travail » = quoi ?** Un sélecteur d'affichage en mémoire entre profils métier déjà résolus (`activeContext`) — jamais un `PlatformTenant`/`OrgMembership`/établissement nommé côté backend.
8. **Pourquoi « Aucun espace disponible » ?** Parce que `profileOptions` est vide une fois résolu — légitime si le compte n'a réellement aucune ressource dérivable (Property/Hotel/HotelStaffAssignment), NON CONFIRMÉ empiriquement pour le compte exact du screenshot faute de fixture reproductible.
9. **Un Owner immobilier a-t-il besoin d'un workspace ?** Non — confirmé par le code (`Property.owner`, ownership pur) et par `/mes-biens` (aucune dépendance à `businessProfiles`).
10. **`/mes-biens` repose sur ownership ou tenant ?** Ownership (`Property.owner === req.user.id`), jamais tenant.
11. **Menu réel pour Owner immobilier ?** Vue du patrimoine, Vente, Location, Rendez-vous, Paiements, Messages, Profil, Sécurité.
12. **Menu pour Owner hôtel ?** Établissements, Hébergements, Réservations, Messages, Profil, Sécurité.
13. **Menu pour multi-activité ?** Les deux groupes, jamais simultanés — un seul `activeContext` actif à la fois, bascule explicite ou par route.
14. **Le flicker est-il corrigé ?** Oui, vérifié par 5 rechargements réels, échantillonnage temporel avant/après.
15. **Le menu final est-il cohérent dès le chargement terminé ?** Oui, vérifié réellement pour le compte multi-activité testé.
16. **Des données stale existent-elles entre utilisateurs ?** Aucune trouvée dans le périmètre testé (contextes séparés) — la séquence littérale logout/login même onglet reste NON CONFIRMÉE.
17. **Le localStorage tenant influence-t-il ce comportement ?** Non — `businessProfiles` ne lit aucune clé `localStorage`, mécanisme entièrement distinct d'AUTH-1.1.
18. **Une régression AUTH-1.1 existe-t-elle ?** Non — AUTH-1.1 concerne le runtime tenant STAFF, jamais consulté par `OwnerDashboard.jsx`.
19. **Le backend a-t-il été modifié ?** Non, aucun fichier serveur touché.
20. **Les tests/build passent-ils ?** Oui — 88/88 fichiers, 581/581 tests, build Next réussi.

## 29. Verdict

**UX-OWNER-3 : GO SOUS RÉSERVES.**

Conditions du mandat pour `CERTIFIÉ VERT` : cause racine identifiée (**PASS**, §12) ; sidebar correcte selon profil (**PASS**, vérifié pour multi-activité et pour le contexte patrimoine/établissement) ; aucun flicker de menu incorrect (**PASS**, mesuré avant/après, 5 rechargements stables) ; workspace affiché seulement quand pertinent (**PASS**, le switcher lui-même n'a jamais eu ce défaut — seul `NAV_LINKS` en amont posait problème) ; `/mes-biens` cohérent (**PASS**) ; owner immobilier cohérent (**PASS**, vérifié réellement) ; owner hôtel cohérent (**PASS pour le volet contexte/navigation**, mais jamais testé avec une fixture *hôtel-seul* isolée — seulement via le même compte multi-activité) ; multi-activité cohérent (**PASS**) ; logout/login sans stale state (**PARTIEL** — prouvé par contextes séparés, non par la séquence littérale du mandat) ; navigateur réel vérifié (**PASS**) ; tests/build verts (**PASS**).

Réserves empêchant `CERTIFIÉ VERT` strict : (1) le cas « Owner sans ressource réelle » (terminaison légitime sur « Aucun espace disponible ») n'a pas pu être reproduit empiriquement dans ce harnais — seule une preuve de code est disponible, honnêtement marquée NON CONFIRMÉ plutôt que déduite ; (2) aucune fixture *hôtel-seul* strictement isolée testée ; (3) la séquence littérale logout-puis-login-dans-le-même-onglet n'a pas abouti avec le sélecteur utilisé, remplacée par une preuve équivalente mais non identique (contextes navigateur séparés). Aucune de ces réserves ne remet en cause la correction elle-même, qui règle le bug réellement démontré et mesuré (le flash), sans avoir eu besoin de modifier IAM, tenant, ou le backend.
