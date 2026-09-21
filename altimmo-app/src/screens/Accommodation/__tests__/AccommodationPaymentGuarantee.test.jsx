import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AccommodationBookingScreen from '../AccommodationBookingScreen';
import { createAccommodationReservation, getAccommodationAvailability } from '../../../services/accommodationReservationService';

jest.mock('../../../services/accommodationReservationService', () => ({
  createAccommodationReservation: jest.fn(), getAccommodationAvailability: jest.fn(),
}));
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: { bg: '#fff', bgCard: '#fff', border: '#ddd', text: '#111', textSub: '#333', gold: '#b88700', success: 'green', warning: '#8a4b00' } }) }));
jest.mock('../../../components/Screen', () => { const RN = require('react-native'); return ({ children }) => <RN.View>{children}</RN.View>; });
jest.mock('../../../components/PageHeader', () => { const RN = require('react-native'); return ({ title }) => <RN.Text>{title}</RN.Text>; });
jest.mock('../../../components/Input', () => { const RN = require('react-native'); return ({ label, value, onChangeText }) => <RN.TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}/>; });
jest.mock('../../../components/ui/Button', () => { const RN = require('react-native'); return ({ label, onPress, disabled }) => <RN.Button title={label} onPress={onPress} disabled={disabled}/>; });

const navigation = { goBack: jest.fn(), replace: jest.fn() };
const quote = { data: { available: true, pricing: { nights: 5, nightlyRate: 50000, cleaningFee: 0, total: 250000, requiredToConfirm: 50000, currency: 'XAF' } }, offline: false };

beforeEach(() => { jest.clearAllMocks(); getAccommodationAvailability.mockResolvedValue(quote); });

test('affiche le récapitulatif serveur, la garantie et la règle non remboursable', async () => {
  render(<AccommodationBookingScreen navigation={navigation} route={{ params: { accommodationId: 'acc-1', title: 'Maison Mila' } }}/>);
  fireEvent.changeText(screen.getByLabelText('Arrivée (AAAA-MM-JJ)'), '2027-09-10');
  fireEvent.changeText(screen.getByLabelText('Départ (AAAA-MM-JJ)'), '2027-09-15');
  fireEvent.press(screen.getByText('Vérifier disponibilité et tarif'));
  await waitFor(() => expect(screen.getByText('À payer pour confirmer : 50 000 XAF')).toBeTruthy());
  expect(screen.getByText('5 nuit(s) × 50 000 XAF')).toBeTruthy();
  expect(screen.getByText('Total : 250 000 XAF')).toBeTruthy();
  expect(screen.getByText('Reste après garantie : 200 000 XAF')).toBeTruthy();
  expect(screen.getByText(/garantie non remboursable/i)).toBeTruthy();
});

test('le mobile envoie seulement les identifiants, dates et voyageurs, jamais prix/tenant/statut', async () => {
  createAccommodationReservation.mockResolvedValue({ _id: 'res-1', total: 250000, currency: 'XAF', paymentExpiresAt: '2027-09-01T12:00:00Z', pricingSnapshot: { requiredToConfirm: 50000 } });
  render(<AccommodationBookingScreen navigation={navigation} route={{ params: { accommodationId: 'acc-1', title: 'Maison Mila' } }}/>);
  fireEvent.changeText(screen.getByLabelText('Arrivée (AAAA-MM-JJ)'), '2027-09-10'); fireEvent.changeText(screen.getByLabelText('Départ (AAAA-MM-JJ)'), '2027-09-15');
  fireEvent.press(screen.getByText('Vérifier disponibilité et tarif')); await screen.findByText('Créer la demande (hold 2 h)');
  fireEvent.press(screen.getByText('Créer la demande (hold 2 h)'));
  await waitFor(() => expect(createAccommodationReservation).toHaveBeenCalled());
  expect(createAccommodationReservation.mock.calls[0][0]).toEqual(expect.objectContaining({ accommodation: 'acc-1', checkInDate: '2027-09-10', checkOutDate: '2027-09-15' }));
  expect(createAccommodationReservation.mock.calls[0][0]).not.toEqual(expect.objectContaining({ total: expect.anything(), tenant: expect.anything(), status: expect.anything() }));
  expect(await screen.findByText(/maintenue pendant 2 heures/i)).toBeTruthy();
});
