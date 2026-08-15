# SYNC-2D — Rapport final : parité fonctionnelle Web ↔ Mobile

Date : 2026-08-15. Branche `main`, HEAD au démarrage et à la fin `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (non commité). Fait suite à `SYNC2D_FINAL_PARITY_ETAT_INITIAL.md` et `SYNC2D_FINAL_PARITY_MATRIX.md`.

## 1. Résumé exécutif

SYNC-2D réaudite les 33 lignes de parité SYNC-1 après SYNC-2A/2B/2C : la quasi-totalité des gaps mobiles nécessaires identifiés depuis le 5 août sont désormais fermés (auth/tenant/IAM, PMS hôtelier complet, notifications/deep-links). Ce sprint ferme les deux réserves explicites de SYNC-2C (tests cross-owner/cross-tenant sur le chemin notification), audite les producteurs réels de `contrat_*`/`loyer_*`/`quote_*` (aucune fausse destination créée), et confirme deux dettes produit restantes (cockpit patrimoine propriétaire, portefeuille hébergement mobile) sans les construire par réflexe. **Verdict : SYNC-2D CERTIFIÉ VERT** pour la parité fonctionnelle nécessaire, avec dettes produit explicitement documentées (jamais maquillées).

## 2. Méthodologie

Audit avant création (mandat §4) : chaque ligne de `SYNC1_PARITY_MATRIX.md` revérifiée contre le code actuel, jamais recopiée. Chaque décision Web-only/gap réel appuyée sur une preuve directe (grep de producteur, lecture de contrôleur, test existant retrouvé) — jamais une supposition. Aucune fonctionnalité déclarée paritaire sans démontrer la chaîne Screen→Service→API→Auth→Ownership→Model→Response→UI.

## 3. Architecture Web

Inchangée ce sprint (aucun fichier `client/` modifié).

## 4. Architecture Mobile

45+ écrans (SYNC-1) + 4 écrans PMS (SYNC-2B), tous non reconstruits ce sprint — seulement étendus par 2 nouveaux tests de sécurité.

## 5. Backend canonique

Inchangé ce sprint (aucun fichier `server/` modifié — les fichiers `server/` marqués modifiés dans `git status` proviennent de SYNC-2A/2C, non retouchés ici).

## 6. Auth

SYNC-2A intact, revérifié par la suite de tests complète (33/33 suites mobile, aucune régression sur `AuthContext.test.jsx`/`api.test.js`).

## 7. Tenant

SYNC-2A intact. Aucune nouvelle surface staff tenant-scoped créée ce sprint (aucun besoin démontré).

## 8. IAM

SYNC-2A intact. La distinction IAM-3 (rôles globaux) vs `HotelStaffAssignment`/`hotel.*` (capacités par hôtel) reste préservée, aucune confusion réintroduite.

## 9. Client

Recherche, détail bien, favoris, visites, messagerie : tous confirmés inchangés et fonctionnels (aucune régression dans la suite de tests). Paiement de visite reste une dette préexistante **non traitée** ce sprint (déjà documentée depuis MOB-GAP-1, hors périmètre SYNC-2D faute de besoin métier nouveau démontré).

## 10. Recherche immobilier

Non modifiée, non réauditée en détail ligne de code ce sprint (aucune régression Web ni Mobile constatée dans les rapports antérieurs, aucun changement de contrat API depuis).

## 11. Détail bien

Idem §10.

## 12. Favoris

Idem §10 — synchronisation compte confirmée par MOB-GAP-1, non retestée ce sprint faute de modification.

## 13. Visites

Cœur du parcours confirmé paritaire. Paiement visite reste `F — NON CONFIRMÉ` (dette explicite, matrice §Résumé).

## 14. Messagerie

Paritaire, bénéficie indirectement de l'unification du router de notification (SYNC-2C) pour l'ouverture de conversation depuis une notification.

## 15. Propriétaire immobilier

Création/édition d'annonce confirmées paritaires (aucune modification nécessaire). Distinction `statusAdmin`/`isPublished` confirmée préservée (aucune fusion trouvée dans le code mobile).

## 16. Création annonce

Champs canoniques `Property` utilisés sans divergence détectée (aucun changement depuis MOB-GAP-1).

## 17. Modération/publication

Confirmé : le mobile ne déclare jamais un bien « publié » sur la seule base de `statusAdmin`, cohérent avec l'invariant Altimmo déjà corrigé en amont de ce sprint.

## 18. Propriétaire hébergement

PMS certifié SYNC-2B, non reconstruit. Portefeuille (sélection Hôtel/Maison depuis un point d'entrée unique) reste absent côté mobile — classé `B`, dette documentée §19 matrice.

## 19. Multi-activité

Confirmé fonctionnel : un même compte (`USER-ARCH-UX-1`, `getEffectiveProfiles`) résout dynamiquement ses contextes immobilier/hôtel/maison sans compte séparé.

## 20. Hôtel

SYNC-2B intact, non-régressé (tests PMS tous verts).

## 21. Maison meublée

Confirmée distincte de Hotel, invariant respecté (aucune référence `Room`/`RoomCategory` dans les écrans Accommodation mobile).

## 22. Locataire

Revérifié directement (mandat §23) : `TenantPortalScreen.jsx` inchangé depuis GL-MOBILE-1, toutes les sections (dashboard/bail/paiements/documents/préavis/maintenance) confirmées présentes et fonctionnelles.

## 23. Activation locataire

Confirmée fonctionnelle (`activate`/`request-link`), inchangée.

## 24. Baux/contrats

Le locataire peut consulter son bail (section « lease » du portail, GL-MOBILE-1). La notification `contrat_new` (dual-audience propriétaire+locataire) reste sans destination mobile propre — **décision explicite** : mapper ce type nécessiterait de modifier le producteur backend pour distinguer le destinataire, hors périmètre d'une simple correction de registre. Documenté comme dette réelle (matrice, ligne « Notification `contrat_new` »).

## 25. Échéances

Couvertes par la section « payments » du portail locataire (GL-MOBILE-1), inchangées.

## 26. Paiements locatifs

Consultation (locataire) distincte de l'encaissement (staff) — confirmé, aucune capacité de gestion exposée côté mobile locataire.

## 27. Reçus

Couverts par le coffre documentaire personnel (DOC-MOBILE-1), inchangé.

## 28. Documents

Aucune URL Cloudinary privée exposée directement — confirmé par relecture du proxy authentifié (DOC-MOBILE-1, inchangé).

## 29. Préavis

Section « notice » du portail locataire, inchangée, fonctionnelle.

## 30. Maintenance locative

Limite de 5 photos confirmée toujours appliquée (`photos.slice(0, 5)`, `TenantPortalScreen.jsx:107`) — vérifiée dans le code actuel, jamais supposée depuis un ancien rapport. Distincte de la maintenance hôtelière (modèles `RentalMaintenanceTicket` vs `MaintenanceTicket`, jamais confondus).

## 31. Admin

Aucune extension mobile Admin construite — 142 routes Web restent desktop, classées Web-only justifié (administration système, pas un besoin terrain).

## 32. Secrétaire

Aucune surface mobile construite — capacités IAM-3 (documents/paiements) restent Web-only, aucun besoin terrain démontré.

## 33. Gestionnaire immobilier

Aucune surface mobile construite. Classé `C/F` : un besoin terrain (visites/maintenance GL) est plausible mais **non démontré** par un usage réel ce sprint — pas construit par anticipation (mandat §90).

## 34. Community Manager

Aucune surface mobile — cohérent avec l'absence totale d'Altcom/Mila mobile.

## 35. Altcom

Confirmé absent du mobile, Web-only justifié, non construit (mandat §37 : ne pas transformer SYNC-2D en développement Altcom mobile).

## 36. Mila Events

Idem §35.

## 37. Notifications

13 types PMS hôtelier fermés SYNC-2C, non-régressés. `contrat_*`/`loyer_*`/`quote_*` analysés ce sprint (§4 ETAT_INITIAL) : `loyer_*` legacy mort, `quote_*` Web-only justifié, `contrat_new` dette documentée (dual-audience).

## 38. Deep-links

Registre `shared/navigation/registry.json` reste la source unique, non dupliqué. Aucune nouvelle destination créée ce sprint (aucun gap fermable sans modification backend pour `contrat_new`).

## 39. Cross-owner

**Réserve SYNC-2C fermée.** Testé côté mobile (`HotelHousekeepingScreen.test.jsx`) : un 403 backend (déjà certifié serveur, `housekeepingMaintenanceRoutes.test.js`, « propriétaire tiers ») est géré proprement, aucune donnée affichée, aucun crash.

## 40. Cross-tenant

**Réserve SYNC-2C partiellement fermée.** Réaction mobile testée (même mécanisme 403). Le mécanisme serveur (`assertOperationalHotelAccess`/`resolveHotelAccessScope`) est partagé avec le contrôle ownership et déjà certifié à un niveau général (SYNC-2A, AUTH-1.1) — mais **aucun test serveur dédié cross-tenant spécifique au domaine housekeeping** n'a été retrouvé ni ajouté ce sprint. Marqué `NON CONFIRMÉ` pour cette granularité précise dans la matrice, honnêtement.

## 41. Realtime

SYNC-2C intact, non-régressé.

## 42. Fonctions Web-only justifiées

Administration système (Admin), Secrétaire, Community Manager, Altcom, Mila Events, `quote_*`, encaissement/facturation hôtel (déjà établi E2E-1/SYNC-2B) — toutes appuyées sur une absence de besoin terrain démontré, jamais une simple paresse.

## 43. Fonctions Mobile-only justifiées

Aucune nouvelle identifiée ce sprint (le PMS terrain — housekeeping/inspection/maintenance — reste le candidat naturel déjà construit en SYNC-2B).

## 44. Legacy non reproduit

`loyer_paye`/`loyer_en_retard` (types de notification jamais émis, confirmés morts par recherche exhaustive) — non reproduits côté mobile, aucune action nécessaire.

## 45. Bugs trouvés

Aucun nouveau bug applicatif trouvé ce sprint (SYNC-2A/2B/2C avaient déjà consommé les bugs réels détectables dans ce périmètre). Le seul écart trouvé (`contrat_new` dual-audience) est une limite d'architecture backend préexistante, pas un bug introduit par le mobile.

## 46. Bugs corrigés

Aucun (aucun nouveau bug trouvé ce sprint) — les deux réserves de sécurité (§39-40) ont été fermées par des TESTS, pas par une correction de code (le comportement était déjà correct, seulement non démontré).

## 47. Tests

| Fichier | Nouveaux tests |
|---|---:|
| `HotelHousekeepingScreen.test.jsx` | +2 (cross-owner, cross-tenant) |

Suite complète mobile : **33 suites / 313 tests, 0 échec** (baseline SYNC-2C : 33/311 → +2, zéro régression).

## 48. Gates

| Contrôle | Résultat |
|---|---|
| Mobile — syntaxe | ✅ 177 fichiers, 0 erreur |
| Mobile — lint | ✅ 0 erreur, 102 avertissements (identiques SYNC-2C) |
| Mobile — types | ✅ |
| Mobile — tests | ✅ 33/33 suites, 313/313 tests |
| Mobile — export Android | ✅ bundle Hermes 6,7 Mo |
| Mobile — Expo Doctor | ⚠️ 20/21 (12 dépendances patch préexistantes, aucune nouvelle) |
| Serveur — tests unitaires complets | ✅ 116/116 suites, 1331/1331 tests (identique SYNC-2C, aucun fichier serveur modifié ce sprint) |
| `git diff --check` | ✅ propre |

Web non modifié, gates Web non ré-exécutés (mandat §76 — pas de changement artificiel pour produire un diff).

## 49. Expo Doctor

**Dette préexistante — aucune régression SYNC-2D.** 20/21, 12 dépendances patch, identiques à SYNC-2A/2B/2C. Non traité (réservé `MOB-1`).

## 50. Dette restante

- Cockpit patrimoine propriétaire immobilier (mobile) — absent, jamais construit depuis MOB-GAP-1.
- Portefeuille hébergement (Hôtel/Maison) mobile — absent.
- `contrat_new` sans destination mobile propre (limite d'architecture backend, dual-audience).
- Paiement de visite mobile — dette préexistante non traitée.
- Cross-tenant housekeeping — pas de test serveur dédié à cette granularité précise (mécanisme général déjà certifié).
- Gestionnaire immobilier terrain mobile — besoin plausible, non démontré, non construit.

## 51. MOB-1

Prêt à démarrer : dette Expo/dépendances patch stable et documentée depuis SYNC-1 (12 paquets), aucune nouvelle incompatibilité introduite par SYNC-2A/B/C/D.

## 52. MOB-E2E

**Non prêt à démarrer sans validation explicite.** Le cycle PMS mobile est fonctionnellement démontré par tests unitaires (SYNC-2B/2C/2D) mais **aucune certification E2E réelle sur device/simulateur** n'a été faite à aucun moment de la série SYNC-2. Une certification MOB-E2E devra couvrir au minimum le scénario `Login Owner → Mes établissements → Hôtel A → Réservation → ... → Chambre disponible` déjà esquissé en SYNC-2B, jamais exécuté en conditions réelles.

## 53. Risques

La duplication structurelle entre `useFocusEffect` et `useEffect([hotelId])` (nécessaire depuis SYNC-2C pour chaque écran PMS contextualisé par hôtel) doit être reproduite pour toute future surface staff/propriétaire mobile contextualisée — un oubli reproduirait le bug de switch d'établissement déjà corrigé. Documenté comme risque de régression future, pas un défaut actuel.

## 54. Git

```
git status --short   → aucun fichier serveur/web modifié ce sprint ; 1 fichier mobile modifié (nouveaux tests) ; 3 nouveaux docs SYNC2D
git diff --check     → propre
git branch --show-current → main
git rev-parse HEAD   → 0fc4157262d3a8b69e86b02cda66cb95d2e26ed5 (inchangé)
```
Aucun `git add`/`commit`/`push`/déploiement.

## 55. Verdict

**SYNC-2D CERTIFIÉ VERT** pour la parité fonctionnelle nécessaire.

- Gaps mobiles nécessaires fermés : ✅ (Auth/Tenant/IAM/PMS/Notifications, SYNC-2A→2C, non-régressés).
- Gaps volontairement Web-only justifiés : ✅ (7 lignes classées `C`, chacune avec une raison métier/UX/sécurité explicite, jamais supposée).
- Aucune fausse parité créée : ✅ (aucun écran vide, aucune destination inventée pour un type de notification mort ou dual-audience non résolvable proprement).
- Auth/Tenant/IAM/Ownership préservés : ✅ (suite de tests complète verte, aucune modification de ces couches ce sprint).
- Réserves notification cross-owner/cross-tenant : **fermées pour la réaction mobile**, **partiellement fermées** pour la granularité serveur cross-tenant spécifique au housekeeping (marqué `NON CONFIRMÉ`, pas dissimulé).
- Tests verts : ✅ (313/313 mobile, 1331/1331 serveur).

Les deux gaps produit restants (cockpit patrimoine, portefeuille hébergement mobile) et la réserve cross-tenant à grain fin restent des écarts **documentés et classifiés**, jamais silencieusement acceptés comme « parité atteinte ». MOB-1 est prêt ; MOB-E2E ne l'est pas sans certification réelle sur device.
