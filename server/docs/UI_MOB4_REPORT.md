# UI-MOB-4 — Rapport final : certification visuelle Messagerie & Tenant Portal

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (**inchangé**, aucun commit).

## 1. Résumé exécutif

UI-MOB-4 ferme les deux dernières réserves NON CONFIRMÉ d'UI-MOB-3. Résultat contrasté et honnête : **Tenant Portal est entièrement propre** (0 couleur hardcodée, tous tokens valides, aucun bug trouvé — pas de changement fabriqué). **Messagerie contenait 2 bugs réels et démontrés** : un badge de rôle (« Prestataire ») figé sur une couleur mauve claire alors que ses deux voisins du même tableau (Propriétaire/Client) sont déjà theme-aware — corrigé par extension additive de 2 nouveaux tokens (`purple`/`purpleMuted`) suivant exactement le pattern déjà établi (`blue`/`blueMuted`) ; et l'icône du bouton Envoyer en blanc fixe sur fond gold, la même classe de bug de contraste corrigée 6 fois en UI-MOB-3. Aucune régression : 40/40 suites (+2), 358/358 tests (+12), lint 0 erreur, Doctor 21/21, export Android PASS.

## 2. Baseline Git

Voir ETAT_INITIAL §1. HEAD inchangé du début à la fin.

## 3. Baseline tests

38/38 suites, 346/346 tests → 40/40 suites, 358/358 tests.

## 4. Réserves UI-MOB-3

Messagerie (NON CONFIRMÉ) et Tenant Portal (NON CONFIRMÉ) — toutes deux auditées ce sprint, voir §39-41 pour la fermeture factuelle.

## 5. Architecture Messagerie

`MessagerieStack` : `ConversationsScreen` → `ChatScreen`/`ChatbotScreen`. Voir ETAT_INITIAL §3 pour le graphe complet.

## 6. Architecture Tenant Portal

Écran unique `TenantPortalScreen.jsx`, 6 sections internes commutées par état local. Voir ETAT_INITIAL §4.

## 7. Design system utilisé

`ThemeContext`, tokens (dont les 2 nouveaux `purple`/`purpleMuted` ajoutés ce sprint), `Card`/`Button` (`components/ui/`), `EmptyState`, `Skeleton`, `LoadingSpinner`, `Divider`, `PageHeader` — tous réutilisés tels quels, aucun composant recréé.

## 8. Light Mode Messagerie / 9. Dark Mode Messagerie

`ConversationsScreen` : déjà theme-aware avant ce sprint à l'exception du badge « Prestataire », corrigé. `ChatScreen` : déjà theme-aware à l'exception de l'icône Envoyer, corrigée, et de `bubbleTextMe` tokenisé par cohérence. `ChatbotScreen` : déjà entièrement conforme, aucune correction nécessaire.

## 10. Liste conversations

