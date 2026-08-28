# INBOX-2 — VALIDATION VISUELLE RÉELLE

## Méthode

Infrastructure réutilisée : `@playwright/test` + Chromium déjà installés (même patron que `HOTFIX-INBOX-SECURITY-2`), config dédiée légère (`client/e2e/inbox2/playwright.inbox2.config.js`), aucune dépendance ajoutée. Le VRAI composant de production `InternalMessagingPage.jsx` est bundlé en mémoire (esbuild) avec ses seules dépendances externes stubbées (services réseau, contexte auth, routeur Next — jamais le composant lui-même ni ses enfants réels `SafeHtmlEmailViewer`/`AttachmentStrip`/`ConversationRow`/etc.), monté dans la vraie structure `.dashboard-shell > .dashboard-content-inner` avec le **vrai CSS compilé de production** (`npm run build:next`, tous les chunks `.next/static/css/*.css` concaténés) — preuve fidèle du mécanisme de compatibilité dark mode réellement livré, pas une reconstruction.

## Captures produites (`client/e2e/inbox2/screenshots/`)

| Fichier | Scénario | Constat |
|---|---|---|
| `desktop-light.png` | 1440×900, clair, message sélectionné avec pièces jointes | Conforme — nav rail, liste, header, corps HTML, pièces jointes toutes lisibles et bien hiérarchisées |
| `desktop-dark.png` | 1440×900, sombre, message sélectionné | **Avant correctif** : corps HTML du message quasiment illisible (texte sombre sur fond auto-assombri par l'iframe). **Après correctif** (capture finale ci-incluse) : texte clair sur fond sombre explicite, parfaitement lisible, cohérent avec le reste du panneau |
| `mobile-light-folders.png` | 390×844, clair, écran dossiers | Conforme |
| `mobile-dark-folders.png` | 390×844, sombre, écran dossiers | Conforme, aucun défaut trouvé |
| `mobile-light-list.png` | 390×844, clair, liste après sélection du dossier | Conforme |
| `mobile-light-detail.png` | 390×844, clair, lecture plein écran avec pièces jointes | Conforme — bouton retour, actions étoile/suppression, pièces jointes empilées lisiblement |

## Défaut trouvé et corrigé pendant cette validation

Capturé avant correctif : le corps HTML de l'email (`SafeHtmlEmailViewer`) restait au texte `#1f2937` (sombre) codé en dur dans le CSS interne à l'iframe, sans fond explicite — en mode sombre, Chromium assombrit automatiquement le fond du document (comportement UA implicite, hors du contrôle de l'application) tout en conservant la couleur de texte de l'auteur, produisant un texte quasiment invisible. Corrigé par l'ajout d'un bloc `@media (prefers-color-scheme: dark)` explicite dans `SafeHtmlEmailViewer.jsx` (voir `INBOX2_BEHAVIOR_CONTRACT.md`). Re-capturé après correctif : lisible, conforme.

## Limite honnête de cette validation

- Testé : mode sombre déclenché par la préférence OS (`prefers-color-scheme`), seul mécanisme que l'iframe sandboxée peut détecter par elle-même.
- **Non testé** : bascule dark mode explicite via un contrôle utilisateur en surface (`.dark` sur `.dashboard-shell`, indépendant de l'OS) — si un tel contrôle existe dans l'application réelle (non confirmé, hors périmètre de cet audit ciblé sur l'Inbox), le corps HTML de l'email resterait en mode clair jusqu'à ce que l'OS change également de préférence. Documenté comme limite connue, pas une régression : ce cas n'était pas mieux couvert avant ce sprint (le texte était illisible dans les deux cas de déclenchement du sombre).
- Résolutions desktop intermédiaires (standard ~1280px, tablette ~768-1024px) non capturées séparément dans cette passe — voir `INBOX2_RESPONSIVE_MATRIX.md` pour la justification (aucune classe responsive touchée par ce sprint).
- Ceci reste une validation en environnement de test (composant bundlé isolément, pas l'application déployée avec son vrai backend/auth) — une vérification manuelle finale sur l'environnement de développement réel (`npm run dev`, compte de test réel) reste recommandée avant mise en production, si l'utilisateur souhaite une confirmation supplémentaire.

## Verdict de cette dimension

**Validation visuelle réelle effectuée**, en moteur Chromium, sur le composant de production réel avec son CSS de production réel — pas une simple lecture de code. Un défaut réel a été trouvé et corrigé avec preuve avant/après.
