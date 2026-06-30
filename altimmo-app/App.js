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
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { incrementSession } from './src/services/reviewService';

Sentry.init({
  dsn: 'https://7fbaf95c5e78879c80fe1eb126f3d7e7@o4511646980767744.ingest.us.sentry.io/4511647058231296',
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
  attachStacktrace: true,
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
              <AppNavigator />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(AppInner);
