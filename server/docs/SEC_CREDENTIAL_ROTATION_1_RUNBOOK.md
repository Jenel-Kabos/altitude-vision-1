# SEC-CREDENTIAL-ROTATION-1 — Runbook de rotation

Ce document décrit la procédure de rotation MANUELLE que l'opérateur humain doit exécuter côté fournisseurs. Claude Code ne réalise aucune de ces actions.

Référence inventaire : `server/docs/SEC_CREDENTIAL_ROTATION_1_INVENTORY.md`

## Matrice des services

| Secret | Server | Web | Mobile | Render | Netlify | EAS | Restart required |
|---|---|---|---|---|---|---|---|
| `ZOHO_CLIENT_ID` | ✓ | – | – | ✓ (var d'env) | – | – | Oui (backend) |
| `ZOHO_CLIENT_SECRET` | ✓ | – | – | ✓ | – | – | Oui (backend) |
| `ZOHO_REFRESH_TOKEN` | ✓ | – | – | ✓ | – | – | Oui (backend) |
| `JWT_SECRET` | ✓ | – | – | ✓ | – | – | Oui (backend), déconnexion globale de tous les utilisateurs |
| `CLOUDINARY_API_KEY`/`SECRET` | ✓ | – | – | ✓ | – | – | Oui (backend) |
| `FACEBOOK_ACCESS_TOKEN` | ✓ (cron uniquement) | – | – | ✓ | – | – | Oui (backend), impacte le cron Facebook horaire |
| `CINETPAY_API_KEY`/`SITE_ID` | ✓ | – | – | ✓ | – | – | Oui (backend), impacte les paiements en cours |
| `GOOGLE_MAPS_API_KEY` | – | – | ✓ (natif, injecté au build) | – | – | ✓ (secret EAS + rebuild) | Rebuild + republication mobile requis (pas un simple redémarrage) |
| `MONGO_URI` | ✓ | – | – | ✓ | – | – | Déjà fait — confirmer révocation ancien utilisateur Atlas |
| `CLOUDINARY_CLOUD_NAME` | ✓ | ✓ (`NEXT_PUBLIC_*`) | ✓ (public) | ✓ | ✓ | ✓ | Non — identifiant public, pas de rotation |

## Ordre de rotation recommandé

L'ordre par défaut de la mission (préparation → externes sans interruption → Zoho → Facebook → Google → Cloudinary → CinetPay → JWT en dernier) est confirmé pertinent après audit — aucune dépendance croisée trouvée entre ces credentials qui imposerait un ordre différent. Le seul impératif technique est de traiter `JWT_SECRET` **en dernier** et dans une fenêtre annoncée, car c'est le seul changement qui a un effet utilisateur immédiat et visible (déconnexion globale).

1. **Préparation** — ce document + inventaire, aucune interruption de service.
2. **Zoho** (impact limité : emails transactionnels et sync IMAP, tolère quelques minutes d'interruption).
3. **Facebook** (impact limité : cron horaire de synchronisation de posts, aucune interaction utilisateur temps réel).
4. **CinetPay** (impact paiement — préférer une fenêtre de faible trafic).
5. **Cloudinary** (impact upload/affichage d'images — préférer une fenêtre de faible trafic).
6. **Google Maps** (nécessite un rebuild EAS mobile, pas un simple redémarrage — planifier séparément, non bloquant pour le reste).
7. **MongoDB** — déjà fait ; ce sprint se limite à documenter la nécessité de confirmer la révocation de l'ancien utilisateur Atlas.
8. **JWT_SECRET en dernier**, fenêtre annoncée, déconnexion globale acceptée délibérément.

---

## A. ZOHO

### PREPARATION
- Confirmer l'accès à la console développeur Zoho (API Console / Zoho Developer Console) associée au compte `contact@altitudevision.agency`.
- Identifier l'application OAuth existante utilisée par `zohoMailService.js` (flux `grant_type=refresh_token` standard, `accounts.zoho.com/oauth/v2`).

### HUMAN PROVIDER ACTION
1. Dans la console Zoho, régénérer le **client secret** de l'application OAuth existante.
2. Générer un **nouveau refresh token** en refaisant le flux d'autorisation OAuth (redirection + code d'autorisation → échange contre un nouveau refresh token). Ceci invalide implicitement l'ancien refresh token pour cette application.
3. **Client ID** : ne pas recréer l'application sauf si la console Zoho ne permet pas de régénérer le secret sans recréer l'app entière — à déterminer sur place. Si l'app est recréée, le Client ID changera aussi ; documenter le nouveau.
4. Confirmer dans l'interface Zoho que l'ancienne autorisation OAuth n'apparaît plus comme active (section "Connected Apps" ou équivalent du compte Zoho).

### ENV UPDATE
- Mettre à jour `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (et `ZOHO_CLIENT_ID` si recréé) dans le coffre Render (variables d'environnement du service backend) et dans `server/.env` local si nécessaire au développement.

### SERVICE RESTART
- Redémarrer le service backend Render pour recharger les variables d'environnement (`zohoMailService.js` les lit au démarrage via `process.env`, pas de hot-reload).

### VALIDATION
- Vérifier qu'un appel non destructif au endpoint `getAccessToken()`/`getOrganizationInfo()` réussit avec les nouvelles valeurs (script existant `getZohoOrgId.js`, à exécuter manuellement par l'opérateur avec les nouvelles variables chargées — pas par Claude Code).
- Ne jamais envoyer d'email réel pour valider.

### ROLLBACK
- Si la nouvelle configuration échoue, aucune action automatique : contacter le support Zoho, l'ancienne autorisation étant déjà invalidée par la régénération (pas de retour en arrière possible côté Zoho après régénération). Prévoir un compte de test Zoho de secours si la fenêtre de rotation doit être fiabilisée.

---

## B. JWT_SECRET

### Mécanisme actuel (confirmé par lecture de code)
- Signature : `jsonwebtoken`, `jwt.sign({id, tokenVersion}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN})` (`server/utils/generateToken.js`).
- Expiration par défaut : `90d` si `JWT_EXPIRES_IN` non défini (`authController.js`).
- `tokenVersion` : mécanisme d'invalidation **par utilisateur** (incrémenté en base pour forcer une déconnexion individuelle) — indépendant de `JWT_SECRET` et ne remplace pas une rotation de secret.
- Consommateurs de la vérification : `server/middleware/authMiddleware.js` (routes HTTP), `server/socket.js` (connexions Socket.IO).
- Web et Mobile envoient tous deux le token via `Authorization: Bearer <token>` (pas de cookie httpOnly identifié dans le code audité) — donc pas de session serveur à purger séparément, uniquement le token côté client à invalider par la rotation.

### Conséquence confirmée d'une rotation
Une rotation de `JWT_SECRET` invalide **immédiatement et globalement** tous les tokens signés avec l'ancienne valeur, quel que soit leur `tokenVersion` — la vérification de signature échoue avant même que `tokenVersion` soit consulté. **Ne pas tenter de faire accepter l'ancien secret en parallèle du nouveau** (ex. vérification avec une liste de secrets valides) : la mission est explicite, la sécurité prime sur la continuité de session. Tous les utilisateurs Web et Mobile devront se reconnecter.

### JWT ROTATION WINDOW (procédure)
1. **Annoncer une fenêtre de maintenance courte** si le produit a des utilisateurs actifs à l'heure de la rotation (bannière ou notification, à la discrétion du responsable produit — hors périmètre technique de ce runbook).
2. **HUMAN PROVIDER ACTION** : générer une nouvelle valeur aléatoire de haute entropie (ex. `openssl rand -base64 48`) pour `JWT_SECRET`. Ne pas réutiliser ou dériver l'ancienne valeur.
3. **ENV UPDATE** : remplacer `JWT_SECRET` dans le coffre Render.
4. **SERVICE RESTART** : redémarrer proprement le backend (pas de rolling restart avec ancienne + nouvelle instance simultanées si évitable, pour éviter une fenêtre où deux secrets différents seraient actifs en même temps sur des instances différentes).
5. **VALIDATION** : après redémarrage, vérifier qu'un ancien token (émis avant rotation) est rejeté (401) et qu'une nouvelle authentification (login) produit un token accepté par les routes protégées.
6. **Web** : vérifier qu'un utilisateur déconnecté peut se reconnecter normalement et que `localStorage` ne contient plus qu'un token invalide qui sera remplacé au prochain login.
7. **Mobile** : idem, vérifier que l'app gère proprement un 401 sur l'ancien token (redirection vers login, pas de crash).
8. **Socket.IO** : vérifier que les connexions existantes avec l'ancien token sont coupées et qu'une nouvelle connexion avec un token frais est acceptée.

### ROLLBACK
- Un rollback de `JWT_SECRET` vers l'ancienne valeur **annulerait la rotation de sécurité** — à n'envisager qu'en cas d'incident opérationnel majeur bloquant totalement l'authentification, et uniquement de façon très temporaire le temps de résoudre un bug de déploiement (pas pour éviter la déconnexion des utilisateurs, qui est un effet attendu et accepté).

---

## C. CLOUDINARY

**Compte concerné : `dop8vzm5z` (production connue du projet). Aucune opération d'asset (upload/rename/destroy/migration) ne doit être effectuée pendant ce sprint, avant ou après rotation.**

### Distinction confirmée par audit
- `CLOUDINARY_CLOUD_NAME` : identifiant non secret, utilisé aussi côté client (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`) et mobile (preset upload unsigned) — **ne pas changer**, aucune rotation nécessaire.
- `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` : credentials serveur uniquement (`server/config/cloudinary.js`), jamais exposés côté client — **rotation obligatoire**.

