# INBOX-PRO-1 — Architecture UX

## Décision de périmètre (honnête, pas une promesse)

Le mandat décrit une refonte produit complète (61 sections : layout, sidebar, densité, recherche serveur, thread condensable, drawer contact, composer riche, accessibilité clavier complète, etc.). Compte tenu de l'ampleur réelle du travail (plusieurs jours d'un vrai sprint produit) et du temps disponible dans cette session, ce sprint a délibérément priorisé, dans l'ordre indiqué par le mandat lui-même (§ règle finale) :

1. **Fidélité du rendu email** (priorité #3 du mandat) — cause racine résolue (stockage HTML).
2. **Sécurité** (priorité #4 du mandat) — isolation iframe + sanitization, remplace un rendu direct dans le DOM du dashboard.

**N'ont PAS été traités ce sprint** (restent tels qu'avant, aucune régression, mais aucune amélioration non plus) :

- Proportions/densité de la mise en page (sidebar/liste/lecture) — la structure à trois `<div>` de largeur fixe décrite au §4 du mandat **existe toujours telle quelle**. Le rendu de contenu à l'intérieur du panneau de lecture est désormais professionnel et sûr, mais l'ossature "trois blocs" n'a pas été restructurée visuellement.
- Sidebar compacte/repensée (§5), densité de liste avancée (§6-7), recherche serveur (§8), filtres compacts dédiés (§9), thread condensable (§11), drawer contact (§28-29), composer riche (§25), accessibilité clavier complète (§35).

Ce choix est documenté explicitement pour ne jamais prétendre un résultat non livré, conformément à la règle du mandat "toute réponse non démontrée = NON CONFIRMÉ".

## Ce qui a été réutilisé (mandat §3)

Aucun nouveau système de conversation, aucune duplication :
- `messageService.js` (toutes les fonctions existantes, inchangées).
- `MessageItem`, `MessageDetail`, `ComposeModal`, `NavButton` (composants inline existants, réutilisés tels quels — seul le rendu du corps du message dans `MessageDetail` a changé).
- Structure de navigation `mobilePane` (existante, responsive écran-par-écran déjà en place, conservée).

## Ce qui a été créé

- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` — nouveau composant, aucun équivalent existant (vérifié par recherche exhaustive avant création, mandat §3).

## Ce qui a été modifié

- `client/lib/pages/dashboard/InternalMessagingPage.jsx` — remplacement du bloc `dangerouslySetInnerHTML` par `<SafeHtmlEmailViewer html={message.html} text={message.content} />`, suppression de l'import `dompurify` devenu inutile à ce niveau (la sanitization vit désormais dans le composant dédié).

## Recommandation pour la suite (non démarrée)

Un second sprint dédié (`INBOX-PRO-2` ou équivalent) pourrait traiter la restructuration visuelle proprement dite (§4-11, §28-39) maintenant que le contenu affiché est fiable et sûr — travailler sur la présentation d'un contenu qui n'était pas fidèlement rendu aurait été prématuré.
