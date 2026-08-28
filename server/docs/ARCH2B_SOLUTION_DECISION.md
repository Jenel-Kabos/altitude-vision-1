# ARCH-2B — Décision de solution

## Décision

Rupture de `notificationService → crmAutomationEngine` par un port de callback local, `notificationObservationPort`. `notificationService` publie le payload déjà existant sans connaître CRM. `crmAutomationEngine.initializeCrmAutomation()` enregistre `handleEvent` une seule fois depuis `server.js`.

Ce n'est ni un bus global ni un nouveau système d'événements : un module de 23 lignes conserve exactement un callback, refuse une deuxième fonction et fournit un cleanup pour les tests. Aucune dépendance npm n'est ajoutée.

## Pourquoi cette arête

Elle est post-persistance, side-effect only, sans retour utilisé, déjà différée d'un microtask et best-effort. Elle inverse aussi la direction saine : l'infrastructure Notification connaissait l'orchestration CRM. Les autres arêtes de la SCC servent des lectures nécessaires ou des actions déclarées par les règles.

## Alternatives rejetées

- Casser `crmService → notificationService` : quatre workflows CRM et leurs notifications auraient dû être réécrits.
- Casser score/cockpit/segmentation : ces appels retournent des données indispensables et ne sont pas infrastructurels.
- Façade important les deux côtés : elle aurait déplacé ou recréé le cycle.
- EventEmitter global : inutile pour un observateur unique, plus exposé aux doubles listeners et fuites mémoire.
- `require()` dynamique, timeout ou allowlist : ils masqueraient le problème sans supprimer la dépendance.

## Sémantique

Le callback est planifié avec `Promise.resolve().then`, comme avant. Son rejet est absorbé, comme avant. Le payload, le tenant, l'ordre après persistance et les chemins Socket/push/webhook restent dans `notificationService` et sont inchangés.
