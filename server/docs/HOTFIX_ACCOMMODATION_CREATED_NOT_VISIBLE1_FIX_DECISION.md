# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Décision de correction

## Correctif appliqué

`server/services/accommodationService.js::createFullAccommodation` — après la création réussie de `Property` + `Accommodation` + `RatePlan` optionnel (aucune étape de création modifiée), ajout d'une étape non bloquante :

```js
if (evaluateReadiness(accommodation, property).ready) {
  try {
    accommodation.publicationStatus = 'soumis';
    accommodation.submittedAt = new Date();
    await accommodation.save();
  } catch (error) {
    logger.error(`Soumission automatique de Accommodation(${accommodation._id}) échouée — reste en brouillon`, error);
    accommodation.publicationStatus = 'brouillon';
    accommodation.submittedAt = null;
  }
}
```

`evaluateReadiness` est **réutilisée telle quelle**, jamais dupliquée (même fonction déjà utilisée par `exports.submit` et par le flux mobile).

## Alternatives considérées et rejetées

| Option | Rejetée parce que |
|---|---|
| Auto-publier directement (`publicationStatus:'publie'`) | Contournerait la modération pour un contenu créé par un rôle qui peut aussi la valider lui-même — le mandat interdit explicitement d'auto-approuver "juste pour que la carte apparaisse" ; aucune preuve que ce soit le contrat voulu (le flux mobile analogue s'arrête à `'soumis'`, pas `'publie'`) |
| Ajouter un lien `/mes-hebergements` dans la sidebar staff + laisser `brouillon` | Change une expérience utilisateur plus large (nouvelle entrée de navigation, nouvelle page visible pour tout le staff) pour un problème dont la cause précise est le point de création lui-même — plus large que "correctif minimal", et n'aligne pas ce point d'entrée sur le pattern déjà existant (mobile) |
| Modifier le message d'état vide pour dire "en brouillon, à soumettre manuellement" | Contredit le contrat déjà prouvé par le flux mobile analogue ; aurait figé un vrai trou de workflow comme s'il était voulu |
| Rendre la soumission bloquante (transaction, échec si `evaluateReadiness` KO) comme le flux mobile | Le flux mobile utilise une vraie transaction Mongo (`mongoose.startSession()`) ; `createFullAccommodation` utilise un pattern de compensation séquentielle explicitement documenté comme n'ayant "aucun précédent" de transaction dans ce chemin de code — introduire une transaction ici est un changement d'architecture plus large que ce hotfix, non nécessaire : laisser l'hébergement incomplet en `brouillon` (état déjà existant, déjà correct) est un résultat sûr et suffisant |

## Pourquoi ce correctif est minimal

- Une seule fonction modifiée (`createFullAccommodation`), un seul point d'entrée affecté (`POST /accommodations/admin`).
- Aucune nouvelle règle de validation, aucun nouveau champ, aucun changement de schéma.
- Réutilise un mécanisme (`evaluateReadiness`) et un statut cible (`'soumis'`) déjà définis, déjà testés, déjà appliqués ailleurs dans le même service.
- Le point d'entrée propriétaire self-service (`exports.create`) n'est pas touché.
- La modération reste un gate réel et non contournable : `reviewDecision` (validation → `'publie'`) est totalement inchangé.
