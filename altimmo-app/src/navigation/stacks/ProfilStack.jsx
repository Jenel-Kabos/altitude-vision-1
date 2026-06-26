import { createStackNavigator } from '@react-navigation/stack';
import ProfilScreen from '../../screens/Profil/ProfilScreen';
import EditProfileScreen from '../../screens/Profil/EditProfileScreen';
import ChangePasswordScreen from '../../screens/Profil/ChangePasswordScreen';
import MesAnnoncesScreen from '../../screens/MesBiens/MesAnnoncesScreen';
import PublierBienScreen from '../../screens/Publication/PublierBienScreen';

const Stack = createStackNavigator();

export default function ProfilStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfilHome"      component={ProfilScreen} />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
      <Stack.Screen name="MesAnnonces"     component={MesAnnoncesScreen} />
      <Stack.Screen name="PublierBien"     component={PublierBienScreen} />
    </Stack.Navigator>
  );
}
