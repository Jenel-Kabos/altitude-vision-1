# HOTFIX-OWNER-CONTRACT-RESEND-1 — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → propre (rien de non commité)
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782
git diff --check → exit 0
git diff --stat → (vide)
```

**Changement externe constaté** : `HEAD` a évolué depuis la fin de HOTFIX-USERS-COUNT-1 (`bfdd67c8f8293c690640fab799b2aae062196d7a`) vers `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` ("Update Altimmo 32"). Vérifié via `git show --stat` : ce commit contient exactement le travail de la session précédente (PAY-3, PAY-4, HOTFIX-USERS-COUNT-1 — mêmes fichiers listés dans le rapport précédent), commité par l'utilisateur en dehors de cette session. Aucun fichier surprise, aucune perte de travail.

## 2. Problème rapporté

Sur `/dashboard/users`, le compte Proprietaire "huinlogistics Boss" (email `huinlogistics@gmail.com`, rôle Proprietaire, statut Actif) apparaît désormais correctement (HOTFIX-USERS-COUNT-1). La modale de son contrat d'hébergement affiche correctement référence, version, date d'acceptation, IP, certifications. Mais le clic sur "Renvoyer par email" échoue avec "Utilisateur introuvable."

**Preuve runtime déjà capturée par l'utilisateur** :
```
POST /api/users/6a84080352c6ffabafb26af7/renvoyer-contrat
→ 404 "Utilisateur introuvable."
```
Le frontend atteint donc bien la route ; le problème est dans la résolution d'identité côté backend ou dans l'identifiant transmis.

## 3. Méthode

Audit en lecture seule du code (routes, contrôleurs, modèles) pour tracer l'ID `6a84080352c6ffabafb26af7` depuis la modale jusqu'au modèle Mongo interrogé, puis correction minimale et tests avec fixtures locales — jamais sur la base réelle. Interdiction explicite du mandat : pas de fallback `User.findOne({email: req.body.email})`, pas de conclusion prématurée que HOTFIX-USERS-COUNT-1 est la cause.

## 4. Plan

1. Tracer la route `POST /api/users/:id/renvoyer-contrat` (ou équivalent) et son contrôleur.
2. Identifier exactement quel modèle est interrogé avec l'ID reçu (`User.findById` ? `Proprietaire.findById` ?).
3. Tracer côté frontend quel ID est transmis dans l'URL (User._id ? Proprietaire._id ? autre ?).
4. Construire la matrice identité (User._id / Proprietaire._id / OrgMembership / contract.user / email).
5. Identifier le modèle réel du "contrat d'hébergement" (collection Mongo, relations).
6. Localiser la ligne exacte produisant "Utilisateur introuvable."
7. Corriger au niveau le plus étroit, dériver le destinataire côté serveur depuis la ressource autorisée (jamais un email/ID arbitraire du client).
8. Tests : cas nominal (Proprietaire signup sans OrgMembership) + test adversarial (injection d'email/ID d'un autre utilisateur).
9. Gates complets + rapport.