### PREPARATION
- Identifier dans la console Cloudinary (compte `dop8vzm5z`) la section de régénération d'API secret.

### HUMAN PROVIDER ACTION
1. Régénérer l'API secret depuis la console Cloudinary.
2. Si possible, régénérer également l'API key (recommandé mais vérifier l'impact sur d'éventuelles intégrations tierces déjà configurées avec l'ancienne clé, ce qui n'a pas pu être audité depuis ce dépôt).

### ENV UPDATE
- Mettre à jour `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` dans le coffre Render. Ne pas toucher `CLOUDINARY_CLOUD_NAME`.

### SERVICE RESTART
- Redémarrer le backend Render (`cloudinary.config()` est appelé au chargement du module).

### VALIDATION
- Vérifier uniquement que la configuration se charge sans erreur (`server/config/cloudinaryProductionFingerprint.js` peut aider à confirmer que le `cloud_name` actif correspond toujours à la production attendue). **Aucune opération d'upload/rename/destroy réelle.**

### ROLLBACK
- Conserver l'ancienne clé notée par l'opérateur humain (hors dépôt) pendant une courte fenêtre en cas de besoin de retour arrière immédiat, puis la détruire définitivement après confirmation que la nouvelle configuration fonctionne.

---

## D. FACEBOOK

