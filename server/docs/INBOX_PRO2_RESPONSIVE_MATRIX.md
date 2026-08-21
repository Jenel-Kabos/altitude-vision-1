# INBOX-PRO-2 — Matrice responsive

**Avertissement honnête (mandat §55)** : cette session ne dispose d'aucun outil de capture d'écran / navigateur piloté. Toute la validation ci-dessous est **structurelle** (classes Tailwind appliquées, comportement DOM/JS testé par Vitest+RTL, build Next.js réussi) — **AUCUNE capture visuelle réelle n'a été effectuée**. Le verdict final en tient compte explicitement (GO SOUS RÉSERVES, pas CERTIFIÉ VERT).

| Breakpoint | Classes clés appliquées | Comportement attendu | Vérifié comment |
|---|---|---|---|
| **Desktop large / Laptop** (`lg:` et au-delà, ≥1024px) | `InboxNavRail` : `hidden lg:flex w-14`. Liste : `lg:flex w-[340px]`. Viewer : `lg:flex flex-1`. `MobileFolderList` : masqué (non rendu, `mobilePane==='folders'` uniquement au premier chargement mais bascule vite) | Rail compact + liste 340px + viewer dominant, jamais 33/33/33 | Structurel (classes présentes dans le DOM rendu par les tests) + build réussi. **Rendu visuel réel NON CONFIRMÉ** (pas de navigateur disponible) |
| **Tablet** (768-1023px, sous `lg:`) | Aucune règle `md:` dédiée ajoutée — le point de bascule reste `lg:` (1024px), donc une tablette en portrait/paysage suit le comportement MOBILE (`mobilePane` écran-par-écran) | Liste + viewer mono-écran comme mobile | **NON CONFIRMÉ** — aucun test ni capture à cette largeur précise ; le mandat §25 suggérait "liste + viewer côte à côte" sur tablette, ce qui **n'a pas été implémenté** (un breakpoint `md:` intermédiaire aurait été nécessaire, non ajouté par prudence — un point de bascule mal calibré sans validation visuelle réelle aurait pu casser plus qu'il n'aurait amélioré) |
| **Mobile** (<1024px, `mobilePane` state) | Navigation 3 écrans (`folders`→`list`→`detail`), chaque écran `w-full`, jamais de colonnes compressées | Un écran à la fois, retour explicite (`BackButton`) | Testé (`DashboardResponsiveNavigation.test.jsx`, 5/5 verts) — navigation dossiers→liste→détail→retour confirmée fonctionnellement, y compris avec le nouveau landmark `aria-label="Choisir un dossier"` |
| **Drawer contact** | `fixed inset-0`/`fixed top-0 right-0 w-full max-w-sm` | Overlay plein écran sur mobile (max-w-sm ≈ 384px, proche de 100% sur petit écran), panneau latéral sur desktop | Testé fonctionnellement (ouverture/fermeture, contenu) — **présentation visuelle réelle NON CONFIRMÉE** |

## Dette explicite

- Pas de breakpoint tablette dédié (`md:`) — comportement tablette = comportement mobile, ce qui respecte au moins l'exigence "jamais de colonnes desktop compressées" (mandat §26) par défaut, mais ne livre pas l'exigence plus fine du §25 ("liste + viewer avec largeur adaptée" sur tablette spécifiquement).
- Aucune capture d'écran réelle prise à aucune largeur — recommandé pour une validation humaine avant mise en production.
