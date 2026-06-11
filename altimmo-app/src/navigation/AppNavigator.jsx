import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#0A0A0A',
      }} />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: {
            backgroundColor: '#0A0A0A',
          },
        }}
      >
        {user ? (
          <Stack.Screen
            name="Main"
            component={TabNavigator}
          />
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