### Type de token à déterminer par l'opérateur
Le code (`server/scripts/sync-facebook.js`) consomme `FACEBOOK_ACCESS_TOKEN` pour lire les posts d'une page via l'API Graph, dans un cron horaire. Le code ne permet pas de déterminer avec certitude s'il s'agit d'un token utilisateur, un token de page, ou un token longue durée — **à vérifier dans Meta for Developers** (type affiché dans le Graph API Explorer ou la configuration de l'app).

### HUMAN PROVIDER ACTION
1. Dans Meta for Developers, révoquer/régénérer le token existant associé à la page Facebook utilisée.
2. Si le token est un token utilisateur de courte durée converti manuellement, envisager de migrer vers un token de page longue durée (recommandation, pas une obligation de ce sprint) pour réduire la fréquence de rotation future — décision produit, pas technique.

### ENV UPDATE
- Mettre à jour `FACEBOOK_ACCESS_TOKEN` dans le coffre Render.

### SERVICE RESTART
- Redémarrer le backend (le cron relit `process.env` au prochain tick après redémarrage).

### VALIDATION
- Ne publier aucun contenu. Le prochain tick du cron horaire de synchronisation effectuera une lecture normale des posts si le token est valide — surveiller les logs applicatifs pour confirmer l'absence d'erreur d'authentification, sans déclencher manuellement d'appel supplémentaire.

### ROLLBACK
- Revenir à l'ancien token uniquement s'il n'a pas encore été révoqué côté Meta — sinon, aucun rollback possible, seule une nouvelle régénération.

