# UX-OWNER-3 — État initial

Date : 2026-08-18. Branche `main`.

## 1. Baseline Git

```
git status --short   → (vide)
git branch --show-current → main
git rev-parse HEAD   → bb8ab83cbf36ac73d5e3e2e1571633567f8438cf
git diff --check     → exit 0
git diff --stat       → (vide)
```
**HEAD a changé** depuis la clôture d'UX-OWNER-2 (`1462ea748cd032523c575a4387ae7048a99e9c21` → `bb8ab83cbf36ac73d5e3e2e1571633567f8438cf`). Vérifié : commit externe `bb8ab83` (« Update Altimmo 28 »), auteur `Altitudevision <altitudevis3n@gmail.com>`, `Tue Aug 18 14:53:32 2026 +0100` — contenu du commit vérifié fichier par fichier (`git show --stat`) : capture **exactement** l'ensemble des fichiers créés/modifiés par la session UX-OWNER-2 précédente (routes/contrôleurs sale/rental property, formulaires Owner, tests, docs UX_OWNER1/2). Même schéma déjà documenté et confirmé dans `HOTFIX_MSG_STAFF_INBOX1_REPORT.md` §42 et implicitement entre UX-OWNER-1/2 : un outillage externe à cette session commite périodiquement l'arbre de travail. **Cette session n'a exécuté aucun `git add`/`commit`/`push`.**

## 2. Rapports lus

`UX_OWNER1_REPORT.md`, `UX_OWNER2_REPORT.md` (déjà en mémoire de session, relus pour ce sprint), `AUDIT_AUTH_RUNTIME_TENANT_REPORT.md` (référence « AUTH-1.1 »), `IAM2_ARCHITECTURE_REPORT.md`, `IAM3_STAFF_PERMISSIONS_REPORT.md`, `DASH1_REPORT.md`, `DASH2_OWNER_REPORT.md`.

**Point clé d'AUDIT_AUTH_RUNTIME_TENANT_REPORT.md** : ce rapport concerne le runtime `PlatformTenantRuntimeContext`/`PlatformTenantRuntimeProvider`, un mécanisme de sélection de **tenant SaaS pour le STAFF/PlatformOperator** (§4-8 de ce rapport). Il documente explicitement (§8) : « Les utilisateurs ordinaires ne sont pas bloqués : leur tenant est résolu côté backend par membership unique/explicite. » **Ce mécanisme est distinct de ce qui est observé dans ce sprint** — vérifié ci-dessous, le bloc « Espace de travail » du dashboard Owner ne vient PAS de ce runtime tenant, mais d'un composant propre à `OwnerDashboard.jsx` portant sur les **profils métier** (`businessProfiles`), une notion différente de `PlatformTenant`.

## 3. Deux sources de menu — recherche des chaînes exactes

Toutes les chaînes citées dans le mandat proviennent d'un **unique** fichier, `client/lib/pages/dashboard/OwnerDashboard.jsx` (`NAV_LINKS`, déjà lu en détail lors d'UX-OWNER-1/2), et d'un **unique** composant partagé, `client/lib/components/dashboard/DashboardUI.jsx` (`DashboardContextSwitcher`). **Il n'existe pas deux dashboards distincts** — un seul composant, deux valeurs successives d'un même état React (`businessProfiles`).

### `DashboardContextSwitcher` (DashboardUI.jsx:74-87)
```jsx
export const DashboardContextSwitcher = ({ label = "Espace de travail", value, options, onChange, loading = false }) => (
  <label className="dashboard-context-switcher">
    <span>{label}</span>
    <select ... disabled={loading || options.length < 2}>
      {loading && <option value="">Chargement…</option>}
      {!loading && options.length === 0 && <option value="">Aucun espace disponible</option>}
      {options.map(...)}
    </select>
  </label>
);
```
Source EXACTE des 3 chaînes « Espace de travail » / « Chargement… » / « Aucun espace disponible ». `loading` et `options` sont transmis par l'appelant — pas de logique métier interne à ce composant.

