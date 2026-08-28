# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — CONTRAT COMPORTEMENTAL

| Scenario | Before | After |
|---|---|---|
| Recommandé vente (ex. Parcelle), montage initial de l'écran | Affiché avec son image, si les données étaient déjà correctes au moment du premier appel | **Inchangé** — même comportement, non modifié |
| Recommandé location (ex. Bureau), montage initial de l'écran | Affiché, si déjà recommandé au moment du premier appel | **Inchangé** au montage — même comportement |
| **Recommandation modifiée côté admin APRÈS le montage de l'écran mobile (nouveau bien recommandé, image corrigée), puis pull-to-refresh** | **Bug prouvé — le nouveau/corrigé bien reste invisible indéfiniment**, `getRecommendedProperties()` jamais rappelé | **Corrigé — le pull-to-refresh invalide le cache `recommended:` et rappelle `getRecommendedProperties()`, la section se met à jour** |
| Les deux (vente + location) ensemble | Déjà supporté par le contrat existant (aucun filtre vente/location), s'affichent ensemble si présents dans le state | **Inchangé** — comportement déjà correct, non modifié |
| Non recommandé (`recommande: false`) | Absent de la section (filtre backend `recommande:true`) | **Inchangé** |
| Non publié (`isPublished: false`) ou non validé (`statusAdmin !== 'Validée'`) | Absent (filtre public backend) | **Inchangé — aucun assouplissement de publication** |
| Image string | Résolue correctement (`item.images?.[0]`) | **Inchangé** |
| Image absente (`images: []`) | Fallback `PLACEHOLDER` affiché | **Inchangé** |

## Fichier modifié

`altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` — fonction `onRefresh` (pull-to-refresh) : ajout de `cache.invalidate('recommended:')` et `getRecommendedProperties().then(setRecommended).catch(() => {})`, en plus du comportement existant (inchangé) sur le préfixe `'properties:'`. Aucune autre ligne modifiée. Aucun fichier backend touché.

## Ce qui n'a PAS changé (rappel explicite)

Définition de "recommandé", vente/location, publication, modération, `isPublished`, `statusAdmin`, tenant, ownership, RBAC, commission, classement, pagination, limite de recommandations, structure `images`, endpoint, aucune nouvelle route.