---

## E. CINETPAY

### PREPARATION
Traité comme credential financier critique conformément à la mission. `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` sont tous deux consommés par `server/controllers/cinetpayController.js` et `server/controllers/paiementTransactionController.js`.

### HUMAN PROVIDER ACTION
1. Contacter le support CinetPay (l'interface self-service ne permet pas nécessairement la régénération autonome de l'API key — à confirmer par l'opérateur).
2. Demander explicitement la révocation de l'ancienne API key exposée.
3. `SITE_ID` : documenter s'il s'agit d'un identifiant de site rotatable ou d'un identifiant fixe associé au compte marchand — **ne pas exiger sa rotation si CinetPay le traite comme non rotatable**, mais le signaler au support par prudence puisqu'il a été exposé conjointement avec l'API key.

### ENV UPDATE
- Mettre à jour `CINETPAY_API_KEY` (et `CINETPAY_SITE_ID` si effectivement renouvelé) dans le coffre Render.

### SERVICE RESTART
- Redémarrer le backend.

### VALIDATION
- Aucune transaction réelle. Utiliser exclusivement les tests/mocks existants (`server/__tests__/transactionPaymentAuthorization.test.js`) pour vérifier que le contrôleur charge correctement la nouvelle configuration.

### ROLLBACK
- Idem Cloudinary : conserver l'ancienne clé hors dépôt le temps de valider la nouvelle, puis la détruire.

---

## F. GOOGLE MAPS

### Configuration confirmée par audit
`GOOGLE_MAPS_API_KEY` est lu directement (sans préfixe `EXPO_PUBLIC_`) par `altimmo-app/app.config.js` et injecté dans la configuration Android native **au moment du build EAS**, pas au runtime JS — donc un changement de valeur nécessite un **nouveau build EAS et une republication**, pas seulement un redémarrage.

### HUMAN PROVIDER ACTION
1. Dans Google Cloud Console, régénérer la clé API Maps.
2. **Appliquer des restrictions** sur la nouvelle clé avant toute republication : restriction par package Android (`com.altitudevision.altimmo` ou équivalent réel du projet) et empreinte SHA-1/SHA-256 de signature, restriction des API activées (Maps SDK for Android uniquement, pas toutes les API Google).
3. Ne pas supposer que ces restrictions étaient déjà en place sur l'ancienne clé —à vérifier/documenter, pas à supposer acquis (conformément à la mission).

### ENV UPDATE
- Mettre à jour le secret via `eas secret:create` (ou équivalent tableau de bord EAS) — jamais en clair dans `eas.json` ou `app.config.js`.

### SERVICE RESTART → REBUILD
- Un `eas build -p android --profile production` est nécessaire pour que la nouvelle clé soit effective (pas de hot-reload possible pour une clé native).

### VALIDATION
- Vérifier uniquement la présence de la nouvelle configuration dans le build (pas de test cartographique réel en production nécessaire pour ce sprint).

### ROLLBACK
- Revenir à l'ancienne clé uniquement si elle n'a pas encore été révoquée — sinon, nouveau build avec une nouvelle clé.

---

## G. MONGODB (MONGO_URI)

Déjà rotée (fingerprint `DIFFERENT` confirmé en section précédente). Action restante :
- **HUMAN PROVIDER ACTION** : dans MongoDB Atlas, confirmer que l'ancien utilisateur de base de données (associé à l'ancien `MONGO_URI`) est bien désactivé ou supprimé, pas seulement remplacé par un nouvel utilisateur en parallèle. Ceci n'est pas vérifiable depuis cet environnement (aucune connexion Atlas n'a été établie par cette session, conformément à l'interdiction de connexion automatique à Mongo production).
- Documenter la confirmation humaine dans le rapport final une fois obtenue.

---

## Résumé — checkpoint humain

Toutes les actions ci-dessus sont à la charge de l'opérateur humain. Ce runbook ne doit pas être exécuté automatiquement par Claude Code. Voir `SEC_CREDENTIAL_ROTATION_1_REPORT.md` pour le statut `READY FOR HUMAN CREDENTIAL ROTATION`.