### `OwnerDashboard.jsx` — appelant (déjà lu intégralement en UX-OWNER-1/2, revérifié)
```jsx
const { logout, user, businessProfiles, isProprietaireImmobilier, isExploitantEtablissement } = useAuth();
const profileOptions = businessProfiles === null ? [] : [
  isProprietaireImmobilier && { value: 'patrimoine', label: 'Patrimoine immobilier' },
  isExploitantEtablissement && { value: 'etablissement', label: "Exploitation d'établissement" },
].filter(Boolean);
...
const visibleNavLinks = businessProfiles === null ? NAV_LINKS : NAV_LINKS.filter(({ profile }) => {
  if (!profile) return true;
  if (profile === 'proprietaire_immobilier') return isProprietaireImmobilier && activeContext === 'patrimoine';
  return isExploitantEtablissement && activeContext === 'etablissement';
});
...
<DashboardContextSwitcher value={activeContext} options={profileOptions}
  loading={businessProfiles === null}
  onChange={...} />
```
`NAV_LINKS` porte un champ `profile` (`'proprietaire_immobilier' | 'exploitant_etablissement' | null`) par entrée — les entrées `profile: null` (Messages, Profil, Sécurité) **ne sont jamais filtrées**, quel que soit l'état.

## 4. Mécanique exacte des deux états — prouvée par le code, pas supposée

| | `businessProfiles` | `visibleNavLinks` | `DashboardContextSwitcher` |
|---|---|---|---|
| **État 1** (mandat) | `null` (valeur initiale, pas encore résolu) | `NAV_LINKS` intégral — **AUCUN filtre appliqué**, toutes les sections rendues sans condition | `loading=true` → « Chargement… » |
| **État 2** (mandat) | `[]` (résolu, tableau vide) | Filtré : seules les entrées `profile: null` passent (`isProprietaireImmobilier`/`isExploitantEtablissement` toutes deux `false`) | `loading=false`, `options.length===0` → « Aucun espace disponible » |

**Il s'agit du MÊME composant `OwnerDashboard.jsx`, un seul rendu conditionnel sur une seule variable d'état (`businessProfiles`), jamais deux dashboards.**

## 5. Origine de `businessProfiles` — AuthContext.jsx

```js
const [businessProfiles, setBusinessProfiles] = useState(null); // ligne 45
...
useEffect(() => {                                                  // lignes 178-186
  const userId = user?._id || user?.id;
  if (!userId) { setBusinessProfiles(user ? [] : null); return; }
  let cancelled = false;
  getEffectiveProfiles(userId)
    .then((profiles) => { if (!cancelled) setBusinessProfiles(profiles); })
    .catch(() => { if (!cancelled) setBusinessProfiles([]); });   // ← échec silencieux = []
  return () => { cancelled = true; };
}, [user?._id, user?.id]);
```
**Fait établi, pas supposé** : `businessProfiles` part TOUJOURS à `null` au montage (avant que `user` soit connu), passe à `null`→`[...]` ou `null`→`[]` de façon strictement asynchrone après le premier rendu — jamais résolu de façon synchrone/SSR. Le flash État1→État2 est donc **structurellement garanti pour TOUT propriétaire**, y compris un propriétaire avec de vraies ressources — pas seulement pour un compte sans ressource. Point à vérifier au navigateur (§7 mandat / §9 ci-dessous) : le flash disparaît-il une fois résolu avec un JEU DE DONNÉES RÉEL (résolution vers un menu riche plutôt que vide) ?

**Fait à risque identifié, pas encore prouvé** : le `.catch(() => setBusinessProfiles([]))` rend **indiscernables** deux cas très différents : (a) l'utilisateur n'a réellement aucune Property/Hotel/HotelStaffAssignment/Locataire, et (b) l'appel réseau/backend a échoué pour une tout autre raison (erreur serveur, timeout, bug). Dans les deux cas, l'UI affiche « Aucun espace disponible » — un message qui, dans le cas (b), serait trompeur. À vérifier empiriquement (Network tab / logs) pour le compte réellement observé (§37 Q8 du mandat).

