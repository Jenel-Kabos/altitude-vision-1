import { createStackNavigator } from '@react-navigation/stack';
import ProfilScreen         from '../../screens/Profil/ProfilScreen';
import EditProfileScreen    from '../../screens/Profil/EditProfileScreen';
import ChangePasswordScreen from '../../screens/Profil/ChangePasswordScreen';
import MesAnnoncesScreen    from '../../screens/MesBiens/MesAnnoncesScreen';
import PublierBienScreen    from '../../screens/Publication/PublierBienScreen';
import ChoixTypeAnnonceScreen  from '../../screens/Publication/ChoixTypeAnnonceScreen';
import AddSalePropertyScreen   from '../../screens/Publication/AddSalePropertyScreen';
import AddRentalPropertyScreen from '../../screens/Publication/AddRentalPropertyScreen';
import AddAccommodationScreen  from '../../screens/Publication/AddAccommodationScreen';
import FavorisScreen        from '../../screens/Profil/FavorisScreen';
import TransactionsScreen   from '../../screens/Profil/TransactionsScreen';
import PaiementScreen       from '../../screens/Paiements/PaiementScreen';
import VirementScreen                  from '../../screens/Paiements/VirementScreen';
import PolitiqueConfidentialiteScreen  from '../../screens/Profil/PolitiqueConfidentialiteScreen';
import CacheManagementScreen          from '../../screens/Profil/CacheManagementScreen';
import MyHotelReservationsScreen from '../../screens/Hotels/MyHotelReservationsScreen';
import HotelReservationDetailScreen from '../../screens/Hotels/HotelReservationDetailScreen';
import HotelBookingScreen from '../../screens/Hotels/HotelBookingScreen';
import HotelOperationsScreen from '../../screens/Hotels/HotelOperationsScreen';
import RealEstateApplicationsScreen from '../../screens/Profil/RealEstateApplicationsScreen';
import RealEstateApplicationDetailScreen from '../../screens/Profil/RealEstateApplicationDetailScreen';
import SubmitRealEstateApplicationScreen from '../../screens/Annonces/SubmitRealEstateApplicationScreen';
import TenantPortalScreen from '../../screens/TenantPortal/TenantPortalScreen';
import MyAccommodationReservationsScreen from '../../screens/Accommodation/MyAccommodationReservationsScreen';
import AccommodationReservationDetailScreen from '../../screens/Accommodation/AccommodationReservationDetailScreen';
import AccommodationBookingScreen from '../../screens/Accommodation/AccommodationBookingScreen';
import MyDocumentsScreen from '../../screens/Documents/MyDocumentsScreen';
import PersonalDocumentDetailScreen from '../../screens/Documents/PersonalDocumentDetailScreen';

const Stack = createStackNavigator();

export default function ProfilStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfilHome"      component={ProfilScreen} />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
      <Stack.Screen name="MesAnnonces"     component={MesAnnoncesScreen} />
      <Stack.Screen name="PublierBien"     component={PublierBienScreen} />
      <Stack.Screen name="ChoixTypeAnnonce"   component={ChoixTypeAnnonceScreen} />
      <Stack.Screen name="AddSaleProperty"    component={AddSalePropertyScreen} />
      <Stack.Screen name="AddRentalProperty"  component={AddRentalPropertyScreen} />
      <Stack.Screen name="AddAccommodation"   component={AddAccommodationScreen} />
      <Stack.Screen name="Favoris"         component={FavorisScreen} />
      <Stack.Screen name="Transactions"    component={TransactionsScreen} />
      <Stack.Screen name="RealEstateApplications" component={RealEstateApplicationsScreen} />
      <Stack.Screen name="RealEstateApplicationDetail" component={RealEstateApplicationDetailScreen} />
      <Stack.Screen name="SubmitRealEstateApplication" component={SubmitRealEstateApplicationScreen} />
      <Stack.Screen name="PaiementCancel"  component={TransactionsScreen} />
      <Stack.Screen name="Paiement"        component={PaiementScreen} />
      <Stack.Screen name="VirementScreen"             component={VirementScreen} />
      <Stack.Screen name="PolitiqueConfidentialite"  component={PolitiqueConfidentialiteScreen} />
      <Stack.Screen name="CacheManagement"          component={CacheManagementScreen} />
      <Stack.Screen name="MyHotelReservations" component={MyHotelReservationsScreen} />
      <Stack.Screen name="HotelReservationDetail" component={HotelReservationDetailScreen} />
      <Stack.Screen name="HotelBooking" component={HotelBookingScreen} />
      <Stack.Screen name="HotelOperations" component={HotelOperationsScreen} />
      <Stack.Screen name="TenantPortal" component={TenantPortalScreen} />
      <Stack.Screen name="MyAccommodationReservations" component={MyAccommodationReservationsScreen} />
      <Stack.Screen name="AccommodationReservationDetail" component={AccommodationReservationDetailScreen} />
      <Stack.Screen name="AccommodationBooking" component={AccommodationBookingScreen} />
      <Stack.Screen name="MyDocuments" component={MyDocumentsScreen} />
      <Stack.Screen name="PersonalDocumentDetail" component={PersonalDocumentDetailScreen} />
    </Stack.Navigator>
  );
}
