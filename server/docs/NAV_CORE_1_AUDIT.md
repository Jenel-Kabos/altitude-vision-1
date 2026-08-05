# NAV-CORE-1 — Audit initial de navigation

Date de l'audit : 2026-08-05

## Périmètre inspecté

- routes Next.js (`client/app`) et redirections historiques `Altimmo`, `Mila Events`, `Altcom` ;
- navigateurs React Navigation, linking Expo, schéma iOS et intent filters Android ;
- producteurs, modèle, socket et push Expo des notifications backend ;
- consommateurs de notifications Web et Mobile ;
- routes liées aux annonces, visites, paiements, dossiers immobiliers, hôtellerie et gestion locative.

## État avant correction

La navigation ne possède pas de source unique. L'audit relève 509 appels ou littéraux de navigation répartis dans le Web, le Mobile et le Backend. Ce total inclut les usages UI normaux ; le défaut architectural concerne surtout les destinations métier recopiées dans plusieurs tables.

1. `server/services/notificationService.js` contient deux tables `type -> URL`, séparées entre utilisateurs et staff.
2. `client/lib/components/notifications/NotificationBell.jsx` maintient ses propres tables de secours et choisit entre `link`, `data.webPath` et ces tables.
3. `altimmo-app/src/services/notificationsService.js` maintient une table `type -> écran` pour les push.
4. `altimmo-app/src/screens/Notifications/NotificationsScreen.jsx` possède une seconde table mobile, différente de la précédente.
5. `altimmo-app/src/navigation/AppNavigator.jsx` décrit les chemins entrants indépendamment de `app.config.js`.
6. `app.config.js` ne déclare qu'un intent filter `/annonces`, alors que le linking JS accepte aussi visites, messages, profil, paiements et dossiers.
7. Les payloads ne sont pas homogènes : selon le producteur, la destination est portée par `link`, `data.webPath`, `data.screen`, le type de notification ou aucun champ explicite.

## Incohérences et risques observés

- Une même notification peut ouvrir des écrans différents selon qu'elle est touchée depuis un push ou depuis la liste interne.
- `visite_auto_cancelled_owner` pointe vers `/mes-biens/visites` côté backend mais vers `/mes-visites` dans le fallback Web.
- Les notifications de dossiers immobiliers possèdent des variantes liste/détail sur Mobile, sans contrat commun avec le Web.
- Les routes staff et client d'un même événement ne sont pas interchangeables ; une résolution sans rôle peut contourner l'intention RBAC ou envoyer vers une page inutilisable.
- La gestion locative Web n'a pas d'équivalent mobile actuel. Lui attribuer un écran mobile serait une route fictive.
- Les liens natifs ne couvrent pas la totalité des chemins déjà interprétés par React Navigation.
- Les producteurs historiques qui fournissent uniquement `data.screen` restent nombreux : une migration brutale casserait les notifications déjà persistées et les anciennes versions de l'app.

## Décision de migration

Le correctif introduit un registre canonique partagé et trois adaptateurs (Backend, Web, Mobile). Les nouveaux payloads portent `type`, `destination`, `entityType` et `entityId`. Les champs historiques `link`, `data.webPath`, `data.screen` et `data.params` sont conservés et calculés par le Backend pour la compatibilité descendante. Les consommateurs résolvent d'abord `destination`, puis leurs anciennes données.

La migration est progressive : seuls les points centraux sont modifiés dans ce sprint. Les appels UI ordinaires restent en place lorsqu'ils ne représentent pas une destination métier partagée. Aucune URL existante, redirection Next.js ou route React Navigation n'est supprimée.