## 6. `getEffectiveProfiles` — backend, lu intégralement (déjà audité une fois pour ce sprint)

`server/services/userBusinessProfileService.js:137-140` :
```js
async function getEffectiveProfiles(userId) {
  const [stored, derived] = await Promise.all([getActiveProfiles(userId), deriveProfilesFromExistingData(userId)]);
  return [...new Set([...stored, ...derived])];
}
```
`deriveProfilesFromExistingData` (lignes 114-130) : `proprietaire_immobilier` dérivé de `Property.exists({ owner: userId, status: {$in:['vente','location']} })` — **jamais d'un `PlatformTenant`, d'un `OrgMembership` ou d'un workspace SaaS**. Confirme, par le code, que le modèle métier réel est bien `ownership` (`Property.owner`), pas `tenant` (répond par avance à la question centrale du mandat §5-7).

Route `GET /api/user-business-profiles/:userId` (`userBusinessProfileRoutes.js:35-39, 55`) : `selfOrStaff` — pour un appel **self** (l'utilisateur demande son propre profil, cas exact du dashboard Owner), passage direct à `next()`, **aucune frontière tenant appliquée**. Confirme qu'aucune dépendance tenant/workspace n'est imposée par le backend pour cette lecture — cohérent avec la conclusion attendue du mandat §7.

## 7. Réponse préliminaire (à confirmer au navigateur) aux questions centrales du mandat

- **« Espace de travail » = quoi exactement ?** Ni `PlatformTenant`, ni `OrgMembership`, ni établissement — c'est un sélecteur d'ACTIVITÉ (`activeContext`, `'patrimoine' | 'etablissement'`) entre les profils métier USER-ARCH-1 (`businessProfiles`) d'un même utilisateur multi-activité. Nom exact dans le code : aucun nom de modèle dédié — c'est une donnée dérivée en mémoire (`profileOptions`), jamais persistée côté backend sous ce nom.
- **Un propriétaire immobilier a-t-il besoin d'un workspace/tenant pour accéder à ses biens ?** Non, structurellement — confirmé par lecture de `deriveProfilesFromExistingData` (ownership pur) et par `propertyRoutes.js`/`propertyController.js` (déjà audités UX-OWNER-2 : `Property.owner === req.user.id`, jamais de frontière tenant pour Owner). `/mes-biens` lui-même (`OwnerPropertyManagement.jsx`, `getMyProperties()`) n'a **aucune dépendance à `businessProfiles`** — sa donnée est indépendante.
- **`/mes-biens` repose-t-il sur ownership ou tenant ?** Ownership pur, confirmé.

## 8. Ce qui reste à prouver au navigateur (pas déductible du seul code)

1. Le flash État1→État2 se produit-il aussi pour un propriétaire avec de VRAIES ressources (résolution vers un menu riche, pas vide) — confirmant que le bug est le rendu non-filtré pendant le chargement, indépendamment du résultat final ?
2. Pour un compte qui termine en État 2 (menu réduit), est-ce parce que `businessProfiles` résout légitimement à `[]` (aucune Property/Hotel réelle), ou parce que l'appel réseau échoue silencieusement (`.catch`) malgré des données réelles ?
3. Ordre et statut HTTP réel des appels réseau au chargement de `/mes-biens` (Network tab).
4. Stabilité au hard refresh, à la navigation interne, au logout/login (stale state).
5. Interaction avec `localStorage` (AUTH-1.1 concerne le tenant STAFF — vérifier qu'aucune clé `localStorage` liée n'affecte `businessProfiles`, qui n'en lit aucune d'après le code déjà lu — à confirmer qu'aucun autre mécanisme ne interfère).

Suite : matrice par profil, tests navigateur réels, correction minimale — voir `UX_OWNER3_DASHBOARD_STATE_REPORT.md`.
