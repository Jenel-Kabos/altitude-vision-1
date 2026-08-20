jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('../../config/environment', () => ({
  environment: { googleWebClientId: 'web-client.apps.googleusercontent.com' },
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  getGoogleSignInErrorMessage,
} from '../googleSignIn';

describe('googleSignIn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('configures the original API with the WEB client ID and no offline access', () => {
    configureGoogleSignIn();
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client.apps.googleusercontent.com',
      offlineAccess: false,
    });
  });

  it('returns the ID token after checking Play Services', async () => {
    GoogleSignin.signIn.mockResolvedValue({ data: { idToken: 'test-id-token' } });
    await expect(getGoogleIdToken()).resolves.toBe('test-id-token');
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledTimes(1);
  });

  it.each(['SIGN_IN_CANCELLED', 'IN_PROGRESS'])('silently ignores %s', (code) => {
    expect(getGoogleSignInErrorMessage({ code })).toBeNull();
  });

  it('distinguishes unavailable Play Services', () => {
    expect(getGoogleSignInErrorMessage({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }))
      .toBe('Google Play Services est requis pour continuer.');
  });

  it.each(['10', 'DEVELOPER_ERROR'])('hides technical developer error %s', (code) => {
    expect(getGoogleSignInErrorMessage({ code }))
      .toBe('Connexion Google indisponible. Veuillez réessayer.');
  });
});