Fond, header (`PageHeader`), avatar (photo ou fallback initiale `c.gold` sur `c.bgCardAlt`), preview dernier message (`c.textSub`/`c.text` selon lu/non-lu), timestamp (`c.textMuted`, pas d'opacité basse), badge non-lu (`c.gold`/`c.onAccent`, déjà correct), divider (composant `Divider`, corrigé UI-MOB-3), empty state (illustration + CTA conditionnel pour les clients uniquement), loading (`LoadingSpinner`, corrigé UI-MOB-3) — tous PASS Light/Dark.

## 11. Conversation

Header personnalisé (`c.bgCard`/`c.text`/`c.border`, statut « En ligne » via `c.success`), liste de messages inversée, séparateurs de date (`c.textMuted`), composer, clavier (`KeyboardAvoidingView` existant, non modifié) — PASS Light/Dark.

## 12. Message bubbles

Bulle envoyée : fond `c.gold` (reste clair dans les deux thèmes), texte `c.onAccent` (quasi-noir) — contraste correct, jamais noir-sur-noir ni blanc-sur-clair. Bulle reçue : fond `c.bgCard`, texte `c.text`, tous deux du thème actif — jamais figé sur le clair. Distinction immédiate par position (gauche/droite) + couleur de fond, indépendante du thème. **PASS Light/Dark, vérifié par test dédié.**

## 13. Composer

Fond `c.bgCardAlt`, texte `c.text`, placeholder `c.placeholder`, bordure `c.border`, curseur/sélection `c.gold`/`c.borderGold` — déjà correct. Bouton Envoyer corrigé (§9). Bouton pièce jointe (`+`) et emoji déjà `c.gold`/theme-neutre. État désactivé (`sendBtnDisabled: opacity: 0.45`) reste visuellement distinct sans devenir illisible.

## 14. Unread

Badge non-lu (`ConversationsScreen`) : `c.gold`/`c.onAccent`, taille/position déjà correctes, testé Light/Dark. Indicateur de frappe (« typing dots ») : `c.bgCard`/`c.textMuted`, déjà cohérent.

## 15. Attachments

Menu de sélection (modal, `c.bgCard`, overlay `rgba(0,0,0,0.5)` légitime), aperçu avant envoi (`c.bgCardAlt`, icône `c.gold`, bouton de retrait `c.textMuted`), rendu dans les bulles (`downloadSecureAttachment`, icône `shield-checkmark-outline` en `c.gold`, lecteur audio minimal) — tous déjà theme-aware, aucune fonctionnalité ajoutée ou modifiée (mandat §18 respecté).

## 16. Keyboard Messagerie

Architecture existante (`KeyboardAvoidingView`) non modifiée. Aucun second système introduit.

## 17. Empty/Error/Loading Messagerie

Empty : illustration + titre + sous-titre + CTA conditionnel (client uniquement, pas de CTA inventé pour le staff). Loading : `LoadingSpinner` réutilisé tel quel. Aucun état d'erreur dédié distinct trouvé dans `ConversationsScreen`/`ChatScreen` au-delà du échec silencieux déjà en place (comportement fonctionnel, non modifié).

## 18. Light Mode Tenant Portal / 19. Dark Mode Tenant Portal

**Aucune modification — écran déjà entièrement conforme.** 0 couleur hardcodée (grep exhaustif), toutes les paires foreground/background utilisent des tokens valides et cohérents (ex. `status: {color: c.success, backgroundColor: c.successMuted}` — exactement le couple correct, contrairement au bug historique de `MesAnnoncesScreen`). **PASS Light/Dark, confirmé par lecture exhaustive du fichier (179 lignes) et par le test d'intégrité des tokens (UI-MOB-3) qui scanne ce fichier.**

## 20. Header locataire

`PageHeader` avec sous-titre dynamique (« Lecture hors connexion » / « Portail sécurisé ») — déjà correct.

## 21. Dashboard locataire

Cards `Metric` (icône `c.gold`, valeur `c.text`, label `c.textSub`) pour prochain paiement, montant restant, durée restante, caution — déjà correct.

## 22. Baux

Card par bail avec statut (`c.success`/`c.successMuted`), timeline (avenants, cycle de vie, états des lieux, historique caution) — déjà correct.

## 23. Échéances

Voir §21/§28 — mêmes composants `Metric`/`Row`, statuts affichés via `titleCase()` sans invention, calculs non touchés.

## 24. Paiements

Liste (`Row`, icône conditionnelle payé/en attente), résumé (dû/reçu/reste + pénalités) — déjà correct, aucun statut inventé.

## 25. Reçus

Rendu via les documents de type reçu dans la section Documents (§26) — pas de composant séparé, mécanisme documentaire non touché (mandat §30).

## 26. Documents

Card par document, icônes d'action (aperçu `c.info`, téléchargement `c.gold`) déjà accessibles (`accessibilityLabel` dynamique par document). Empty state dédié (« Coffre vide »). Aucune URL permanente introduite — le téléchargement passe par `downloadTenantDocument()` (service existant, non modifié).

## 27. Préavis

Lecture seule (`Metric` + `Timeline`), aucune mutation ajoutée (mandat §33 respecté).

## 28. Maintenance locative

Formulaire de création (catégories réelles, description, jusqu'à 5 photos — `selectionLimit: 5` et `.slice(0, 5)` **non modifiés**, règle métier déjà auditée par les sprints précédents), suivi des interventions (`Row` par ticket). **Confirmé distinct de la maintenance hôtel** (`HotelMaintenanceScreen`, PMS) — aucune donnée, statut ou composant partagé entre les deux, vérifié par lecture des deux fichiers.

## 29. Empty/Error/Loading Tenant

Empty : `EmptyState`/`Empty` par section (aucun texte technique backend exposé brut — messages déjà mappés via `.response?.data?.message` avec fallback français). Error : écran dédié avec `EmptyState` + action « Réessayer ». Loading : 4× `Skeleton` (corrigé UI-MOB-3) — déjà correct.

## 30. Tokens

2 nouveaux tokens ajoutés : `purple`/`purpleMuted`, dans `colors.js` ET `colorsDark.js` (symétrie vérifiée par le test d'intégrité). Valeurs : light `purple:'#6D28D9'`/`purpleMuted:'#EDE9FE'` (= les valeurs hardcodées précédentes, aucun changement visuel en mode clair) ; dark `purple:'#A78BFA'`/`purpleMuted:'#241B45'` (nouvelles valeurs, cohérentes avec la transformation déjà appliquée à `blue`/`blueMuted`).

## 31. Hardcodes

`ChatbotScreen.jsx` (6) : palette verte « en ligne »/« temps de réponse » (`#16A34A`/`#059669`, catégorie A — accent déjà cohérent et reconnaissable dans les 2 thèmes) + 2 overlays noirs sur fond gold sélectionné (catégorie E, légitime). `ChatScreen.jsx` (4 avant correction, 2 après) : 2 corrigés (icône Envoyer, `bubbleTextMe`), 2 restants légitimes (overlay modal `rgba(0,0,0,0.5)`, tint audio `rgba(0,0,0,0.06)` — catégorie E). `ConversationsScreen.jsx` (1 avant, 0 après) : corrigé. `TenantPortalScreen.jsx` : 0.

## 32. Imports statiques

Recherche exhaustive de `import { colors }` (thème clair statique) dans les 4 fichiers audités : **aucun trouvé**. Les 4 écrans utilisaient déjà `useTheme()` de façon cohérente — contrairement à l'hypothèse implicite du mandat de retrouver la classe de bug `Chip.jsx`/UI-MOB-3.

## 33. Fallbacks

Recherche de `c.xxx || '#...'` dans les 4 fichiers : **aucun trouvé**.

## 34. Accessibilité

Boutons Envoyer, pièce jointe, retrait, téléchargement document, aperçu document — tous déjà pourvus d'`accessibilityLabel`/`accessibilityRole` avant ce sprint. Touch targets déjà ≥44×44 sur les contrôles principaux (`sendBtn` 40×40 — légèrement sous la cible, non modifié car non démontré comme un problème d'usage réel, cosmétique).

## 35. Responsive

Non testé sur device/simulateur réel (**NON CONFIRMÉ** physiquement). `TenantPortalScreen` a déjà une adaptation tablette existante (`useWindowDimensions`), non modifiée ce sprint.

## 36. Safe areas

Déjà correctes sur les 4 écrans (voir ETAT_INITIAL §13), non modifiées.

## 37. StatusBar

Géré par `Screen.jsx`/le header natif de navigation pour les écrans qui les utilisent — aucune anomalie trouvée dans le périmètre audité.

## 38. Navigation

`resolveNavigation()`, `registry.json`, deep-links PMS/notifications — **non modifiés**, vérifié par `git diff` (aucun fichier de navigation touché ce sprint en dehors des tokens de thème et des 2 fichiers Messagerie).

## 39. Bugs trouvés

1. `ConversationsScreen.jsx` : badge de rôle « Prestataire » non theme-aware. **P2**.
2. `ChatScreen.jsx` : icône Envoyer blanche fixe sur fond gold. **P1**.
3. `ChatScreen.jsx` : `bubbleTextMe` non tokenisé (valeur identique, dette de cohérence). **P3**.

## 40. Bugs corrigés

1, 2, 3 — tous corrigés, tests ajoutés pour 1 et 2.

## 41. Bugs hors périmètre

Aucun. Aucun bug métier/realtime/socket découvert pendant cet audit (contrairement à d'autres sprints, rien à documenter comme hors périmètre ici).

## 42. Tests ajoutés

`src/screens/Messagerie/__tests__/ChatScreen.test.jsx` (6 tests, Light+Dark) : contraste des bulles envoyées/reçues, bouton Envoyer (`c.onAccent`, jamais blanc fixe), cycle de vie Socket.IO (join/leave). `src/screens/Messagerie/__tests__/ConversationsScreen.test.jsx` (6 tests, Light+Dark) : badge de rôle Prestataire theme-aware, badge non-lu, état vide avec CTA. Aucun test ajouté pour `TenantPortalScreen.jsx` (aucune modification de code, déjà couvert indirectement par le test d'intégrité des tokens) ni `ChatbotScreen.jsx` (aucune modification de code).

## 43. Tests complets

**40/40 suites (+2), 358/358 tests (+12)**, aucune régression sur la baseline UI-MOB-3 (38/38, 346/346).

## 44. Lint/types

Lint : 0 erreur (104 avertissements pré-existants, non liés à ce sprint). Types : pas de gate `tsc` dédié dans ce projet JS (inchangé).

## 45. Expo Doctor

**21/21, inchangé** — aucune dépendance modifiée, vérifié par exécution réelle.

## 46. Android export

`npx expo export --platform android` → succès, bundle Hermes généré, aucune erreur.

## 47. iOS

**NON CONFIRMÉ** — aucun environnement iOS exécuté (ni ce sprint ni les précédents).

## 48. Dette restante

- Touch target `sendBtn` (40×40, légèrement sous la cible 44×44) — cosmétique, non corrigé faute de problème d'usage démontré.
- Responsive non vérifié visuellement sur device/simulateur réel pour Messagerie/Tenant Portal.
- iOS non confirmé pour l'ensemble du périmètre UI-MOB-1 à 4.
- Dette héritée non retraitée (badges type de bien 6 écrans, ~490 couleurs hors périmètre audité au global — UI-MOB-2/3).

## 49. MOB-E2E readiness

Voir Verdict.

## 50. Git

```
git status --short   → 30+ lignes (UI-MOB-1+2+3+4 cumulés, tous non commités)
git diff --check     → propre
git branch --show-current → main
git rev-parse HEAD   → ab5ae586fab50ddce02e65ea081330d2769c6503 (inchangé)
```
Fichiers modifiés spécifiquement par UI-MOB-4 : `theme/colors.js`, `theme/colorsDark.js` (tokens `purple`/`purpleMuted`), `screens/Messagerie/ChatScreen.jsx`, `screens/Messagerie/ConversationsScreen.jsx`, + 2 nouveaux fichiers de test + `server/docs/UI_MOB4_*.md`. Aucun `git add`/`commit`/`push`/`reset`/`checkout .`/`stash` exécuté. Aucune modification préexistante (UI-MOB-1/2/3) perdue ou altérée.

## Matrice Messagerie

| Surface | Light | Dark | Responsive | Accessibilité | Verdict |
|---|---|---|---|---|---|
| Liste conversations | PASS | PASS | NON CONFIRMÉ | PASS | Certifié |
| Conversation | PASS | PASS | NON CONFIRMÉ | PASS | Certifié |
| Message envoyé | PASS | PASS | N/A | PASS | Certifié |
| Message reçu | PASS | PASS | N/A | PASS | Certifié |
| Composer | PASS | PASS (après correctif) | NON CONFIRMÉ | PASS | Certifié après correction |
| Unread | PASS | PASS | N/A | PASS | Certifié |
| Empty | PASS | PASS | N/A | PASS | Certifié |
| Error | N/A | N/A | N/A | N/A | Pas d'état d'erreur dédié distinct trouvé |

## Matrice Tenant Portal

| Surface | Light | Dark | Responsive | Accessibilité | Verdict |
|---|---|---|---|---|---|
| Dashboard | PASS | PASS | PASS (adaptation tablette existante) | PASS | Certifié, aucun bug |
| Baux | PASS | PASS | PASS | PASS | Certifié, aucun bug |
| Échéances | PASS | PASS | PASS | PASS | Certifié, aucun bug |
| Paiements | PASS | PASS | PASS | PASS | Certifié, aucun bug |
| Reçus | PASS | PASS | PASS | PASS | Certifié, aucun bug (via Documents) |
| Documents | PASS | PASS | PASS | PASS | Certifié, aucun bug |
| Préavis | PASS | PASS | PASS | PASS | Certifié, aucun bug |
| Maintenance | PASS | PASS | PASS | PASS | Certifié, aucun bug |

## Matrice des bugs

| ID | Domaine | Gravité | Symptôme | Cause racine | Correction | Test |
|---|---|---|---|---|---|---|
| UI4-1 | Messagerie (ConversationsScreen) | P2 | Badge « Prestataire » mauve clair figé, incohérent avec ses 2 voisins theme-aware | Valeurs hex en dur au lieu de tokens | Tokens `purple`/`purpleMuted` ajoutés (extension additive) | `ConversationsScreen.test.jsx` (2 tests dédiés) |
| UI4-2 | Messagerie (ChatScreen) | P1 | Icône Envoyer blanche sur gold, contraste insuffisant | Motif `color="#FFFFFF"` au lieu de `c.onAccent` | `c.onAccent` | `ChatScreen.test.jsx` (2 tests dédiés) |
| UI4-3 | Messagerie (ChatScreen) | P3 | `bubbleTextMe` non tokenisé | `color:'#0A0A0A'` en dur (valeur identique à `c.onAccent`) | `c.onAccent` | `ChatScreen.test.jsx` (couvert par le test de contraste des bulles) |

## Questions obligatoires — Messagerie

- La liste des conversations est-elle correcte en Light ? **Oui.** En Dark ? **Oui.**
- Les titres sont-ils lisibles ? **Oui**, `c.text`/`c.textSub`, pas d'opacité basse.
- Les previews sont-elles lisibles ? **Oui.**
- Les unread badges sont-ils lisibles ? **Oui**, `c.gold`/`c.onAccent`.
- Les messages envoyés sont-ils clairement identifiables ? **Oui**, fond gold + alignement droite. Les reçus ? **Oui**, fond `bgCard` + alignement gauche.
- Le foreground des bulles est-il correct ? **Oui**, vérifié et un cas tokenisé par cohérence.
- Le composer est-il lisible ? **Oui.** Le placeholder ? **Oui**, `c.placeholder`. Le bouton envoyer ? **Oui après correction.**
- Les pièces jointes ? **Oui**, déjà theme-aware.
- Le clavier masque-t-il le composer ? **NON CONFIRMÉ** sur device réel — architecture existante (`KeyboardAvoidingView`) non modifiée, non testée physiquement.
- Les empty states sont-ils corrects ? **Oui.** Les error states ? **N/A**, pas d'état dédié trouvé au-delà de l'échec silencieux existant. Les loading states ? **Oui**, `LoadingSpinner` réutilisé.
- Existe-t-il des imports statiques du thème clair ? **Non**, recherche exhaustive négative.
- Existe-t-il des tokens invalides ? **Non**, vérifié par le test d'intégrité (toujours vert).
- Existe-t-il des fallbacks suspects ? **Non**, recherche exhaustive négative.

## Questions obligatoires — Tenant Portal

- Le Tenant Portal est-il correct en Light ? **Oui.** En Dark ? **Oui.**
- Le titre est-il lisible ? **Oui.** Le profil locataire ? **Oui.** Les cards dashboard ? **Oui.**
- Les baux ? **Oui.** Les échéances ? **Oui.** Les montants ? **Oui**, formatage `money()` cohérent (non dupliqué de `PrixFCFA`, fonction locale simple — pas de bug, juste un formatage différent car contexte différent : texte inline, pas composant dédié prix).
- Les paiements ? **Oui.** Les pénalités ? **Oui**, affichées dans le résumé Paiements. Les reçus ? **Oui**, via Documents.
- Les documents ? **Oui.** Le préavis ? **Oui.** La maintenance locative ? **Oui**, distincte de la maintenance hôtel, vérifié.
- Les photos maintenance ? **Oui**, limite de 5 non modifiée.
- Les badges ? **Oui**, `success`/`successMuted` correctement pairés. Les CTA ? **Oui.**
- Les empty states ? **Oui.** Les error states ? **Oui**, avec action Réessayer. Les loading states ? **Oui**, `Skeleton`.
- Le responsive ? **PASS structurellement** (adaptation tablette existante), **NON CONFIRMÉ** sur device physique.
- Les safe areas ? **Oui.**
- Existe-t-il des imports statiques du thème clair ? **Non.**
- Existe-t-il des tokens invalides ? **Non.**
- Existe-t-il des hardcodes UI injustifiés ? **Non, aucun** — 0 couleur hardcodée dans tout le fichier.

## Questions globales

- Combien de P0 ? **0.** P1 ? **1** (icône Envoyer). P2 ? **1** (badge rôle). P3 ? **1** (tokenisation cosmétique).
- Combien ont été corrigés ? **3/3.**
- Une logique métier a-t-elle été modifiée ? **Non** — uniquement des couleurs/tokens ; aucun endpoint, payload, statut, calcul, ou navigation fonctionnelle modifié.
- Le design system existant a-t-il été respecté ? **Oui** — extension additive de 2 tokens suivant le pattern déjà établi, aucun composant recréé.
- Les tests sont-ils tous verts ? **Oui, 358/358.**
- Lint est-il à 0 erreur ? **Oui.**
- Expo Doctor est-il toujours 21/21 ? **Oui.**
- Android export passe-t-il ? **Oui.**
- Reste-t-il un écran critique NON CONFIRMÉ parmi les périmètres UI-MOB-1/2/3/4 ? **Oui, partiellement** : `PublierBienScreen`/`DetailAnnonceScreen`/`CarteScreen`/écrans Auth (UI-MOB-3) et Messagerie/Tenant Portal (UI-MOB-4) sont désormais audités et corrigés dans leur périmètre visuel critique ; restent NON CONFIRMÉ : vérification physique sur device/simulateur (Android et iOS) pour l'ensemble des 4 sprints, et les écrans à faible priorité jamais audités individuellement (voir UI-MOB-2/3 §dette).
- Le périmètre visuel critique mobile est-il certifié ? **Oui, dans les limites exactes documentées** — pas « tous les pixels de l'application », mais l'ensemble des écrans et flux prioritaires identifiés à travers les 4 sprints (navigation, PMS, notifications, mes annonces, profil, formulaires de publication, détail annonce, carte, authentification, messagerie, portail locataire).
- MOB-E2E est-il READY ? **Oui pour le périmètre critique certifié**, voir Verdict.

## Verdict

**UI-MOB-4 : GO SOUS RÉSERVES.**

Justification : Messagerie et Tenant Portal sont désormais auditées et fermées — Tenant Portal s'est révélé déjà entièrement conforme (aucun changement fabriqué, conformément à la règle finale du mandat), Messagerie avait 2 bugs réels (P1 contraste, P2 cohérence de badge) tous deux corrigés et testés. Aucune régression, tous les gates obligatoires passent. Ce qui empêche CERTIFIÉ VERT au sens strict : (1) aucune vérification visuelle physique (device ou simulateur, Android ou iOS) n'a été réalisée à aucun moment des 4 sprints UI-MOB — toutes les certifications reposent sur la lecture de code, le calcul de contraste et des tests unitaires, jamais une capture d'écran réelle ; (2) le responsive n'a jamais été vérifié au-delà du niveau structurel/logique. C'est un choix délibéré de transparence, pas un échec du sprint.

## Certification visuelle globale

En cumulant les conclusions d'UI-MOB-1, UI-MOB-2, UI-MOB-3 et UI-MOB-4 : **PÉRIMÈTRE VISUEL CRITIQUE MOBILE CERTIFIÉ**, défini exactement comme : theming System/Light/Dark, composants partagés (`Button`, `Chip`, `Input`, `Card`, `StepHeader`, `StepFooter`, `CustomTabBar`, `LoadingSpinner`, `Divider`, `Skeleton`, `SkeletonPropertyCard`, `PrixFCFA`), navigation (tab bar, transitions), PMS complet (Cockpit/Housekeeping/Maintenance/Operations), notifications, profil, mes annonces, formulaires de publication (création et édition), détail d'annonce, carte, authentification (Login/Signup/ForgotPassword/ResetPassword/CompleterProfil), messagerie (conversations/chat/chatbot), portail locataire. **Non inclus dans cette certification** : 100% des 490+ couleurs hardcodées restantes hors écrans explicitement audités, vérification visuelle sur device/simulateur physique, iOS, badges "type de bien" (dette UI-MOB-2 documentée).

## MOB-E2E readiness

**MOB-E2E READY** pour le périmètre critique cumulé des 4 sprints UI-MOB. Aucun P0/P1/P2 visuel connu et non corrigé ne subsiste dans ce périmètre. Réserves non bloquantes à transmettre : absence de vérification visuelle physique (tous OS confondus), dette de couleurs hardcodées hors périmètre documentée mais non chiffrée à nouveau ce sprint.
