module.exports = {
  expo: {
    name: 'Altimmo',
    slug: 'altimmo-app',
    version: '1.0.1',
    scheme: 'altimmo',
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
        'applinks:altitudevision.agency',
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

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0A',
      },

      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },

      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'altitudevision.agency',
              pathPrefix: '/annonces',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],

      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],
    },

    plugins: [
      'expo-updates',
      'expo-notifications',
      'expo-location',
      'expo-camera',
      'expo-font',
      'expo-secure-store',
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
      eas: {
        projectId: '20e7342e-6723-404c-bd44-66ef60758a19',
      },
    },
  },
};