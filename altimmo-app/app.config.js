const navigationRegistry = require('../shared/navigation/registry.json');
const { URL } = require('url');

const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

// EAS must never produce an Android binary that can mount Google Maps without
// the native manifest key. Local config inspection remains possible without a
// secret; the UI then uses its explicit address-only fallback.
if (process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android' && !googleMapsAndroidApiKey) {
  throw new Error('GOOGLE_MAPS_ANDROID_API_KEY is required for EAS Android builds.');
}

const universalLinkPrefixes = [...new Set(navigationRegistry.destinations
  .map((destination) => destination.universalLink?.split('/:')[0])
  .filter(Boolean))];

module.exports = {
  expo: {
    name: 'Altimmo',
    slug: 'altimmo-app',
    version: '1.0.1',
    scheme: navigationRegistry.origins.scheme,
    orientation: 'portrait',
    newArchEnabled: true,

    icon: './assets/icon.png',

    splash: {
      image: './assets/Logo_Altitude_transparent.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0A',
    },

    updates: {
      url: 'https://u.expo.dev/20e7342e-6723-404c-bd44-66ef60758a19',
    },

    runtimeVersion: {
      policy: 'appVersion',
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.altitudevision.altimmo',
      associatedDomains: [
        `applinks:${new URL(navigationRegistry.origins.web).host}`,
      ],
      infoPlist: {
        NSCameraUsageDescription:
          'Altitude Vision utilise la caméra pour photographier votre bien.',
        NSPhotoLibraryUsageDescription:
          'Altitude Vision accède à vos photos pour illustrer votre annonce.',
      },
    },

    android: {
      package: 'com.altitudevision.altimmo',
      versionCode: 2,
      // EAS Build ne téléverse que les fichiers suivis par Git. `google-services.json`
      // reste gitignoré : on le passe au builder via une file env var EAS
      // (`GOOGLE_SERVICES_JSON`) qui matérialise le fichier dans un chemin temporaire.
      // En local (dev, tests) on retombe sur le fichier au racine du projet mobile.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0A',
      },

      config: googleMapsAndroidApiKey
        ? { googleMaps: { apiKey: googleMapsAndroidApiKey } }
        : {},

      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: universalLinkPrefixes.map((pathPrefix) => ({
            scheme: 'https',
            host: new URL(navigationRegistry.origins.web).host,
            pathPrefix,
          })),
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],

      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],

      // GOOGLE-PLAY-P0-3 — Permissions injectées par les modules Expo
      // natifs (expo-audio, react-native-modal…) mais qu'aucun code
      // applicatif n'utilise. Les bloquer explicitement évite qu'elles
      // apparaissent dans la fiche Play et déclenchent une revue
      // supplémentaire. À réévaluer si l'app introduit un jour de
      // l'enregistrement audio, du lock-screen media control, ou un
      // overlay.
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        // GOOGLE-PLAY-R2.1 — déclarée par le manifest de la bibliothèque
        // expo-image-picker mais jamais utilisée (aucune prise de vue : les
        // images viennent du sélecteur système). READ_MEDIA_IMAGES est retirée
        // des permissions : le sélecteur système n'en a pas besoin.
        'android.permission.CAMERA',
      ],
    },

    plugins: [
      'expo-asset',
      'expo-image',
      'expo-sharing',
      'expo-status-bar',
      'expo-web-browser',
      'expo-video',
      // GOOGLE-PLAY-R2 — l'audio n'est lu qu'en premier plan (messages vocaux du
      // chat). Le défaut du plugin (enableBackgroundPlayback: true) déclarait un
      // service de premier plan « mediaPlayback » et ses permissions, soumis à
      // déclaration FGS justifiée sur Google Play pour targetSdk ≥ 34.
      ['expo-audio', { enableBackgroundPlayback: false }],
      'expo-updates',
      'expo-notifications',
      'expo-location',
      'expo-camera',
      'expo-font',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      '@react-native-google-signin/google-signin',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'altimmo-mobile',
          organization: 'altitudevision',
        },
      ],
    ],

    extra: {
      googleMapsConfigured: Boolean(googleMapsAndroidApiKey),
      // GOOGLE-PLAY-R2.1 — EAS fournit le DSN sous `SENTRY_DSN` (secret, jamais
      // inliné par Metro faute de préfixe EXPO_PUBLIC_) : exposé ici au build
      // pour que l'app l'initialise en release. Le DSN est public par nature.
      sentryDsn: process.env.SENTRY_DSN?.trim() || undefined,
      eas: {
        projectId: '20e7342e-6723-404c-bd44-66ef60758a19',
      },
    },
  },
};
