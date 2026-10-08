/* eslint-env node, jest */
// GOOGLE-PLAY-R2 — manifest Android effectif (prebuild Expo résolu depuis
// app.config.js + plugins). L'application ne lit l'audio qu'en premier plan
// (messages vocaux du chat) : aucun service de premier plan « mediaPlayback »
// ne doit être déclaré, sinon Google Play exige une déclaration FGS justifiée.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.setTimeout(180000);

// EAS part d'un prebuild PROPRE (android/ et ios/ sont gitignorés, donc jamais
// téléversés). Un `expo config --type introspect` lancé dans le dossier de
// travail fusionnerait un android/ local éventuellement périmé : on résout donc
// le manifest dans une copie temporaire sans dossiers natifs.
function cleanProjectCopy() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'altimmo-manifest-'));
  const copyRoot = path.join(workspace, path.basename(projectRoot));
  fs.mkdirSync(copyRoot);
  const skipped = new Set(['android', 'ios', 'node_modules', 'coverage', 'dist', '.expo', '.git']);
  for (const entry of fs.readdirSync(projectRoot)) {
    if (skipped.has(entry) || /\.(apk|aab|jks|keystore)$/.test(entry)) continue;
    fs.cpSync(path.join(projectRoot, entry), path.join(copyRoot, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(copyRoot, 'node_modules'));
  fs.symlinkSync(path.resolve(projectRoot, '../shared'), path.join(workspace, 'shared'));
  return { workspace, copyRoot };
}

let manifest;
let workspace;
afterAll(() => { if (workspace) fs.rmSync(workspace, { recursive: true, force: true }); });
beforeAll(() => {
  const copy = cleanProjectCopy();
  workspace = copy.workspace;
  const out = execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
    cwd: copy.copyRoot,
    env: { ...process.env, EAS_BUILD: '', GOOGLE_MAPS_ANDROID_API_KEY: '' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const config = JSON.parse(out);
  const mod = config._internal?.modResults?.android?.manifest || config.modResults?.android?.manifest;
  manifest = mod.manifest || mod;
});

const permissions = () => (manifest['uses-permission'] || [])
  .filter((p) => p.$['tools:node'] !== 'remove')
  .map((p) => p.$['android:name']);

test('aucun service de premier plan mediaPlayback (lecture audio en arrière-plan inutilisée)', () => {
  expect(permissions()).not.toContain('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
  expect(permissions()).not.toContain('android.permission.FOREGROUND_SERVICE');
  const services = manifest.application[0].service || [];
  expect(services.filter((s) => s.$['android:foregroundServiceType'] && s.$['tools:node'] !== 'remove')).toEqual([]);
});

test('permissions sensibles bloquées et absence de cleartext / debuggable', () => {
  const removed = (manifest['uses-permission'] || []).filter((p) => p.$['tools:node'] === 'remove').map((p) => p.$['android:name']);
  expect(removed).toEqual(expect.arrayContaining(['android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW']));
  const app = manifest.application[0].$;
  expect(app['android:usesCleartextTraffic']).not.toBe('true');
  expect(app['android:debuggable']).not.toBe('true');
});

// GOOGLE-PLAY-R2.1 — minimisation des permissions (politique « Photos and Video
// Permissions ») : les sélections d'images passent par le sélecteur système
// (AndroidX PickVisualMedia, aucune permission), la caméra n'est jamais utilisée.
const removedPermissions = () => (manifest['uses-permission'] || [])
  .filter((p) => p.$['tools:node'] === 'remove')
  .map((p) => p.$['android:name']);

test('PLAYPERM-01 — READ_MEDIA_IMAGES (et tout accès média large) absent du manifest de release', () => {
  expect(permissions()).not.toContain('android.permission.READ_MEDIA_IMAGES');
  expect(permissions()).not.toContain('android.permission.READ_MEDIA_VIDEO');
  expect(permissions()).not.toContain('android.permission.READ_MEDIA_VISUAL_USER_SELECTED');
  expect(permissions()).not.toContain('android.permission.MANAGE_EXTERNAL_STORAGE');
});

test('PLAYPERM-03 — CAMERA absente et bloquée (déclarée par la bibliothèque expo-image-picker, jamais utilisée)', () => {
  expect(permissions()).not.toContain('android.permission.CAMERA');
  expect(removedPermissions()).toContain('android.permission.CAMERA');
});
