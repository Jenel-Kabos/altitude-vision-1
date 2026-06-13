import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import { useAuth } from '../context/AuthContext';
import ListeAnnoncesScreen from '../screens/Annonces/ListeAnnoncesScreen';
import ProfilScreen from '../screens/Profil/ProfilScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function StubScreen({ title, emoji }) {
  return (
    <View style={stubStyles.container}>
      <Text style={stubStyles.emoji}>{emoji}</Text>
      <Text style={stubStyles.title}>{title}</Text>
      <Text style={stubStyles.subtitle}>Bientôt disponible</Text>
    </View>
  );
}

function PublierScreen() {
  return <StubScreen emoji="➕" title="Publier un bien" />;
}

function MessagesScreen() {
  return <StubScreen emoji="💬" title="Messagerie" />;
}

function VisitesScreen() {
  return <StubScreen emoji="📅" title="Visites" />;
}

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
          component={PublierScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            )
          }}
        />
      )}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
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

const stubStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16
  },
  title: {
    color: '#C8960C',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8
  },
  subtitle: {
    color: '#666',
    fontSize: 14
  }
});
