# RELEASE-CONSOLIDATION-SECURITY-1 — Baseline

1. HEAD (vérifié) : `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche : `main`.
3. `git log -20 --oneline` : les 20 derniers commits sont tous antérieurs à toute la campagne sécurité (`a04055f Update Altimmo 40`, etc.) — confirme qu'aucun commit n'a été fait pendant HZ/HF/RBAC/P0/P1/FCA/validation/consolidation.
4. `git status --short` : 91 fichiers modifiés (`M`), 629 fichiers non trackés (`??`) — le seul changement de ce mandat est `.gitignore` (90→91 modifiés, voir §6).
5. `git diff --numstat` (total) : +1735 / −616 sur les 90 fichiers de code/tests pré-existants (hors `.gitignore`).
6. `git diff --check` : 4 avertissements CRLF pré-existants uniquement (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`).
7. Aucune opération destructive exécutée (`reset --hard`, `clean -fd`, `restore .`, `checkout .`, `stash` global, `rebase`, `merge`) — le worktree accumulé sur toute la session est intact.

## Modification apportée par ce mandat

**`.gitignore`** — ajout de 2 lignes (`altimmo-app/*.apk`, `altimmo-app/*.aab`) pour protéger contre la présence d'un artefact de build Android (149 Mo) découvert non tracké et sans protection (voir `_GATE_MATRIX.md` §Anomalies). C'est la SEULE modification de code/config de tout ce mandat — strictement une anomalie de consolidation évidente et triviale (mandat §82), documentée avant/après.

Avant :
```
*.p8
*.p12
*.mobileprovision
```
Après :
```
*.p8
*.p12
*.mobileprovision

# Artefacts de build mobile locaux (EAS/Expo) — jamais versionnés
altimmo-app/*.apk
altimmo-app/*.aab
```

Confirmé : `altimmo-app/build-1787511872437.apk` n'apparaît plus dans `git status --short` après ce changement.
