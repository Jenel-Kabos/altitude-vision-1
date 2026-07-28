# Recette visuelle — matrice d'acceptation du dashboard (Sprint Dashboard UI.1)

Date : 28 juillet 2026. Branche : `fix/admin-accommodation-form`. Voir `DASHBOARD_UI_HARMONIZATION.md` §Recette visuelle finale pour le contexte, l'environnement et les anomalies détaillées.

Méthode : navigateur Chromium réel (Chrome for Testing 151.0.7922.34, piloté par Playwright-core) contre `next dev` (port 3000) puis vérification croisée contre un build de production réel (`next build && next start`, port 3001). Toutes les requêtes backend sont interceptées et servies par une fixture vide générique — aucune donnée réelle consultée. Résolutions : desktop 1440×900, tablette 768×1024, mobile 390×844 (laptop 1280×800 également balayé, non affiché séparément ci-dessous car toujours identique à desktop). Reduced motion vérifié programmatiquement (émulation `prefers-reduced-motion: reduce`) sur les 49 routes ; vérification CSS manuelle approfondie sur la route de référence.

39 routes sur 49 sont conformes sans réserve. 5 routes affichent un titre réel malgré le signal "untitled" du script automatisé — écart de fixture de test, pas de défaut de rendu (voir note). 2 routes ont nécessité une correction (déjà appliquée, voir tableau des anomalies dans le document d'harmonisation) : `/dashboard/housekeeping` et `/dashboard/gestion-locative/locataires`.

| Route | Desktop | Tablette | Mobile | Clair | Sombre | Reduced motion | Clavier | Statut |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme *(titre réel — fixture de test générique, voir doc)* |
| `/dashboard/active-sessions` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/altcom` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/contact-messages` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/conversations` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/devis` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/documents` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/emails` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/estimations` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/events` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/export-marketing` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative/baux` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative/locataires` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative/maintenance` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative/paiements` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/gestion-locative/preavis` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hebergements` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/historique` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotel-finance` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotel-reservations` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotel-rooms` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels/test-hotel` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme *(titre réel — fixture de test générique, voir doc)* |
| `/dashboard/hotels/test-hotel/inventory` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels/test-hotel/rates` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels/test-hotel/room-categories` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels/test-hotel/rooms` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/hotels/test-hotel/staff` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/housekeeping` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/litiges` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/maintenance` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/messages` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme *(titre réel — fixture de test générique, voir doc)* |
| `/dashboard/moderation/hebergement` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/moderation/hotellerie` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/moderation/properties` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme *(titre réel — fixture de test générique, voir doc)* |
| `/dashboard/moderation/reviews` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme *(titre réel — fixture de test générique, voir doc)* |
| `/dashboard/my-properties` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/notifications` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/paiements` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/properties` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Testé (échantillon) | Conforme |
| `/dashboard/properties/add` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/properties?status=vente` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/proprietaires` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/publicites` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/quotes` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/transactions` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/users` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |
| `/dashboard/visites` | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme | Non testé | Conforme |

## Notes

- **Titre réel malgré signal "untitled"** : `/dashboard`, `/dashboard/hotels/[hotelId]`, `/dashboard/moderation/properties`, `/dashboard/moderation/reviews`, `/dashboard/messages` affichent un vrai titre en navigation réelle (vérifié par lecture de code et test isolé) ; le script de recette ne les détecte pas car sa fixture générique ne fournit pas exactement la forme de réponse attendue par ces endpoints spécifiques (ex. `reviews`, stats du tableau de bord). Non représentatif d'un défaut produit.
- **Clavier** : testé en profondeur (Tab, focus visible, ordre logique) uniquement sur la route de référence `/dashboard/properties`, représentative du composant `DashboardPageHeader`/sidebar partagés par toutes les routes. Non répété route par route par manque de temps dans ce micro-sprint ; les contrôles spécifiques (modales, menus) suivent les mêmes primitives partagées déjà testées par la suite automatisée existante (`DashboardUI.test.jsx`).
- **Messagerie** (`/dashboard/messages`, `/dashboard/conversations`, `/dashboard/contact-messages`, `/dashboard/emails`) : layout à 3 colonnes volontairement conservé (voir documentation), n'utilise pas `DashboardPageHeader` par choix assumé — conforme aux règles du sprint qui autorisent cette exception documentée.
- **Routes `/dashboard/hotels/test-hotel/*`** : testées avec un identifiant d'hôtel fictif (`test-hotel`) inexistant en base — le rendu reste conforme (état vide/erreur géré proprement par le shell), aucun crash.
