import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { fonts, fontSize } from '../theme';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import CompleterProfilScreen from '../screens/Auth/CompleterProfilScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import { navigationRef, flushPendingNavigation } from '../services/navigationService';
import { setupNotificationListeners } from '../services/notificationsService';

const LOGO = require('../../assets/Logo_Altitude_transparent.png');

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, loading, needsProfileCompletion } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then((val) => {
      setOnboardingDone(val === '1');
    });
  }, []);

  const handleOnboardingDone  = useCallback(() => setOnboardingDone(true), []);

  const handleOnboardingLogin = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_complete', '1');
    setOnboardingDone(true);
  }, []);

  // Listeners push : initialisés une seule fois au montage de l'app
  useEffect(() => {
    setupNotificationListeners();
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={styles.splash}>
        <Image
          source={LOGO}
          style={styles.splashLogo}
          contentFit="contain"
          cachePolicy="memory"
          accessible={false}
        />
        <Text style={styles.splashName}>Altimmo</Text>
        <Text style={styles.splashSub}>par Altitude Vision</Text>
      </View>
    );
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={handleOnboardingDone}
        onLogin={handleOnboardingLogin}
      />
    );
  }

  const linking = {
    prefixes: ['altimmo://'],
    config: {
      screens: {
        Main: {
          screens: {
            Profil: {
              screens: {
                Transactions:   'paiement/success',
                PaiementCancel: 'paiement/cancel',
              },
            },
          },
        },
      },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#0A0A0A' },
        }}
      >
        {user && needsProfileCompletion ? (
          <Stack.Screen name="CompleterProfil" component={CompleterProfilScreen} />
        ) : user ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  splashLogo: {
    width: 80,
    height: 80,
    marginBottom: 4,
  },
  splashName: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    color: '#C8960C',
    letterSpacing: 1,
  },
  splashSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.35)',
    letterSpacing: 0.5,
  },
});
