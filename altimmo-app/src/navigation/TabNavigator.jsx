import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { HouseIcon } from '../components';
import ListeAnnoncesScreen from '../screens/Annonces/ListeAnnoncesScreen';
import DetailAnnonceScreen from '../screens/Annonces/DetailAnnonceScreen';
import MessagerieStack from './stacks/MessagerieStack';
import ProfilStack from './stacks/ProfilStack';
import VisitesScreen from '../screens/Visites/VisitesScreen';
import PublierBienScreen from '../screens/Publication/PublierBienScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnnoncesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ListeAnnonces" component={ListeAnnoncesScreen} />
      <Stack.Screen name="DetailAnnonce" component={DetailAnnonceScreen} />
    </Stack.Navigator>
  );
}

// Renderer factory : retourne une fonction (focused) -> icône avec point indicateur
const makeIcon = (nameActive, nameInactive) => ({ focused }) => (
  <View style={styles.iconWrap}>
    <View style={[styles.dot, focused && styles.dotActive]} />
    <Ionicons
      name={focused ? nameActive : nameInactive}
      size={focused ? 24 : 22}
      color={focused ? colors.primary : colors.textMuted}
    />
  </View>
);

// Renderer factory pour le label : styles différents actif/inactif
const makeLabel = (text) => ({ focused }) => (
  <Text style={[styles.label, focused && styles.labelActive]}>{text}</Text>
);

export default function TabNavigator() {
  const { canAdd } = useAuth();
  const insets = useSafeAreaInsets();

  const safeBottom = Platform.OS === 'ios' ? insets.bottom : 0;
  const tabBarHeight = 65 + safeBottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? safeBottom : 8,
        },
      }}
    >
      <Tab.Screen
        name="Annonces"
        component={AnnoncesStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrap}>
              <View style={[styles.dot, focused && styles.dotActive]} />
              <HouseIcon size={24} color={focused ? colors.gold : colors.textMuted} />
            </View>
          ),
          tabBarLabel: makeLabel('Annonces'),
        }}
      />
      {canAdd && (
        <Tab.Screen
          name="Publier"
          component={PublierBienScreen}
          options={{
            tabBarIcon: makeIcon('add-circle', 'add-circle-outline'),
            tabBarLabel: makeLabel('Publier'),
          }}
        />
      )}
      <Tab.Screen
        name="Messages"
        component={MessagerieStack}
        options={{
          tabBarIcon: makeIcon('chatbubbles', 'chatbubbles-outline'),
          tabBarLabel: makeLabel('Messages'),
        }}
      />
      <Tab.Screen
        name="Visites"
        component={VisitesScreen}
        options={{
          tabBarIcon: makeIcon('calendar', 'calendar-outline'),
          tabBarLabel: makeLabel('Visites'),
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfilStack}
        options={{
          tabBarIcon: makeIcon('person', 'person-outline'),
          tabBarLabel: makeLabel('Profil'),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 32,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
