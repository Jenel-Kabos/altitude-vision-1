# F-U1.J — Audit Cloudinary et conformité KYC

> Document de travail technique. **Ce n'est ni une validation juridique ni une
> autorisation de production.** Le stockage KYC reste désactivé.

Catégories de preuve : **A** = vérifié dans le code / exécution locale ;
**B** = documentation officielle identifiable ; **C** = non vérifié (compte,
contrat ou confirmation prestataire nécessaires).

## 1. Cartographie

| Élément | Constat | Preuve |
|---|---|---|
| Compte | Un seul compte Cloudinary (`config/cloudinary.js`) pour médias publics, documents privés (baux, preuves de paiement, candidatures, messagerie) et KYC. | A |
| Envoi non signé | Un preset non signé est embarqué dans le web et le mobile (annonces, publicités) : tout tiers peut téléverser dans ce compte selon les réglages du preset. | A (présence) / C (réglages) |
| Type KYC | `type: authenticated`, `public_id` `altitude-vision/private/kyc/<case>/<uuid>-<uuid>` (non devinable), aucune transformation entrante (`transformation: ""` vérifié hors ligne via `build_upload_params`). | A |
| Lecture | `private_download_url(..., type: authenticated, expires_at: +60 s)` générée et consommée **côté serveur** ; aucune route ne renvoie d'URL au client ; le client reçoit un flux. | A |
| API download | Supporte `type: authenticated` ; `expires_at` par défaut 1 h ; réponses non mises en cache CDN. | B ([Control access to media](https://cloudinary.com/documentation/control_access_to_media)) |
| Livraison authenticated | Original et dérivés accessibles seulement par URL signée ; pas de transformation à la volée ; **pas de révocation d'une URL signée déjà émise**. | B (même page) |
| Jetons à durée limitée | Plan Advanced ou supérieur, activation par le support. | B (même page) / C (notre plan) |
| Suppression | `destroy` avec `invalidate: true` ; suppression « immédiate et permanente » du stockage ; propagation CDN de quelques secondes à quelques minutes ; **restauration possible depuis la sauvegarde si elle est activée sur le compte**. | A (code) / B ([Delete assets](https://cloudinary.com/documentation/delete_assets.md)) / C (sauvegarde du compte) |
| Sauvegardes | Désactivées par défaut ; si activées, conservent les originaux ; suppression des versions sauvegardées à demander explicitement. | B ([Backups](https://cloudinary.com/documentation/backups_and_version_management)) / C |
| Chiffrement | AES-256 au repos, TLS 1.2+ en transit. | B ([Trust](https://cloudinary.com/trust_03_31_2023)) |
| Certifications | ISO/IEC 27001, 27017, 27018, 27701, SOC 2 Type II déclarées. | B (page Trust, non datée) |
| Localisation | Centres en Amérique du Nord, Europe, Asie-Pacifique ; région effective du compte inconnue. | B / **C** |
| DPA, sous-traitants | DPA « disponible pour les plans payants » ; liste publique des sous-traitants. Version applicable à notre contrat non obtenue. | B ([Sub-processors](https://cloudinary.com/subprocessors)) / **C** |
| Secrets | Aucun secret Cloudinary versionné (`.env.example` vide) ; journal applicatif masque `secret`, `api_key`, `token`. | A |

## 2. Vulnérabilités identifiées et corrigées (périmètre KYC)

| # | Gravité | Constat (preuve A) | Correction |
|---|---|---|---|
| V1 | **Élevée** | `select('+documents.asset')` ne charge pas les champs imbriqués `select:false` (`publicId`, `resourceType`…) : lecture des pièces impossible, et **chaque nouveau dépôt réécrivait le tableau en effaçant les références existantes** (perte de rattachement des objets stockés). Démontré sur MongoDB réel. | Sélection complète `fullAssetSelect` ; test de non-régression (références intactes après remplacements). |
| V2 | Moyenne | Erreur prestataire renvoyée telle quelle (`err.message`) : un message Cloudinary peut contenir le `public_id` ou la chaîne signée. | Erreurs neutralisées (`KYC_DOCUMENT_STORAGE_UNAVAILABLE`), journal limité au code HTTP prestataire. |
| V3 | Moyenne | Réponses JSON KYC sans `no-store` ; document sans CSP. | `Cache-Control: private, no-store`, `Pragma`, `Expires`, `Referrer-Policy` sur toutes les routes KYC (y compris 401) ; `CSP sandbox`, `X-Frame-Options: DENY` sur les pièces. |
| V4 | Moyenne | Organisation : accès à tous les dossiers de ses membres (y compris rédigés par eux seuls) et aux pièces après décision. | Accès limité aux dossiers préparés par l'organisation et encore ouverts. |
| V5 | Moyenne | Signature binaire seule : polyglottes, données après fin, bombes de décompression, PDF actifs ou chiffrés acceptés. | Inspection structurelle (PNG, JPEG, PDF) + analyseur anti-malware obligatoire (absent ⇒ stockage fermé). |
| V6 | Faible | Objet stocké orphelin si l'enregistrement du dépôt échoue et que la suppression échoue (silencieux). | Journal `KycDocumentDisposal` + reprise. |
| V7 | Faible | Doublon de pièce accepté (recto = verso). | Refus `KYC_DOCUMENT_DUPLICATE`. |
| V8 | Faible | Pas de limitation de débit sur la lecture et le dépôt. | Limitation par identité authentifiée. |

**Constat hors périmètre (non corrigé)** : V1 affecte aussi les preuves de
paiement manuel hôtelières (`select('+proof.asset')`, démontré) ; à traiter
dans un lot dédié au domaine financier hôtelier.

## 3. Révocation et URL signées

Une URL signée Cloudinary déjà émise reste utilisable jusqu'à expiration (B).
Pour le KYC, **aucune URL n'est jamais remise au client** (A) : chaque
consultation repasse par l'autorisation serveur, la journalisation et la
limitation de débit ; la révocation d'un droit est donc effective dès la
requête suivante (testée). L'URL interne de 60 s n'existe que le temps du
téléchargement serveur.

## 4. Conservation et purge

- Politique `UNCONFIGURED` tant qu'une durée **et** la référence de la
  décision juridique ne sont pas fournies ; départ à la clôture du dossier.
- Gel légal, demande d'effacement (enregistrée pour examen, jamais exécutée
  automatiquement), simulation par défaut, exécution réelle derrière
  `KYC_PURGE_ENABLED`, preuve prestataire avant retrait de la référence,
  échecs tracés et rejouables.
- **Limites** : les copies de sauvegarde du compte (si activées) ne sont pas
  supprimées par `destroy` ; la purge des caches CDN dépend de l'invalidation
  (minutes) — sans objet pour le KYC qui n'émet aucune URL de livraison.

## 5. Analyse juridique (Congo-Brazzaville) — à valider par un juriste

Source primaire identifiée : **Loi n° 29-2019 du 10 octobre 2019 portant
protection des données à caractère personnel**, Journal officiel n° 45 du
7 novembre 2019 ([JO 2019-45](https://www.sgg.cg/JO/2019/congo-jo-2019-45.pdf)).
Le texte intégral n'a pas été analysé article par article. Résumés
secondaires : [DLA Piper](https://www.dlapiperdataprotection.com/?c=CG&t=law),
[Clym](https://www.clym.io/regulations/law-no-29-2019-congo).

| Question | État |
|---|---|
| Base légale du KYC (contrat, obligation légale, intérêt légitime ?) | À valider |
| Formalités auprès de la Commission (déclaration / autorisation préalable pour données sensibles ou pièces d'identité) | À valider ; statut opérationnel de la Commission incertain selon les sources |
| Transferts hors du Congo (stockage Cloudinary hors Afrique centrale) : conditions et garanties | À valider — **point bloquant** |
| Durée de conservation (lien avec obligations de vigilance financière éventuelles) | À valider |
| Délégué à la protection des données | À valider |
| Notification des violations (délai, destinataires) | À valider |
| Droits : accès, rectification, effacement, opposition | Mécanismes techniques prêts (lecture, mise à jour, demande d'effacement) |
| Entrée en vigueur et sanctions | Divergences entre sources secondaires ; vérifier sur le JO |

## 6. Projet d'information (non publié)

> **Vérification de votre identité — Altimmo**
> Responsable du traitement : Altitude Vision, 24 rue Mfoa, Poto-Poto,
> Brazzaville (RCCM et NIU à confirmer). Contact : [adresse dédiée à définir].
> Finalité : vérifier votre identité avant toute habilitation à des opérations
> financières sensibles, ou pour des opérations financières de propriétaire.
> Données : nom, prénoms, date de naissance (si nécessaire), type, pays
> émetteur et date d'expiration de la pièce, image de la pièce. Le numéro de la
> pièce n'est pas conservé en clair.
> Destinataires : agents Altitude Vision habilités à la vérification ;
> l'organisation qui prépare votre dossier, pour le seul suivi.
> Prestataire : hébergement des images par [Cloudinary, sous réserve de
> validation], susceptible d'impliquer un transfert hors du Congo [garanties à
> préciser].
> Conservation : [durée à fixer par décision juridique] à compter de la
> clôture du dossier, sauf obligation légale ou contentieux.
> Vos droits : accès, rectification, effacement, opposition selon la loi
> n° 29-2019 ; réclamation auprès de l'autorité compétente.

## 7. Protocole de test Cloudinary (non exécuté)

Sur un **environnement produit séparé**, jamais le compte de production, avec
des images fictives :
1. Téléverser en `authenticated` via `secureStorageService` ; vérifier que
   l'URL de livraison non signée et l'URL `/upload/` renvoient 401/404.
2. Générer `private_download_url` (60 s) ; vérifier l'accès, puis le refus après
   expiration.
3. Tenter une transformation à la volée non signée : refus attendu.
4. Vérifier le preset non signé : impossibilité de produire un `authenticated`
   ou d'écrire sous `altitude-vision/private/kyc`.
5. `destroy` + `invalidate` ; vérifier l'absence via Admin API et l'état des
   sauvegardes (si activées : purge des versions sauvegardées).
6. Relever la région de stockage du compte et l'état « strict transformations ».

## 8. Verdict

**CLOUDINARY ADMISSIBLE SOUS CONDITIONS** — sécurité applicative adaptée (A) ;
garanties prestataire plausibles mais non contractualisées pour notre compte ;
conformité juridique non établie. Conditions : DPA signé et localisation
confirmée ; environnement produit dédié au KYC sans preset non signé ;
sauvegardes désactivées ou incluses dans la purge ; protocole §7 réussi ;
analyseur anti-malware intégré ; décisions juridiques §5 (transferts,
formalités, conservation).
