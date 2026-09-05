import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelBookingScreen from '../HotelBookingScreen';
import { createHotelReservation, getHotelAvailability, getPublicHotel, newReservationRequestId, searchPublicHotels } from '../../../services/hotelReservationService';

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../services/hotelReservationService', () => ({ searchPublicHotels: jest.fn(), getPublicHotel: jest.fn(), getHotelAvailability: jest.fn(), createHotelReservation: jest.fn(), newReservationRequestId: jest.fn(() => 'request-stable-1') }));

const hotel = { _id: 'hotel-1', name: 'Altitude Hôtel', minNightlyRate: 35000, property: { address: { city: 'Brazzaville' } } };
const category = { _id: 'category-1', name: 'Standard', maxAdults: 2, numberOfBeds: 1, amenities: ['Wi-Fi'], rates: [{ _id: 'rate-1', rateType: 'public', amount: 35000, active: true }] };
const navigation = { replace: jest.fn() };
async function reachConfirmation() {
  fireEvent.press(screen.getByLabelText('Rechercher')); await waitFor(() => expect(screen.getByLabelText('Choisir Altitude Hôtel')).toBeTruthy()); fireEvent.press(screen.getByLabelText('Choisir Altitude Hôtel'));
  await waitFor(() => expect(screen.getByLabelText('Arrivée (AAAA-MM-JJ)')).toBeTruthy()); fireEvent.changeText(screen.getByLabelText('Arrivée (AAAA-MM-JJ)'), '2026-10-10'); fireEvent.changeText(screen.getByLabelText('Départ (AAAA-MM-JJ)'), '2026-10-12'); fireEvent.press(screen.getByLabelText('Rechercher les disponibilités'));
  await waitFor(() => expect(screen.getByLabelText(/Choisir Standard/)).toBeTruthy()); fireEvent.press(screen.getByLabelText(/Choisir Standard/)); fireEvent.press(screen.getByLabelText(/Choisir le tarif Tarif public/)); fireEvent.changeText(screen.getByLabelText('Prénom'), 'Ada'); fireEvent.changeText(screen.getByLabelText('Nom'), 'Lovelace'); fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.test'); fireEvent.press(screen.getByLabelText('Voir le résumé'));
}

describe('HotelBookingScreen — parcours public C/D.1.1', () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    searchPublicHotels.mockResolvedValue({ hotels: [hotel], total: 1, page: 1 });
    getPublicHotel.mockResolvedValue({ hotel, categories: [category] });
    getHotelAvailability.mockResolvedValue({ available: true, nights: [{ availableUnits: 3 }, { availableUnits: 3 }] });
    createHotelReservation.mockResolvedValue({ reservation: { _id: 'reservation-1', reference: 'RES-001' }, idempotent: false });
  });

  test('aucun identifiant technique n’est demandé et le parcours va jusqu’au détail', async () => {
    render(<HotelBookingScreen navigation={navigation} route={{ params: {} }} />);
    expect(screen.queryByLabelText(/identifiant/i)).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Nom de l’hôtel"), 'Altitude'); fireEvent.press(screen.getByLabelText('Rechercher'));
    await waitFor(() => expect(screen.getByLabelText('Choisir Altitude Hôtel')).toBeTruthy()); fireEvent.press(screen.getByLabelText('Choisir Altitude Hôtel'));
    await waitFor(() => expect(screen.getByLabelText('Arrivée (AAAA-MM-JJ)')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Arrivée (AAAA-MM-JJ)'), '2026-10-10'); fireEvent.changeText(screen.getByLabelText('Départ (AAAA-MM-JJ)'), '2026-10-12'); fireEvent.press(screen.getByLabelText('Rechercher les disponibilités'));
    await waitFor(() => expect(screen.getByLabelText(/Choisir Standard/)).toBeTruthy()); fireEvent.press(screen.getByLabelText(/Choisir Standard/)); fireEvent.press(screen.getByLabelText(/Choisir le tarif Tarif public/));
    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Ada'); fireEvent.changeText(screen.getByLabelText('Nom'), 'Lovelace'); fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.test'); fireEvent.press(screen.getByLabelText('Voir le résumé')); fireEvent.press(screen.getByLabelText('Confirmer la réservation'));
    await waitFor(() => expect(screen.getByText('Référence RES-001')).toBeTruthy()); fireEvent.press(screen.getByLabelText('Voir le détail'));
    expect(navigation.replace).toHaveBeenCalledWith('HotelReservationDetail', { reservationId: 'reservation-1' });
  });

  test('un retry après erreur conserve exactement la même clé', async () => {
    createHotelReservation.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ reservation: { _id: 'reservation-1', reference: 'RES-001' }, idempotent: true });
    render(<HotelBookingScreen navigation={navigation} route={{ params: {} }} />); await reachConfirmation();
    fireEvent.press(screen.getByLabelText('Confirmer la réservation')); await waitFor(() => expect(createHotelReservation).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByLabelText('Confirmer la réservation')); await waitFor(() => expect(createHotelReservation).toHaveBeenCalledTimes(2));
    expect(createHotelReservation.mock.calls.map((call) => call[1].reservationRequestId)).toEqual(['request-stable-1', 'request-stable-1']);
    expect(newReservationRequestId).toHaveBeenCalledTimes(1);
  });
});

