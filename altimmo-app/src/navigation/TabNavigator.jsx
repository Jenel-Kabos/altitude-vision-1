import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { themeColors: c } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: c.bg },
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

  // UI-MOB-5 — doit rester en phase avec `bottomPad` dans CustomTabBar.jsx : cette
  // hauteur est ce que React Navigation réserve comme espace pour le contenu des
  // écrans au-dessus de la tab bar custom. Elle ignorait `insets.bottom` sur
  // Android (toujours `65 + 0`) ; une fois CustomTabBar corrigé pour respecter la
  // vraie zone sûre (navigation 3 boutons, `insets.bottom` ≈ 135px sur le device
  // testé), la barre réellement rendue devenait plus haute que l'espace réservé
  // ici — elle recouvrait alors le bas du contenu de chaque écran (confirmé :
  // l'état vide de la Home se retrouvait rogné, magnifying glass et titre
  // masqués sous la tab bar). Même formule que `bottomPad` dans CustomTabBar.jsx
  // pour qu'ils correspondent exactement.
  const tabBarHeight = Platform.OS === 'ios'
    ? 65 + insets.bottom
    : 65 - 8 + Math.max(insets.bottom, 8);

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
