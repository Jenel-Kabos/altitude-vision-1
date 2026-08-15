import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Sentry from '@sentry/react-native';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { AuthProvider } from './src/context/AuthContext';
import { PlatformTenantRuntimeProvider } from './src/context/PlatformTenantRuntimeContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { incrementSession } from './src/services/reviewService';
import { environment } from './src/config/environment';

Sentry.init({
  dsn: environment.sentryDsn,
  enabled: !__DEV__ && Boolean(environment.sentryDsn),
  tracesSampleRate: 0.2,
  environment: environment.name,
  attachStacktrace: true,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
      }
    }
    if (event.user) {
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }
    return event;
  },
});

function AppInner() {
  React.useEffect(() => { incrementSession(); }, []);

  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Regular':   CormorantGaramond_400Regular,
    'CormorantGaramond-Italic':    CormorantGaramond_400Regular_Italic,
    'CormorantGaramond-SemiBold':  CormorantGaramond_600SemiBold,
    'CormorantGaramond-Bold':      CormorantGaramond_700Bold,
    'DMSans-Regular':              DMSans_400Regular,
    'DMSans-Medium':               DMSans_500Medium,
    'DMSans-Bold':                 DMSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <PlatformTenantRuntimeProvider>
                <AppNavigator />
              </PlatformTenantRuntimeProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(AppInner);
