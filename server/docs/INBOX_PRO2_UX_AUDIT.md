# INBOX-PRO-2 — Audit UX avant code

Date : 2026-08-21.

## 0. Clarification de cible (héritée d'INBOX-PRO-1)

Le mandat utilise "StaffInbox" comme nom générique. Deux systèmes distincts existent réellement dans le code :
- `StaffInboxPage.jsx` (`/dashboard/conversations`) — chat client temps réel, `Conversation`/`Message`, déjà 2 colonnes, **hors périmètre** (confirmé en INBOX-PRO-1).
- `InternalMessagingPage.jsx` (`/dashboard/messages`) — boîte de réception réelle (interne + emails Zoho), **cible de PRO-1 ET PRO-2**.

Ce document audite `InternalMessagingPage.jsx` tel qu'il existe après INBOX-PRO-1 (SafeHtmlEmailViewer déjà intégré).

## 1. Zones existantes — classification

| Zone | Existant | Verdict |
|---|---|---|
| Conteneur racine (`flex h-[...] bg-gray-50`) | 3 `<div>` de largeur fixe (sidebar 256px / liste 384px / détail flex-1) | **À MODIFIER** — remplacer par toolbar horizontale + 2 zones (liste + viewer dominant) |
| Sidebar dossiers (`w-64`, compose button + nav + profil) | Fonctionnelle, 6 dossiers (inbox/sent/unread/starred/drafts/trash) | **À DÉPLACER/FUSIONNER** — devient une barre de navigation compacte intégrée à la toolbar/liste, plus une colonne pleine largeur séparée |
| Recherche | `<input>` dans la colonne liste, filtrage 100% frontend sur `messages` déjà chargé (`filteredMessages`) | **À CONSERVER tel quel** — aucune API de recherche serveur n'existe ; documenté comme `BACKEND SEARCH REQUIRED` (non implémenté, cf. §11 mandat) plutôt que de prétendre une recherche globale |
| Liste des messages (`MessageItem`) | Une ligne par message, avatar + nom + objet + aperçu + date + badges | **À MODIFIER** — densité déjà correcte dans son principe, resserrer padding et supprimer les avatars en dégradé trop lourds visuellement |
| Panneau détail (`MessageDetail`) | Header expéditeur + `SafeHtmlEmailViewer` (depuis PRO-1) + liste attachments | **À CONSERVER le viewer**, **À MODIFIER l'enrobage** (header, actions, largeur `max-w-3xl` qui limite artificiellement l'usage de l'espace disponible) |
| Panneau contact/informations permanent | **N'existe pas en tant que 3e colonne** dans le code actuel (contrairement à l'hypothèse du mandat) — les seules infos "contact" sont déjà dans le header du détail (nom, email) | **À CRÉER** un drawer, mais depuis zéro (pas de panneau permanent à transformer, car il n'y en avait pas — le "problème 3 colonnes" vient de sidebar+liste+détail, pas de détail+contact) |
| Thread / plusieurs messages liés | **Aucune notion de thread dans `InternalMail`** — chaque message est un document indépendant (`sender`/`receiver`/`content`), aucun champ `threadId`/`inReplyTo`/`conversationId` | **NON APPLICABLE** — pas de regroupement de messages en fil de discussion possible sans modification de modèle (hors périmètre, mandat §3 interdit un nouveau modèle) ; documenté honnêtement, pas simulé |
| Composer (`ComposeModal`) | Modal plein écran, interne/externe, pièces jointes, brouillons | **À CONSERVER le mécanisme**, resserrer visuellement uniquement |
| Attachments (dans `MessageDetail`) | Liste verticale avec icône/nom/taille/actions | **À MODIFIER** — déjà proche de la cible du mandat (§21), resserrer en bande compacte |
| Responsive (`mobilePane`) | 3 états (`folders`/`list`/`detail`), déjà écran-par-écran sur mobile | **À CONSERVER**, adapter aux nouvelles zones (toolbar+liste fusionnées) |
| États loading/empty | Spinner centré, message simple | **À AMÉLIORER légèrement** (skeleton liste plutôt que spinner plein écran) |
| État erreur dédié | **Absent** — seulement un toast, pas de zone d'erreur avec retry | **À CRÉER** minimalement |

## 2. Composants réellement inventoriés avant création (mandat §43)

| Composant cible du mandat | Existe déjà sous quel nom ? | Décision |
|---|---|---|
| `InboxToolbar` | Non — recherche est dans la colonne liste, dossiers dans la sidebar séparée | **Créer** (fusionne recherche + dossiers actifs + refresh) |
| `ConversationList`/`ConversationRow` | `MessageItem` (inline) | **Extraire et renommer** en composant dédié, pas dupliquer |
| `ConversationViewer`/`ConversationHeader` | `MessageDetail` (inline, header inclus) | **Découper** en `ConversationHeader` + garder `SafeHtmlEmailViewer` tel quel |
| `MessageThread`/`MessageItem` (thread) | Non applicable (voir §1) | **Ne pas créer** — pas de données pour l'alimenter |
| `AttachmentStrip` | Bloc inline dans `MessageDetail` | **Extraire** en composant dédié |
| `ReplyComposer` | `ComposeModal` (modal, pas inline) | **Conserver le modal existant** — le transformer en panneau inline serait une reconstruction non justifiée par un bug ; le mandat §19 demande de conserver le mécanisme d'envoi, pas obligatoirement la présentation modale, mais le risque de régression d'un changement modal→inline dépasse le bénéfice mesuré pour ce sprint — **décision : conserver le modal, uniquement resserrer son style** |
| `ContactDrawer` | N'existe pas | **Créer**, minimal (nom, email, rôle si staff interne ; expéditeur/destinataire pour un email externe) |

## 3. Plan d'implémentation

1. `ConversationRow.jsx` — extraction dense de `MessageItem`.
2. `ConversationList.jsx` — liste + recherche + filtres (Tous/Non lus/Avec pièce jointe), remplace la recherche isolée.
3. `InboxToolbar.jsx` — barre compacte (dossier actif, nouveau message, actualiser).
4. `AttachmentStrip.jsx` — extraction compacte des pièces jointes.
5. `ContactDrawer.jsx` — nouveau panneau contextuel escamotable.
6. `ConversationViewer.jsx` — header + `SafeHtmlEmailViewer` (inchangé) + `AttachmentStrip`, largeur pleine (suppression du `max-w-3xl`).
7. `InternalMessagingPage.jsx` — réassemblage : toolbar en haut, liste (320-380px) + viewer dominant, drawer overlay, sidebar dossiers fusionnée dans la liste (pas de 3e colonne séparée).
8. Tests (sélection, non-lu, empty/loading/error, drawer, responsive mobile, filtres, non-régression PRO-1/sécurité).
9. Build + validation visuelle réelle (dev server, captures documentées).
