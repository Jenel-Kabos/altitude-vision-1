# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — FLUX RÉEL

## Composant page

`client/lib/pages/dashboard/PublicitesPage.jsx` — page `/dashboard/publicites`, formulaire modal (`renderForm`), champ fichier (`<input type="file" accept="image/*">`, ligne 287), preview locale via `URL.createObjectURL(file)` (ligne 55-60).

## Handler de soumission

`handleSubmit` (ligne 103-129) :
```js
let mediaUrl = formData.media;
if (file) {
  mediaUrl = await uploadToCloudinary(file);
}
if (!mediaUrl) { showNotif("Veuillez sélectionner une image.", "error"); return; }
const payload = { ...formData, media: mediaUrl, ordre: Number(formData.ordre) || 0 };
if (editingId) { await updatePublicite(editingId, payload); }
else { await createPublicite(payload); }
```
**L'upload est `await`é avant tout appel backend** — si `uploadToCloudinary` rejette, le `catch` du bloc englobant intercepte l'erreur et `createPublicite`/`updatePublicite` ne sont jamais atteints. Ce contrat était déjà correct avant ce hotfix (voir `_BEHAVIOR_CONTRACT.md`).

## Fonction d'upload — `client/lib/services/publiciteService.js::uploadToCloudinary`

```js
export const uploadToCloudinary = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: fd },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error('Échec upload Cloudinary');
  return data.secure_url;
};
```
**C'est cette ligne exacte** qui construit l'URL `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`. Aucune autre fonction du frontend web ne construit une URL Cloudinary de ce type (confirmé par grep exhaustif de `client/lib/` et `client/app/` — c'est le SEUL point d'upload direct navigateur→Cloudinary de tout le dashboard web ; toutes les autres surfaces (Property, Hotel, etc.) uploadent via le backend, multer + Cloudinary SDK serveur).

## Appel backend après upload

`createPublicite(payload)` → `POST /publicites`, avec `media: mediaUrl` (l'URL Cloudinary retournée, jamais l'objet `File` brut). Le backend (`server/controllers/publiciteController.js`, non modifié, non audité en détail car hors du chemin fautif) reçoit et stocke cette URL telle quelle.

## Chaîne complète

```
sélection fichier (input type=file)
  → preview locale (URL.createObjectURL, inchangé)
  → soumission formulaire (handleSubmit)
  → uploadToCloudinary(file)
      → FormData { file, upload_preset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET }
      → fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`)
      → { secure_url } OU erreur
  → si succès : createPublicite({ ...formData, media: secure_url })
  → si échec : erreur affichée, createPublicite JAMAIS appelé
```
