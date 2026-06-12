import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { View, Text } from 'react-native';

const Tab = createBottomTabNavigator();

function HomeScreen() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0A0A0A',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Text style={{
        color: '#C8960C',
        fontSize: 24
      }}>
        🏠 Bienvenue sur Altimmo
      </Text>
    </View>
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
        },
        tabBarActiveTintColor: '#C8960C',
        tabBarInactiveTintColor: '#606060',
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
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
