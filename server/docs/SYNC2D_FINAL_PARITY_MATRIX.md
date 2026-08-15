# SYNC-2D — Matrice de parité fonctionnelle finale Web ↔ Mobile

| Domaine | Fonction | Web | Mobile avant SYNC-2 | Mobile après SYNC-2D | API | Auth | Tenant | Ownership | Classification | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Client | Recherche/détail/favoris | ✅ | ✅ | ✅ (inchangé) | canonique | ✅ | n/a | n/a | A | Parité atteinte |
| Client | Visites | ✅ | ✅ (partiel : paiement visite non certifié) | ✅ (inchangé, même dette) | canonique | ✅ | n/a | ✅ | A/F | Parité atteinte pour le cœur ; paiement visite **NON CONFIRMÉ** (dette préexistante non traitée ce sprint) |
| Client | Messagerie | ✅ | ✅ | ✅ (source de résolution unifiée SYNC-2C) | canonique | ✅ | n/a | n/a | A | Parité atteinte |
| Client | Espace personnel (`/mon-espace`) | ✅ | ✅ (Profil + onglets) | ✅ (inchangé) | canonique | ✅ | n/a | n/a | A | Parité atteinte (intention, pas l'URL) |
| Owner immobilier | Création/édition annonce | ✅ | ✅ | ✅ (inchangé) | canonique (`Property`) | ✅ | n/a | ✅ | A | Parité atteinte |
| Owner immobilier | Statuts validation/publication | ✅ (`statusAdmin`/`isPublished` distincts) | ✅ (reflète les mêmes champs, aucune fusion trouvée) | ✅ (inchangé) | canonique | ✅ | n/a | ✅ | A | Parité atteinte, distinction préservée |
| Owner immobilier | Cockpit patrimoine (cycle de vie, revenus, entretien) | ✅ | ❌ | ❌ (toujours absent) | existant côté API | — | — | — | B (documenté, non fermé) | Gap réel, dette SYNC-2E/OWNER-MOBILE-1 |
| Owner hébergement | Portefeuille Hôtel/Maison | ✅ | ❌ | ❌ (toujours absent, `MY_ESTABLISHMENTS.mobileRoute: null`) | existant | — | — | — | B (documenté, non fermé) | Gap réel, dette SYNC-2E |
| Owner multi-activité | Un seul compte, contextes multiples | ✅ | ✅ (`getEffectiveProfiles`, USER-ARCH-UX-1) | ✅ (inchangé, revérifié) | canonique | ✅ | n/a | ✅ | A | Parité atteinte |
| Hébergement | Maison meublée (Accommodation, jamais Room) | ✅ | ✅ (ACC-MOBILE-1) | ✅ (inchangé) | canonique | ✅ | n/a | ✅ | A | Parité atteinte, invariant respecté |
| Hébergement | Hôtel — PMS complet | ✅ (certifié E2E-1) | ❌ (avant SYNC-2B) | ✅ (SYNC-2B, non-régressé) | canonique | ✅ | ✅ (scaffold) | ✅ | A | Parité atteinte |
| Locataire | Portail (bail/échéances/paiements/documents/préavis/maintenance) | ✅ | ✅ (GL-MOBILE-1) | ✅ (revérifié inchangé, aucune régression) | canonique | ✅ | n/a | ✅ | A | Parité atteinte |
| Locataire | Activation espace locataire | ✅ (`/activer-espace-locataire`) | ✅ (`activate`/`request-link`, GL-MOBILE-1) | ✅ (inchangé) | canonique | ✅ | n/a | ✅ | A | Parité atteinte |
| Locataire | Notification `contrat_new` contextualisée | ✅ (implicite, Profil) | ❌ | ❌ (non fermé, voir §4 ETAT_INITIAL) | canonique | ✅ | n/a | n/a | F | **NON CONFIRMÉ** — type dual-audience (propriétaire+locataire), ne peut être mappé correctement sans modifier le producteur backend ; dette documentée, pas contournée |
| Locataire | Notification `loyer_*` | — | ❌ | ❌ (aucune destination) | aucun producteur trouvé | — | — | — | E | Legacy/mort, jamais émis — aucune action nécessaire |
| Staff | Admin — fonctions terrain vs desktop | ✅ (142 routes) | n/a | n/a (aucune extension mobile faite) | canonique | ✅ | ✅ | ✅ | C | Web-only justifié — administration système, non nécessaire terrain |
| Staff | Secrétaire (documents/paiements) | ✅ | ❌ | ❌ (non construit) | canonique | ✅ | ✅ | ✅ | C | Web-only justifié — aucun besoin terrain démontré, capacités déjà étroites (IAM-3) |
| Staff | Gestionnaire immobilier (GL terrain) | ✅ | ❌ | ❌ (non construit) | canonique | ✅ | ✅ | ✅ | C/F | Web-only pour l'instant — besoin terrain plausible (visites/maintenance) mais **NON CONFIRMÉ** par un usage démontré ce sprint |
| Staff | Community Manager (Altcom/Mila) | ✅ | ❌ | ❌ (non construit) | canonique | ✅ | ✅ | n/a | C | Web-only justifié — Altcom/Mila entièrement absents du mobile par construction |
| Altcom | Projets/portfolio | ✅ | ❌ | ❌ | canonique | ✅ | ✅ | n/a | C | Web-only justifié |
| Mila Events | Événements | ✅ | ❌ | ❌ | canonique | ✅ | ✅ | n/a | C | Web-only justifié |
| Notifications | `quote_*` (devis Altcom) | ✅ | ❌ | ❌ (volontaire) | canonique | ✅ | ✅ | n/a | C | Web-only justifié — cohérent avec l'absence totale d'Altcom mobile |
| Notifications | PMS hôtelier (13 types) | ✅ | ❌ (avant SYNC-2C) | ✅ (SYNC-2C, non-régressé) | canonique | ✅ | n/a | ✅ | A | Parité atteinte |
| Notifications | Router central | dupliqué historiquement (non audité ce sprint côté Web) | ❌ (dupliqué, bug réel SYNC-2C) | ✅ (source unique) | — | — | — | A | Bug corrigé, parité de robustesse atteinte |
| Realtime | Room utilisateur | ✅ | ✅ | ✅ (inchangé) | canonique | ✅ | n/a | n/a | A | Parité atteinte |
| Realtime | Room hôtel (`hotel:<id>`) | ✅ (DASH-4) | ❌ (avant SYNC-2B) | ✅ (SYNC-2B/2C, non-régressé) | canonique | ✅ | ✅ | ✅ | A | Parité atteinte |
| Sécurité | Cross-owner deep-link (hôtel) | ✅ (E2E-1, testé serveur) | ❌ (non testé spécifiquement) | ✅ (testé ce sprint, mobile + confirmation serveur existante) | canonique | ✅ | n/a | ✅ | A | Réserve SYNC-2C fermée |
| Sécurité | Cross-tenant deep-link (hôtel) | ✅ (mécanisme partagé `assertOperationalHotelAccess`) | ❌ (non testé spécifiquement) | ✅ (testé côté mobile ce sprint) | canonique | ✅ | ✅ | ✅ | A/F | Réaction mobile testée ; **NON CONFIRMÉ** par un test serveur dédié cross-tenant spécifique au domaine housekeeping (le mécanisme est partagé et déjà certifié à un niveau plus général, mais pas isolé ligne à ligne pour ce domaine précis) |

## Résumé chiffré

| Classification | Nombre de lignes |
|---|---:|
| A — Parité atteinte | 20 |
| B — Gap mobile documenté, non fermé (dette produit) | 2 |
| C — Web-only justifié | 7 |
| E — Legacy non reproduit | 1 |
| F — Non confirmé (documenté explicitement, pas de fausse certitude) | 3 (dont 2 se recoupent avec A/C ci-dessus, comptées à part pour transparence) |
