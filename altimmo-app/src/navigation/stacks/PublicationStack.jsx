import { createStackNavigator } from '@react-navigation/stack';
import ChoixTypeAnnonceScreen from '../../screens/Publication/ChoixTypeAnnonceScreen';
import AddSalePropertyScreen from '../../screens/Publication/AddSalePropertyScreen';
import AddRentalPropertyScreen from '../../screens/Publication/AddRentalPropertyScreen';
import AddAccommodationScreen from '../../screens/Publication/AddAccommodationScreen';

const Stack = createStackNavigator();

// Point d'entrée "Publier" de l'onglet central (TabNavigator) — l'écran de choix
// initial remplace l'ancien formulaire unique PublierBienScreen (conservé uniquement
// pour l'édition d'une annonce existante, via ProfilStack "PublierBien").
export default function PublicationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChoixTypeAnnonce" component={ChoixTypeAnnonceScreen} />
      <Stack.Screen name="AddSaleProperty" component={AddSalePropertyScreen} />
      <Stack.Screen name="AddRentalProperty" component={AddRentalPropertyScreen} />
      <Stack.Screen name="AddAccommodation" component={AddAccommodationScreen} />
    </Stack.Navigator>
  );
}
