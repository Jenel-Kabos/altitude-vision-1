# HOTFIX-ADMIN-DASHBOARD-RENTAL-ACTIVE-CONTRACTS-1 — Rapport

**Verdict : B. PARTIAL FIX — REMAINING INCONSISTENCY (le postulat du mandat est incorrect, aucun code modifié)**
**Aucun commit, push ou déploiement.**

## Baseline (§18 question 1)
1. HEAD initial : `bdcba2462a17f4ded3ccad188ae5024a14940f8b` — confirmé identique avant/après (aucune modification effectuée). `git status --short` et `git diff --check` vérifiés au démarrage : le fix Inbox et le hotfix RM Dashboard Semantics étaient déjà présents et intacts, aucune opération destructive exécutée.

## Découverte critique — le fichier ciblé par le mandat est du code mort

Le mandat identifie `server/controllers/dashboardController.js` comme la surface à corriger (fonction `getDashboardStats`, ligne 65 : `Contrat.countDocuments({ statut: 'actif' })`, exposée sous `gestionLocative.contratsActifs`).

**Vérification effectuée avant toute modification** :
```
grep -rn "require.*dashboardController" --include="*.js" .
```
→ **Aucun résultat.** Ce fichier n'est importé par **aucune route, aucun test, aucun script** dans l'ensemble du dépôt. C'est du code strictement mort — jamais exécuté par aucune requête réelle.

La route réellement montée, `GET /api/dashboard/stats` (`server/routes/dashboardRoutes.js`), délègue à `getDashboardKpis()` (`server/services/dashboardKpiQueryService.js`), qui retourne uniquement `{Altimmo, MilaEvents, Altcom, Users, Owners}` — **aucun champ `gestionLocative` n'existe dans cette réponse**, ni maintenant ni avant l'extraction ARCH2 de ce même service (vérifié via `git show cb64609 -- routes/dashboardRoutes.js` : le handler inline pré-ARCH2 ne calculait déjà aucun `Contrat`/`gestionLocative` — remonté jusqu'au commit `2b25924` « Première version », ce champ n'a **jamais** existé dans la réponse réelle de cet endpoint). **Ce n'est donc pas une régression introduite par le refactor ARCH2 de cette session.**

## Le bug réel côté frontend est différent de celui décrit

Le widget "Contrats actifs" du dashboard Admin global (`DashboardHome.jsx`) appelle `getDashboardStats()` (`client/lib/services/dashboardService.js`), qui lit :
```js
contratsActifs: data.kpis?.gestionLocative?.contratsActifs ?? 0,
```
Comme `data.kpis` n'existe jamais dans la réponse réelle du backend, **cette expression retourne systématiquement `0`** — le widget n'affiche donc jamais un compteur gonflé par des contrats de vente ; il affiche **toujours zéro**, quel que soit le nombre réel de contrats locatifs actifs. C'est un bug différent de celui décrit par le mandat (qui supposait un sur-comptage, pas une absence totale de donnée), préexistant à toute cette session de travail, et non lié au correctif `HOTFIX-RENTAL-MANAGEMENT-DASHBOARD-SEMANTICS-1`.

## Pourquoi aucune correction n'a été appliquée

Le mandat autorise explicitement un correctif ciblé **uniquement** sur la surface décrite, avec l'instruction explicite : *« Sauf si le code exact partagé rend impossible une correction ciblée. Dans ce cas : STOP et documenter. »* C'est exactement la situation rencontrée :
- Corriger `dashboardController.js` serait un **no-op** total (code inatteignable), ce qui donnerait une fausse certification « CERTIFIED GREEN » sans que le widget réel change de comportement.
- Corriger le vrai bug nécessiterait de modifier `dashboardKpiQueryService.js` (ajouter un champ `gestionLocative.contratsActifs` absent) — une action **différente** de celle décrite dans ce mandat (qui suppose la correction d'un filtre existant, pas l'ajout d'un champ manquant), sur un fichier non nommé par le mandat, pour corriger un symptôme différent de celui diagnostiqué. Procéder sans confirmation aurait excédé le périmètre explicite.

## Réponses aux questions obligatoires (§18)

1. HEAD initial : `bdcba2462a17f4ded3ccad188ae5024a14940f8b`. 2. Fonction exacte visée par le mandat : `dashboardController.exports.getDashboardStats` — confirmée **non appelée par aucune route** (code mort). 3. Ancienne query : `Contrat.countDocuments({ statut: 'actif' })`, sans filtre de type — mais dans un fichier jamais exécuté. 4. Pourquoi la vente était comptée : dans l'absolu, cette query compterait bien les ventes actives — mais elle n'est **jamais exécutée en production**. 5-7. Sans objet — **aucune modification appliquée**, la prémisse du mandat ne correspond pas au code live.

8-12. Tests RED/GREEN : **non créés** — un test RED sur du code mort n'aurait aucune valeur de preuve (il ne prouverait rien sur le comportement réel de l'application). 13. Autres widgets modifiés ? **Aucun, rien n'a été modifié.** 14. Tenant logic modifiée ? **Non.** 15. API shape modifiée ? **Non.** 16. Frontend modifié ? **Non.**

17. Tests ciblés : **non exécutés** (aucun changement à tester). 18. Architecture : non ré-exécutée (aucun changement). 19. Lint : non ré-exécuté (aucun changement). 20. diff-check : `git diff --check` toujours **PASS** (identique à la baseline, aucun changement introduit).

21. Fix Inbox préservé ? **Oui**, intact, non touché. 22. Hotfix Rental Dashboard Semantics préservé ? **Oui**, intact, non touché. 23. Mobile modifié ? **Non.** 24. Migration ? **Non.** 25. Mongo production ? **Non.** 26. Commit ? **Non.** 27. Push ? **Non.** 28. Deploy ? **Non.** 29. HEAD final : `bdcba2462a17f4ded3ccad188ae5024a14940f8b`, inchangé.

30. **Verdict : B. PARTIAL FIX — REMAINING INCONSISTENCY.** Le finding décrit par le mandat ne correspond à aucun code exécuté ; le bug réel du widget "Contrats actifs" du dashboard Admin global est différent (absence totale du champ dans la réponse API, pas un sur-comptage) et préexiste à toute cette campagne. Aucune régression n'a été causée par les mandats précédents de cette session.

## Recommandation pour un futur mandat

Si une correction est souhaitée, elle devrait :
1. Confirmer si le widget "Contrats actifs" du dashboard Admin global (`DashboardHome.jsx`) doit réellement afficher cette métrique (actuellement muette depuis, semble-t-il, l'origine du fichier `dashboardRoutes.js` actuel).
2. Si oui, ajouter dans `dashboardKpiQueryService.js::getDashboardKpis` un compte `Contrat.countDocuments({ type: 'location', statut: 'actif' })` (même définition canonique que `HOTFIX-RENTAL-MANAGEMENT-DASHBOARD-SEMANTICS-1`), exposé sous une clé cohérente avec ce que lit déjà `dashboardService.js` — ou ajuster ce dernier si la clé doit changer.
3. Supprimer ou documenter explicitement `dashboardController.js` comme code mort, pour éviter qu'un futur mandat le cible à nouveau par erreur.

Ce travail n'a **pas** été effectué ici, conformément à l'interdiction d'excéder le périmètre explicitement autorisé sans confirmation.
