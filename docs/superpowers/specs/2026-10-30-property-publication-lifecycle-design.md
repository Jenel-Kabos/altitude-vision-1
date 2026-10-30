# Cycle de vie des annonces immobilières — Design

## Intention

Permettre au propriétaire de retirer immédiatement un bien du marché tout en conservant à Altimmo l'autorité exclusive de publication. Une disponibilité déclarée n'est jamais une transaction financière et aucune donnée historique n'est supprimée.

## Approches considérées

1. Réutiliser seulement `availability`, `statusAdmin` et `isPublished`. Écartée : ces champs ne distinguent ni retrait volontaire, ni suspension, ni demande de réactivation.
2. Créer une seconde collection de workflow. Écartée : elle dupliquerait `CommercialPublicationRevision` et créerait deux autorités de version.
3. **Approche retenue :** ajouter à `Property` un état de publication compact et historisé, avec fallback pour les annonces legacy; conserver `CommercialPublicationRevision` comme unique mécanisme de version commerciale.

## États et responsabilités

- `draft` : non soumis.
- `pending` : publication initiale ou réactivation en attente.
- `published` : snapshot courant approuvé et publiable.
- `change_pending` : modification soumise; annonce immédiatement retirée.
- `owner_withdrawn` : retrait volontaire immédiat.
- `admin_suspended` : suspension Altimmo, non annulable par le propriétaire.
- `rejected` : dernière soumission refusée, sans republication de l'ancien snapshot.

Pour les documents sans nouvel état, le système dérive le comportement de `statusAdmin`, `isPublished` et `availability`; aucune migration n'est nécessaire et aucune annonce legacy n'est masquée par défaut.

La disponibilité continue d'utiliser le champ existant : `Disponible`, `Loué`, `Vendu`, `Indisponible`, `Retiré`. Les libellés métier `AVAILABLE/RENTED/SOLD/UNAVAILABLE` sont des équivalences d'API, pas un second champ.

## Transitions

- Création : `pending`, non publiée, révision initiale.
- Modification publiée : nouvelle révision `content_change`, `change_pending`, dépublication atomique.
- Retrait / loué / vendu / indisponible : annule les révisions pendantes, dépublie immédiatement, historise auteur/motif; aucune suppression.
- Réactivation propriétaire : interdite si `admin_suspended`; remet la disponibilité à `Disponible`, crée une révision `reactivation`, passe à `pending`, reste non publiée.
- Approbation Altimmo : seulement révision pendante courante + bien disponible + état admissible; promeut le snapshot et passe à `published`.
- Rejet : passe à `rejected`, conserve les snapshots historiques, reste non publié.
- Suspension Altimmo : annule les révisions pendantes, passe à `admin_suspended`, dépublie.
- Demande de réexamen : journalisée sans lever la suspension.
- Levée de suspension : crée une nouvelle révision `suspension_review`, passe à `pending`; aucune republication automatique.

## Concurrence

Les transitions sont réalisées sous transaction MongoDB. Chaque écriture conditionne l'état courant et, pour les décisions, l'identifiant de la révision active. Un retrait ou une suspension supersède toute révision pendante; une décision sur cette révision devient alors obsolète. Une seule révision pendante par bien reste garantie par l'index existant.

## Accès et exposition

- Propriétaire : mutation seulement de son bien; consultation toujours conservée dans `my-properties`.
- Altimmo : suspension, levée, approbation et rejet sous `platform.commercial.manage` et Vue plateforme.
- Public : uniquement `published`, disponible, `statusAdmin=Validée`, `isPublished=true`; fallback legacy inchangé.
- Nouvelles visites/candidatures : refusées dès que le bien n'est plus commercialisable; dossiers existants inchangés.
- Champs administratifs, propriétaire et tenant restent non modifiables depuis le formulaire.

## Interface

La page propriétaire existante reçoit les actions Loué, Vendu, Indisponible, Retirer et Réactiver. La modération existante reçoit Suspendre, Lever la suspension et les décisions de révision. Aucun nouvel écran global n'est créé.

## Non-objectifs

Aucun paiement, commission, facture, reversement, remboursement, PMS, KYC, IA, marketing, CRM ou nouvelle messagerie. Aucun mouvement automatique sur les visites, candidatures, réservations ou transactions existantes.

## Production

Aucune variable d'environnement. Champs additifs avec fallback legacy, donc aucune migration obligatoire. Une procédure de backfill facultative pourra matérialiser l'état dérivé après observation, mais n'est pas exécutée ici.
