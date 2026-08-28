# RELEASE-CONSOLIDATION-SECURITY-1 — Plan de déploiement (documentation uniquement, rien exécuté)

## Ordre de déploiement recommandé

1. **Environnement/config** — confirmer manuellement les variables Render/Netlify listées dans `_ENV_MATRIX.md` (aucune nouvelle variable requise par ce diff, seulement une confirmation que les valeurs existantes sont toujours correctes).
2. **Backend (Render)** — déployer en premier : les correctifs sécurité et le refactor ARCH2 sont rétrocompatibles avec le frontend/mobile actuellement en production (aucun breaking change de contrat API, voir `_DIFF_CLASSIFICATION.md`).
3. **Health check backend** — vérifier l'endpoint de santé standard après déploiement, avant de toucher au frontend.
4. **Frontend (Netlify)** — déployer ensuite (`npm run build:next` déjà validé en local, PASS).
5. **Smoke test frontend** — voir matrice ci-dessous.
6. **Security smoke** — voir matrice ci-dessous (§54 du mandat, quelques checks représentatifs, pas les 1280 tests).
7. **Mobile** — **NOT PART OF THIS RELEASE par défaut.** Un seul fichier mobile a changé (`ListeAnnoncesScreen.jsx`, hotfix mineur non sécurité : refetch "biens recommandés" au pull-to-refresh). Décision humaine requise : attendre une release groupée ultérieure, ou publier isolément si jugé prioritaire. Aucune build EAS n'a été lancée dans ce mandat (autorisation séparée requise, §34 du mandat).

## Préconditions

- Aucune migration requise (voir `_DIFF_CLASSIFICATION.md`).
- Aucune nouvelle variable d'environnement à créer.
- Le backend doit démarrer sans erreur avec la même configuration Render actuelle (nouveau modèle `ImapSyncCheckpoint` : collection créée automatiquement au premier accès, aucune action manuelle Mongo requise).

## Smoke test matrix (post-deploy, à exécuter manuellement, PAS dans ce mandat)

| Domaine | Vérification |
|---|---|
| Auth | Login Admin/Client fonctionne, JWT valide émis |
| Dashboard | Chargement des KPIs (`dashboardKpiQueryService` — vérifier que l'extraction ARCH2 n'a rien cassé) |
| Property | Liste et détail d'un bien s'affichent |
| Accommodation | Liste hébergements + nouvelle toolbar de filtres compacte s'affiche et fonctionne |
| Hotel | Liste hôtels/réservations admin |
| Rental | Création d'un bail (`POST /api/contrats`) sur un bien de son propre tenant → 201 |
| Messaging | Envoi/réception message, prévisualisation pièce jointe |
| Documents | Téléchargement d'un document locatif |
| Finance | Consultation des paiements d'un tenant |

## Security smoke (§54 du mandat — quelques checks représentatifs)

1. Admin Tenant A ne voit pas les données du Tenant B (liste Contrat/Locataire/Proprietaire).
2. Staff sans tenant résolu → refusé (fail-closed) sur une route de liste tenant-scopée.
3. `POST /api/contrats` avec l'ObjectId d'une Property d'un autre tenant → refusé (FCA1-01).
4. `POST /api/real-estate-applications/reservations/:id/cancel` sur une réservation d'un autre tenant → refusé (FCA1-02).
5. Un participant légitime à une conversation peut lire ses messages ; un tiers ne peut pas.

## Rien exécuté dans ce mandat

Ce document est purement descriptif. Aucun déploiement, aucune migration, aucune mutation production n'a eu lieu.
