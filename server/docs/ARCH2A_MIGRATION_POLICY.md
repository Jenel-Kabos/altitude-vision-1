# ARCH-2A — Politique de migration

## Nouveau code

Le flux attendu est `Route → Controller → Service → Model`. Aucun nouveau route → model, service → controller, controller → controller ou cycle fort n'est accepté.

## Réduction d'une dette existante

1. Modifier le code sans élargir le périmètre métier.
2. Exécuter les tests ciblés.
3. Lancer `npm run architecture:check` : l'entrée supprimée doit être signalée stale.
4. Retirer uniquement l'entrée exacte de `architecture/baseline.json`.
5. Relancer le checker et obtenir `Architecture boundaries: PASS`.

Le baseline ne doit jamais être régénéré automatiquement ni assoupli pour faire passer CI. Toute exception nouvelle requiert justification, revue et test. Le cycle CRM est réservé à ARCH-2B ; les adapters controller → controller de Dossier et les frontières de domaines seront traités progressivement dans les phases suivantes.
