import { createStackNavigator } from '@react-navigation/stack';
import ProfilScreen         from '../../screens/Profil/ProfilScreen';
import EditProfileScreen    from '../../screens/Profil/EditProfileScreen';
import ChangePasswordScreen from '../../screens/Profil/ChangePasswordScreen';
import MesAnnoncesScreen    from '../../screens/MesBiens/MesAnnoncesScreen';
import PublierBienScreen    from '../../screens/Publication/PublierBienScreen';
import FavorisScreen        from '../../screens/Profil/FavorisScreen';
import TransactionsScreen   from '../../screens/Profil/TransactionsScreen';
import PaiementScreen       from '../../screens/Paiements/PaiementScreen';
import VirementScreen                  from '../../screens/Paiements/VirementScreen';
import PolitiqueConfidentialiteScreen  from '../../screens/Profil/PolitiqueConfidentialiteScreen';
import CacheManagementScreen          from '../../screens/Profil/CacheManagementScreen';

const Stack = createStackNavigator();

export default function ProfilStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfilHome"      component={ProfilScreen} />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
      <Stack.Screen name="MesAnnonces"     component={MesAnnoncesScreen} />
      <Stack.Screen name="PublierBien"     component={PublierBienScreen} />
      <Stack.Screen name="Favoris"         component={FavorisScreen} />
      <Stack.Screen name="Transactions"    component={TransactionsScreen} />
      <Stack.Screen name="Paiement"        component={PaiementScreen} />
      <Stack.Screen name="VirementScreen"             component={VirementScreen} />
      <Stack.Screen name="PolitiqueConfidentialite"  component={PolitiqueConfidentialiteScreen} />
      <Stack.Screen name="CacheManagement"          component={CacheManagementScreen} />
    </Stack.Navigator>
  );
}
