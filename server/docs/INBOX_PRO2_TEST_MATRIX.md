# INBOX-PRO-2 — Matrice de tests

## Nouveaux tests (mandat §48)

| Cas (mandat §48) | Test | Fichier | Résultat |
|---|---|---|---|
| Sélection de conversation | "sélection : cliquer une conversation l'ouvre, marque comme lu et affiche le contenu HTML sécurisé" | `InternalMessagingPageUX.test.jsx` | ✅ |
| Style non-lu | "unread styling : un message non lu est visuellement distingué..." | idem | ✅ |
| Aucune sélection | "no selection : le panneau central invite explicitement..." | idem | ✅ |
| Loading | "loading : un skeleton est affiché pendant le chargement initial" | idem | ✅ |
| Erreur | "error state : un échec de chargement affiche un message clair avec un bouton réessayer" | idem | ✅ |
| Recherche | "recherche : filtre la liste déjà chargée par objet/expéditeur/contenu" | idem | ✅ |
| Filtres | "filtres : Non lus et Avec pièce jointe réduisent la liste sans appel réseau supplémentaire" | idem | ✅ |
| Drawer | "drawer contact : s'ouvre au clic sur l'expéditeur et se ferme via son bouton" | idem | ✅ |
| Pièces jointes | "pièces jointes : présentées en bande compacte avec actions voir/télécharger" | idem | ✅ |
| Reply composer | Non re-testé spécifiquement (mécanisme `ComposeModal` inchangé — déjà couvert par la suite existante avant ce sprint, non modifiée) | — | Non-régression (suite existante verte) |
| Responsive state | "la messagerie interne suit dossiers, liste, détail puis les retours locaux" (mis à jour pour le nouveau double-landmark) | `DashboardResponsiveNavigation.test.jsx` | ✅ |
| Favoris (ajouté au-delà de la liste du mandat) | "favoris : basculer l'étoile appelle le service et affiche une confirmation" | `InternalMessagingPageUX.test.jsx` | ✅ |

**11/11** nouveaux tests UX verts (`InternalMessagingPageUX.test.jsx`).

## Régression INBOX-PRO-1 (mandat §49-50, obligatoire)

| Suite | Résultat |
|---|---|
| `SafeHtmlEmailViewer.test.jsx` (12 tests : script/onerror/onclick/javascript:/iframe/object/form/style/fallback texte) | **12/12 verts, rejoués tels quels, composant non modifié** |
| Intégration dans le nouveau layout (`InternalMessagingPageUX.test.jsx`, test "sélection") | ✅ confirme que l'iframe sandboxée (`sandbox` sans `allow-scripts`) est bien présente dans le nouveau `ConversationViewer` |
| `zohoImapService.test.js` (pipeline HTML backend, INBOX-PRO-1) | **10/10 verts** (backend non modifié ce sprint) |

## Régression globale

| Gate | Résultat |
|---|---|
| `DashboardResponsiveNavigation.test.jsx` | 5/5 ✅ (1 test mis à jour pour le double-landmark, cf. rapport) |
| Suite client complète | 611/611 (91 fichiers) ✅ |
| Lint client | 0 erreur, 266 warnings (baseline en baisse : -3 vs avant ce sprint) ✅ |
| Build client | ✅ |
| `zohoImapService.test.js` | 10/10 ✅ |
| Server unit complet | 1449/1449 ✅ |
| `git diff --check` | exit 0 ✅ |
