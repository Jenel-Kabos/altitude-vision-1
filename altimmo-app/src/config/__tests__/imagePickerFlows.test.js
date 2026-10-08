/* eslint-env node, jest */
// GOOGLE-PLAY-R2.1 · PLAYPERM-02 — les sélections d'images n'exigent aucune
// permission galerie : `launchImageLibraryAsync` ouvre le sélecteur système
// (Android : AndroidX PickVisualMedia ; iOS : PHPicker) et ne renvoie que les
// éléments choisis. Aucun flux ne doit demander l'accès à toute la galerie.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
  return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
});

const PICKER_FLOWS = [
  'components/publication/PhotoManager.jsx',
  'screens/Profil/ProfilScreen.jsx',
  'screens/Publication/PublierBienScreen.jsx',
  'screens/TenantPortal/TenantPortalScreen.jsx',
  'screens/Messagerie/ChatScreen.jsx',
];

test('PLAYPERM-02 — aucun flux applicatif ne demande la permission galerie', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => /requestMediaLibraryPermissionsAsync|getMediaLibraryPermissionsAsync|useMediaLibraryPermissions/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC, file));
  expect(offenders).toEqual([]);
});

test.each(PICKER_FLOWS)('%s ouvre toujours le sélecteur système (launchImageLibraryAsync)', (file) => {
  expect(fs.readFileSync(path.join(SRC, file), 'utf8')).toMatch(/launchImageLibraryAsync\(/);
});

test('aucun flux ne lance la caméra', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => /launchCameraAsync|from 'expo-camera'|useCameraPermissions|requestCameraPermissionsAsync/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC, file));
  expect(offenders).toEqual([]);
});
