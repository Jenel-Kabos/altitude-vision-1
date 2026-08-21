import {
  GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes,
} from '@react-native-google-signin/google-signin';
import { environment } from '../config/environment';

const DEVELOPER_ERROR_CODES = new Set(['10', 'DEVELOPER_ERROR']);

export function logGoogleSignInStep(step, details = {}) {
  if (__DEV__) console.info(`[Google Sign-In] ${step}`, details);
}

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
  logGoogleSignInStep('STEP 2 checkPlayServices completed');
  logGoogleSignInStep('STEP 3 signIn called');

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (error) {
    logGoogleSignInStep('STEP 4 signIn threw', getGoogleSignInDiagnostic(error));
    throw error;
  }

  const data = response?.data;
  const idToken = data?.idToken;
  logGoogleSignInStep('STEP 4 signIn returned', {
    jsType: typeof response,
    resultKeys: response && typeof response === 'object' ? Object.keys(response).sort() : [],
    resultType: response?.type,
    hasData: Boolean(data),
    dataKeys: data && typeof data === 'object' ? Object.keys(data).sort() : [],
    hasUser: Boolean(data?.user),
    hasIdToken: Boolean(idToken),
    idTokenLength: typeof idToken === 'string' ? idToken.length : 0,
    hasServerAuthCode: Boolean(data?.serverAuthCode),
  });

  if (isCancelledResponse(response)) {
    logGoogleSignInStep('STEP 5 result classified', { classification: 'cancelled' });
    const error = new Error('Google Sign-In cancelled');
    error.code = statusCodes.SIGN_IN_CANCELLED;
    throw error;
  }
  if (!isSuccessResponse(response)) {
    logGoogleSignInStep('STEP 5 result classified', { classification: 'unknown' });
    throw new Error('Google Sign-In returned an unsupported response');
  }
  logGoogleSignInStep('STEP 5 result classified', { classification: 'success' });

  if (!idToken) throw new Error('Google Sign-In did not return an ID token');
  logGoogleSignInStep('STEP 6 idToken extracted', { idTokenLength: idToken.length });
  return idToken;
}

export async function signInWithGoogle(authenticate, source) {
  const intentBySource = { Login: 'login', Signup: 'signup' };
  const intent = intentBySource[source];
  if (!intent) throw new Error('Unsupported Google authentication source');
  logGoogleSignInStep(`STEP 1 ${source} button pressed`);
  const idToken = await getGoogleIdToken();
  logGoogleSignInStep('STEP 7 backend auth call attempted', { source });
  const result = await authenticate({ idToken, intent, role: 'Client' });
  logGoogleSignInStep(`STEP 9 ${source} session result`, {
    hasSessionUser: Boolean(result?.user),
  });
  return result;
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