describe('HotelBookingScreen — contexte verrouillé depuis HotelDetailScreen (PHASE-H2)', () => {
  const lockedNav = { replace: jest.fn(), goBack: jest.fn() };
  const lockedParams = {
    hotelId: 'hotel-1', roomCategoryId: 'category-1', ratePlanId: 'rate-1',
    checkInDate: '2026-10-10', checkOutDate: '2026-10-12', adults: 2, children: 0, roomsCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getPublicHotel.mockResolvedValue({ hotel, categories: [category] });
    createHotelReservation.mockResolvedValue({ reservation: { _id: 'reservation-1', reference: 'RES-002' }, idempotent: false });
  });

  test('saute directement aux informations client avec la catégorie/le tarif déjà choisis, sans permettre de les changer', async () => {
    render(<HotelBookingScreen navigation={lockedNav} route={{ params: lockedParams }} />);
    await waitFor(() => expect(screen.getByLabelText('Offre sélectionnée, non modifiable')).toBeTruthy());
    expect(screen.getByText('Standard · Tarif public')).toBeTruthy();
    expect(screen.getByText('2026-10-10 → 2026-10-12 · 2 nuit(s) · 1 chambre(s)')).toBeTruthy();
    // Aucun moyen de revenir choisir une autre catégorie/un autre tarif :
    // uniquement un retour à la fiche hôtel, jamais "Retour aux tarifs".
    expect(screen.queryByLabelText('Retour aux tarifs')).toBeNull();
    expect(screen.getByLabelText('Retour à la fiche hôtel')).toBeTruthy();
  });

  test('la réservation créée porte exactement la catégorie/le tarif/les dates fournis, jamais recalculés côté client', async () => {
    render(<HotelBookingScreen navigation={lockedNav} route={{ params: lockedParams }} />);
    await waitFor(() => expect(screen.getByLabelText('Offre sélectionnée, non modifiable')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Ada'); fireEvent.changeText(screen.getByLabelText('Nom'), 'Lovelace'); fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.test');
    fireEvent.press(screen.getByLabelText('Voir le résumé'));
    fireEvent.press(screen.getByLabelText('Confirmer la réservation'));
    await waitFor(() => expect(createHotelReservation).toHaveBeenCalledWith('hotel-1', expect.objectContaining({
      roomCategoryId: 'category-1', ratePlanId: 'rate-1', checkInDate: '2026-10-10', checkOutDate: '2026-10-12', adults: 2, children: 0, roomsCount: 1,
    })));
  });

  test('"Retour à la fiche hôtel" revient en arrière sans jamais rouvrir les étapes catégorie/tarif', async () => {
    render(<HotelBookingScreen navigation={lockedNav} route={{ params: lockedParams }} />);
    await waitFor(() => expect(screen.getByLabelText('Retour à la fiche hôtel')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Retour à la fiche hôtel'));
    expect(lockedNav.goBack).toHaveBeenCalled();
  });

  test('une offre qui n’existe plus dans la fiche hôtel (catégorie/tarif obsolète) échoue proprement, sans fallback silencieux', async () => {
    getPublicHotel.mockResolvedValue({ hotel, categories: [{ ...category, rates: [] }] });
    render(<HotelBookingScreen navigation={lockedNav} route={{ params: lockedParams }} />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Offre indisponible', expect.any(String)));
    expect(screen.queryByLabelText('Offre sélectionnée, non modifiable')).toBeNull();
  });
});
