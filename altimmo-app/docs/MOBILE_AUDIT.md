# Audit mobile statique

## Architecture

Les écrans les plus volumineux sont `DetailAnnonceScreen` (environ 2 000 lignes),
`PublierBienScreen` (environ 1 700), `RegisterScreen` (plus de 1 100) et
`MesAnnoncesScreen` (plus de 900). Ils combinent encore rendu, formatage et orchestration.
La migration vers `src/features` doit rester progressive. Les services API, Socket,
notification et environnement constituent désormais les frontières à conserver.

## Navigation

| Écran | Route | Rôle | Deep link | Fallback |
| --- | --- | --- | --- | --- |
| Annonces | Main > Annonces | authentifié | `/annonces` | liste |
| Détail bien | Main > Annonces > DetailAnnonce | authentifié | `/annonces/:propertyId` | liste |
| Visites | Main > Visites | authentifié | `/visites` | login |
| Messages | Main > Messages | authentifié | `/messages` | login/liste |
| Profil | Main > Profil | authentifié | `/profil` | login |
| Transactions | Main > Profil > Transactions | authentifié | `/paiement/success` | profil |
| Compléter profil | CompleterProfil | nouvel utilisateur | aucun | login |

Les routes sont protégées par la session validée. Les payloads push arbitraires sont
limités à une liste d’écrans publics autorisés. L’autorisation d’une conversation reste
vérifiée par l’API avant d’ouvrir le chat.

## Permissions

| Permission | Usage | Écran | Demande | Fallback |
| --- | --- | --- | --- | --- |
| Notifications | push | après login | actuellement après session | application utilisable sans push |
| Caméra | média d’annonce | publication | contextuelle via module | galerie |
| Photos / médias | annonce et avatar | publication/profil | contextuelle | annulation |
| Localisation précise | carte/adresse | carte/publication | contextuelle | saisie/navigation manuelle |
| Microphone | injecté par camera/AV | aucun enregistrement démontré | non demandée explicitement | à bloquer après test natif |
| Stockage ancien | injecté/config historique | média | selon Android | à retirer lors de validation SDK |

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO` et les descriptions
iOS génériques injectées doivent être revalidés dans une branche native. Ils ne sont pas
supprimés sans test appareil, conformément à la mission.

## Authentification et données

Le token est exclusivement dans Expo Secure Store. AsyncStorage ne contient que des
préférences non sensibles. Un 401 supprime le token, invalide le contexte et déconnecte
Socket.IO. Le logout tente de dissocier le push avant suppression locale. Aucun refresh
token n’est implémenté car le backend n’en expose pas; l’expiration impose une reconnexion.
Le rôle reçu du backend reste la source d’affichage, mais les contrôles réels doivent
rester côté serveur.

## Messagerie, visites et propriétaire

Un seul appel `io()` existe et le socket est partagé. Les écrans utilisent l’API commune.
La messagerie conserve encore sa logique d’état local dans un écran de plus de 800 lignes:
déduplication, retry et pagination doivent être renforcés avec des tests d’intégration.
Les visites et la gestion propriétaire doivent continuer à consommer `status`,
`displayStatus` et `allowedActions` du backend; aucune machine d’états mobile n’a été créée.

## Offline, médias, performance et accessibilité

Les erreurs réseau et timeouts sont normalisés, mais il n’existe pas encore de bannière
réseau globale ni de cache offline cohérent. Les médias passent par les workflows
existants; la compression, le retrait EXIF et la progression nécessitent encore un audit
fonctionnel. `expo-image` est présent. L’inventaire trouve davantage de ScrollView que de
listes virtualisées dans les écrans; toute conversion doit être mesurée. Les tabulations
ont des labels, mais VoiceOver/TalkBack, contrastes, focus et texte agrandi ne sont pas
validés sur appareil.

## Sécurité métier

L’analyse statique ne remplace pas des tests serveur d’isolation. À couvrir avec des
comptes dédiés: propriété/conversation/notification/visite d’un autre utilisateur,
ObjectId invalide, mass assignment, données locataire masquées, URL privée et actions
staff. Le backend reste la frontière de sécurité.
