const fs = require('fs');
const path = require('path');

const appRoot = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

describe('Google OAuth project alignment', () => {
  test('every EAS profile uses the Altitude Vision WEB client project', () => {
    const eas = JSON.parse(read('eas.json'));

    for (const profileName of ['development', 'staging', 'preview', 'production']) {
      const clientId = eas.build[profileName].env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      expect(clientId).toMatch(/^872164120879-.+\.apps\.googleusercontent\.com$/);
      expect(clientId).not.toContain('3869205293-');
    }
  });

  test('the shared helper reads the environment and contains no hardcoded OAuth client', () => {
    const helper = read('src/services/googleSignIn.js');

    expect(helper).toContain('environment.googleWebClientId');
    expect(helper).not.toMatch(/\d+-[a-z0-9]+\.apps\.googleusercontent\.com/i);
  });

  test.each(['LoginScreen.jsx', 'RegisterScreen.jsx'])(
    '%s uses the same Google Sign-In helper',
    (screenName) => {
      const screen = read(`src/screens/Auth/${screenName}`);
      expect(screen).toContain("from '../../services/googleSignIn'");
      expect(screen).toContain('configureGoogleSignIn');
      expect(screen).toContain('signInWithGoogle');
    },
  );
});
