# HOTFIX-MOB-GOOGLE-AUTH-3 — PROPRIÉTÉ DE PROJET GOOGLE CLOUD

## Constat : mélange actuel confirmé

**Oui**, l'application mélange actuellement deux projets Google Cloud pour un seul et même flux d'authentification :

- Le **Web Client ID** utilisé par `GoogleSignin.configure({ webClientId })` (mobile) et par `verifyIdToken` (backend local) appartient au projet **Altitude Vision** (`872164120879-…`).
- Le **client OAuth Android** effectivement résolu pour le build distribué via EAS (SHA-1 `62:49:CC:78…`) appartient, selon le contexte fourni par l'utilisateur, au projet **My First Project** (`3869205293-…`) — un projet différent.

C'est exactement le point critique demandé par le mandat (§6) : **oui, il y a mélange**, et c'est la cause directe du `DEVELOPER_ERROR` sur le build EAS (voir `HOTFIX_MOB_GOOGLE_AUTH3_AUTH_FLOW.md` pour le mécanisme exact).

## Le token obtenu via "My First Project" serait-il rejeté par le backend actuel ?

**Question mal posée par construction — et c'est important de le noter** : dans ce mécanisme (`@react-native-google-signin/google-signin` avec `webClientId` uniquement, sans `androidClientId` explicite), l'app n'obtient **jamais** de token émis par "My First Project" tant que le `webClientId` configuré est celui d'"Altitude Vision" — l'échec se produit **avant** l'émission de tout token, au niveau de la résolution native package+SHA-1. Il n'existe donc pas, dans la configuration actuelle, de scénario où un idToken "My First Project" atteindrait le backend Altitude Vision : soit la résolution réussit (et le token porte alors l'audience `872164120879-`, cohérente avec le backend local), soit elle échoue avec `DEVELOPER_ERROR` sans qu'aucun token ne soit produit.

**Cela aurait été différent avant `ALIGN-1`** (quand `webClientId` pointait encore vers "My First Project") : à ce moment-là, un token réussi aurait porté l'audience `3869205293-…`, et le backend local (déjà aligné sur `872164120879-` à un moment donné, ou pas — chronologie exacte non reconstituée avec certitude) aurait pu le rejeter. Ce scénario appartient au passé documenté (`HOTFIX-MOB-GOOGLE-SIGNIN-2`) et n'est plus le mécanisme actif aujourd'hui.

## Preuve explicite : quel projet doit devenir la source canonique

**Altitude Vision (`872164120879-…`) doit être le projet canonique unique pour l'OAuth Google d'Altimmo — mobile, Web et backend confondus.**

Preuves à l'appui (toutes vérifiées par lecture directe du code/configuration, aucune supposition) :

1. **Le Web (NextAuth, `client/.env.local`) utilise déjà exclusivement Altitude Vision** — `HOTFIX-WEB-GOOGLE-AUTH-1` n'a jamais touché à un autre projet, et ce Web Client ID est identique à celui utilisé par le backend et désormais par le mobile.
2. **Le backend local (`server/.env`) a déjà été aligné sur Altitude Vision** par `ALIGN-1` — confirmé par lecture directe dans ce tour (`872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...`, valeur identique au Web et au mobile).
3. **Le mobile (`.env`, 4 profils `eas.json`) a déjà été aligné sur Altitude Vision** par `ALIGN-1` — confirmé par lecture directe dans ce tour, et protégé par un test de régression permanent (`googleProjectAlignment.test.js`, 3 tests, vérifié vert dans ce tour).
4. **Seul le client OAuth Android résolu pour le build EAS reste sur l'ancien projet** ("My First Project") — c'est la seule pièce manquante pour une convergence totale, pas une nouvelle décision architecturale à trancher : la convergence vers Altitude Vision est déjà la trajectoire prise par les trois sprints précédents (`SIGNIN-2` → `ALIGN-1` → ce constat), jamais remise en cause, jamais partie dans l'autre sens.
5. **Le nom "My First Project"** est le nom par défaut attribué par Google Cloud à tout nouveau projet créé sans nom explicite — un indice fort (bien que non une preuve formelle sans accès Console) qu'il s'agit d'un projet créé accidentellement ou à des fins de test isolé, jamais destiné à héberger la production Altimmo, contrairement à "Altitude Vision" dont le nom correspond explicitement à la marque du produit.

## Ce qui reste `NON CONFIRMÉ` (nécessite un accès direct à Google Cloud Console / Render, indisponible dans cette session)

- L'existence et l'exactitude du client OAuth Android sous "My First Project" avec le SHA-1 EAS (`62:49:CC:78…`) — rapportée par l'utilisateur dans le contexte de ce mandat, non vérifiable depuis le code.
- L'existence et l'exactitude du client OAuth Android sous "Altitude Vision" avec le SHA-1 local (`5E:8F:16:06…`) — idem.
- La valeur runtime exacte de `GOOGLE_CLIENT_ID` sur le service Render de production — signalée `NON CONFIRMÉE` depuis `HOTFIX-BACK-GOOGLE-AUTH-401-1`, toujours non résolue à ce jour, **directement pertinente** : même après correction complète côté Android/EAS, un backend de production resté sur l'ancienne audience `3869205293-…` continuerait de rejeter les tokens `872164120879-…` avec un 401, produisant un nouvel échec de connexion Google (différent de `DEVELOPER_ERROR`, mais tout aussi bloquant pour l'utilisateur final).
- Le contenu du fichier local non suivi `client_secret_3869205293-….json` — jamais ouvert (mandat : ne jamais afficher un secret), sa seule utilité ici est de confirmer, par son nom de fichier, qu'un client de type "Desktop"/"Autre" existait aussi sous "My First Project" à un moment donné — sans lien démontré avec le flux mobile actuel (jamais référencé par le code).

## Verdict de propriété

**Altitude Vision (`872164120879-…`) est, avec un haut niveau de confiance fondé sur preuve, le projet canonique cible.** "My First Project" (`3869205293-…`) est un vestige d'une configuration antérieure déjà en cours d'élimination depuis deux sprints précédents, dont il ne reste plus qu'une seule pièce orpheline : le client OAuth Android associé au certificat de signature EAS.
