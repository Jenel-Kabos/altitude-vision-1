import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Fraunces_700Bold,
  Fraunces_400Regular_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Bold':    Fraunces_700Bold,
    'Fraunces-Italic':  Fraunces_400Regular_Italic,
    'Inter-Regular':    Inter_400Regular,
    'Inter-Italic':     Inter_400Regular_Italic,
    'Inter-Bold':       Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
