import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createStackNavigator } from '@react-navigation/stack';

import ListeAnnoncesScreen  from '../screens/Annonces/ListeAnnoncesScreen';
import DetailAnnonceScreen  from '../screens/Annonces/DetailAnnonceScreen';
import PublierBienScreen    from '../screens/Publication/PublierBienScreen';
import ConversationsScreen  from '../screens/Messagerie/ConversationsScreen';
import ChatScreen           from '../screens/Messagerie/ChatScreen';
import VisitesScreen        from '../screens/Visites/VisitesScreen';
import ProfilScreen         from '../screens/Profil/ProfilScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnnoncesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ListeAnnonces"  component={ListeAnnoncesScreen} />
      <Stack.Screen name="DetailAnnonce" component={DetailAnnonceScreen} />
    </Stack.Navigator>
  );
}

function MessagerieStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Chat"          component={ChatScreen} />
    </Stack.Navigator>
  );
}

const ICONS = {
  Annonces:  ['home',        'home-outline'],
  Publier:   ['add-circle',  'add-circle-outline'],
  Messages:  ['chatbubbles', 'chatbubbles-outline'],
  Visites:   ['calendar',    'calendar-outline'],
  Profil:    ['person',      'person-outline'],
};

export default function TabNavigator() {
  const { canAdd } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.backgroundLight,
          borderTopColor:  colors.border,
          height: 65,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Annonces" component={AnnoncesStack} />
      {canAdd && <Tab.Screen name="Publier"  component={PublierBienScreen} />}
      <Tab.Screen name="Messages" component={MessagerieStack} />
      <Tab.Screen name="Visites"  component={VisitesScreen} />
      <Tab.Screen name="Profil"   component={ProfilScreen} />
    </Tab.Navigator>
  );
}
