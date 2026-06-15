import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import ListeAnnoncesScreen from '../screens/Annonces/ListeAnnoncesScreen';
import DetailAnnonceScreen from '../screens/Annonces/DetailAnnonceScreen';
import ConversationsScreen from '../screens/Messagerie/ConversationsScreen';
import VisitesScreen from '../screens/Visites/VisitesScreen';
import ProfilScreen from '../screens/Profil/ProfilScreen';
import PublierBienScreen from '../screens/Publication/PublierBienScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnnoncesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0A0A0A' }
      }}
    >
      <Stack.Screen
        name="ListeAnnonces"
        component={ListeAnnoncesScreen}
      />
      <Stack.Screen
        name="DetailAnnonce"
        component={DetailAnnonceScreen}
      />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  const { canAdd } = useAuth();

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
            <Ionicons name="home" size={size} color={color} />
          )
        }}
      />
      {canAdd && (
        <Tab.Screen
          name="Publier"
          component={PublierBienScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            )
          }}
        />
      )}
      <Tab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Visites"
        component={VisitesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfilScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
}
