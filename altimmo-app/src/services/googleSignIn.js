import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { environment } from '../config/environment';

const DEVELOPER_ERROR_CODES = new Set(['10', 'DEVELOPER_ERROR']);

export function configureGoogleSignIn() {
  if (!environment.googleWebClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required');
  }

  GoogleSignin.configure({
    webClientId: environment.googleWebClientId,
    offlineAccess: false,
  });
}

export async function getGoogleIdToken() {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken || userInfo.idToken;

  if (!idToken) throw new Error('Google Sign-In did not return an ID token');
  return idToken;
}

export function getGoogleSignInErrorMessage(error) {
  const code = String(error?.code ?? '');

  if (code === String(statusCodes.SIGN_IN_CANCELLED) || code === String(statusCodes.IN_PROGRESS)) {
    return null;
  }
  if (code === String(statusCodes.PLAY_SERVICES_NOT_AVAILABLE)) {
    return 'Google Play Services est requis pour continuer.';
  }
  if (DEVELOPER_ERROR_CODES.has(code)) {
    return 'Connexion Google indisponible. Veuillez réessayer.';
  }
  return 'Impossible de vous connecter avec Google. Veuillez réessayer.';
}

export function getGoogleSignInDiagnostic(error) {
  const sensitiveProperty = /token|credential|cookie|authorization|jwt|codeVerifier/i;
  return {
    name: error?.name,
    code: error?.code,
    message: error?.message,
    propertyNames: error && typeof error === 'object'
      ? Object.keys(error).filter((key) => !sensitiveProperty.test(key)).sort()
      : [],
  };
}
