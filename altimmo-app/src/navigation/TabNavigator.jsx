import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import ListeAnnoncesScreen from '../screens/Annonces/ListeAnnoncesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnnoncesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: '#0A0A0A'
        }
      }}
    >
      <Stack.Screen
        name="ListeAnnonces"
        component={ListeAnnoncesScreen}
      />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1A1A',
          borderTopColor: '#2A2A2A',
          height: 65,
          paddingBottom: 8
        },
        tabBarActiveTintColor: '#C8960C',
        tabBarInactiveTintColor: '#606060',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        }
      }}
    >
      <Tab.Screen
        name="Annonces"
        component={AnnoncesStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home"
              size={size}
              color={color}
            />
          )
        }}
      />
    </Tab.Navigator>
  );
}
