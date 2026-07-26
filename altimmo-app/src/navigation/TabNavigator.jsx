import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import CustomTabBar from './CustomTabBar';

import ListeAnnoncesScreen  from '../screens/Annonces/ListeAnnoncesScreen';
import DetailAnnonceScreen  from '../screens/Annonces/DetailAnnonceScreen';
import CarteScreen          from '../screens/Annonces/CarteScreen';
import NotificationsScreen  from '../screens/Notifications/NotificationsScreen';
import MessagerieStack      from './stacks/MessagerieStack';
import ProfilStack          from './stacks/ProfilStack';
import VisitesScreen        from '../screens/Visites/VisitesScreen';
import PublicationStack     from './stacks/PublicationStack';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnnoncesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="ListeAnnonces" component={ListeAnnoncesScreen} />
      <Stack.Screen name="DetailAnnonce" component={DetailAnnonceScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  const { canAdd } = useAuth();
  const insets     = useSafeAreaInsets();

  const tabBarHeight = 65 + (Platform.OS === 'ios' ? insets.bottom : 0);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Décale le contenu pour ne pas être caché par la tab bar custom
        tabBarStyle: { height: tabBarHeight },
      }}
    >
      <Tab.Screen
        name="Annonces"
        component={AnnoncesStack}
        options={{ tabBarAccessibilityLabel: 'Annonces immobilières' }}
      />
      {canAdd && (
        <Tab.Screen
          name="Publier"
          component={PublicationStack}
          options={{ tabBarAccessibilityLabel: 'Publier un bien' }}
        />
      )}
      <Tab.Screen
        name="Carte"
        component={CarteScreen}
        options={{ tabBarAccessibilityLabel: 'Carte des biens' }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagerieStack}
        options={{ tabBarAccessibilityLabel: 'Messagerie' }}
      />
      <Tab.Screen
        name="Visites"
        component={VisitesScreen}
        options={{ tabBarAccessibilityLabel: 'Mes visites' }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfilStack}
        options={{ tabBarAccessibilityLabel: 'Mon profil' }}
      />
    </Tab.Navigator>
  );
}
