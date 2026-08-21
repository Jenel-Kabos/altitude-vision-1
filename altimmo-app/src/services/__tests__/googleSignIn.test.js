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
  isCancelledResponse: (response) => response?.type === 'cancelled',
  isSuccessResponse: (response) => response?.type === 'success',
}));

jest.mock('../../config/environment', () => ({
  environment: { googleWebClientId: 'web-client.apps.googleusercontent.com' },
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { environment } from '../../config/environment';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  getGoogleSignInDiagnostic,
  getGoogleSignInErrorMessage,
  signInWithGoogle,
} from '../googleSignIn';

describe('googleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => console.info.mockRestore());

  it('configures the original API with the WEB client ID and no offline access', () => {
    configureGoogleSignIn();
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client.apps.googleusercontent.com',
      offlineAccess: false,
    });
  });

  it('fails explicitly when the WEB client ID is absent', () => {
    const configuredClientId = environment.googleWebClientId;
    environment.googleWebClientId = '';

    expect(() => configureGoogleSignIn())
      .toThrow('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required');
    expect(GoogleSignin.configure).not.toHaveBeenCalled();

    environment.googleWebClientId = configuredClientId;
  });

  it('returns the ID token after checking Play Services', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'test-id-token', user: { id: 'google-user' } },
    });
    await expect(getGoogleIdToken()).resolves.toBe('test-id-token');
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledTimes(1);
  });

  it('classifies the modern cancelled response without treating it as a token failure', async () => {
    GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(getGoogleIdToken()).rejects.toMatchObject({ code: 'SIGN_IN_CANCELLED' });
  });

  it('rejects a modern success response without an ID token', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success', data: { idToken: null, user: { id: 'google-user' } },
    });

    await expect(getGoogleIdToken())
      .rejects.toThrow('Google Sign-In did not return an ID token');
  });

  it('explicitly rejects the legacy root response shape', async () => {
    GoogleSignin.signIn.mockResolvedValue({ idToken: 'legacy-token' });

    await expect(getGoogleIdToken())
      .rejects.toThrow('Google Sign-In returned an unsupported response');
  });

  it('does not log token values', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success', data: { idToken: 'never-log-this-token', user: {} },
    });
    await getGoogleIdToken();

    expect(JSON.stringify(console.info.mock.calls)).not.toContain('never-log-this-token');
  });

  it('calls backend authentication exactly once after a modern success', async () => {
    const authenticate = jest.fn().mockResolvedValue({ user: { id: 'app-user' } });
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success', data: { idToken: 'test-id-token', user: {} },
    });

    await signInWithGoogle(authenticate, 'Login');
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith({ idToken: 'test-id-token', role: 'Client' });
  });

  it('does not call backend authentication after cancellation', async () => {
    const authenticate = jest.fn();
    GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithGoogle(authenticate, 'Login'))
      .rejects.toMatchObject({ code: 'SIGN_IN_CANCELLED' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('does not call backend authentication after a native error', async () => {
    const authenticate = jest.fn();
    GoogleSignin.signIn.mockRejectedValue(Object.assign(new Error('native failure'), { code: 'NATIVE' }));

    await expect(signInWithGoogle(authenticate, 'Login')).rejects.toMatchObject({ code: 'NATIVE' });
    expect(authenticate).not.toHaveBeenCalled();
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

  it('exposes only safe diagnostic fields and property names', () => {
    const diagnostic = getGoogleSignInDiagnostic({
      name: 'Error', code: '10', message: 'DEVELOPER_ERROR', idToken: 'never-log-me',
    });
    expect(diagnostic).toEqual({
      name: 'Error',
      code: '10',
      message: 'DEVELOPER_ERROR',
      propertyNames: ['code', 'message', 'name'],
    });
    expect(diagnostic).not.toHaveProperty('idToken');
  });
});
